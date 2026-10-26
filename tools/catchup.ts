import { DEFAULT_TUNING, Fauna } from '../src/sim/fauna/fauna.ts';
import type { FaunaTuning, FaunaWeather } from '../src/sim/fauna/fauna.ts';
import { LIFE_COUNT, LIVES, PATCH_TILES, Stage } from '../src/sim/fauna/life.ts';
import { Fish } from '../src/sim/fish/fish.ts';
import { World } from '../src/sim/world.ts';

const SEED = Number(process.env.SEED ?? 20250214);
const [FIRST, LAST] = (process.env.BAND ?? '30-66').split('-').map(Number) as [number, number];
const SCENARIO = process.env.SCENARIO ?? 'flood';
const TIMES = (process.env.TIMES ?? '0.25,1,4').split(',').map(Number);
const STEPS = (process.env.STEPS ?? '0.05,0.25,1').split(',').map(Number);
const FINE = Number(process.env.FINE ?? 0.01);
const SETTLE = Number(process.env.SETTLE ?? 20);
const BLOCK = 6;
const FACTOR = Number(process.env.FACTOR ?? 3);
const MARGIN = Number(process.env.MARGIN ?? 2);

const world = World.generate(SEED);
const tuning: FaunaTuning = { ...DEFAULT_TUNING, maxStep: 0.25, ...JSON.parse(process.env.TUNE ?? '{}') };
const fauna = new Fauna(world, SEED, tuning);
const fish = new Fish(world, SEED, fauna);
const { columns, count } = fauna.patches;
const { grid } = world;
const celsius = new Float32Array(count);
for (let p = 0; p < count; p += 1) {
  const column = Math.min(grid.columns - 1, (p % columns) * PATCH_TILES + 8);
  const row = Math.min(grid.rows - 1, Math.floor(p / columns) * PATCH_TILES + 8);
  celsius[p] = world.field.temperature[row * grid.columns + column]!;
}
const weather: FaunaWeather = { celsius, snow: new Float32Array(count), cellOf: Int32Array.from({ length: count }, (_, i) => i) };
const waters = { temperatureAt: (tile: number) => world.field.temperature[tile]!, daylightAt: () => 0.5 };
fish.populate(waters);
fish.measure();
fauna.populate();

const hidden = fauna as unknown as { clock: number; lastVisit: Float64Array; rho: Float32Array };
const snapshot = () => ({ stock: fauna.stock.slice(), fed: fauna.fed.slice(), rho: hidden.rho.slice() });
type Snapshot = ReturnType<typeof snapshot>;
const restore = (s: Snapshot): void => {
  fauna.stock.set(s.stock);
  fauna.fed.set(s.fed);
  hidden.rho.set(s.rho);
  hidden.clock = 0;
  hidden.lastVisit.fill(0);
};
const sweep = (dt: number, first: number, last: number): void => {
  tuning.maxStep = Math.max(dt, 1e-6);
  fauna.sweep(dt, weather, first, last);
  fauna.fishTake.fill(0);
};
const run = (years: number, dt: number, first = FIRST, last = LAST): number => {
  const t = performance.now();
  const n = Math.max(1, Math.round(years / dt));
  for (let i = 0; i < n; i += 1) sweep(years / n, first, last);
  return performance.now() - t;
};

const t0 = performance.now();
run(SETTLE, 0.25, 0, fauna.patches.rows);
console.log(`settled ${SETTLE} years over the whole world in ${(performance.now() - t0).toFixed(0)} ms, ${columns}x${fauna.patches.rows} patches, ${LIFE_COUNT} species`);
const equilibrium = snapshot();

