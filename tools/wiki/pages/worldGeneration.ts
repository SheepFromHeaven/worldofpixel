import { BIOME_NAMES, Biome } from '../../../src/sim/types.ts';
import { noise2 } from '../../../src/sim/rng.ts';
import { TILE, WORLD_TILES, MARGIN_TILES, TEXELS_PER_TILE } from '../../../src/sim/grid.ts';
import {
  classify,
  HIGHLAND,
  LATITUDE_RAIN,
  latitudesOf,
  MEAN_TEMPERATURE,
  PEAK_METRES,
  seaLevelTemperature,
} from '../../../src/sim/terrain/climate.ts';
import {
  BASE_WAVELENGTH,
  baseHeight,
  fbm,
  NORM,
  OCTAVES,
  SEA_LEVEL,
  shoreFalloff,
  WORLD_EXTENT,
} from '../../../src/sim/terrain/heightmap.ts';
import {
  canyonDistance,
  canyonMask,
  cliffMask,
  CANYON_DEPTH,
  CLIFF_HEIGHT,
  coneAt,
  MESA_FROM,
  MESA_STEP,
  mesaMask,
  terraced,
  volcanoesNear,
} from '../../../src/sim/terrain/landforms.ts';
import { boundaryAt, PLATE_CELL, tectonicsAt } from '../../../src/sim/terrain/plates.ts';
import { classifyAll } from '../../../src/sim/terrain/worldfield.ts';
import { FERTILITY_ONE } from '../../../src/sim/terrain/surface.ts';
import { RIVER_FLUX, Water } from '../../../src/sim/terrain/hydrology.ts';
import { world, SEED } from '../context.ts';
import { BIOME_RGB, heat, hypsometric, mono, wetness } from '../maps.ts';
import type { Page, PageLink } from '../page.ts';
import { callout, figure, flow, grid, img, SERIES, table } from '../page.ts';
import { line, renderMap } from '../raster.ts';
import { areaChart, heatmap, legend, lineChart, samples } from '../svg.ts';
import { BIOME_COLORS } from '../../../src/render/palette.ts';
import { provideGroundSprites } from '../../../src/render/groundSprites.ts';
import { riverBank, riverShade, texelsIn } from '../../../src/render/terrainPixels.ts';
import { groundFromSource } from '../../groundSource.ts';
import { save } from '../raster.ts';

const STEP = 4;

const percent = (n: number, of: number): string => `${((100 * n) / of).toFixed(1)}%`;


function bankFigures(): string {
  const w = world();
  const halves = [0.5, 1.5, 3.5];
  const names = ['a stream, half width 0.5', 'a river, 1.5', 'a great river, 3.5'];
  const colours = [SERIES.gold, SERIES.blue, SERIES.ink];
  const shade = lineChart({
    x: { label: 'across the channel (0 bank, 1 middle)', domain: [0, 1] },
    y: { label: 'shade (0 dark, 1 light)', domain: [0, 1] },
    series: halves.map((half, i) => ({ name: names[i]!, colour: colours[i]!, points: samples(0, 1, 100, (d) => riverShade(d, half)) })),
    label: 'River water shade by depth across the channel',
  });
  const widths = lineChart({
    x: { label: 'river half width (tiles)', domain: [0.2, 4] },
    y: { label: 'bank band (tiles)', domain: [0, 0.9] },
    series: [{ name: 'bank band', colour: SERIES.green, points: samples(0.2, 4, 120, (half) => riverBank(half).band) }],
    verticals: [{ at: 1.05, label: 'gravel below, mud above' }],
    label: 'Width of the wet bank by river size',
    legend: false,
  });

  provideGroundSprites(groundFromSource());
  const crop = (name: string, x: number, y: number): string => {
    const span = 16;
    const size = 256;
    const texel = span / size;
    const colours32 = texelsIn(w, texel, Math.floor(x / texel), Math.floor(y / texel), size, size);
    const pixels = new Uint8Array(size * size * 4);
    colours32.forEach((c, i) => pixels.set([(c >>> 24) & 0xff, (c >>> 16) & 0xff, (c >>> 8) & 0xff, 255], i * 4));
    return save(name, pixels, size, size);
  };
  const river = crop('bank-river.png', 663, 1216);
  const coast = crop('bank-coast.png', 1388, 49);
  const desert = crop('bank-desert.png', 1478, 425);

  return `<h3>Banks and depth</h3>
<p><b>Continents come from the plates, not from the noise.</b> A plate is continental with a chance that depends on the seed (42% plus up to 32%, so one world is an archipelago and another nearly one landmass) and lifts the ground 0.08, an oceanic one sinks it 0.28, over a base that sits 0.08 above the sea, and the fractal noise only roughens that (its contrast is 1.25, it was 1.9 and drew the whole map as one blobby landmass). Plates are 320 tiles across with a 120 tile warp, the coast between a continental and an oceanic plate is a 34 tile shelf rather than a ruled edge, and the world's own edge only starts to pull the land down at 72% of the way out. The result is a few continents of different sizes with seas between them, peninsulas, and island chains where ocean plates meet. <code>tools/continents.ts</code> draws six seeds side by side.</p>
<p><b>Rain is recycled over land.</b> Air that has rained out over land picks most of it up again from plants and soil, so the humidity of an air column falls over a length 1 / (1 - 0.55) times longer than the rain falls (<code>RECYCLE</code> in <code>climate.ts</code>, applied exactly inside <code>fallout</code> so it does not depend on the step). Continental interiors therefore stay green: about a third of the land is forest, a sixth meadow, and desert belongs to the dry latitudes and rain shadows.</p>
<p><b>Lakes erode.</b> Before the water balance is asked (<code>erodeLakes</code> in <code>hydrology.ts</code>), every lake loses what its outlet would cut: 0.005 of height plus a quarter of its depth, so shallow lakes vanish and deep ones shrink to their core; a lake whose surface is within 0.02 of the sea opens to it and is gone; and no lake keeps more than 5000 tiles of surface, because a bigger one needs a basin the world does not have.</p>
<p><b>Lakes sit in basins the land makes.</b> Lowland carries bowl-shaped sags (<code>basinDepth</code> in <code>landforms.ts</code>: a jittered site every 220 tiles, 40% of them with a basin 16 to 50 tiles in radius and 45 to 130 m deep, never taking the ground below the sea), so the flood has real hollows to fill, and a lake keeps what 70% of its inflow can feed against 0.5 per degree of warmth over its surface, which gives a few big lakes and many small ones, 3 to 5% of the land. <b>Rivers start small.</b> A channel counts from a flux of 400 at a quarter of a tile of half width and widens with the square root of its flux; a headwater that runs less than 12 tiles before it joins another, or the sea, is dropped.</p>
<p><b>Close rivers merge.</b> Steep wet ground gives many channels that each carry just enough water to count as a river, side by side like the teeth of a comb. After the rivers are traced, an opening pass (<code>openRivers</code> in <code>hydrology.ts</code>) walks them from the biggest down: a river cell with a river at least 1.3 times its flux within 7 tiles, that is not its own downstream path, is given up, and what is left of its branch is drawn into that neighbour instead. Rivers of flux 8000 and over are never given up.</p>
<p>The painter does not stop at the waterline. <b>Water is shaded by how deep it is</b>: a river is pale at its edge and dark in its middle, and a bigger river is deeper overall, so a stream never gets as dark as a great river. A lake or the sea is lightened over the first tile or so off the shore, the shallows. Where a river runs through a standing-water cell the river's own shade wins, so the join has no seam.</p>
<p><b>The land beside the water changes with the depth too.</b> A wet strip runs along the waterline, wider the further its size is from the middle: shallow streams leave a pale <b>gravel</b> bar, deep rivers a dark <b>mud</b> bank, lakes mud and the open sea a <b>sand</b> beach. Outside the strip the ground is darkened a little, damp, and fades back to the biome. The strip is drawn from the path ramps, so flat marks keep off it, and its edge wanders on a noise so it is never a ruled line.</p>
${grid(
    figure(shade, '<b>Depth shade.</b> Light at the bank and dark in the middle. The great river reaches nearly black where the stream stays pale.'),
    figure(widths, '<b>Bank width.</b> Under about 1 tile of half width the bank is gravel and gets narrower as the river grows. Above it the bank is mud and gets wider, a deep river having a wider flood bank.'),
  )}
${grid(
    figure(img(river, 'A meadow river with a mud bank on the deep bends and gravel on the shallow reach'), '<b>A meadow river.</b> Mud on the deep bend, gravel where it shallows, a dark damp fringe outside both.'),
    figure(img(coast, 'A coast with a sand beach and pale shallows'), '<b>A coast.</b> Sand beach, shallows lighter than the open water.'),
    figure(img(desert, 'A desert river with a gravel bank'), '<b>A desert river.</b> The gravel bank is nearly the colour of the ground, so the edge is a fine line.'),
  )}`;
}

