import { BIOME_COLORS } from '../../../src/render/palette.ts';
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
import { AQUA_NAMES, FASTEST_FLOW, suitability } from '../../../src/sim/aquatic.ts';
import { SEASONAL_PLANT_KINDS } from '../../../src/sim/seasons/seasonalRegistry.ts';
import { Biome, BIOME_NAMES } from '../../../src/sim/types.ts';
import { Cover } from '../../../src/sim/world.ts';
import { load, KIND_LABEL, percent } from '../encyclopedia.ts';
import { world } from '../context.ts';
import { BIOME_RGB } from '../maps.ts';
import type { Page, PageLink } from '../page.ts';
import { callout, FORM_COLOURS, figure, flow, grid, img, SERIES, table } from '../page.ts';
import type { Rgb } from '../raster.ts';
import { hex, mix, renderMap } from '../raster.ts';
import { areaChart, heatmap, legend, lineChart, samples } from '../svg.ts';

const LAND = [Biome.Meadow, Biome.Forest, Biome.Highland, Biome.Marsh, Biome.Tundra, Biome.Desert] as const;

const MONTHS = ['mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb'];

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

const WATER_COLOURS: readonly string[] = ['', '#6f9a3c', '#c2607f', '#a3b862', '#2f8a72', '#8a6238', '#7a8c9a'];

type WaterConditions = Parameters<typeof suitability>[0];