const blockRows = [Math.floor((FIRST + LAST) / 2) - BLOCK / 2, Math.floor((FIRST + LAST) / 2) + BLOCK / 2] as const;
const alive = (column: number): number => {
  let score = 0;
  for (let row = blockRows[0]; row < blockRows[1]; row += 1) for (let c = column; c < column + BLOCK; c += 1) for (let id = 0; id < LIFE_COUNT; id += 1) if (fauna.stockOf(row * columns + c, id, Stage.Adult) > 0.01) score += 1;
  return score;
};
let bestColumn = 0;
for (let c = 0; c + BLOCK <= columns; c += 1) if (alive(c) > alive(bestColumn)) bestColumn = c;
const block: number[] = [];
for (let row = blockRows[0]; row < blockRows[1]; row += 1) for (let c = bestColumn; c < bestColumn + BLOCK; c += 1) block.push(row * columns + c);
console.log(`block rows ${blockRows[0]}-${blockRows[1]} columns ${bestColumn}-${bestColumn + BLOCK}, ${block.length} patches`);

const total = (id: number, patches: number[], stage: number = Stage.Adult): number => {
  let sum = 0;
  for (const p of patches) sum += fauna.stockOf(p, id, stage);
  return sum;
};

let predator = -1;
for (let id = 0; id < LIFE_COUNT; id += 1) {
  const life = LIVES[id]!;
  if (life.eats === 0 || life.plant[2]! > 0 || total(id, block) < 0.5) continue;
  if (predator < 0 || life.mass[Stage.Adult]! > LIVES[predator]!.mass[Stage.Adult]!) predator = id;
}
const prey = fauna.inspect(block[Math.floor(block.length / 2)]!, predator).prey.sort((a, b) => b.stock - a.stock).slice(0, 3).map((e) => e.key);
console.log(`predator ${LIVES[predator]!.key} (${LIVES[predator]!.mass[Stage.Adult]} kg), block adults ${total(predator, block).toFixed(2)}; main prey ${prey.join(', ')}`);

const disturb = (): void => {
  for (const p of block) {
    const at = (p * LIFE_COUNT + predator) * 4;
    if (SCENARIO === 'none') continue;
    if (SCENARIO === 'cull') {
      for (let s = 0; s < 4; s += 1) fauna.stock[at + s] = 0;
    } else {
      const cap = fauna.capacity(p, predator);
      fauna.stock[at + Stage.Adult] = Math.max(fauna.stock[at + Stage.Adult]!, FACTOR * cap);
    }
  }
};
disturb();
const disturbed = snapshot();

const speciesIds = Array.from({ length: LIFE_COUNT }, (_, id) => id);
const vector = (patches: number[]): Float64Array => Float64Array.from(speciesIds, (id) => total(id, patches));
const ring = (): number[] => {
  const out: number[] = [];
  const rows = fauna.patches.rows;
  for (let row = Math.max(0, blockRows[0] - MARGIN); row < Math.min(rows, blockRows[1] + MARGIN); row += 1) for (let c = Math.max(0, bestColumn - MARGIN); c < Math.min(columns, bestColumn + BLOCK + MARGIN); c += 1) out.push(row * columns + c);
  return out;
};
const region = ring();
const rowsOfRegion: [number, number] = [Math.max(0, blockRows[0] - MARGIN), Math.min(fauna.patches.rows, blockRows[1] + MARGIN)];

const EPS = 1e-3;
const score = (truth: Float64Array, got: Float64Array): { median: number; mean: number; within2: number; species: number } => {
  const errors: number[] = [];
  let within = 0;
  for (let id = 0; id < LIFE_COUNT; id += 1) {
    if (truth[id]! < 0.05 && got[id]! < 0.05) continue;
    const e = Math.abs(Math.log((got[id]! + EPS) / (truth[id]! + EPS)));
    errors.push(e);
    if (e < Math.log(2)) within += 1;
  }
  errors.sort((a, b) => a - b);
  return { median: errors[Math.floor(errors.length / 2)] ?? 0, mean: errors.reduce((s, e) => s + e, 0) / Math.max(1, errors.length), within2: within / Math.max(1, errors.length), species: errors.length };
};
const fmt = (x: number, d = 2): string => x.toFixed(d);