function octaveFigure(): string {
  const at = (x: number, octave: number, y: number): number => {
    let amplitude = 1;
    let wavelength = BASE_WAVELENGTH;
    for (let o = 0; o < octave; o += 1) {
      amplitude *= 0.5;
      wavelength *= 0.5;
    }
    return amplitude * noise2(x / wavelength, y / wavelength, SEED + 11 + octave * 7919);
  };
  let total = 0;
  for (let o = 0; o < OCTAVES; o += 1) total += 0.5 ** o;

  const y = 700;
  const check = fbm(300, y, SEED + 11);
  const sum = Array.from({ length: OCTAVES }, (_, o) => at(300, o, y)).reduce((a, b) => a + b, 0) / total;
  if (Math.abs(check - sum) > 1e-9) throw new Error('octave slice no longer matches fbm');

  const shades = ['#3b352c', '#5a4f3d', '#7a6c52', '#9a8a74', '#a8a090', '#b7ae9c', '#c4bba9', '#d0c8b8'];
  const coarse = [0, 1, 2, 3].map((o) => ({
    name: `octave ${o} (${(BASE_WAVELENGTH / 2 ** o).toFixed(0)} tiles)`,
    colour: shades[o]!,
    points: samples(0, 600, 300, (x) => at(x, o, y) / total),
  }));
  const total2 = samples(0, 600, 300, (x) => fbm(x, y, SEED + 11));
  const fine = [5, 6, 7].map((o) => ({
    name: `octave ${o} (${(BASE_WAVELENGTH / 2 ** o).toFixed(2)} tiles)`,
    colour: [SERIES.blue, SERIES.red, SERIES.gold][o - 5]!,
    points: samples(0, 24, 240, (x) => (at(x, o, y) - 0.5 ** (o + 1)) / total),
  }));

  const left = lineChart({
    x: { label: 'tiles east', domain: [0, 600] },
    y: { label: 'value', domain: [0, 0.75], ticks: [0, 0.25, 0.5, 0.75] },
    series: [{ name: 'sum of all eight (fbm)', colour: SERIES.red, points: total2 }, ...coarse],
    label: 'The four coarsest octaves and their sum along a 600 tile slice',
    height: 280,
  });
  const right = lineChart({
    x: { label: 'tiles east', domain: [0, 24] },
    y: { label: 'contribution, centred', domain: [-0.008, 0.008], ticks: [-0.008, -0.004, 0, 0.004, 0.008] },
    series: fine,
    label: 'The three finest octaves over 24 tiles',
    height: 280,
  });
  return grid(
    figure(left, '<b>The land is the sum.</b> Each octave has half the wavelength and half the amplitude of the one before. The first sets continents, the next three set ranges, hills and ridges.'),
    figure(right, '<b>The last octaves are almost flat.</b> They move the height by under a percent, which is exactly enough to break a perfectly smooth slope so water finds a way down. The finest wiggles inside one tile.'),
  );
}

