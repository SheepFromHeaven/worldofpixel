import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BIOME_COLORS } from '../../src/render/palette.ts';
import { MATERIALS, patchiness, spriteKind } from '../../src/render/groundSprites.ts';
import type { Grain, Material } from '../../src/render/groundSprites.ts';
import { affinityOf, densitiesAt } from '../../src/sim/cover.ts';
import { SPECIES } from '../../src/sim/plants/species.ts';
import { SEASONAL_PLANT_KINDS } from '../../src/sim/seasons/seasonalRegistry.ts';
import { Biome } from '../../src/sim/types.ts';
import { SEED } from './context.ts';
import { mono } from './maps.ts';
import type { Section } from './page.ts';
import { figure, img } from './page.ts';
import { hex, mix, OUT, renderMap } from './raster.ts';
import { bars, legend, lineChart, niceTicks, samples } from './svg.ts';

export interface Entry {
  name: string;
  x: number;
  y: number;
  size: number;
  height: number;
  sway: number;
  season: number;
  density: Record<string, number>;
  grain: Grain[];
}

export interface Species {
  key: string;
  form: 'tree' | 'bush' | 'boulder' | 'mark';
  biome: string;
  sprites: Entry[];
  weight: Record<string, number>;
  seasonKind: string;
}


export const KIND_LABEL: Record<string, string> = {
  evergreen: 'evergreen, never changes',
  deciduous: 'deciduous tree',
  shrub: 'flowering shrub',
  berry: 'berry bush',
  grass: 'grass, dries to straw',
  flower: 'flower in bloom',
  bud: 'flower bud',
  seed: 'flower seed head',
  fern: 'fern',
};


export const materialBiome = (material: string): Biome => MATERIALS.indexOf(material as Material) as Biome;

export const percent = (v: number, digits = 1): string => `${(100 * v).toFixed(digits)}%`;

export const slug = (key: string): string => key.replace(/[^a-z0-9]+/g, '-');

let everySprite: Entry[] = [];


export function load(): { sheet: { width: number; height: number }; species: Species[] } {
  const manifest = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'public', 'props', 'props.json'), 'utf8')) as {
    sheet: { width: number; height: number };
    props: Entry[];
  };
  everySprite = manifest.props;
  const byKey = new Map<string, Species>();
  for (const entry of manifest.props) {
    const key = entry.name.replace(/\.(sapling|young|low|mid|high)$/, '').replace(/\.v\d+/, '');
    const form = key.startsWith('tree.') ? 'tree' : key.startsWith('bush.') ? 'bush' : key.startsWith('boulder.') ? 'boulder' : null;
    const prefix = key.split('.')[0]!;
    const isMark = ['meadow', 'forest', 'highland', 'marsh', 'swamp', 'tundra', 'desert', 'path'].includes(prefix);
    if (!form && !isMark) continue;
    if (/\.(bud|seed)$/.test(key)) continue;
    const known = byKey.get(key);
    const species: Species = known ?? {
      key,
      form: form ?? 'mark',
      biome: isMark ? (prefix as Material) : 'any',
      sprites: [],
      weight: {},
      seasonKind: SEASONAL_PLANT_KINDS[entry.season]?.kindName ?? 'evergreen',
    };
    species.sprites.push(entry);
    for (const [material, value] of Object.entries(entry.density)) species.weight[material] = (species.weight[material] ?? 0) + value;
    byKey.set(key, species);
  }
  return { sheet: manifest.sheet, species: [...byKey.values()] };
}


export function sprite(entry: Entry, sheet: { width: number; height: number }, scale: number, title = entry.name): string {
  return `<span class="sprite" title="${title}" style="width:${entry.size * scale}px;height:${entry.size * scale}px;background-image:url(img/props-albedo.png);background-size:${sheet.width * scale}px ${sheet.height * scale}px;background-position:-${entry.x * scale}px -${entry.y * scale}px"></span>`;
}


