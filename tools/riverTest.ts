import { COARSE, Geology } from '../src/sim/geology/geology.ts';
import { FEATURES } from '../src/sim/geology/minerals.ts';
import { TileGrid } from '../src/sim/grid.ts';
import { precipitation, temperatures } from '../src/sim/terrain/climate.ts';
import { buildCoarse, CLIMATE_SPACING } from '../src/sim/terrain/coarse.ts';
import { baseHeights } from '../src/sim/terrain/heightmap.ts';
import { Water } from '../src/sim/terrain/hydrology.ts';
import { buildNetwork } from '../src/sim/terrain/riverNetwork.ts';
import type { FineWindow } from '../src/sim/terrain/window.ts';
import { buildWindow, windowIndex } from '../src/sim/terrain/window.ts';
import type { Truth } from './windowTruth.ts';
import { truthFrom } from './windowTruth.ts';
import { buildField } from '../src/sim/terrain/worldfield.ts';

const SEED = Number(process.env.SEED ?? 20250214);
const K = Number(process.env.K ?? 8);
const SIZE = Number(process.env.SIZE ?? 256);
const HALO = Number(process.env.HALO ?? 32);
const MODES = (process.env.MODES ?? 'plain,network').split(',');
const SAMPLE = Number(process.env.SAMPLE ?? 1);
const PAIRS = Number(process.env.PAIRS ?? 8);
const BIG = Number(process.env.BIG ?? 8000);
const CHECK = process.env.CHECK !== undefined;

function originalTruth(): Truth {
  const field = buildField(SEED);
  const river = new Uint8Array(field.grid.count);
  for (let i = 0; i < river.length; i += 1) if (field.rivers.of[i] !== 0) river[i] = 1;
  return { grid: field.grid, water: field.water, flux: field.flux, river, climate: field.climate, biome: field.biome, fertility: field.fertility, geology: null };
}

let t = performance.now();
const CLIMATE = Number(process.env.CLIMATE ?? CLIMATE_SPACING);
const TRUTH_CLIMATE = Number(process.env.TRUTH_CLIMATE ?? CLIMATE);
const coarse = buildCoarse(SEED, K, CLIMATE);
const TRUTH_K = Number(process.env.TRUTH_K ?? K);
const truthField = TRUTH_CLIMATE === CLIMATE && TRUTH_K === K ? coarse : buildCoarse(SEED, TRUTH_K, TRUTH_CLIMATE);
console.log(`world ${coarse.grid.columns * K}x${coarse.grid.rows * K} tiles, climate at ${CLIMATE} m, coarse field k=${K} ${coarse.grid.columns}x${coarse.grid.rows} in ${(performance.now() - t).toFixed(0)} ms`);
t = performance.now();
const network = buildNetwork(coarse);
console.log(`river network: ${network.count} samples (${(network.count / 1000).toFixed(1)} km of rivers with flux >= ${BIG}) in ${(performance.now() - t).toFixed(0)} ms`);

const fine = TileGrid.world(1);
const pct = (x: number, y: number): number => (100 * x) / Math.max(1, y);
const median = (values: number[]): number => (values.length === 0 ? NaN : [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!);
const share = (values: number[], below: number): number => (values.length === 0 ? NaN : (100 * values.filter((v) => v < below).length) / values.length);

{
  const plain = baseHeights(fine, SEED);
  const rainFine = precipitation(fine, plain, temperatures(fine, plain, coarse.latitudes), coarse.latitudes, SEED);
  const columns = coarse.grid.columns;
  let n = 0;
  let within = 0;
  let sumLog = 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let row = 0; row < coarse.grid.rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (coarse.flow.water[row * columns + column] === Water.Ocean) continue;
      let sum = 0;
      let m = 0;
      for (let dy = 0; dy < K && row * K + dy < fine.rows; dy += 1) for (let dx = 0; dx < K && column * K + dx < fine.columns; dx += 1) {
        sum += rainFine[(row * K + dy) * fine.columns + column * K + dx]!;
        m += 1;
      }
      const truth = sum / m;
      const got = coarse.rain[row * columns + column]!;
      n += 1;
      sumLog += Math.abs(Math.log2((got + 1) / (truth + 1)));
      if (got + 1 < 2 * (truth + 1) && truth + 1 < 2 * (got + 1)) within += 1;
      sx += truth;
      sy += got;
      sxx += truth * truth;
      syy += got * got;
      sxy += truth * got;
    }
  }
  const corr = (n * sxy - sx * sy) / Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
  console.log(`climate: coarse rain vs rain computed at every tile, pooled ${K}x${K}, ${n} land cells: correlation ${corr.toFixed(3)}, within 2x ${pct(within, n).toFixed(0)}%, mean |log2 error| ${(sumLog / n).toFixed(2)}, mean ${(sy / n).toFixed(1)} vs ${(sx / n).toFixed(1)}`);
}

