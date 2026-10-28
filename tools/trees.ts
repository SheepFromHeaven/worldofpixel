import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { encodePng } from '../src/pixel/png.ts';
import { bakeGrown, isGrown } from '../src/render/lit/growth/bake.ts';
import { packBaked } from '../src/render/lit/obliqueAtlas.ts';
import type { Baked, Sheets } from '../src/render/lit/obliqueCanvas.ts';
import type { SpriteSheetEntry } from '../src/render/lit/propPlacementCache.ts';
import { TREE_VIEW } from '../src/render/lit/treeView.ts';
import { packSheet } from './propSheet.ts';

const directory = resolve(process.cwd(), 'public/trees');
mkdirSync(directory, { recursive: true });

const sheet = packSheet();
const sheets = {
  albedo: { width: sheet.width, height: sheet.height, data: sheet.albedo },
  normals: { width: sheet.width, height: sheet.height, data: sheet.normals },
} as unknown as Sheets;
const entries = new Map(sheet.props.map((entry) => [entry.name, entry as unknown as SpriteSheetEntry]));

const TREE_NAME = /^tree\.([a-z]+)\.v(\d+)\.([a-z]+)$/;
const byArt = new Map<string, Map<string, Baked>>();
const started = performance.now();
for (const entry of sheet.props) {
  const match = TREE_NAME.exec(entry.name);
  if (!match || !isGrown(match[1]!)) continue;
  const [, art, , storey] = match as unknown as [string, string, string, string];
  const baked = bakeGrown(sheets, art, storey, entry as unknown as SpriteSheetEntry, entries.get(`trunk.${art}.${storey}`), entry.name);
  (byArt.get(art) ?? byArt.set(art, new Map()).get(art)!).set(entry.name, baked);
}

const manifest: { k: number; arts: Record<string, unknown> } = { k: TREE_VIEW.k, arts: {} };
let bytes = 0;
for (const [art, baked] of [...byArt].sort(([a], [b]) => a.localeCompare(b))) {
  const atlas = packBaked(baked);
  writeFileSync(resolve(directory, `${art}.albedo.png`), encodePng(atlas.albedo, atlas.width, atlas.height));
  writeFileSync(resolve(directory, `${art}.normals.png`), encodePng(atlas.normals, atlas.width, atlas.height));
  bytes += atlas.width * atlas.height * 8;
  const sprites: Record<string, unknown> = {};
  for (const [name, placed] of atlas.placed) {
    const plan = entries.get(name)!;
    sprites[name] = {
      x: placed.x,
      y: placed.y,
      size: placed.size,
      foot: placed.foot,
      layered: placed.layered,
      low: placed.low,
      high: placed.high,
      height: plan.height,
      sway: plan.sway,
      canopy: plan.canopy,
      bend: plan.bend,
      hides: plan.hides ?? false,
      season: plan.season,
    };
  }
  manifest.arts[art] = { width: atlas.width, height: atlas.height, sprites };
  console.log(`  ${art.padEnd(9)} ${String(baked.size).padStart(2)} sprites -> ${atlas.width} x ${atlas.height}`);
}
writeFileSync(resolve(directory, 'trees.json'), `${JSON.stringify(manifest)}\n`);
console.log(`trees: ${[...byArt.values()].reduce((sum, baked) => sum + baked.size, 0)} sprites in ${byArt.size} atlases, ${(bytes / 1e6).toFixed(1)} MB raw, ${((performance.now() - started) / 1000).toFixed(1)} s`);