export function speciesCard(s: Species, all: Species[], sheet: { width: number; height: number }): string {
  const mid = (suffix: string): Entry | undefined => s.sprites.find((e) => e.name.endsWith(suffix) && e.name.includes('.v0'));
  const lead = s.sprites.find((e) => e.name.includes('.v0') && e.name.endsWith('.mid')) ?? s.sprites[0]!;
  const scale = Math.max(1, Math.floor(60 / lead.size));
  const shots: string[] = [];
  if (s.form === 'tree' || s.form === 'bush' || s.form === 'boulder') {
    for (const storey of ['sapling', 'young', 'low', 'mid', 'high']) {
      const e = mid(`.${storey}`);
      if (e) shots.push(sprite(e, sheet, scale, `${storey} storey`));
    }
  } else {
    for (const e of s.sprites.slice(0, 3)) shots.push(sprite(e, sheet, scale, e.name));
  }
  const twins = ['bud', 'seed'].map((t) => everySprite.find((e) => e.name === `${s.key}.${t}.v0`)).filter((e): e is Entry => !!e);
  for (const t of twins) shots.push(`<span class="muted">→</span>${sprite(t, sheet, scale, t.name)}`);
  const bare = everySprite.find((e) => e.name === s.key.replace('tree.', 'bare.') + '.v0.mid');
  if (bare && s.key.startsWith('tree.')) shots.push(`<span class="muted">winter</span>${sprite(bare, sheet, scale, 'bare twin')}`);

  const materials = Object.entries(s.weight).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  let body = '';
  if (s.form === 'mark') {
    const peak = Math.max(...materials.map(([, v]) => v));
    body += bars(
      materials.map(([m, v]) => ({ label: m, value: v, colour: BIOME_COLORS[materialBiome(m)] ?? 'var(--ink)' })),
      Math.max(peak, 0.5),
      (v) => v.toFixed(2),
    );
    const grain = lead.grain;
    const map = renderMap(`patch-${slug(s.key)}.png`, {
      columns: 96, rows: 96, step: 1, zoom: 1,
      colourAt: (c, r) => mono(Math.min(1, patchiness(SEED, grain, 900 + c, 500 + r) / 4), [244, 241, 234], hex(BIOME_COLORS[materialBiome(materials[0]![0])] ?? '#3b352c')),
    });
    body += `<div class="row"><img src="${map}" alt="Patch field of ${s.key}" style="image-rendering:pixelated;border:1px solid var(--shade)"><dl><dt>density</dt><dd>${materials.map(([m, v]) => `${v.toFixed(2)} a tile on ${m}`).join(', ')}</dd><dt>patches</dt><dd>${grain.map((l) => `${l.scale} tiles across, ${percent(l.cover, 0)} covered`).join('; ')}</dd></dl></div>`;
  } else if (s.form === 'tree') {
    const art = spriteKind(s.key);
    const users = SPECIES.filter((p) => p.art === art || p.snowArt === art);
    body += `<dl><dt>drawn for</dt><dd>${users.map((p) => p.name).join(', ') || 'none'}</dd><dt>variants</dt><dd>${s.sprites.length / 5 | 0} shapes, five growth stages</dd></dl>`;
  } else {
    const form = s.form;
    const family = all.filter((o) => o.form === form);
    const rows = materials.map(([m, v]) => {
      const total = family.reduce((sum, o) => sum + (o.weight[m] ?? 0), 0);
      return { m, share: v / total };
    });
    body += `<dl><dt>share of ${form} tiles</dt><dd></dd></dl>`;
    body += bars(
      rows.map((r) => ({ label: r.m, value: r.share, colour: BIOME_COLORS[materialBiome(r.m)] ?? 'var(--ink)' })),
      1,
      (v) => percent(v, 0),
    );
    const curves = rows.map((r) => ({
      name: r.m,
      colour: BIOME_COLORS[materialBiome(r.m)]!,
      points: samples(0, 1, 100, (f) => 100 * densitiesAt(affinityOf(materialBiome(r.m)), f)[form] * r.share),
    }));
    const peak = Math.max(...curves.flatMap((c) => c.points.map((p) => p[1])));
    const ceiling = niceTicks(0, peak * 1.05, 4).at(-1) ?? peak;
    body += lineChart({
      width: 300,
      height: 160,
      x: { label: 'eco', domain: [0, 1], ticks: [0, 0.5, 1] },
      y: { label: '% of tiles', domain: [0, Math.max(ceiling, peak * 1.02)], ticks: niceTicks(0, ceiling, 3) },
      series: curves,
      legend: false,
      label: `Expected share of tiles occupied by ${s.key}, over eco`,
    });
    body += legend(rows.map((r) => ({ name: r.m, colour: BIOME_COLORS[materialBiome(r.m)]! })));
  }
  body += `<dl><dt>height</dt><dd>${lead.height.toFixed(1)} m</dd><dt>sways</dt><dd>${lead.sway === 0 ? 'never' : lead.sway.toFixed(1)}</dd><dt>seasons</dt><dd>${KIND_LABEL[s.seasonKind] ?? s.seasonKind}</dd></dl>`;

  const filter = s.form === 'mark' ? s.biome : s.form;
  return `<div class="card" data-group="${filter}"><h4>${(s.form === 'tree' || s.form === 'mark' ? s.key.replace(/^[a-z]+\./, '') : s.key).replace(/\./g, ' ')}</h4><div class="id">${s.key}</div><div class="sprites">${shots.join('')}</div>${body}</div>`;
}


