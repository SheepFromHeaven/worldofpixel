import { CATCH_UP_COARSE_STEP, CATCH_UP_FINE_STEP, CATCH_UP_FINE_YEARS, CATCH_UP_MAX_YEARS } from '../../../src/sim/fauna/fauna.ts';
import { CLIMATE_SPACING } from '../../../src/sim/terrain/coarse.ts';
import { SEA_LEVEL } from '../../../src/sim/terrain/heightmap.ts';
import { Water } from '../../../src/sim/terrain/hydrology.ts';
import { BIOME_RGB, hypsometric } from '../maps.ts';
import type { Page, PageLink } from '../page.ts';
import { callout, figure, grid, img, table } from '../page.ts';
import { renderMap } from '../raster.ts';
import type { Patch } from '../windowRun.ts';
import { HALO, PATCH, SIZE, SPACING, windowRun } from '../windowRun.ts';

export const LINK: PageLink = {
  slug: 'world-scale',
  title: 'Bigger worlds',
  summary: 'A coarse global field, 1 m windows made on demand, geology per window, and catching up ground nobody watched.',
};

const pct = (value: number): string => `${value.toFixed(1)}%`;

function shaded(patch: Patch, biomes: Uint8Array, name: string): string {
  const { columns, rows, height } = patch;
  const at = (c: number, r: number): number => height[Math.min(rows - 1, Math.max(0, r)) * columns + Math.min(columns - 1, Math.max(0, c))]!;
  return renderMap(name, {
    columns,
    rows,
    step: 1,
    zoom: 1,
    colourAt: (c, r) => {
      const biome = biomes[r * columns + c]!;
      const base = BIOME_RGB[biome] ?? [255, 0, 255];
      const water = biome === 6 || biome === 7;
      const lit = water ? 1 : 1 + Math.max(-0.3, Math.min(0.3, (at(c - 1, r - 1) - at(c + 1, r + 1)) * 14));
      return [Math.min(255, base[0] * lit), Math.min(255, base[1] * lit), Math.min(255, base[2] * lit)];
    },
  });
}

