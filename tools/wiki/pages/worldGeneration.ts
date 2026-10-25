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
import { classifyAll } from '../../../src/sim/terrain/worldfield.ts';
import { RIVER_FLUX, Water } from '../../../src/sim/terrain/hydrology.ts';
import { world, SEED } from '../context.ts';
import { BIOME_RGB, heat, hypsometric, mono, wetness } from '../maps.ts';
import type { Page, PageLink } from '../page.ts';
import { callout, figure, flow, grid, img, SERIES, table } from '../page.ts';
import { line, renderMap } from '../raster.ts';
import { areaChart, heatmap, legend, lineChart, samples } from '../svg.ts';
import { BIOME_COLORS } from '../../../src/render/palette.ts';

const STEP = 4;

const percent = (n: number, of: number): string => `${((100 * n) / of).toFixed(1)}%`;

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
          if (classed[i] !== field.biome[i]) changed += 1;
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
  const after = crop('wg-wandered.png', field.biome);

  let land = 0;
  let sea = 0;
  let lake = 0;
  const share = new Array<number>(9).fill(0);
  for (let i = 0; i < tileGrid.count; i += 1) {
    if (field.water[i] === Water.Ocean) sea += 1;
    else if (field.water[i] === Water.Lake) lake += 1;
    else land += 1;
    share[field.biome[i]!] = share[field.biome[i]!]! + 1;
  }
  const latitudes = latitudesOf(SEED);

  const landBiomes = [Biome.Meadow, Biome.Forest, Biome.Highland, Biome.Marsh, Biome.Tundra, Biome.Desert];

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
          { title: 'Raise the land', text: 'Eight octaves of noise, a smooth shore falloff.' },
          { title: 'Fill the seas', text: 'Priority flood from the edge, lakes in every hollow.' },
          { title: 'Send the rain', text: 'Wind carries humidity across land and over hills.' },
          { title: 'Cut the rivers', text: 'Flow accumulation, then a ribbon for every strong cell.' },
          { title: 'Raise the winds', text: 'Latitude belt, altitude, fetch, ravines, shelter.' },
          { title: 'Sow the ground', text: 'Classify each tile, then wander the edges.' },
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
  figure(img(biomeMap, 'Biome map'), '<b>6 Biomes.</b> The only thing the game keeps from all of this, together with the water and rivers.'),
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
        id: 'water',
        title: 'Sea, lakes and rivers',
        html: `<p>The sea is every cell below sea level that connects to the edge of the map. From the sea a priority flood grows inland, always taking the lowest unvisited cell next and giving each cell the higher of its own height and the level the flood reached it at, plus a hair. Wherever that raised surface stands above the real ground, the hollow is a lake. Then every cell drains to its steepest neighbour and the rain is added up along the way. A cell carrying more than <code>RIVER_FLUX</code> (${RIVER_FLUX}) is a river.</p>
${callout(`<p><b>Three rules that look like details and are not.</b></p><p>Route the water down the steepest slope, not back the way the flood came: the flood reaches a cell from whichever neighbour got there first, and following that back makes radial lines.</p><p>A flat is drained by the ground under it, not by the fill on top. Fill a hollow and its surface is level to the last bit, so steepest descent runs dead straight out of the spill point and a basin becomes a star of rays. The tie is broken on the drowned bed.</p><p>Lakes evaporate and a dry basin is a sink. Without that a desert is stippled with blue. Drying and filling settle each other, so they are asked in turn, three rounds at most.</p>`)}
<p>This seed has ${field.rivers.segments.length.toLocaleString()} river segments and ${field.rivers.count.toLocaleString()} river cells. A river is a ribbon narrower than a tile, so it is drawn from its segments and never written into the biome array. The meander is a field in world units, not jitter per cell, so neighbouring cells lean the same way and the line bends instead of fraying.</p>`,
      },
      {
        id: 'climate',
        title: 'Temperature and rain',
        html: `<p>The climate works in real units, degrees and the rainfall units the biome table was written in, because a model in made-up units cannot be checked against anything. <code>environmentAt</code> is where it is normalised to 0 to 1 for the game.</p>
${temperatureFigure()}
<p>Rain is a wind that blows across each row from the side the prevailing wind comes from, carrying humidity. Over the sea it picks more up. Over land it drops some every step, a lot where the ground climbs, and it cannot cross anything above ${(0.81).toFixed(2)} altitude. A second, weaker pass blows down the map from the top or the bottom edge, picked by the seed, at a third of the humidity. Moisture then blends each cell's rain with its neighbours and adds the water in rivers.</p>
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
        id: 'result',
        title: 'What the world hands the game',
        html: `<p>For this seed, the share of every tile by biome:</p>
${table(['Biome', 'Tiles', 'Share'], BIOME_NAMES.slice(0, 8).map((name, b) => [name, share[b]!.toLocaleString(), percent(share[b]!, tileGrid.count)]))}
<p>River is the ninth biome and never appears in the array, because a river is narrower than a tile. <code>world.river</code> rasterises the ribbons once for anything that needs to ask.</p>
<p>The ground's own state is then derived from this: <a href="ecosystem.html">how well things grow, and what grows</a>. The weather reads the same field through a coarse map, one texel to ${16} tiles: see <a href="weather.html">weather</a>.</p>
<p><b>Determinism.</b> Insertion order everywhere and explicit tie-breaks. Nothing in this pass may use <code>Math.random</code> or the clock, and the biome table above is the first thing to change if someone does.</p>`,
      },
    ],
  };
}