const longest = Math.max(...TIMES);
const truthAt = new Map<number, Snapshot>();
restore(disturbed);
const fineMs = new Map<number, number>();
let elapsed = 0;
let spent = 0;
const trajectory: string[] = [];
for (const T of [...TIMES].sort((a, b) => a - b)) {
  spent += run(T - elapsed, FINE);
  elapsed = T;
  truthAt.set(T, snapshot());
  fineMs.set(T, spent);
}
void longest;

const detail = (label: string, vec: Float64Array): string => `${label.padEnd(26)} ${LIVES[predator]!.key} ${fmt(vec[predator]!, 2).padStart(8)}  ` + prey.map((key) => `${key} ${fmt(vec[LIVES.findIndex((l) => l.key === key)]!, 2).padStart(9)}`).join('  ');

for (const T of TIMES) {
  restore(truthAt.get(T)!);
  const truthBlock = vector(block);
  const truthRegion = vector(region);
  const truthWorld = vector(Array.from({ length: (FIRST < LAST ? LAST - FIRST : 0) * columns }, (_, i) => FIRST * columns + i));
  console.log(`\n=== ${SCENARIO}, away ${T} years (fine reference ${FINE}/sweep took ${fmt(fineMs.get(T)!, 0)} ms for the whole band)`);
  console.log(detail('truth (fine, all rows)', truthBlock));
  restore(equilibrium);
  console.log(detail('same scene (reset)', vector(block)));
  console.log(`${' '.repeat(26)} error vs truth: block ${JSON.stringify(roundAll(score(truthBlock, vector(block))))}`);
  restore(disturbed);
  console.log(detail('frozen at departure', vector(block)));
  console.log(`${' '.repeat(26)} error vs truth: block ${JSON.stringify(roundAll(score(truthBlock, vector(block))))}`);
  for (const dt of STEPS) {
    if (dt > T) continue;
    restore(disturbed);
    const ms = run(T, dt);
    const got = vector(block);
    console.log(detail(`catch-up band dt ${dt}`, got));
    console.log(`${' '.repeat(26)} ${fmt(ms, 0)} ms; error block ${JSON.stringify(roundAll(score(truthBlock, got)))} region ${JSON.stringify(roundAll(score(truthRegion, vector(region))))} band ${JSON.stringify(roundAll(score(truthWorld, vector(Array.from({ length: (LAST - FIRST) * columns }, (_, i) => FIRST * columns + i)))))}`);
  }
  for (const dt of STEPS) {
    if (dt > T) continue;
    restore(disturbed);
    const ms = run(T, dt, rowsOfRegion[0], rowsOfRegion[1]);
    const got = vector(block);
    console.log(detail(`catch-up local dt ${dt}`, got));
    console.log(`${' '.repeat(26)} ${fmt(ms, 0)} ms (rows ${rowsOfRegion[0]}-${rowsOfRegion[1]} only); error block ${JSON.stringify(roundAll(score(truthBlock, got)))} region ${JSON.stringify(roundAll(score(truthRegion, vector(region))))}`);
  }
  for (const margin of (process.env.MARGINS ?? '0,1,2,4').split(',').map(Number)) {
    restore(disturbed);
    const area = { firstColumn: bestColumn - margin, lastColumn: bestColumn + BLOCK + margin, firstRow: blockRows[0] - margin, lastRow: blockRows[1] + margin };
    const t = performance.now();
    fauna.catchUp(T, weather, area);
    const ms = performance.now() - t;
    const got = vector(block);
    console.log(detail(`engine margin ${margin}`, got));
    console.log(`${' '.repeat(26)} ${fmt(ms, 0)} ms (${(area.lastColumn - area.firstColumn) * (area.lastRow - area.firstRow)} patches); error block ${JSON.stringify(roundAll(score(truthBlock, got)))}`);
  }
}

function roundAll(o: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 100) / 100]));
}
void trajectory;