function waterSection(): string {
  const w = world();
  const lake: WaterConditions = { celsius: 16, depth: 1, shore: 4, flow: 0, salt: false, bank: false };
  const river: WaterConditions = { celsius: 16, depth: 0.7, shore: 0, flow: 0.5, salt: false, bank: false };
  const sea: WaterConditions = { celsius: 16, depth: 3, shore: 6, flow: 0, salt: true, bank: false };
  const series = (kinds: readonly number[], from: number, to: number, at: (x: number, kind: number) => WaterConditions) =>
    kinds.map((kind) => ({ name: AQUA_NAMES[kind]!, colour: WATER_COLOURS[kind]!, points: samples(from, to, 120, (x) => suitability(at(x, kind))[kind]!) }));

  const flow = lineChart({
    x: { label: 'current (metres per second)', domain: [0, FASTEST_FLOW] },
    y: { label: 'suitability', domain: [0, 1] },
    series: series([1, 2, 3, 6], 0, FASTEST_FLOW, (x, kind) => ({ ...river, flow: x, bank: kind === 1 })),
    label: 'Suitability of a river tile by current',
  });
  const depth = lineChart({
    x: { label: 'depth (metres)', domain: [0, 6] },
    y: { label: 'suitability', domain: [0, 1] },
    series: series([1, 2, 3], 0, 6, (x) => ({ ...lake, depth: x })),
    label: 'Suitability of a still lake by depth',
  });
  const seaDepth = lineChart({
    x: { label: 'depth (metres)', domain: [0, 26] },
    y: { label: 'suitability', domain: [0, 1] },
    series: [
      ...series([4], 0, 26, (x) => ({ ...sea, depth: x, celsius: 20 })).map((line) => ({ ...line, name: 'seagrass, warm sea' })),
      ...series([5], 0, 26, (x) => ({ ...sea, depth: x, celsius: 8 })).map((line) => ({ ...line, name: 'kelp, cold sea' })),
    ],
    label: 'Suitability of the sea by depth',
  });
  const warmth = lineChart({
    x: { label: 'water temperature (C)', domain: [-5, 32] },
    y: { label: 'suitability', domain: [0, 1] },
    series: [
      ...series([1, 2, 3], -5, 32, (x) => ({ ...lake, celsius: x })),
      ...series([4], -5, 32, (x) => ({ ...sea, celsius: x, depth: 2 })),
      ...series([5], -5, 32, (x) => ({ ...sea, celsius: x, depth: 6 })),
    ],
    label: 'Suitability by temperature',
  });

  const { grid: g, biome } = w;
  const map = renderMap('water-flora.png', {
    columns: g.columns,
    rows: g.rows,
    step: 3,
    colourAt: (column, row) => {
      const i = g.at(column, row);
      if (i < 0) return hex('#1d3556');
      const kind = w.aqua[i]!;
      if (kind > 0) return hex(WATER_COLOURS[kind]!);
      if (biome[i]! === Biome.Ocean) return hex('#2a4a78');
      if (biome[i]! === Biome.Lake || w.river[i] === 1) return hex('#6b9ac4');
      return hex('#e8dcc0');
    },
  });

  return `<p>Water gets the same treatment as land: a tile's conditions pick the plant. A water tile is one of three things (<b>standing</b> water, a <b>river</b> channel, or the <b>bank</b> beside one), and each plant has a suitability from <b>depth</b>, <b>distance from the shore</b>, <b>temperature</b>, <b>salt</b> and <b>current</b> (<code>suitability</code> in <code>aquatic.ts</code>). The best plant wins the tile, a patch noise per plant decides where it clumps, and a roll against its suitability decides whether anything is there at all. The current of a river tile is the speed the river mesh already draws, from how steeply that reach falls (<code>flowSpeedFor</code>).</p>
${callout('<p><b>The current sorts the plants.</b> In still water reeds, lilies and algae grow, in a slow current only the reeds along the bank, in a moving current the streaming weed, and in rapids nothing holds on. Reeds and lilies need fresh water. In the sea the depth decides: seagrass on the warm shallow shelf, kelp in the colder, deeper water beyond it.</p>')}
${grid(
    figure(flow, '<b>Current.</b> Lilies and algae need still water and are gone by 0.3 m/s. Reeds grow on the bank of a gentle river. Weed streams in the middle of the range and lets go in rapids.'),
    figure(depth, '<b>Depth in a lake.</b> Reeds stand in the shallows. Lilies want a metre or two of water and the shore a few tiles off. Algae mats float on shallow, warm, still water.'),
  )}
${grid(
    figure(seaDepth, '<b>The sea.</b> Seagrass takes the first few metres of a warm shelf. Kelp holds the colder water below it, to about twenty metres.'),
    figure(warmth, '<b>Temperature.</b> Algae bloom only in warm water, lilies a little cooler, reeds will take almost anything above freezing. Kelp is the one that prefers the cold.'),
  )}
${figure(img(map, 'Where each water plant grows'), '<b>On the map.</b> Green reeds line shallows, pink lily pads and lime algae sit in lakes, grey weed follows streams, teal seagrass and brown kelp ring the coasts. Most open water stays bare. Lilies and algae are in leaf only in the warm half of the year, reeds dry to straw in autumn.', true)}`;
}

export const LINK: PageLink = {
  slug: 'ecosystem',
  title: 'Ecosystem',
  summary: 'How well things grow, what a tile wants, water plants, the seasons and what changes the ground.',
};

