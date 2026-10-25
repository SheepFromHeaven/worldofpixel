import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BIOME_COLORS } from '../../../src/render/palette.ts';
import { MATERIALS, patchiness } from '../../../src/render/groundSprites.ts';
import type { Grain, Material } from '../../../src/render/groundSprites.ts';
import { affinityOf, densitiesAt, FORMS } from '../../../src/sim/cover.ts';
import {
  ecoScore,
  moistureScore,
  rainScore,
  rockScore,
  slopeScore,
  warmthFor,
  waterTableScore,
} from '../../../src/sim/eco.ts';
import { SEASONAL_PLANT_KINDS } from '../../../src/sim/seasons/seasonalRegistry.ts';
import { Biome, BIOME_NAMES } from '../../../src/sim/types.ts';
import { Cover } from '../../../src/sim/world.ts';
import { SEED, world } from '../context.ts';
import { BIOME_RGB, mono } from '../maps.ts';
import type { Page, PageLink } from '../page.ts';
import { callout, FORM_COLOURS, figure, flow, grid, img, SERIES, table } from '../page.ts';
import type { Rgb } from '../raster.ts';
import { hex, mix, OUT, renderMap } from '../raster.ts';
import { areaChart, bars, heatmap, legend, lineChart, niceTicks, samples } from '../svg.ts';