function normFigure(): string {
  const contour = (p: number): [number, number][] =>
    Array.from({ length: 241 }, (_, i) => {
      const t = (i / 240) * 2 * Math.PI;
      const c = Math.cos(t);
      const s = Math.sin(t);
      const r = Number.isFinite(p) ? (Math.abs(c) ** p + Math.abs(s) ** p) ** (-1 / p) : 1 / Math.max(Math.abs(c), Math.abs(s));
      return [c * r, s * r];
    });
  const shape = lineChart({
    width: 380,
    height: 380,
    x: { label: 'across the world', domain: [-1.15, 1.15], ticks: [-1, 0, 1] },
    y: { label: 'down the world', domain: [-1.15, 1.15], ticks: [-1, 0, 1] },
    series: [
      { name: 'infinity norm, max(dx, dy)', colour: SERIES.grey, dashed: true, points: contour(Infinity) },
      { name: `smooth norm, p = ${NORM}`, colour: SERIES.red, points: contour(NORM) },
      { name: 'euclidean, p = 2', colour: SERIES.blue, dashed: true, points: contour(2) },
    ],
    label: 'Shapes of reach = 1 for three norms',
  });
  const mid = WORLD_EXTENT.height / 2;
  const profile = lineChart({
    x: { label: 'tiles east across the middle row', domain: [-MARGIN_TILES, WORLD_TILES.columns + MARGIN_TILES] },
    y: { label: 'height', domain: [0, 1], ticks: [0, 0.25, 0.42, 0.75, 1] },
    horizontals: [{ at: SEA_LEVEL, label: 'sea level 0.42' }],
    series: [
      { name: 'terrain with the falloff taken off', colour: SERIES.grey, dashed: true, points: samples(-MARGIN_TILES, WORLD_TILES.columns + MARGIN_TILES, 400, (x) => Math.min(1, baseHeight(x, mid, SEED) + shoreFalloff(x, mid))) },
      { name: 'height the game uses', colour: SERIES.green, points: samples(-MARGIN_TILES, WORLD_TILES.columns + MARGIN_TILES, 400, (x) => baseHeight(x, mid, SEED)) },
    ],
    label: 'Height across the middle row, with and without the shore falloff',
    height: 300,
  });
  return grid(
    figure(shape, '<b>Why the norm is smooth.</b> The infinity norm has a gradient pointing exactly along x over the left and right thirds of the map, so every river on a plain runs due east. A smooth norm turns with position.'),
    figure(profile, '<b>The sea is built in.</b> Past the edge the falloff keeps growing until nothing clears sea level, so there is no land beyond what is drawn and the skirt is all sea.'),
  );
}

const biomeKey = (biomes: readonly Biome[]): string =>
  legend(biomes.map((b) => ({ name: BIOME_NAMES[b]!, colour: BIOME_COLORS[b]! })));

function biomeTable(): string {
  const panel = (onRiver: boolean, altitude: number): string => {
    const heightValue = SEA_LEVEL + altitude * (1 - SEA_LEVEL);
    return heatmap({
      width: 440,
      height: 300,
      x: { label: 'temperature (C)', domain: [-20, 40], ticks: [-20, -10, 0, 10, 20, 30, 40] },
      y: { label: 'moisture (rainfall units)', domain: [4, 40], ticks: [4, 10, 20, 30, 40] },
      columns: 120,
      rows: 72,
      colourAt: (temperature, wet) => BIOME_COLORS[classify(heightValue, temperature, wet, onRiver)]!,
      label: `Biome by temperature and moisture, altitude ${altitude}${onRiver ? ' on a river' : ''}`,
    });
  };
  const land = [Biome.Meadow, Biome.Forest, Biome.Highland, Biome.Marsh, Biome.Tundra, Biome.Desert] as const;
  return `${grid(
    figure(panel(false, 0.2), '<b>Lowland.</b> Tundra takes everything below -5 degrees. Desert needs 25 degrees and almost no rain. Marsh takes over once the ground is waterlogged, past about 24. In between is the matrix: steps of 5 in moisture and 1 degree in temperature.'),
    figure(panel(true, 0.2), '<b>On a river.</b> The same diagram with the river flag set. The desert rule is switched off, so a river runs a green line through the dry quarter.'),
  )}${biomeKey(land)}
${figure(grid(panel(false, 0.45), panel(false, 0.7)), `<b>Higher up.</b> Left is altitude 0.45: marsh narrows, because standing water only counts below 0.5. Right is 0.7, above ${HIGHLAND}, where the whole table gives way to highland.`, true)}`;
}