export function build(): Page {
  const { species } = load();
  const { maps, histogram } = worldEcoFigures();
  const kinds = SEASONAL_PLANT_KINDS.filter((k) => seasonSeries(k.kindName).length > 0);

  return {
    ...LINK,
    lede: `Plants are not placed by hand. Each tile gets a growth score from its climate and water, rolls a form from that score, and a species is picked for the form. Water has its own plants, sorted by depth and current. The species themselves, with every sprite, are on the Plants page.`,
    code: ['src/sim/eco.ts', 'src/sim/aquatic.ts', 'src/sim/cover.ts', 'src/render/groundSprites.ts', 'src/pixel/ground/plants.ts', 'src/sim/seasons/'],
    sections: [
      {
        id: 'how',
        title: 'How a tile gets its plants',
        html: `${flow([
          { title: 'Eco', text: 'A 0 to 255 score from warmth, rain, water table, slope and rock.' },
          { title: 'Cover', text: 'Per tile, a roll picks bare, grass, scrub, bush, tree or boulder.' },
          { title: 'Species', text: 'The form is only what the tile wants. The species is chosen by niche fitness, and the plant then grows, competes and seeds on the Plants page.' },
          { title: 'Marks', text: 'Flowers, tufts, ferns and stones are scattered by density, in patches.' },
          { title: 'Water', text: 'On water tiles a plant is picked by depth, shore, temperature, salt and the current of the river.' },
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
        html: `<p><b>Generation only.</b> This roll decides what a tile wants (<code>wants</code>) and seeds the first plants. After that plants grow, shade, die and re-seed on their own (see the Plants page), and <code>world.cover</code> is derived from the plants on the tile. Five forms compete for a tile: tree, bush, scrub, boulder and grass. Each biome has an <b>affinity</b> for each form, and each form has a density curve over eco. The affinity scales the curve:</p>
${affinityTable()}
<p>The curves are the same for every biome and only their height changes. A tree wants fertile ground (zero below 0.12, full above 0.55). A bush likes the middle, peaking at 0.6. Scrub peaks at 0.3, on poorer ground. Boulders do better the worse the ground is. Grass needs only a little.</p>
${callout('<p><b>The roll is one number per tile.</b> The tile rolls once, from 0 to 1, and the forms are laid end to end in this order: tree, bush, boulder, scrub, grass. Wherever the roll lands is the cover. Trees and bushes are first, so they take what they want and the later forms get what is left, which is why a woodland has no room for grass.</p><p>Trees and bushes are also multiplied by a clump noise 14 tiles across (0.5 to 1.5), so woods come out as woods and not an even scatter. The curves below leave it out, at its average of 1.</p>')}
${formCurves()}
${callout('<p><b>Nothing grows on a river.</b> A river tile (<code>world.river</code>: within the ribbon\'s half width plus a bank of 0.4 tile) rolls no cover at all, so no tree, bush, boulder or grass is generated in the channel, and regrowth skips it too. Flat marks follow the same rule more finely: a mark scattered on a river tile is dropped when its spot is within 0.3 tile of the water the painter draws (<code>wetNear</code>), so the bank keeps its flowers and mushrooms and the water keeps none. Only the water plants below are allowed on the water itself.</p>')}
<h3>Does the prediction hold?</h3>
<p>The average density the curves give over every tile of a biome, next to what the generator actually put there on this seed. The two agree to a tenth of a percent, except for grass in forest and marsh. There the earlier forms already fill most of the roll, the stack in the charts above runs past 100% and the last form is cut off, so grass comes in under its curve.</p>
${predictedVersusMeasured()}`,
      },
      {
        id: 'water',
        title: 'Water plants',
        html: waterSection(),
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
<p>A deciduous tree is not a thinned crown but a crown that comes off: each oak, birch, chestnut, apple and willow has a bare twin baked in the same footprint, drawn under the canopy whenever the leaves are going. A flower is not a crown that comes off, so it <b>changes sprite</b> instead: bud, bloom and seed head are three sprites, and a per-flower hash decides which one shows. The bar for 'present' on those charts is the share of flowers showing that sprite.</p>`,
      },
      {
        id: 'felled',
        title: 'What changes the ground',
        html: `<p>Everything above is the world as generated. Five things rewrite it afterwards, each stamping the 64 tile block it touches so the painter re-bakes that chunk and nothing else: a storm or an <code>uproot</code> turns <code>Cover.Tree</code> into <code>Cover.Fallen</code> (the tile then draws a log with its root plate), a person chopping clears it, a fire clears and treads the tile bare, and walking wears a path. The fifth is that it grows back: plants grow, shade each other, die and re-seed from real parents (<code>Plants</code>, see the Plants page), and a felled tree leaves a fallen log that rots to bare ground, so a hole in a wood fills where the tree stood. Wear fades on the same clock, so a path nobody walks grows over. Each tree also carries a <b>trunk</b> sprite drawn under the canopy from the zoom where canopies start to dither away, so as they go the stump they stood on is what shows.</p>`,
      },
    ],
  };
}
