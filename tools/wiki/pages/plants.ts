import { heightAfter } from '../../../src/sim/plants/growth.ts';
import { trapezoid } from '../../../src/sim/plants/niche.ts';
import type { Species } from '../../../src/sim/plants/species.ts';
import { SPECIES } from '../../../src/sim/plants/species.ts';
import { ZONE_NAMES } from '../../../src/sim/plants/zones.ts';
import { encyclopediaSections } from '../encyclopedia.ts';
import { world } from '../context.ts';
import { BIOME_RGB } from '../maps.ts';
import type { Page, PageLink } from '../page.ts';
import { callout, figure, flow, img, SERIES, table } from '../page.ts';
import type { Rgb } from '../raster.ts';
import { hex, mix, renderMap } from '../raster.ts';
import { bars, legend, lineChart, samples } from '../svg.ts';

const PALETTE = [
  '#3f7a3a', '#a8523a', '#c9a23c', '#3f6b7a', '#8a5c9a', '#6aa84f', '#d0703c', '#2f8a72', '#b8b04a', '#7a4a2a',
  '#5a7ac0', '#c25a8a', '#8aa05a', '#4a4a7a', '#d8c070', '#2a6a3a', '#9a6a3a', '#68b0c0',
];

const colourOf = (id: number): Rgb => hex(PALETTE[(id - 1) % PALETTE.length]!);

const layerOf = (layer: Species['layer']): Species[] => SPECIES.filter((s) => s.layer === layer && s.key !== 'snag');

const MONTHS = ['mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb'];

const range = (r: readonly number[], unit = ''): string => `${r[1]} to ${r[2]}${unit}`;

function catalogue(): string {
  const rows = SPECIES.filter((s) => s.key !== 'snag').map((s) => [
    s.name,
    s.layer,
    `${s.habit}, ${s.leaf}`,
    `${s.height} m`,
    `${s.yearsTo90} y`,
    `${s.lifespan} y`,
    range(s.temperature, ' C'),
    range(s.rain),
    s.fruit ? `${s.fruit.name}, ${s.fruit.kcal} kcal` : '-',
  ]);
  return table(['Species', 'Layer', 'Habit', 'Height', 'To 90%', 'Lives', 'Best temperature', 'Best rain', 'Fruit'], rows);
}

function growthChart(layer: Species['layer'], years: number, label: string): string {
  const list = layerOf(layer);
  return lineChart({
    width: 560,
    height: 300,
    x: { label: 'years', domain: [0, years], ticks: [0, years / 4, years / 2, (years * 3) / 4, years] },
    y: { label: 'metres', domain: [0, Math.max(...list.map((s) => s.height))], ticks: [0, 10, 20, 30, 40, 50] },
    series: list.map((s, i) => ({
      name: s.name,
      colour: PALETTE[i % PALETTE.length]!,
      points: samples(0, years, 120, (t) => heightAfter(s, t)),
    })),
    legend: false,
    label,
  });
}

function nicheChart(keys: readonly string[], pick: 'temperature' | 'rain', domain: [number, number]): string {
  const list = keys.map((key) => SPECIES.find((s) => s.key === key)!);
  return (
    lineChart({
      width: 560,
      height: 260,
      x: { label: pick === 'temperature' ? 'annual temperature, C' : 'rainfall units', domain },
      y: { label: 'fitness', domain: [0, 1], ticks: [0, 0.5, 1] },
      series: list.map((s, i) => ({
        name: s.name,
        colour: PALETTE[i % PALETTE.length]!,
        points: samples(domain[0], domain[1], 160, (x) => trapezoid(s[pick], x)),
      })),
      legend: false,
      label: `Fitness of ${list.map((s) => s.name).join(', ')} over ${pick}`,
    }) + legend(list.map((s, i) => ({ name: s.name, colour: PALETTE[i % PALETTE.length]! })))
  );
}