export function build(): Page {
  const run = windowRun();
  const overview = renderMap('scale-coarse.png', {
    columns: run.coarseColumns,
    rows: run.coarseRows,
    step: 1,
    zoom: 2,
    colourAt: (c, r) => {
      const i = r * run.coarseColumns + c;
      if (run.coarseWater[i] === Water.Ocean) return [38, 74, 104];
      return hypsometric(Math.max(SEA_LEVEL, run.coarseHeight[i]!));
    },
  });
  const truthMap = shaded(run.patch, run.patch.truthBiome, 'scale-truth.png');
  const windowMap = shaded(run.patch, run.patch.windowBiome, 'scale-windows.png');

  const fidelity = table(
    ['What is compared', 'Agreement', 'Note'],
    [
      ['Water class (land, ocean, lake)', pct(run.water), 'every tile of every window'],
      ['Lakes, share of the land', `${pct(run.lakeWindows)} in windows, ${pct(run.lakeWhole)} whole`, 'the same lakes are not required, only as many of them; overlapping windows agree on every tile of water'],
      ['River tiles found within 2 tiles', pct(run.riverRecall), 'of every river tile in the whole-world run'],
      ['River tiles that are real within 2 tiles', pct(run.riverPrecision), 'of every river tile a window draws'],
      ['Climate biome', pct(run.climate), 'before the rock is consulted'],
      ['Final biome, from the rock', pct(run.biome), 'rock, karst, salt, badlands, volcanic'],
      ['Fertility', `off by ${run.fertilityOff.toFixed(1)} of 200`, 'mean over every tile'],
    ],
  );

  const geologyTable = table(
    ['Per 4 x 4 tile cell', 'Agreement', 'Note'],
    [
      ['Rock series', pct(run.series), `${run.cells.toLocaleString('en')} cells`],
      ['Surface rock', pct(run.rock), ''],
      ['Soil depth', `off by ${run.soilOff.toFixed(2)} of 255`, 'mean'],
      ['Mineral and rock features', `off by ${run.featuresOff.toFixed(2)} of 255`, 'mean over the ten features'],
      ['Water table', `median ${run.tableMedian.toFixed(2)} m, 90th percentile ${run.tableP90.toFixed(1)} m`, 'from the coarse table where water is out of view'],
    ],
  );

  const sizes = table(
    ['World', 'Dense generation', 'Memory held', 'Windowed'],
    [
      ['3.3 km2 (today)', '3.0 s', '330 MB', 'coarse field in under 0.2 s'],
      ['12.4 km2', '12.8 s', '1.1 GB', 'coarse field in under 0.5 s'],
      ['27.3 km2', '25.7 s', '2.4 GB', 'coarse field in under 0.5 s'],
      ['48 km2', 'about 50 s for the whole-world check', 'too much for a tab', 'coarse field 0.7 s, 97 ms a window'],
    ],
  );

  const catchUp = table(
    ['Away', 'Same scene', 'Catch-up, step 0.05 then 0.1', 'Cost for 100 patches'],
    [
      ['1 year', 'median error 0.2, 70% of species within 2x', 'median error 0.04, 90% within 2x', '134 ms'],
      ['4 years', 'median error 0.29, 64% within 2x', 'median error 0.08, 80% within 2x', '410 ms'],
    ],
  );

  return {
    ...LINK,
    lede: `The world is built from one coarse field and sharp windows cut out of it. The coarse field is one cell to ${SPACING} tiles and keeps the shape of the land, the sea, the lakes and the big drains, so it is small enough to hold for a very large world. A window is a square of tiles at one tile to the metre, made when somebody looks at it, with the same code that makes the whole world today. This page measures how closely the two ways agree.`,
    sections: [
      {
        id: 'coarse',
        title: 'The coarse field',
        html: `<p>The coarse field holds heights built from the broad octaves only (the plates, landforms and the first three noise octaves reach it; the finest noise does not), the sea, the lakes with their level, which way every cell drains and how much water passes. It runs the same priority flood and flow accumulation as the dense world, on a grid of ${SPACING} tile cells. Heights and the rock layers are functions of position, so they need no grid at all; only the drainage and the rain do.</p><p>The rain model measures every step in tiles of the same size and solves it exactly (the fall-out is an exponential, then a steady floor), so it gives the same climate whatever the cell, and its reach and humidity grow with the width of the world (<code>WORLD_SIZE_FACTOR</code>), so the same continent has the same climate at any size. Climate is made on its own grid, ${CLIMATE_SPACING} tiles to a cell at this size and 8 times the world factor in general, from the mean of the heights inside each cell, and the field reads it smoothly. Rain made that way correlates ${run.climateCorrelation.toFixed(2)} with rain made at every tile, and what has to be fine is only the drainage, which keeps its answer down to cells of about 16 tiles and degrades beyond 32.</p><p>The plates grow with the world (<code>PLATE_SCALE</code>), so a bigger world has the same few continents, larger, and a lake is what its inflow can feed: half the rain that reaches a closed basin against the evaporation of its surface, so lakes stay a few percent of the land at every size.</p>${figure(img(overview, 'The coarse field drawn as a map', run.coarseColumns * 2), `The whole world as ${run.coarseColumns} x ${run.coarseRows} coarse cells. This is all that has to be kept for the world at large.`, true)}`,
      },
      {
        id: 'windows',
        title: 'A window',
        html: `<p>A window is ${SIZE} tiles across with a ${HALO} tile border that is thrown away. Inside it the heights are the real heights at every tile, the sea is every tile below sea level next to coarse ocean, the lakes fill from the levels the coarse field gives at the border, and the water drains by the same flood and steepest descent as the whole world. Nothing in a window depends on where it was cut, so two windows overlapping agree (99.9% of tiles).</p>${grid(figure(img(truthMap, 'The world made all at once', 384), `The world made all at once, ${PATCH * SIZE} tiles square.`), figure(img(windowMap, 'The same ground from nine windows', 384), `The same ground from ${PATCH * PATCH} windows laid side by side. There are no seams.`))}${table(['Cost', 'Value'], [['One window', `${run.msPerWindow.toFixed(0)} ms for ${(SIZE + 2 * HALO) ** 2 / 1000 | 0}k tiles with geology`], ['Coarse field', `${run.coarseMs.toFixed(0)} ms for ${run.coarseCells.toLocaleString('en')} cells`], ['Whole world for the check', `${run.truthSeconds.toFixed(1)} s`]])}`,
      },
      {
        id: 'fidelity',
        title: 'How closely windows agree',
        html: `<p>Every number here is measured by running the whole world at once on the same rain, then cutting ${run.windows} windows and comparing tile by tile (<code>npm run rivers</code> does the same at any size).</p>${fidelity}${callout('The world is not the one the game made before windows. The rain model and the lakes were rewritten (lakes by water balance, not by whether a hollow can fill), so a seed gives a somewhat different map. Climate made on a grid coarser than about 16 tiles at the size of the first world loses the small ranges that shed the rain, which is why the climate grid grows only with the world.')}`,
      },
      {
        id: 'geology',
        title: 'Geology in a window',
        html: `<p>The geology already works on cells of 4 x 4 tiles, so a window builds its own: plates and volcanoes by position, soil and rock from the window's wetness and heights, the surface biomes from the rock. The groundwater table is the one thing that reaches beyond a window (it spreads down a slope from any water however far), so each window starts from the coarse field's table and takes the lower of the two.</p>${geologyTable}<p>The geology was also made faster without changing a single result: the noise that is read along a row of tiles keeps its lattice corners, the nearest plates and volcanoes are kept for the cell being walked, and the per-cell closures and lookups are gone. Making the heights 40% faster and the rock 40% faster took the whole world from 5.4 s to 3.9 s of CPU.</p>`,
      },
      {
        id: 'sizes',
        title: 'What it costs',
        html: `<p>Measured on this machine by making the world 1, 2, 3 and 4 times as wide as today.</p>${sizes}<p>The coarse field is about 45 bytes a cell, so cells of ${SPACING} tiles reach about a 30 km square in a tab and cells of 32 tiles about 100 km. Real world size above that needs a coarser level for the climate.</p>`,
      },
      {
        id: 'catch-up',
        title: 'Ground nobody watched',
        html: `<p>The food web keeps one number per species and stage in every patch of 16 tiles, so ground that is out of view can be brought up to date when the player returns instead of being simulated all the time. <code>Fauna.catchUp</code> advances only the patches around a region, at a step of ${CATCH_UP_FINE_STEP} for the first ${CATCH_UP_FINE_YEARS} years and ${CATCH_UP_COARSE_STEP} after that, for at most ${CATCH_UP_MAX_YEARS} years, and <code>capture</code> and <code>restoreState</code> save only the patches that were disturbed. Steps of 0.25 or more do no better than leaving the scene as it was, because they smooth away the boom and the crash.</p>${catchUp}<p>It costs about a millisecond for each patch and year, so a square kilometre left for a year takes about four seconds. A patch with a margin of one or two patches around it is enough.</p>`,
      },
    ],
    code: [
      'src/sim/terrain/coarse.ts: buildCoarse, sampleGrid',
      'src/sim/terrain/window.ts: buildWindow, coarseOcean',
      'src/sim/geology/geology.ts: relaxTable, GeologyOptions',
      'src/sim/fauna/fauna.ts: catchUp, advanceRegion, capture, restoreState',
      'tools/riverTest.ts, tools/windowTruth.ts: the comparison',
    ],
  };
}