const positions: [number, number][] = [];
for (let row = 96; row + SIZE <= fine.rows - 96; row += SIZE) for (let column = 96; column + SIZE <= fine.columns - 96; column += SIZE) positions.push([column, row]);
const picked = positions.filter((_, i) => i % SAMPLE === 0);
console.log(`${picked.length} windows of ${SIZE} (halo ${HALO}), every ${SAMPLE}th of ${positions.length}`);

let failures = 0;
const check = (label: string, value: number, floor: number): void => {
  const ok = value >= floor;
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${label}: ${value.toFixed(1)} (needs ${floor})`);
};

const riverMask = (win: FineWindow): Uint8Array => {
  const mask = new Uint8Array(win.grid.count);
  for (let i = 0; i < mask.length; i += 1) if (win.rivers.of[i] !== 0) mask[i] = 1;
  return mask;
};
const near = (mask: Uint8Array, columns: number, c: number, r: number, reach: number): boolean => {
  for (let dy = -reach; dy <= reach; dy += 1) for (let dx = -reach; dx <= reach; dx += 1) if (mask[(r + dy) * columns + c + dx] === 1) return true;
  return false;
};

for (const mode of MODES) {
  const net = mode === 'network' ? network : null;
  t = performance.now();
  const truth = process.env.ORIGINAL ? originalTruth() : truthFrom(truthField, net, SEED);
  console.log(`\n=== ${mode}${process.env.ORIGINAL ? ' against the original generator' : ''}: truth world (every tile at once) built in ${((performance.now() - t) / 1000).toFixed(1)} s`);

  const tally = { windows: 0, ms: 0, tiles: 0, water: 0, lakeBoth: 0, lakeEither: 0, lakeTruth: 0, lakeWindow: 0, landTiles: 0, oceanBoth: 0, oceanEither: 0, biome: 0, surface: 0, cells: 0, seriesSame: 0, rockSame: 0, soilOff: 0, featureOff: 0, heads: [] as number[], fertility: 0, fertilityTiles: 0, dense: 0, window: 0, exact: 0, recall: 0, precision: 0, big: 0, bigRecall: 0, ratios: [] as number[], bigRatios: [] as number[] };
  for (const [column0, row0] of picked) {
    const started = performance.now();
    const win = buildWindow(coarse, net, column0, row0, SIZE, SIZE, { halo: HALO });
    tally.ms += performance.now() - started;
    tally.windows += 1;
    const mask = riverMask(win);
    for (let row = row0; row < row0 + SIZE; row += 1) {
      for (let column = column0; column < column0 + SIZE; column += 1) {
        const di = row * fine.columns + column;
        const wi = windowIndex(win, column, row);
        const dw = truth.water[di]!;
        const ww = win.water[wi]!;
        tally.tiles += 1;
        if (dw === ww) tally.water += 1;
        if (dw === Water.Ocean && ww === Water.Ocean) tally.oceanBoth += 1;
        if (dw === Water.Ocean || ww === Water.Ocean) tally.oceanEither += 1;
        if (dw !== Water.Ocean) tally.landTiles += 1;
        if (dw === Water.Lake) tally.lakeTruth += 1;
        if (ww === Water.Lake) tally.lakeWindow += 1;
        if (dw === Water.Lake && ww === Water.Lake) tally.lakeBoth += 1;
        if (dw === Water.Lake || ww === Water.Lake) tally.lakeEither += 1;
        if (truth.climate[di] === win.climate[wi]) tally.biome += 1;
        if (truth.biome[di] === win.biome[wi]) tally.surface += 1;
        if (truth.fertility) {
          tally.fertility += Math.abs(truth.fertility[di]! - win.fertility[wi]!);
          tally.fertilityTiles += 1;
        }
        const dr = truth.river[di] === 1;
        const wr = mask[wi] === 1;
        const big = dr && truth.flux[di]! >= BIG;
        if (dr) tally.dense += 1;
        if (wr) tally.window += 1;
        if (big) tally.big += 1;
        if (dr && wr) {
          tally.exact += 1;
          const ratio = Math.log2(Math.max(1, win.flux[wi]!) / Math.max(1, truth.flux[di]!));
          tally.ratios.push(ratio);
          if (big) tally.bigRatios.push(ratio);
        }
        if (dr && near(mask, win.grid.columns, column - column0 + HALO, row - row0 + HALO, 2)) {
          tally.recall += 1;
          if (big) tally.bigRecall += 1;
        }
        if (wr) {
          let hit = false;
          for (let dy = -2; dy <= 2 && !hit; dy += 1) for (let dx = -2; dx <= 2; dx += 1) if (truth.river[di + dy * fine.columns + dx] === 1) { hit = true; break; }
          if (hit) tally.precision += 1;
        }
      }
    }
  }
  if (truth.geology) {
    for (const [column0, row0] of picked) {
      const win = buildWindow(coarse, net, column0, row0, SIZE, SIZE, { halo: HALO });
      const mine = win.geology!.coarseFields();
      const theirs: ReturnType<Geology['coarseFields']> = truth.geology.coarseFields();
      const first = { column: column0 - HALO, row: row0 - HALO };
      for (let cr = HALO / COARSE; cr < (HALO + SIZE) / COARSE; cr += 1) {
        for (let cc = HALO / COARSE; cc < (HALO + SIZE) / COARSE; cc += 1) {
          const a = cr * mine.columns + cc;
          const b = ((first.row + cr * COARSE) / COARSE) * theirs.columns + (first.column + cc * COARSE) / COARSE;
          tally.cells += 1;
          if (mine.series[a] === theirs.series[b]) tally.seriesSame += 1;
          if (mine.surfaceRock[a] === theirs.surfaceRock[b]) tally.rockSame += 1;
          tally.soilOff += Math.abs(mine.soil[a]! - theirs.soil[b]!);
          for (let k = 0; k < FEATURES.length; k += 1) tally.featureOff += Math.abs(mine.features[a * FEATURES.length + k]! - theirs.features[b * FEATURES.length + k]!);
          const x = win.grid.x(cc * COARSE + COARSE / 2);
          const y = win.grid.y(cr * COARSE + COARSE / 2);
          const gap = win.geology!.tableAt(x, y) - truth.geology.tableAt(x, y);
          tally.heads.push(Math.abs(gap));
          if (process.env.HEADS && Math.abs(gap) > 50 && tally.heads.length % 40 === 0) console.log(`    head ${truth.geology.tableAt(x, y).toFixed(0)} m in truth, ${win.geology!.tableAt(x, y).toFixed(0)} m in window at ${x.toFixed(0)},${y.toFixed(0)}, ground ${win.terrain[(cr * COARSE + 2) * win.grid.columns + cc * COARSE + 2]!.toFixed(3)}`);
        }
      }
    }
  }
  console.log(`windows vs truth, ${(tally.ms / tally.windows).toFixed(0)} ms a window: water ${pct(tally.water, tally.tiles).toFixed(1)}% (ocean iou ${pct(tally.oceanBoth, tally.oceanEither).toFixed(1)}%, lakes ${pct(tally.lakeWindow, tally.landTiles).toFixed(1)}% of land in windows against ${pct(tally.lakeTruth, tally.landTiles).toFixed(1)}% in the whole-world run), climate biome ${pct(tally.biome, tally.tiles).toFixed(1)}%, final biome ${pct(tally.surface, tally.tiles).toFixed(1)}%, fertility off by ${(tally.fertility / Math.max(1, tally.fertilityTiles)).toFixed(1)} of 200`);
  console.log(`  river tiles: truth ${tally.dense}, window ${tally.window}, exact ${pct(tally.exact, tally.dense).toFixed(0)}%, recall(2) ${pct(tally.recall, tally.dense).toFixed(1)}%, precision(2) ${pct(tally.precision, tally.window).toFixed(1)}%, flux log2 median ${median(tally.ratios).toFixed(2)}, under half ${share(tally.ratios, -1).toFixed(1)}%`);
  console.log(`  big rivers (flux >= ${BIG}): ${tally.big} tiles, recall(2) ${pct(tally.bigRecall, tally.big).toFixed(1)}%, flux under half ${share(tally.bigRatios, -1).toFixed(1)}%`);
  if (tally.cells > 0) {
    const heads = [...tally.heads].sort((x, y) => x - y);
    console.log(`  geology per 4x4 cell (${tally.cells} cells): series same ${pct(tally.seriesSame, tally.cells).toFixed(1)}%, surface rock same ${pct(tally.rockSame, tally.cells).toFixed(1)}%, soil off by ${(tally.soilOff / tally.cells).toFixed(2)} of 255, features off by ${(tally.featureOff / (tally.cells * FEATURES.length)).toFixed(2)} of 255, water table off by median ${heads[Math.floor(heads.length / 2)]!.toFixed(2)} m, p90 ${heads[Math.floor(heads.length * 0.9)]!.toFixed(2)} m`);
  }

  const buckets = [800, 2500, 8000, 30000, Infinity];
  const both = buckets.map(() => 0);
  const either = buckets.map(() => 0);
  let seamWater = 0;
  let seamTiles = 0;
  let seamOcean = 0;
  const pairs = picked.filter((_, i) => i % 2 === 0).slice(0, PAIRS);
  for (const [column0, row0] of pairs) {
    const shiftX = Math.floor(SIZE / 2);
    const shiftY = Math.floor(SIZE / 3);
    const a = buildWindow(coarse, net, column0, row0, SIZE, SIZE, { halo: HALO });
    const b = buildWindow(coarse, net, column0 + shiftX, row0 + shiftY, SIZE, SIZE, { halo: HALO });
    const maskA = riverMask(a);
    const maskB = riverMask(b);
    for (let row = row0 + shiftY; row < row0 + SIZE; row += 1) {
      for (let column = column0 + shiftX; column < column0 + SIZE; column += 1) {
        const ia = windowIndex(a, column, row);
        const ib = windowIndex(b, column, row);
        seamTiles += 1;
        if (a.water[ia] === b.water[ib]) seamWater += 1;
        else if (a.water[ia] === Water.Ocean || b.water[ib] === Water.Ocean) seamOcean += 1;
        if (maskA[ia] === 0 && maskB[ib] === 0) continue;
        const k = buckets.findIndex((limit) => Math.max(a.flux[ia]!, b.flux[ib]!) < limit);
        either[k] = either[k]! + 1;
        if (maskA[ia] === 1 && maskB[ib] === 1) both[k] = both[k]! + 1;
      }
    }
  }
  console.log(`  placement independence (${pairs.length} window pairs offset by half and a third): water same ${pct(seamWater, seamTiles).toFixed(2)}% (ocean differs on ${pct(seamOcean, seamTiles).toFixed(2)}%)`);
  buckets.forEach((limit, k) => console.log(`    rivers with flux < ${limit}: ${either[k]} tiles, in both windows ${pct(both[k]!, either[k]!).toFixed(1)}%`));
  const bigK = buckets.findIndex((limit) => limit > BIG);
  const bigBoth = both.slice(bigK).reduce((x, y) => x + y, 0);
  const bigEither = either.slice(bigK).reduce((x, y) => x + y, 0);

  if (CHECK && mode === (process.env.CHECK || 'network')) {
    check('water class agreement with truth %', pct(tally.water, tally.tiles), 98);
    check('river recall within 2 tiles %', pct(tally.recall, tally.dense), 97);
    check('river precision within 2 tiles %', pct(tally.precision, tally.window), 80);
    check('big river recall within 2 tiles %', pct(tally.bigRecall, tally.big), 95);
    check('river flux within 2x of truth %', 100 - share(tally.ratios, -1), 97);
    check('big rivers identical across window placements %', pct(bigBoth, bigEither), 95);
    check('biome agreement with truth %', pct(tally.biome, tally.tiles), 95);
    check('water identical across window placements %', pct(seamWater, seamTiles), 99.9);
    const lakeRatio = tally.lakeTruth === 0 ? 1 : tally.lakeWindow / tally.lakeTruth;
    check('lake area in windows within a factor of three of the whole run (100 = the limit)', 100 * Math.min(lakeRatio, 1 / Math.max(lakeRatio, 1e-9)) * 3, 100);
    check('lakes under 8% of the land (100 - percent)', 100 - pct(tally.lakeWindow, tally.landTiles), 92);
  }
}

if (CHECK) {
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}
void buildField;
