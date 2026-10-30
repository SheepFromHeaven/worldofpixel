import { createHash } from 'node:crypto';
import { LIT_PROPS } from '../src/pixel/ground/index.ts';
import { BUILDING_ARTS } from '../src/content/buildings/art.ts';
import { bakeItem, isItem } from '../src/render/lit/growth/itemBake.ts';
import { bakeMarker, isMarker } from '../src/render/lit/growth/markerBake.ts';
import type { Sheets } from '../src/render/lit/obliqueCanvas.ts';
import type { SpriteSheetEntry } from '../src/render/lit/propPlacementCache.ts';
import { packSheet } from './propSheet.ts';

const hash = (...parts: (Uint8Array | string | undefined)[]): string => {
  const h = createHash('sha1');
  for (const part of parts) if (part !== undefined) h.update(part);
  return h.digest('hex').slice(0, 10);
};

const lines: string[] = [];
for (const prop of LIT_PROPS) lines.push(`prop ${prop.name} ${prop.size} ${prop.height} ${prop.torchShadow ? 'T' : '-'}${prop.emit ? 'E' : '-'} ${hash(prop.albedo, prop.normals)}`);

const sheet = packSheet();
const sheets = { albedo: { width: sheet.width, height: sheet.height, data: sheet.albedo }, normals: { width: sheet.width, height: sheet.height, data: sheet.normals } } as unknown as Sheets;
for (const entry of sheet.props) {
  const plan = entry as unknown as SpriteSheetEntry;
  const registered = BUILDING_ARTS.flatMap((art) => art.bakes ?? []).find((candidate) => candidate.match(entry.name));
  const baked = isItem(entry.name) ? bakeItem(sheets, plan) : registered ? registered.bake(sheets, plan) : isMarker(entry.name) ? bakeMarker(sheets, plan) : null;
  if (baked) lines.push(`body ${entry.name} ${baked.size} ${hash(baked.albedo, baked.normals, baked.woodAlbedo, baked.woodNormals)}`);
}
console.log(lines.sort().join('\n'));