export function flowerPatches(species: Species[]): string {
  const flowers = species.filter((s) => s.key.startsWith('meadow.flowers.'));
  const colours = flowers.map((f) => hex({ yellow: '#e0b030', white: '#ffffff', red: '#c05140', blue: '#4a7bb0' }[f.key.split('.')[2]!] ?? '#000000'));
  const map = renderMap('flower-patches.png', {
    columns: 192, rows: 128, step: 1, zoom: 4,
    colourAt: (c, r) => {
      let top = 0.3;
      let at = -1;
      flowers.forEach((f, k) => {
        const d = (f.weight.meadow ?? 0) * patchiness(SEED, f.sprites[0]!.grain, 400 + c, 300 + r);
        if (d > top) { top = d; at = k; }
      });
      return at < 0 ? hex('#8aa65c') : mix(hex('#8aa65c'), colours[at]!, 0.9);
    },
  });
  return figure(img(map, 'Where each flower colour grows in a meadow'), '<b>A meadow in patches.</b> Meadow ground, 192 by 128 tiles. Yellow and white each have their own field inside one large shared one, red and blue sit rarer. Where nothing beats a threshold the meadow stays plain.', true);
}



export function encyclopediaSections(): Section[] {
  const { sheet, species } = load();
  mkdirSync(join(OUT, 'img'), { recursive: true });
  copyFileSync(join(import.meta.dirname, '..', '..', 'public', 'props', 'albedo.png'), join(OUT, 'img', 'props-albedo.png'));

  const trees = species.filter((s) => s.form === 'tree');
  const bushes = species.filter((s) => s.form === 'bush');
  const boulders = species.filter((s) => s.form === 'boulder');
  const marks = species.filter((s) => s.form === 'mark');
  const order = ['meadow', 'forest', 'highland', 'marsh', 'swamp', 'tundra', 'desert', 'path'];
  const sortedMarks = [...marks].sort((a, b) => order.indexOf(a.biome) - order.indexOf(b.biome));
  const cards = [...trees, ...bushes, ...boulders, ...sortedMarks].map((s) => speciesCard(s, species, sheet)).join('');
  return [
      {
        id: 'species',
        title: 'Every species',
        html: `<p>${trees.length} trees, ${bushes.length} bushes, ${boulders.length} boulders and ${marks.length} ground marks. Sprites are the baked albedo, one per storey for the big ones (low, mid and high stand at different heights and cast different shadows).</p>
<p><b>Trees</b> show their niche and where the kind actually stands on this seed. <b>Bushes and boulders</b> have two faces: the <i>share</i> bars say how likely this species is to be the one picked when a tile has that form, and the curve multiplies it by the biome's density curve to give the share of all tiles the species holds as eco rises. A line per biome it grows in. <b>Marks</b> are not rolled by tile. Each has a density a tile in the biome it belongs to, multiplied by a patch field (shown as a map, dark where it grows).</p>
<div class="filters" id="filters"><button data-filter="all" aria-pressed="true">all</button><button data-filter="tree" aria-pressed="false">trees</button><button data-filter="bush" aria-pressed="false">bushes</button><button data-filter="boulder" aria-pressed="false">boulders</button>${order.map((m) => `<button data-filter="${m}" aria-pressed="false">${m} marks</button>`).join('')}</div>
<div class="cards" id="cards">${cards}</div>
<script>
const buttons = document.querySelectorAll('#filters button');
const cards = document.querySelectorAll('#cards .card');
for (const button of buttons) button.addEventListener('click', () => {
  for (const b of buttons) b.setAttribute('aria-pressed', String(b === button));
  for (const card of cards) card.hidden = button.dataset.filter !== 'all' && card.dataset.group !== button.dataset.filter;
});
</script>`,
      },
      {
        id: 'patches',
        title: 'Marks grow in patches',
        html: `<p>A flat mark's density in a tile is its weight times a <b>patch field</b> (<code>patchiness</code>), then rounded stochastically: a density of 0.4 puts one mark in four tiles. The field is one or more layers of value noise, each with a scale in tiles and a cover, multiplied together and scaled up to keep the mean. Flowers share one big field and each colour has its own inside it. Ferns and mushrooms clump tighter. Cacti and boulders get a wide, loose field and half the density, so they stand apart.</p>
${flowerPatches(species)}
<p>The noise is seeded by the world and is a pure function of the tile, so a patch is the same wherever you come at it from.</p>`,
      },
  ];
}