function temperatureFigure(): string {
  const latitude = lineChart({
    x: { label: 'latitude (degrees)', domain: [0, 90] },
    y: { label: 'annual mean at sea level (C)', domain: [-30, 30] },
    verticals: MEAN_TEMPERATURE.slice(1, 6).map(([lat]) => ({ at: lat })),
    series: [{ name: 'sea level mean', colour: SERIES.red, points: samples(0, 90, 180, seaLevelTemperature) }],
    label: 'Mean temperature by latitude',
    legend: false,
  });
  const lapse = lineChart({
    x: { label: 'altitude (metres)', domain: [0, PEAK_METRES], ticks: [0, 500, 1000, 1500, 2000] },
    y: { label: 'temperature (C)', domain: [-40, 30] },
    horizontals: [{ at: 0, label: 'freezing' }],
    series: [0, 30, 45, 60].map((lat, i) => ({
      name: `${lat} degrees`,
      colour: [SERIES.red, SERIES.gold, SERIES.green, SERIES.blue][i]!,
      points: samples(0, PEAK_METRES, 22, (m) => seaLevelTemperature(lat) - (m / 1000) * 6.5),
    })),
    label: 'Temperature by altitude at four latitudes',
  });
  return grid(
    figure(latitude, '<b>Earth in a strip.</b> A table of real annual means, interpolated. The map spans roughly 66 north to 64 south, so the equator crosses the middle row.'),
    figure(lapse, '<b>6.5 degrees a kilometre.</b> The tallest peak is 2200 m, so a mountain at the equator is as cold as a lowland at 45 degrees.'),
  );
}

function rainFigure(): string {
  return figure(
    areaChart({
      x: { label: 'latitude band (5 degree steps from the equator)', domain: [0, LATITUDE_RAIN.length - 1], ticks: [0, 3, 6, 9, 12, 15, 17], format: (v) => `${v * 5}` },
      y: { label: 'rain ceiling (x)', domain: [0, 4.5], ticks: [0, 1, 2, 3, 4] },
      series: [{ name: 'humidity the wind starts with', colour: SERIES.blue, points: LATITUDE_RAIN.map((v, i) => [i, v] as const) }],
      label: 'Rain ceiling by latitude band',
      legend: false,
      height: 260,
    }),
    '<b>Wet at the equator and at 60, dry at 30.</b> This is the humidity a parcel of wind begins its journey with. It then falls out as it crosses land and rises over hills.',
  );
}


function landformFigures(): string {
  const w = world();
  const { field, grid: tileGrid } = w;
  const provinces = renderMap('wg-landforms.png', {
    columns: tileGrid.columns,
    rows: tileGrid.rows,
    step: STEP,
    colourAt: (c, r) => {
      const i = tileGrid.at(c, r);
      if (field.water[i] === Water.Ocean) return [200, 205, 205];
      const x = tileGrid.x(c);
      const y = tileGrid.y(r);
      const mesa = mesaMask(x, y, SEED);
      const canyon = canyonMask(x, y, SEED);
      const coast = field.height[i]! < SEA_LEVEL + 0.06 ? cliffMask(x, y, SEED) : 0;
      const paper: [number, number, number] = [236, 232, 220];
      const pick = (to: [number, number, number], t: number): [number, number, number] => [
        Math.round(paper[0] + (to[0] - paper[0]) * t),
        Math.round(paper[1] + (to[1] - paper[1]) * t),
        Math.round(paper[2] + (to[2] - paper[2]) * t),
      ];
      if (coast > 0.5) return pick([40, 110, 190], coast);
      return mesa >= canyon ? pick([214, 120, 40], mesa) : pick([120, 70, 170], canyon);
    },
  });

  const plates = renderMap('wg-plates.png', {
    columns: tileGrid.columns,
    rows: tileGrid.rows,
    step: STEP,
    colourAt: (c, r) => {
      const x = tileGrid.x(c);
      const y = tileGrid.y(r);
      const edge = boundaryAt(x, y, SEED);
      if (edge.distance < 3 * STEP / 2) return edge.convergence > 0.25 ? [200, 40, 40] : edge.convergence < -0.25 ? [40, 80, 220] : [30, 30, 30];
      const tectonic = tectonicsAt(x, y, SEED);
      if (tectonic.volcanism > 0.5) return [255, 160, 0];
      const v = Math.max(0, Math.min(1, 0.5 + tectonic.lift * 2.2));
      return [Math.round(v * 255), Math.round(v * 255), Math.round(v * 255)];
    },
  });

  const terrace = lineChart({
    x: { label: 'altitude of the broad land above the foot of the mesas', domain: [0, 0.4] },
    y: { label: 'altitude after terracing', domain: [0, 0.4] },
    series: [
      { name: 'unchanged', colour: SERIES.grey, dashed: true, points: samples(0, 0.4, 200, (a) => a) },
      { name: 'terraced', colour: SERIES.red, points: samples(0, 0.4, 400, (a) => terraced(a)) },
    ],
    label: `Terracing curve, a step every ${MESA_STEP} from ${MESA_FROM}`,
    height: 280,
  });

  const volcano = volcanoesNear(1000, 600, SEED)[0]!;
  const section = lineChart({
    x: { label: 'tiles from the vent', domain: [-volcano.radius * 1.3, volcano.radius * 1.3] },
    y: { label: 'profile (1 is the summit rim)', domain: [0, 1] },
    series: [
      {
        name: `a volcano of radius ${volcano.radius.toFixed(0)}`,
        colour: SERIES.red,
        points: samples(-volcano.radius * 1.3, volcano.radius * 1.3, 300, (d) => coneAt(volcano, volcano.x + d, volcano.y, SEED)),
      },
    ],
    label: 'Cross section through a volcano and its crater',
    legend: false,
    height: 280,
  });

  const row = Math.floor(tileGrid.rows * 0.4);
  const trench = lineChart({
    x: { label: 'tiles east along one row', domain: [0, 600] },
    y: { label: 'tiles to the nearest canyon axis (capped at 60)', domain: [0, 60] },
    series: [{ name: 'distance', colour: SERIES.blue, points: samples(500, 1100, 300, (x) => Math.min(60, canyonDistance(x, tileGrid.y(row), SEED))).map(([x, y]) => [x - 500, y] as const) }],
    label: 'Distance to the nearest canyon axis along one row',
    legend: false,
    height: 280,
  });

  return `${figure(img(plates, 'Plates and their boundaries'), `<b>Plates.</b> The world is cut into plates by a warped Voronoi of jittered sites (one per ${PLATE_CELL} tile cell, which is 380 tiles at the size of the first world and grows with it: every length of the plates, their ranges, arcs, rifts and scarps is multiplied by <code>PLATE_SCALE</code>, so a world twice as wide has the same plates twice as large and the same number of them), each continental or oceanic, each drifting a different way. Where two plates close the boundary is red and a mountain range or, beside an ocean, a trench and a volcanic arc (orange) stands on it. Where they part it is blue and a rift valley opens. Where they slide past, black, the step between a continental and an oceanic plate is a straight scarp, which is a cliff coast. The grey is the lift each plate adds to the noise.`)}
${grid(
    figure(img(provinces, 'Landform provinces'), '<b>Provinces.</b> Orange is mesa country, purple canyon country, and blue marks low coast where the cliff province lifts the shore. Each is a slow noise thresholded into a mask, so a region has the one character for a few hundred tiles and fades into plain hills.'),
    figure(terrace, '<b>Mesas are terraces.</b> Flat steps with steep risers, cut on the broad three-octave land, so the tops are wide and flat and the fine octaves only dapple them.'),
  )}
${grid(
  figure(section, '<b>A volcano is not added, it replaces.</b> The cone is blended over whatever stood there, so it keeps its height on a plain or a mountain. A bowl sinks inside the rim and the priority flood fills it into a crater lake when it holds water.'),
  figure(trench, `<b>A canyon has a width, not a threshold.</b> The distance to the axis is a ridged noise divided by its own gradient, so every canyon is the same ${CANYON_DEPTH} deep and about ten tiles wide wherever the noise happens to be steep or flat.`),
)}`;
}