function standMap(): { map: string; counts: string } {
  const w = world();
  const { grid } = w;
  const map = renderMap('plants-canopy.png', {
    columns: grid.columns,
    rows: grid.rows,
    step: 4,
    colourAt: (c, r) => {
      const i = grid.at(c, r);
      const canopy = w.plants.canopy[i]!;
      if (canopy !== 0) return colourOf(canopy);
      const under = w.plants.under[i]!;
      const ground = BIOME_RGB[w.biome[i]!] ?? [200, 200, 200];
      return under !== 0 ? mix(ground, colourOf(under), 0.45) : mix(ground, [244, 241, 234], 0.35);
    },
  });
  const tally = new Map<number, number>();
  for (let i = 0; i < grid.count; i += 1) {
    const id = w.plants.canopy[i]!;
    if (id !== 0) tally.set(id, (tally.get(id) ?? 0) + 1);
  }
  const total = [...tally.values()].reduce((a, b) => a + b, 0);
  const rows = [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({
    label: SPECIES[id - 1]!.name,
    value: n / total,
    colour: PALETTE[(id - 1) % PALETTE.length]!,
  }));
  return { map, counts: bars(rows, Math.max(...rows.map((r) => r.value)), (v) => `${(v * 100).toFixed(1)}%`) };
}

function fruitCalendar(): string {
  const list = SPECIES.filter((s) => s.fruit);
  const row = 20;
  const left = 150;
  const width = 520;
  const cell = (width - left) / 12;
  const out = list.map((s, i) => {
    const f = s.fruit!;
    const x = left + f.from * (width - left);
    const w = Math.max(3, (f.to - f.from) * (width - left));
    return `<text x="4" y="${i * row + 14}" font-size="11" fill="currentColor">${s.fruit!.name}</text><rect x="${x}" y="${i * row + 4}" width="${w}" height="12" rx="2" fill="${SERIES.gold}"/>`;
  });
  const ticks = MONTHS.map((m, i) => `<text x="${left + i * cell}" y="${list.length * row + 14}" font-size="10" fill="currentColor">${m}</text>`);
  return `<svg viewBox="0 0 ${width} ${list.length * row + 24}" width="${width}" role="img" aria-label="When each fruit is ripe">${out.join('')}${ticks.join('')}</svg>`;
}

export const LINK: PageLink = {
  slug: 'plants',
  title: 'Plants',
  summary: 'The species catalogue and encyclopedia, how plants grow, compete for light and water, spread seed and bear fruit.',
};