interface Entry {
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

interface Species {
  key: string;
  form: 'tree' | 'bush' | 'boulder' | 'mark';
  biome: Material | 'any';
  sprites: Entry[];
  weight: Record<string, number>;
  seasonKind: string;
}

const LAND = [Biome.Meadow, Biome.Forest, Biome.Highland, Biome.Marsh, Biome.Tundra, Biome.Desert] as const;

const KIND_LABEL: Record<string, string> = {
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

const MONTHS = ['mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb'];

const materialBiome = (material: string): Biome => MATERIALS.indexOf(material as Material) as Biome;

const percent = (v: number, digits = 1): string => `${(100 * v).toFixed(digits)}%`;

const slug = (key: string): string => key.replace(/[^a-z0-9]+/g, '-');

let everySprite: Entry[] = [];

function load(): { sheet: { width: number; height: number }; species: Species[] } {
  const manifest = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', '..', 'public', 'props', 'props.json'), 'utf8')) as {
    sheet: { width: number; height: number };
    props: Entry[];
  };
  everySprite = manifest.props;
  const byKey = new Map<string, Species>();
  for (const entry of manifest.props) {
    const key = entry.name.replace(/\.(low|mid|high)$/, '').replace(/\.v\d+/, '');
    const form = key.startsWith('tree.') ? 'tree' : key.startsWith('bush.') ? 'bush' : key.startsWith('boulder.') ? 'boulder' : null;
    const prefix = key.split('.')[0]!;
    const isMark = ['meadow', 'forest', 'highland', 'marsh', 'tundra', 'desert', 'path'].includes(prefix);
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

function ecoFigures(): string {
  const warmth = lineChart({
    x: { label: 'air temperature (C)', domain: [-15, 50], ticks: [-10, 0, 10, 20, 30, 40, 50] },
    y: { label: 'warmth score', domain: [0, 1] },
    series: [{ name: 'warmthFor', colour: SERIES.red, points: samples(-15, 50, 260, warmthFor) }],
    label: 'Warmth score by temperature',
    legend: false,
  });
  const water = lineChart({
    x: { label: 'rainfall units (wet)', domain: [0, 30], ticks: [0, 4, 10, 16, 24, 30] },
    y: { label: 'score', domain: [0, 1] },
    series: [{ name: 'rain', colour: SERIES.blue, points: samples(0, 30, 150, rainScore) }],
    label: 'Rain score by moisture',
    legend: false,
  });
  const table_ = lineChart({
    x: { label: 'tiles from fresh water', domain: [0, 40] },
    y: { label: 'score', domain: [0, 1] },
    series: [{ name: 'water table', colour: SERIES.blue, points: samples(0, 40, 160, (d) => waterTableScore(d) * 0.95) }],
    verticals: [{ at: 9, label: 'e-fold 9 tiles' }],
    label: 'Water table score by distance from fresh water',
    legend: false,
  });
  const slope = lineChart({
    x: { label: 'slope read over 16 tiles (metres per tile)', domain: [0, 60] },
    y: { label: 'score', domain: [0, 1] },
    series: [{ name: 'slopeScore', colour: SERIES.gold, points: samples(0, 60, 240, slopeScore) }],
    label: 'Slope score',
    legend: false,
  });
  const rock = lineChart({
    x: { label: 'altitude (0 sea level, 1 summit)', domain: [0, 1] },
    y: { label: 'score', domain: [0, 1] },
    series: [{ name: 'rockScore', colour: SERIES.grey, points: samples(0, 1, 200, rockScore) }],
    label: 'Rock penalty by altitude',
    legend: false,
  });
  const combined = heatmap({
    width: 480,
    height: 320,
    x: { label: 'air temperature (C)', domain: [-10, 45], ticks: [-10, 0, 10, 20, 30, 40] },
    y: { label: 'moisture (rainfall units)', domain: [4, 28], ticks: [4, 10, 16, 22, 28] },
    columns: 110,
    rows: 48,
    colourAt: (t, wet) => {
      const score = ecoScore(warmthFor(t), moistureScore(wet, 99), 1, 1, 0.85);
      const [r, g, b] = mix(hex('#e8dcc0'), hex('#2f6a3a'), Math.sqrt(score));
      return `rgb(${r},${g},${b})`;
    },
    label: 'Eco score over temperature and moisture on flat low ground',
  });
  return `${grid(
    figure(warmth, '<b>Warmth.</b> Zero below -8, full at 10, falling to nothing from 28 to 46. Below -8 nothing grows at all and the tile scores zero.'),
    figure(water, '<b>Rain.</b> Moisture above the dry floor of 4, over a range of 20, raised to 0.6 so the first rain counts most.'),
  )}
${grid(
    figure(table_, '<b>The water table.</b> Distance to a river or lake, as a decay. A river runs a grove through a desert because this curve keeps moisture high near it whatever the rain says. The best of rain and water table is the moisture.'),
    figure(slope, '<b>Slope.</b> Read over 16 tiles each way, because the field is too rough for anything shorter. Full below 12 m per tile, gone by 50.'),
  )}
${grid(
    figure(rock, '<b>Rock.</b> Above 0.55 altitude the soil thins: down to a fifth by 0.75.'),
    figure(combined, '<b>All together on flat lowland.</b> Pale is nothing growing, dark green is full growth. The product is why a cold wet tile and a hot dry one both score low.'),
  )}`;
}

function worldEcoFigures(): { maps: string; histogram: string } {
  const w = world();
  const { grid: g, eco, cover, biome } = w;
  const ecoMap = renderMap('eco-map.png', {
    columns: g.columns, rows: g.rows, step: 4,
    colourAt: (c, r) => {
      const i = g.at(c, r);
      if (biome[i]! >= Biome.Ocean || w.river[i] === 1) return hex('#7aa6bd');
      return mix(hex('#e8dcc0'), hex('#2f6a3a'), Math.sqrt(eco[i]! / 255));
    },
  });

  let best = { score: -1, c: 0, r: 0 };
  const SIZE = { c: 96, r: 64 };
  for (let r = 70; r < g.rows - 70 - SIZE.r; r += 16) {
    for (let c = 70; c < g.columns - 70 - SIZE.c; c += 16) {
      let rivers = 0;
      let dry = 0;
      let land = 0;
      for (let y = 0; y < SIZE.r; y += 2) {
        for (let x = 0; x < SIZE.c; x += 2) {
          const i = g.at(c + x, r + y);
          if (biome[i]! >= Biome.Ocean) continue;
          land += 1;
          if (w.river[i] === 1) rivers += 1;
          if (biome[i] === Biome.Desert || biome[i] === Biome.Meadow) dry += 1;
        }
      }
      const score = land > 0.95 * (SIZE.c / 2) * (SIZE.r / 2) && dry > 0.6 * land ? rivers : 0;
      if (score > best.score) best = { score, c, r };
    }
  }
  const crop = (name: string, colourAt: (i: number) => Rgb): string =>
    renderMap(name, { columns: SIZE.c, rows: SIZE.r, step: 1, zoom: 6, colourAt: (x, y) => colourAt(g.at(best.c + x, best.r + y)) });
  const ground = (i: number): Rgb => mix(BIOME_RGB[biome[i]!]!, [244, 241, 234], 0.55);
  const cropBiome = crop('eco-crop-biome.png', (i) => (w.river[i] === 1 ? hex('#6bb5c0') : BIOME_RGB[biome[i]!]!));
  const cropEco = crop('eco-crop-eco.png', (i) =>
    biome[i]! >= Biome.Ocean || w.river[i] === 1 ? hex('#6bb5c0') : mix(hex('#e8dcc0'), hex('#2f6a3a'), Math.sqrt(eco[i]! / 255)),
  );
  const coverColour: Record<number, Rgb> = {
    [Cover.Tree]: hex(FORM_COLOURS.tree).map((v) => Math.round(v * 0.55)) as unknown as Rgb,
    [Cover.Bush]: hex('#3f6b58'),
    [Cover.Scrub]: hex('#b9923c'),
    [Cover.Boulder]: hex('#6e6354'),
    [Cover.Grass]: hex('#a9c36f'),
    [Cover.Fallen]: hex('#7a5a3a'),
  };
  const cropCover = crop('eco-crop-cover.png', (i) => {
    if (w.river[i] === 1) return hex('#6bb5c0');
    if (biome[i]! >= Biome.Ocean) return hex('#6bb5c0');
    return coverColour[cover[i]!] ?? ground(i);
  });

  const bins = new Array<number>(16).fill(0);
  let landTiles = 0;
  for (let i = 0; i < g.count; i++) {
    if (biome[i]! >= Biome.Ocean || w.river[i] === 1) continue;
    landTiles += 1;
    const k = Math.min(15, eco[i]! >> 4);
    bins[k] = bins[k]! + 1;
  }
  const histogram = areaChart({
    height: 270,
    x: { label: 'eco score (0 to 255)', domain: [0, 256], ticks: [0, 64, 128, 192, 256] },
    y: { label: 'share of land tiles', domain: [0, Math.ceil((Math.max(...bins) / landTiles) * 20) / 20], format: (v) => percent(v, 0) },
    series: [{ name: 'land tiles', colour: FORM_COLOURS.tree, points: bins.flatMap((n, k) => [[k * 16, n / landTiles] as const, [k * 16 + 16, n / landTiles] as const]) }],
    label: 'Eco score histogram over land',
    legend: false,
  });

  const coverKey = legend([
    { name: 'tree', colour: `rgb(${coverColour[Cover.Tree]!.join(',')})` },
    { name: 'bush', colour: `rgb(${coverColour[Cover.Bush]!.join(',')})` },
    { name: 'scrub', colour: `rgb(${coverColour[Cover.Scrub]!.join(',')})` },
    { name: 'boulder', colour: `rgb(${coverColour[Cover.Boulder]!.join(',')})` },
    { name: 'grass', colour: `rgb(${coverColour[Cover.Grass]!.join(',')})` },
    { name: 'bare', colour: 'var(--shade)' },
    { name: 'water', colour: BIOME_COLORS[7]! },
  ]);

  return {
    maps: `${figure(img(ecoMap, 'Eco score over the whole world'), '<b>Eco over the world.</b> Pale tan is nothing, dark green is full growth. Rivers show as blue lines with a green margin either side. Highlands and cold ground fade out.', true)}
<p>Below, one patch of ground, 96 by 64 tiles, where a river crosses dry country. Left to right: the biome, the eco score, what stands on it.</p>
${grid(
  figure(img(cropBiome, 'Biome crop'), '<b>Biome.</b> Meadow and desert, with a river.'),
  figure(img(cropEco, 'Eco crop'), '<b>Eco.</b> The river brings a green strip with it, widening where it meets rain.'),
  figure(img(cropCover, 'Cover crop'), '<b>Cover.</b> Trees line the river, grass and scrub fill the rest.'),
)}${coverKey}`,
    histogram,
  };
}

function formCurves(): string {
  const panels = LAND.map((b) => {
    const affinity = affinityOf(b);
    const order = ['tree', 'bush', 'boulder', 'scrub', 'grass'] as const;
    const series = order.map((form) => ({
      name: form,
      colour: FORM_COLOURS[form],
      points: samples(0, 1, 100, (f) => densitiesAt(affinity, f)[form]),
    }));
    return figure(
      areaChart({
        width: 380,
        height: 260,
        x: { label: 'eco (0 to 1)', domain: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1] },
        y: { label: 'share of tiles', domain: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1], format: (v) => percent(v, 0) },
        series,
        legend: false,
        label: `Cover shares over eco in ${BIOME_NAMES[b]}`,
      }),
      `<b>${BIOME_NAMES[b]}.</b>`,
    );
  });
  const key = legend(FORMS.map((f) => ({ name: f, colour: FORM_COLOURS[f] })));
  return `${grid(...panels.slice(0, 3))}${grid(...panels.slice(3))}${key}`;
}

function affinityTable(): string {
  const cell = (v: number, form: string): string => {
    const [r, g, b] = mix([244, 241, 234], hex(FORM_COLOURS[form as keyof typeof FORM_COLOURS]), Math.min(1, v / 3));
    return `<td class="num" style="background:rgb(${r},${g},${b})">${v}</td>`;
  };
  return `<div class="tablewrap"><table><thead><tr><th>Biome</th>${FORMS.map((f) => `<th class="num">${f}</th>`).join('')}</tr></thead><tbody>${LAND.map(
    (b) => `<tr><td>${BIOME_NAMES[b]}</td>${FORMS.map((f) => cell(affinityOf(b)[f], f)).join('')}</tr>`,
  ).join('')}</tbody></table></div>`;
}

function predictedVersusMeasured(): string {
  const w = world();
  const { grid: g, eco, cover, biome } = w;
  const forms: readonly [string, Cover][] = [['tree', Cover.Tree], ['bush', Cover.Bush], ['scrub', Cover.Scrub], ['boulder', Cover.Boulder], ['grass', Cover.Grass]];
  const rows = LAND.map((b) => {
    const predicted: Record<string, number> = { tree: 0, bush: 0, scrub: 0, boulder: 0, grass: 0 };
    const measured: Record<string, number> = { tree: 0, bush: 0, scrub: 0, boulder: 0, grass: 0 };
    let n = 0;
    for (let i = 0; i < g.count; i += 1) {
      if (biome[i] !== b || w.river[i] === 1) continue;
      n += 1;
      const d = densitiesAt(affinityOf(b), eco[i]! / 255);
      for (const [form, code] of forms) {
        predicted[form] = predicted[form]! + d[form as keyof typeof d];
        if (cover[i] === code) measured[form] = measured[form]! + 1;
      }
    }
    return [BIOME_NAMES[b]!, ...forms.map(([form]) => `${percent(predicted[form]! / n)} <span class="muted">/ ${percent(measured[form]! / n)}</span>`)];
  });
  return table(['Biome', ...forms.map(([f]) => `${f} <small>predicted / measured</small>`)], rows);
}

function sprite(entry: Entry, sheet: { width: number; height: number }, scale: number, title = entry.name): string {
  return `<span class="sprite" title="${title}" style="width:${entry.size * scale}px;height:${entry.size * scale}px;background-image:url(img/props-albedo.png);background-size:${sheet.width * scale}px ${sheet.height * scale}px;background-position:-${entry.x * scale}px -${entry.y * scale}px"></span>`;
}

function seasonSeries(kind: string): { name: string; points: [number, number][] }[] {
  const plant = SEASONAL_PLANT_KINDS.find((p) => p.kindName === kind)!;
  const read: [string, (s: ReturnType<typeof plant.stateAt>) => number][] = [
    ['leaf loss', (s) => s.leafLoss],
    ['autumn colour', (s) => s.autumnColour],
    ['blossom', (s) => s.blossomAmount],
    ['fruit ripeness', (s) => s.fruitRipeness],
    ['straw dryness', (s) => s.strawDryness],
    ['falling leaves', (s) => s.fallingLeavesPerSecond],
    ['leaf litter', (s) => s.leafLitterOnGround],
    ['present', (s) => (s.visibility.kind === 'fractionOfTexelsKept' ? s.visibility.fraction : Math.max(0, s.visibility.toFraction - s.visibility.fromFraction))],
  ];
  return read
    .map(([name, f]) => ({ name, points: samples(0, 1, 240, (x) => f(plant.stateAt(Math.min(0.9999, x)))) }))
    .filter((s) => {
      const values = s.points.map((p) => p[1]);
      return Math.max(...values) - Math.min(...values) > 1e-6;
    });
}

const SEASON_COLOURS = [SERIES.red, SERIES.gold, SERIES.violet, SERIES.blue, SERIES.green, SERIES.grey, SERIES.ink, SERIES.green];

function seasonChart(kind: string, width = 420, height = 250): string {
  const series = seasonSeries(kind);
  if (series.length === 0) return '<p class="muted">Nothing changes with the year.</p>';
  return lineChart({
    width,
    height,
    x: { label: 'year, from 1 march', domain: [0, 1], ticks: MONTHS.map((_, i) => i / 12), format: (v) => MONTHS[Math.round(v * 12)] ?? '' },
    y: { label: 'amount', domain: [0, 1], ticks: [0, 0.5, 1] },
    series: series.map((s, i) => ({ ...s, colour: SEASON_COLOURS[i % SEASON_COLOURS.length]! })),
    label: `Seasonal state of a ${kind} over the year`,
  });
}

function speciesCard(s: Species, all: Species[], sheet: { width: number; height: number }): string {
  const mid = (suffix: string): Entry | undefined => s.sprites.find((e) => e.name.endsWith(suffix) && e.name.includes('.v0'));
  const lead = s.sprites.find((e) => e.name.includes('.v0') && e.name.endsWith('.mid')) ?? s.sprites[0]!;
  const scale = Math.max(1, Math.floor(60 / lead.size));
  const shots: string[] = [];
  if (s.form === 'tree' || s.form === 'bush' || s.form === 'boulder') {
    for (const storey of ['low', 'mid', 'high']) {
      const e = mid(`.${storey}`);
      if (e) shots.push(sprite(e, sheet, scale, `${storey} storey`));
    }
  } else {
    for (const e of s.sprites.slice(0, 3)) shots.push(sprite(e, sheet, scale, e.name));
  }
  const twins = ['bud', 'seed'].map((t) => everySprite.find((e) => e.name === `${s.key}.${t}.v0`)).filter((e): e is Entry => !!e);
  for (const t of twins) shots.push(`<span class="muted">→</span>${sprite(t, sheet, scale, t.name)}`);
  const bare = everySprite.find((e) => e.name === s.key.replace('tree.', 'bare.') + '.v0.mid');
  if (bare && s.key.startsWith('tree.oak')) shots.push(`<span class="muted">winter</span>${sprite(bare, sheet, scale, 'bare twin')}`);

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

function flowerPatches(species: Species[]): string {
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

export const LINK: PageLink = {
  slug: 'ecosystem',
  title: 'Ecosystem',
  summary: 'How well things grow, what stands on each tile, and every plant species with its density curve.',
};

export function build(): Page {
  const { sheet, species } = load();
  mkdirSync(join(OUT, 'img'), { recursive: true });
  copyFileSync(join(import.meta.dirname, '..', '..', '..', 'public', 'props', 'albedo.png'), join(OUT, 'img', 'props-albedo.png'));

  const trees = species.filter((s) => s.form === 'tree');
  const bushes = species.filter((s) => s.form === 'bush');
  const boulders = species.filter((s) => s.form === 'boulder');
  const marks = species.filter((s) => s.form === 'mark');
  const order = ['meadow', 'forest', 'highland', 'marsh', 'tundra', 'desert', 'path'];
  const sortedMarks = [...marks].sort((a, b) => order.indexOf(a.biome) - order.indexOf(b.biome));
  const { maps, histogram } = worldEcoFigures();
  const cards = [...trees, ...bushes, ...boulders, ...sortedMarks].map((s) => speciesCard(s, species, sheet)).join('');
  const kinds = SEASONAL_PLANT_KINDS.filter((k) => seasonSeries(k.kindName).length > 0);

  return {
    ...LINK,
    lede: `Plants are not placed by hand. Each tile gets a growth score from its climate and water, rolls a form from that score, and a species is picked for the form. ${species.length} species are baked into the game. This page shows how a tile gets from numbers to a plant, and gives every species its own curve.`,
    code: ['src/sim/eco.ts', 'src/sim/cover.ts', 'src/render/groundSprites.ts', 'src/pixel/ground/plants.ts', 'src/sim/seasons/'],
    sections: [
      {
        id: 'how',
        title: 'How a tile gets its plants',
        html: `${flow([
          { title: 'Eco', text: 'A 0 to 255 score from warmth, rain, water table, slope and rock.' },
          { title: 'Cover', text: 'Per tile, a roll picks bare, grass, scrub, bush, tree or boulder.' },
          { title: 'Species', text: 'A tree tile picks a tree weighted by the biome. Same for bush and boulder.' },
          { title: 'Marks', text: 'Flowers, tufts, ferns and stones are scattered by density, in patches.' },
          { title: 'Season', text: 'Each species answers with what it looks like on this day of the year.' },
        ])}
<p><b>The data is flat arrays.</b> <code>world.eco</code> and <code>world.cover</code> are one byte per tile. They are derived from the field on every load and never saved, except what the player has changed (felled, cleared, trodden). Everything on this page is a pure function of tile and seed, so clearing a tile removes exactly what stood there and the same world always grows the same woods.</p>`,
      },
      {
        id: 'eco',
        title: 'Eco: how well things grow',
        html: `<p>The score is a product, so one bad factor is enough to stop growth:</p>
<p style="font-size:18px"><code>eco = warmth<sup>0.6</sup> &times; moisture<sup>0.7</sup> &times; slope &times; rock &times; soil</code></p>
<p>It is zero on water and wherever the warmth is zero. Soil is a noise between 0.7 and 1, a wave 38 tiles across, so equal ground is never perfectly equal.</p>
${ecoFigures()}
${maps}
<h3>How much land is fertile</h3>
${figure(histogram, '<b>Most land is poor.</b> The score is a product of five factors that are each below one, so it bunches low, which is what leaves a few green places to be worth something.')}`,
      },
      {
        id: 'cover',
        title: 'Cover: what stands on a tile',
        html: `<p>Five forms compete for a tile: tree, bush, scrub, boulder and grass. Each biome has an <b>affinity</b> for each form, and each form has a density curve over eco. The affinity scales the curve:</p>
${affinityTable()}
<p>The curves are the same for every biome and only their height changes. A tree wants fertile ground (zero below 0.12, full above 0.55). A bush likes the middle, peaking at 0.6. Scrub peaks at 0.3, on poorer ground. Boulders do better the worse the ground is. Grass needs only a little.</p>
${callout('<p><b>The roll is one number per tile.</b> The tile rolls once, from 0 to 1, and the forms are laid end to end in this order: tree, bush, boulder, scrub, grass. Wherever the roll lands is the cover. Trees and bushes are first, so they take what they want and the later forms get what is left, which is why a woodland has no room for grass.</p><p>Trees and bushes are also multiplied by a clump noise 14 tiles across (0.5 to 1.5), so woods come out as woods and not an even scatter. The curves below leave it out, at its average of 1.</p>')}
${formCurves()}
<h3>Does the prediction hold?</h3>
<p>The average density the curves give over every tile of a biome, next to what the generator actually put there on this seed. The two agree to a tenth of a percent, except for grass in forest and marsh. There the earlier forms already fill most of the roll, the stack in the charts above runs past 100% and the last form is cut off, so grass comes in under its curve.</p>
${predictedVersusMeasured()}`,
      },
      {
        id: 'species',
        title: 'Every species',
        html: `<p>${trees.length} trees, ${bushes.length} bushes, ${boulders.length} boulders and ${marks.length} ground marks. Sprites are the baked albedo, one per storey for the big ones (low, mid and high stand at different heights and cast different shadows).</p>
<p><b>Trees, bushes and boulders</b> have two faces: the <i>share</i> bars say how likely this species is to be the one picked when a tile has that form, and the curve multiplies it by the biome's density curve to give the share of all tiles the species holds as eco rises. A line per biome it grows in. <b>Marks</b> are not rolled by tile. Each has a density a tile in the biome it belongs to, multiplied by a patch field (shown as a map, dark where it grows).</p>
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
      {
        id: 'seasons',
        title: 'The year',
        html: `<p>Every species belongs to a <b>seasonal kind</b>. A kind answers one question, <code>stateAt(yearFraction)</code>, with an amount for each of leaf loss, autumn colour, blossom, fruit, straw dryness and so on, and how much of the plant is present. Year zero is the first of March. The shaders read a small table built from this each frame, and the northern and southern hemispheres each get their own table, so trees at the equator are a patchwork of autumn and spring.</p>
<div class="grid-2">${kinds
  .map((k) => {
    const members = species.filter((s) => s.seasonKind === k.kindName).length;
    const note = k.kindName === 'bud' || k.kindName === 'seed' ? 'The twin sprite of each flower.' : `${members} species${k.kindName === 'flower' ? ', each with a bud and a seed head twin' : ''}.`;
    return figure(seasonChart(k.kindName), `<b>${KIND_LABEL[k.kindName] ?? k.kindName}.</b> ${note}`);
  })
  .join('')}</div>
<p>A deciduous tree is not a thinned crown but a crown that comes off: each oak has a bare twin baked in the same footprint, drawn under the canopy whenever the leaves are going. A flower is not a crown that comes off, so it <b>changes sprite</b> instead: bud, bloom and seed head are three sprites, and a per-flower hash decides which one shows. The bar for 'present' on those charts is the share of flowers showing that sprite.</p>`,
      },
      {
        id: 'felled',
        title: 'What changes the ground',
        html: `<p>Everything above is the world as generated. Four things rewrite it afterwards, each stamping the 64 tile block it touches so the painter re-bakes that chunk and nothing else: a storm or an <code>uproot</code> turns <code>Cover.Tree</code> into <code>Cover.Fallen</code> (the tile then draws a log with its root plate), a person chopping clears it, a fire clears and treads the tile bare, and walking wears a path. Each tree also carries a <b>trunk</b> sprite drawn under the canopy from the zoom where canopies start to dither away, so as they go the stump they stood on is what shows.</p>`,
      },
    ],
  };
}