export const LINK: PageLink = {
  slug: 'world-generation',
  title: 'World generation',
  summary: 'From a seed to 3.3 million tiles: height, sea, rain, rivers, climate and biomes.',
};

export function build(): Page {
  const w = world();
  const { field, grid: tileGrid } = w;
  const { columns, rows } = tileGrid;

  const heightMap = renderMap('wg-height.png', { columns, rows, step: STEP, colourAt: (c, r) => hypsometric(field.height[tileGrid.at(c, r)]!) });
  const tempMap = renderMap('wg-temperature.png', {
    columns, rows, step: STEP,
    colourAt: (c, r) => {
      const i = tileGrid.at(c, r);
      return field.water[i] === Water.Ocean ? [200, 205, 205] : heat(field.temperature[i]!);
    },
  });
  const wetMax = 40;
  const wetMap = renderMap('wg-wet.png', {
    columns, rows, step: STEP,
    colourAt: (c, r) => {
      const i = tileGrid.at(c, r);
      return field.water[i] !== Water.None ? [225, 232, 236] : wetness(Math.min(1, (field.wet[i]! - 4) / wetMax));
    },
  });
  const fluxMap = renderMap('wg-flux.png', {
    columns, rows, step: STEP,
    colourAt: (c, r) => {
      const i = tileGrid.at(c, r);
      if (field.water[i] === Water.Ocean) return [226, 232, 232];
      if (field.water[i] === Water.Lake) return [90, 150, 190];
      return mono(Math.min(1, Math.log10(1 + field.flux[i]!) / Math.log10(1 + 40 * RIVER_FLUX)), [244, 241, 234], [30, 60, 120]);
    },
    overlay: (pixels, width, height, scale) => {
      for (const s of field.rivers.segments) line(pixels, width, height, s.ax * scale, s.ay * scale, s.bx * scale, s.by * scale, [192, 81, 64]);
    },
  });
  const windMap = renderMap('wg-wind.png', { columns, rows, step: STEP, colourAt: (c, r) => mono(field.wind[tileGrid.at(c, r)]! / 255, [244, 241, 234], [59, 53, 44]) });
  const climateMap = renderMap('wg-climate.png', { columns, rows, step: STEP, colourAt: (c, r) => BIOME_RGB[field.climate[tileGrid.at(c, r)]!]! });
  const fertilityMap = renderMap('wg-fertility.png', {
    columns,
    rows,
    step: STEP,
    colourAt: (c, r) => {
      const i = tileGrid.at(c, r);
      return field.biome[i]! >= Biome.Ocean ? BIOME_RGB[field.biome[i]!]! : mono(Math.min(1, field.fertility[i]! / FERTILITY_ONE), [236, 226, 196], [52, 96, 56]);
    },
  });
  const biomeMap = renderMap('wg-biome.png', { columns, rows, step: STEP, colourAt: (c, r) => BIOME_RGB[field.biome[tileGrid.at(c, r)]!]! });

  const classed = classifyAll(tileGrid, field.water, field.height, field.temperature, field.wet, field.rivers.of);
  let best = { score: -1, column: 0, row: 0 };
  const CROP = { columns: 112, rows: 80 };
  for (let row = 64; row < rows - 64 - CROP.rows; row += 40) {
    for (let column = 64; column < columns - 64 - CROP.columns; column += 40) {
      let changed = 0;
      let land = 0;
      for (let y = 0; y < CROP.rows; y += 4) {
        for (let x = 0; x < CROP.columns; x += 4) {
          const i = tileGrid.at(column + x, row + y);
          if (field.water[i] !== Water.None) continue;
          land += 1;
          if (classed[i] !== field.climate[i]) changed += 1;
        }
      }
      const score = land > 0.9 * (CROP.columns / 4) * (CROP.rows / 4) ? changed : 0;
      if (score > best.score) best = { score, column, row };
    }
  }
  const crop = (name: string, source: Uint8Array): string =>
    renderMap(name, {
      columns: CROP.columns, rows: CROP.rows, step: 1, zoom: 5,
      colourAt: (c, r) => BIOME_RGB[source[tileGrid.at(best.column + c, best.row + r)]!]!,
    });
  const before = crop('wg-classed.png', classed);
  const after = crop('wg-wandered.png', field.climate);

  let land = 0;
  let sea = 0;
  let lake = 0;
  const share = new Array<number>(BIOME_NAMES.length).fill(0);
  for (let i = 0; i < tileGrid.count; i += 1) {
    if (field.water[i] === Water.Ocean) sea += 1;
    else if (field.water[i] === Water.Lake) lake += 1;
    else land += 1;
    share[field.biome[i]!] = share[field.biome[i]!]! + 1;
  }
  const latitudes = latitudesOf(SEED);

  const landBiomes = [Biome.Meadow, Biome.Forest, Biome.Highland, Biome.Marsh, Biome.Tundra, Biome.Desert, Biome.Rock, Biome.Karst, Biome.Volcanic, Biome.Salt, Biome.Badlands];

  return {
    ...LINK,
    lede: `A world is built once from its seed, in one pass, and nothing about it is stored. The same seed always gives the same ground. This page follows the build in order and draws every stage for seed ${SEED}.`,
    code: ['src/sim/terrain/worldfield.ts', 'heightmap.ts', 'hydrology.ts', 'climate.ts'],
    sections: [
      {
        id: 'tile',
        title: 'The tile is the whole idea',
        html: `<p>One tile is one square metre, sixteen texels across. The world is ${WORLD_TILES.columns} by ${WORLD_TILES.rows} tiles with a ${MARGIN_TILES} tile skirt of sea round it, ${(tileGrid.count / 1e6).toFixed(1)} million tiles in all. Everything below is computed at <b>one cell per tile</b>: the height, the flow, the climate and the biome. There is no second resolution to resample to and no lattice on top, so the biome array answers for a tile with nothing in between.</p>
${table(['Constant', 'Value', 'Meaning'], [
  ['<code>TILE</code>', String(TILE), 'metres per tile'],
  ['<code>TEXELS_PER_TILE</code>', String(TEXELS_PER_TILE), 'a texel is 1/16 m'],
  ['world', `${WORLD_TILES.columns} x ${WORLD_TILES.rows}`, 'tiles, excluding the skirt'],
  ['land', percent(land, tileGrid.count), `of all tiles, including the skirt. Sea is ${percent(sea, tileGrid.count)} and lakes ${percent(lake, tileGrid.count)}`],
  ['latitude range', `${latitudes.north.toFixed(1)} to ${latitudes.south.toFixed(1)}`, 'degrees for this seed, drawn from the seed'],
])}`,
      },
      {
        id: 'pipeline',
        title: 'The pipeline',
        html: `${flow([
          { title: 'Raise the land', text: 'Eight octaves of noise, a smooth shore falloff, then cliffs, mesas, canyons and volcanoes.' },
          { title: 'Fill the seas', text: 'Priority flood from the edge, lakes in every hollow.' },
          { title: 'Send the rain', text: 'Wind carries humidity across land and over hills.' },
          { title: 'Cut the rivers', text: 'Flow accumulation, then a ribbon for every strong cell.' },
          { title: 'Raise the winds', text: 'Latitude belt, altitude, fetch, ravines, shelter.' },
          { title: 'Sow the ground', text: 'Classify each tile, then wander the edges.' },
          { title: 'Lay the rock', text: 'The geology picks bare rock, karst, volcanic ground, salt and badlands, and how fertile each tile is.' },
        ])}
<p>The generator yields after each stage. The loading screen draws what it has so far, which is why you watch the world being built. Four files in strict dependency order do the work and none reaches back up: <code>heightmap.ts</code>, <code>hydrology.ts</code>, <code>climate.ts</code>, then <code>worldfield.ts</code> assembling them.</p>
${grid(
  figure(img(heightMap, 'Height map'), '<b>1 Height.</b> Hypsometric: blues are seabed, then lowland, foothill, rock and snow.'),
  figure(img(fluxMap, 'River flux map'), '<b>4 Flow.</b> Log of water through each cell. Red lines are the traced rivers.'),
)}
${grid(
  figure(img(tempMap, 'Temperature map'), '<b>Temperature</b> in real degrees: latitude, less 6.5 per kilometre.'),
  figure(img(wetMap, 'Moisture map'), '<b>3 Moisture</b> that rain, rivers and nearby water leave behind.'),
)}
${grid(
  figure(img(windMap, 'Wind exposure'), '<b>5 Wind exposure.</b> Dark is windy: open water, ridges and ravines. Trees read it for their sway.'),
  figure(img(biomeMap, 'Biome map'), '<b>6 Biomes</b>, as climate and rock make them. The only thing the game keeps from all of this, together with the water and rivers.'),
)}
${biomeKey([...landBiomes, Biome.Ocean, Biome.Lake])}`,
      },
      {
        id: 'land',
        title: 'Raising the land',
        html: `<p>Height is <code>fbm</code> of the tile position: ${OCTAVES} octaves starting at a ${BASE_WAVELENGTH} tile wavelength, each half the size and half the weight of the last, stretched by a contrast of 1.9, less the shore falloff. <b>The last two octaves are for the rivers.</b> Steepest descent down a field that is smooth at the size of a cell has no small valley to find, so every river runs dead straight and the whole map drains in parallel lines. Dropping octaves is how that comes back.</p>
${octaveFigure()}
<h3>The world bounds itself</h3>
<p>The falloff is a smooth norm of the distance from the middle, and past the extent it keeps growing, so the terrain's own noise cannot make islands in the skirt. A falloff that merely saturates does not do this. <code>BEYOND</code> is derived from the margin and must stay derived: a constant for one drifts from the other the moment the world changes size.</p>
${normFigure()}`,
      },
      {
        id: 'landforms',
        title: 'Cliffs, mesas, canyons and volcanoes',
        html: `<p>Plain noise only makes hills, so the height is shaped before the sea is filled, first by plate tectonics (<code>plates.ts</code>) and then by <code>landforms.ts</code>. The plates give the large structure and the volcanoes follow them: an arc on the overriding side of a subduction, a line along a rift, a few elsewhere. Steep ground, where the height changes by more than ${0.12} in four tiles, is bare rock whatever the climate says. On top of the plates, four local landforms, each living in its own part of the world: <b>shore cliffs</b> lift the land by ${CLIFF_HEIGHT} (about ${Math.round((CLIFF_HEIGHT / (1 - SEA_LEVEL)) * PEAK_METRES)} m) within a few tiles of the waterline in the half of the coast that the cliff province covers, so the beach is a wall; <b>mesas</b> terrace the broad land into stacked plateaus with escarpments between; <b>canyons</b> cut a meandering trench of a fixed width, ${CANYON_DEPTH} deep, along a warped ridged noise, and run into the sea as fjords; <b>volcanoes</b> are a cone with a crater, gullied down the flanks and roughened, one at most per ${640} tile cell and dropped near the world's edge so they are never in the skirt.</p>
<p><b>Cliffs and crevices are read off the height, not drawn as a landform.</b> <code>steepFor</code> (<code>sim/steep.ts</code>) gives every land tile a byte from the metres of fall per metre over a two tile reach (<code>cliffOf</code>: 0 below 45, 1 above 110, which is about the steepest 5% of land), <code>World.steep</code>. Plants read it (eco, vigour and seeding fall to almost nothing on a face), walkers slow on it, and a tile above <code>SHEER</code> is a fourth medium, the cliff, which only climbing mammals, lizards and every flying bird may stand on. The ground painter reads the same function from bilinear heights and draws only the extreme tail as one wall and the rest of the steep ground as a continuous slope fading into scree, in the colour of the bed the geology puts at that height, lit from the top left.</p>
<p>The provinces are slow value noise, so a character holds for hundreds of tiles. Everything keys on world position and the seed, so the landforms are the same however the field is reached. The hydrology needs no change: the lowest ground is the canyon floor, so a river finds it, a crater with a rim holds a lake, and a cliff coast just has no shelf.</p>
${landformFigures()}`,
      },
      {
        id: 'water',
        title: 'Sea, lakes and rivers',
        html: `<p>The sea is every cell below sea level that connects to the edge of the map. From the sea a priority flood grows inland, always taking the lowest unvisited cell next and giving each cell the higher of its own height and the level the flood reached it at, plus a hair. Wherever that raised surface stands above the real ground, the hollow is a lake. Then every cell drains to its steepest neighbour and the rain is added up along the way. A cell carrying more than <code>RIVER_FLUX</code> (${RIVER_FLUX}) is a river.</p>
${callout(`<p><b>Three rules that look like details and are not.</b></p><p>Route the water down the steepest slope, not back the way the flood came: the flood reaches a cell from whichever neighbour got there first, and following that back makes radial lines.</p><p>A flat is drained by the ground under it, not by the fill on top. Fill a hollow and its surface is level to the last bit, so steepest descent runs dead straight out of the spill point and a basin becomes a star of rays. The tie is broken on the drowned bed.</p><p>Lakes evaporate and a dry basin is a sink. Without that a desert is stippled with blue. A closed basin holds only the water its inflow can feed: the inflow is half the rain that reaches it (<code>RUNOFF_SHARE</code>, the land keeps the rest), and every wet tile evaporates in proportion to its warmth. A lake that cannot cover its whole surface shrinks to its lowest tiles, the ones the inflow can keep wet, and is gone if it cannot keep even the lowest, and it never sits below sea level. That keeps lakes a few percent of the land at every size of world, and the great ones for the wet basins. Drying and filling settle each other, so they are asked in turn, three rounds at most.</p>`)}
<p>This seed has ${field.rivers.segments.length.toLocaleString()} river segments and ${field.rivers.count.toLocaleString()} river cells. A river is a ribbon narrower than a tile, so it is drawn from its segments and never written into the biome array. The meander is a field in world units, not jitter per cell, so neighbouring cells lean the same way and the line bends instead of fraying.</p>
${bankFigures()}`,
      },
      {
        id: 'climate',
        title: 'Temperature and rain',
        html: `<p>The climate works in real units, degrees and the rainfall units the biome table was written in, because a model in made-up units cannot be checked against anything. <code>environmentAt</code> is where it is normalised to 0 to 1 for the game.</p>
${temperatureFigure()}
<p>Rain is a wind that blows across each row from the side the prevailing wind comes from, carrying humidity. Over the sea it picks more up. Over land it falls out in proportion to what it carries, over a reach of about 30 tiles with a floor of one rain unit a tile, and a lot where the ground climbs, and it cannot cross anything above ${(0.81).toFixed(2)} altitude. Each step is solved exactly (the fall-out is an exponential, then a steady floor), so the answer does not depend on how big a cell is, and the reach and the humidity grow with the width of the world so the same continent has the same climate at any size. Rain is made on its own, coarser grid for a world that is built in windows. A second, weaker pass blows down the map from the top or the bottom edge, picked by the seed, at a third of the humidity. Moisture then blends each cell's rain with its neighbours and adds the water in rivers.</p>
${rainFigure()}`,
      },
      {
        id: 'biomes',
        title: 'Choosing a biome',
        html: `<p><code>classify</code> takes height, temperature, moisture and whether a river runs there. Highland wins above ${HIGHLAND} altitude, then tundra below -5 degrees, then desert, then marsh, and otherwise a lookup in a five by twenty-six matrix of wetness against cold.</p>
${biomeTable()}
<p>Water is three biomes and they are what blocks: <code>isWater</code> covers ocean, lake and river. Do not test <code>elevation &lt; SEA_LEVEL</code>, because a lake stands above sea level and a river runs over land.</p>`,
      },
      {
        id: 'edges',
        title: 'Where biomes meet',
        html: `<p>Classifying a smooth field gives borders that are the level set of that field: smooth, tidy, and obviously drawn by a computer. <code>wanderEdges</code> rewrites the array by reading each land tile's biome from a position offset by three octaves of noise, a long lobe, a mid wave and a fine one that reaches about a tile.</p>
${grid(
  figure(img(before, 'Biomes straight from the classifier'), '<b>Classified.</b> Contours of a smooth field.'),
  figure(img(after, 'Biomes after wandering'), '<b>Wandered.</b> The same ground, interlocking several tiles deep.'),
)}
<p>It is baked into the array rather than applied in the painter <b>so that what you see and what the tile says are the same fact</b>. A warp in the painter alone would colour a tile meadow while the inspector, reading the array, called it desert. Water is never warped in either direction, since the painter's shoreline comes from the water mask.</p>`,
      },
      {
        id: 'rock',
        title: 'What the rock does to the surface',
        html: `<p>The climate alone paints a world of six grounds. Five more come from what is under them, and they are real biomes, so the painter, the plants and the inspector all see them through the one array. The last stage of the build (<code>terrain/surface.ts</code>) builds the geology of the world (<a href="geology.html">see geology</a>) while the field is still being made, reads it at four tile resolution blended smoothly to the tile, and rewrites <code>field.biome</code>. The climate's own answer is kept as <code>field.climate</code>, because the geology's soil depends on it and must never depend on its own result.</p>
${table(['Biome', 'Where it comes from', 'Rule'], [
  ['bare rock', 'steep or high ground with thin soil', 'highland with under 6 cm of soil, or a noise patch over it, more on steeper ground; hard bedrock on steep thin ground anywhere'],
  ['karst', 'soluble bedrock in a karst province', 'limestone, chalk or marble at the surface where the karst feature is over 0.3, in patches 26 tiles across'],
  ['volcanic', 'cones and young volcanic fields', 'within 40% of a cone radius of any volcano, patchy out to 80%, and a few fields where the volcanic feature is over 0.7'],
  ['salt flat', 'evaporite basins in the dry', 'the evaporite series with arid over 0.45 on flat ground, or the lowest dry basins in a desert'],
  ['badlands', 'soft dry-land rock exposed', 'sandstone, shale, clay, gypsum or ironstone in red-bed or evaporite country, dry, and mostly on slopes'],
])}
${grid(
  figure(img(climateMap, 'Biomes from climate alone'), '<b>Climate.</b> What the temperature, rain and height decide.'),
  figure(img(biomeMap, 'Biomes with the rock'), '<b>With the rock.</b> Bare rock on the mountains, lava round the cones, red badlands in the dry beds, white salt in the basins, pale karst on the limestone.'),
)}
<h3>How well things grow</h3>
<p>The same pass writes <code>field.fertility</code>, a byte with ${FERTILITY_ONE} meaning an ordinary loam: the soil depth (a thin soil is worth less, down to 60%), the kind of soil (sand 0.5, clay 0.85), what the bedrock weathers into (volcanic ash and basalt soils are rich, granite, quartzite and limestone are poor, gypsum and salt very poor) and the biome itself (bare rock 0.12, salt 0.03, fresh lava and ash 0.3, karst 0.45, badlands 0.35). It multiplies the <a href="ecosystem.html">eco score</a>, so the forms and densities that were already chosen by eco follow the soil: a forest thins on a granite ridge and a meadow runs over a basalt plain. The plants themselves grow at <code>0.25 + 0.75 * fertility</code> of their climate vigour, and herbs spread by the same factor.</p>
${grid(
  figure(img(fertilityMap, 'Fertility'), '<b>Fertility.</b> Pale is poor ground, green is rich. Rock, salt and lava are nearly white.'),
  `<div>${table(['Biome', 'Tiles', 'Share of land', 'Mean fertility'], landBiomes.map((b) => {
    let tiles = 0;
    let total = 0;
    for (let i = 0; i < tileGrid.count; i += 1) {
      if (field.biome[i] === b) {
        tiles += 1;
        total += field.fertility[i]!;
      }
    }
    return [BIOME_NAMES[b]!, tiles.toLocaleString(), percent(tiles, land), (total / Math.max(1, tiles) / FERTILITY_ONE).toFixed(2)];
  }))}</div>`,
)}`,
      },
      {
        id: 'result',
        title: 'What the world hands the game',
        html: `<p>For this seed, the share of every tile by biome:</p>
${table(['Biome', 'Tiles', 'Share'], BIOME_NAMES.slice(0, Biome.River).map((name, b) => [name, share[b]!.toLocaleString(), percent(share[b]!, tileGrid.count)]))}
<p>River is the last biome and never appears in the array, because a river is narrower than a tile. <code>world.river</code> rasterises the ribbons once for anything that needs to ask.</p>
<p>The ground's own state is then derived from this: <a href="ecosystem.html">how well things grow, and what grows</a>. The weather reads the same field through a coarse map, one texel to ${16} tiles: see <a href="weather.html">weather</a>.</p>
<p><b>Determinism.</b> Insertion order everywhere and explicit tie-breaks. Nothing in this pass may use <code>Math.random</code> or the clock, and the biome table above is the first thing to change if someone does.</p>`,
      },
    ],
  };
}