export function build(): Page {
  const { map, counts } = standMap();
  return {
    ...LINK,
    lede: `A tile holds up to three plants, one in each layer (canopy, understorey, herb), and each has a species, an age and a height. Nothing is rolled once and left: a plant grows along a logistic curve fitted to how many years the real species takes to reach 90% of its height, shades the ones beside it, thirsts, dies and seeds its neighbours. ${SPECIES.length - 1} species are catalogued, from tundra sedge to rainforest kapok.`,
    code: ['src/sim/plants/', 'src/pixel/ground/flora.ts', 'src/pixel/ground/plants.ts'],
    sections: [
      {
        id: 'model',
        title: 'The model',
        html: `${flow([
          { title: 'Niche', text: 'Five trapezoids (temperature, rain, altitude, salt spray, nearness to fresh water) multiply into a fitness from 0 to 1.' },
          { title: 'Growth', text: 'Height follows a logistic curve whose rate comes from years to 90% of full height, scaled by vigour.' },
          { title: 'Competition', text: 'Light is taken by taller neighbours in a 5 by 5 patch. Water is a budget the stand shares.' },
          { title: 'Seed', text: 'A seedling can only appear where a mature parent is within its dispersal reach, by gravity, wind, animal or water.' },
          { title: 'Death', text: 'A background hazard by age and size, plus drought, shade, felling and storms. A dead tree may stand as a snag, then rot.' },
          { title: 'Fruit', text: 'Mature plants bear a crop in kilocalories in a ripe window of the year. People forage it.' },
        ])}
<p><b>The data is flat arrays.</b> Per tile, per layer: species (u8), age in game days (u16) and height (u8, stored squared so small plants keep resolution). <code>world.cover</code> is derived from them. Only tiles a person or a storm has changed are saved; natural drift is regenerated from the seed on load.</p>
${callout('<p><b>Time.</b> A game year is 32 game days, about twelve and a half real hours at 1x, and it is the unit the calendar, fruit and seasons run in. Plants live on a faster clock: <code>GROWTH_SPEED</code> is 100, so a plant ages and grows 100 plant years for every game year, one plant year in about 6 real minutes at 1x. The figures on this page (years to 90%, lifespan) are plant years. A birch is full grown after about 40 plant years, around four real hours at 1x; an oak after about twelve, a bramble in half an hour. Ripe windows are not sped up.</p>')}`,
      },
      {
        id: 'catalogue',
        title: 'The catalogue',
        html: `<p>Heights and ages are the real figures for each plant. The ranges are the plateau of its niche (fitness 1), it survives a little beyond them.</p>${catalogue()}`,
      },
      {
        id: 'growth',
        title: 'Growth in plant years',
        html: `${figure(growthChart('canopy', 200, 'Height of canopy species over their first 200 years'), '<b>Trees.</b> Pioneers (birch, willow) shoot up and die young. Oaks, firs and baobabs take centuries.', true)}
${figure(growthChart('under', 40, 'Height of understorey species over their first 40 years'), '<b>Shrubs and vines.</b> A banana or a bramble is full grown in a few years. Cactus and juniper take decades.', true)}
<p>The sprite follows the height: <code>sapling</code>, <code>young</code>, <code>low</code>, <code>mid</code> and <code>high</code> are 15%, 35%, 60%, 100% and above of the species height, and each is drawn at its own scale, shadow length and draw order.</p>`,
      },
      {
        id: 'niche',
        title: 'Where each species can live',
        html: `${figure(nicheChart(['birch', 'oak', 'olive', 'acacia', 'coconut', 'kapok'], 'temperature', [-20, 38]), '<b>Temperature.</b> Birch and spruce take the cold edge, kapok and coconut the tropics, olive the warm dry middle.', true)}
${figure(nicheChart(['acacia', 'olive', 'oak', 'birch', 'mahogany', 'liana'], 'rain', [0, 40]), '<b>Rain.</b> In the same units the eco score uses: acacia and olive want little, rainforest species want a great deal.', true)}
<p>Altitude, salt and damp work the same way. Salt spray is <code>exp(-distance to ocean / 5)</code>, so coconut, sea buckthorn and dune grass hold the first few tiles of coast. Damp is how near fresh water is, which is what puts willow and sedge on banks.</p>
<p>Climates are grouped into ${ZONE_NAMES.length} zones (${ZONE_NAMES.join(', ')}) by temperature, rain and altitude. The generator uses the zone to choose how closed the stand is and which form a tile wants.</p>`,
      },
      {
        id: 'stands',
        title: 'What grew on this seed',
        html: `${figure(img(map, 'Canopy species on the map'), '<b>Canopy by species.</b> Each colour is one species. Where there is no tree, a tint of the understorey species is mixed into the ground colour.', true)}
${counts}`,
      },
      {
        id: 'competition',
        title: 'Light, water and shade',
        html: `<p>Vigour is <code>sqrt(fitness) &times; min(light response, water factor)</code>. <b>Light</b> falls with the height-weighted crown cover of taller neighbours in a 5 by 5 patch, and each species has a shade tolerance: a fern is happy under a canopy, a birch is not. <b>Water</b> is a carrying capacity: each tile supports a biomass set by rain and nearness to water, and every plant in the layer takes a share of it by size and thirst. Below the capacity everything is fine. Above it the thirstiest and smallest take a drought hazard. This is what stops scrub from filling a desert and thins a wood on dry ground.</p>
<p>A seedling is only allowed where the generator's own answer for the tile wants that form (<code>wants</code>), so a world relaxes back toward the pattern it was generated as and a hole in a wood fills where the trees stood.</p>`,
      },
      {
        id: 'dispersal',
        title: 'Seeds come from parents',
        html: `<p>Each species disperses by one of four kernels with a reach in tiles. <b>Gravity</b> drops seed at the foot of the parent (banana, bamboo). <b>Wind</b> carries it downwind, biased by the prevailing wind of the row's latitude band (birch, pine, spruce). <b>Animals</b> carry fruit farther (oak acorns, apples, figs). <b>Water</b> moves it along rivers and coasts (willow, coconut). A tile can only be seeded when a parent of at least its <code>matureAge</code> stands within reach, and the number of seedlings scales with the parent's <code>recruits</code> and size.</p>`,
      },
      {
        id: 'fruit',
        title: 'Fruit and foraging',
        html: `<p>A mature plant carries a crop that scales with its size and vigour, in kilocalories, ripe in a window of the local year (the southern hemisphere is half a year on). An idle hungry person walks to the nearest ripe crop within reach and eats up to a stomach (650 kcal) at a time. A crop picked is gone until next year. One hunger unit is 6000 kcal.</p>
${figure(fruitCalendar(), '<b>When each fruit is ripe</b>, as a share of the year starting in March.', true)}`,
      },
      ...encyclopediaSections(),
    ],
  };
}
