import { DEFAULT_TUNING, Fauna } from '../src/sim/fauna/fauna.ts';
import type { FaunaWeather } from '../src/sim/fauna/fauna.ts';
import { FAUNA_YEAR_DAYS, LIFE_COUNT, LIVES, PATCH_TILES, Stage } from '../src/sim/fauna/life.ts';
import { Fish } from '../src/sim/fish/fish.ts';
import { FISH, FISH_COUNT } from '../src/sim/fish/species.ts';
import { World } from '../src/sim/world.ts';

const SEED = Number(process.argv[2] ?? 20250214);
const YEARS = Number(process.argv[3] ?? 20);
const SWEEP = Number(process.argv[4] ?? 0.01);
const [FIRST, LAST] = (process.argv[5] ?? '0-96').split('-').map(Number) as [number, number];

const started = performance.now();
const world = World.generate(SEED);
console.log(`world ${(performance.now() - started).toFixed(0)} ms`);

const t0 = performance.now();
const tuning = { ...DEFAULT_TUNING, ...JSON.parse(process.env.TUNE ?? '{}') };
const fauna = new Fauna(world, SEED, tuning);
console.log(`fauna ${(performance.now() - t0).toFixed(0)} ms, patches ${fauna.patches.columns}x${fauna.patches.rows}`);

const fish = new Fish(world, SEED, fauna);
const { columns, rows, count } = fauna.patches;
const { grid } = world;
const celsius = new Float32Array(count);
for (let p = 0; p < count; p += 1) {
  const column = Math.min(grid.columns - 1, (p % columns) * PATCH_TILES + 8);
  const row = Math.min(grid.rows - 1, Math.floor(p / columns) * PATCH_TILES + 8);
  celsius[p] = world.field.temperature[row * grid.columns + column]!;
}
const weather: FaunaWeather = { celsius, snow: new Float32Array(count), cellOf: Int32Array.from({ length: count }, (_, i) => i) };

const waters = {
  temperatureAt: (tile: number) => world.field.temperature[tile]!,
  daylightAt: () => 0.5,
};
fish.populate(waters);
fish.measure();
fauna.populate();

const report = (label: string): void => {
  const p0 = FIRST * columns;
  const p1 = LAST * columns;
  const adults = fauna.totals(Stage.Adult, p0, p1);
  const juv = fauna.totals(Stage.Juvenile, p0, p1);
  const hatch = fauna.totals(Stage.Hatchling, p0, p1);
  const eggs = fauna.totals(Stage.Egg, p0, p1);
  console.log(`--- ${label}`);
  for (let id = 0; id < LIFE_COUNT; id += 1) {
    const life = LIVES[id]!;
    const patches = fauna.presence(id, Stage.Adult, 0.01, p0, p1);
    console.log(`${life.key.padEnd(16)} A ${adults[id]!.toFixed(1).padStart(10)}  J ${juv[id]!.toFixed(1).padStart(9)}  H ${hatch[id]!.toFixed(1).padStart(9)}  E ${eggs[id]!.toFixed(1).padStart(10)}  patches ${patches}`);
  }
  const fishTotals = fish.totals();
  for (let f = 0; f < FISH_COUNT; f += 1) console.log(`${FISH[f]!.key.padEnd(16)} fish ${fishTotals[f]!.toFixed(0).padStart(9)}`);
  let fishEggs = 0;
  let fishFry = 0;
  for (let i = 0; i < fish.shoals.n; i += 1) {
    fishEggs += fish.eggs[i]!;
    fishFry += fish.fry[i]!;
  }
  console.log(`fish eggs ${fishEggs.toFixed(0)} fry ${fishFry.toFixed(0)} shoals ${fish.count}`);
};

const TREND = process.env.TREND === '1';
const history: Float64Array[] = [];
const trend = (): void => void history.push(fauna.totals(Stage.Adult, FIRST * columns, LAST * columns));
if (!TREND) report('start');
trend();
const t1 = performance.now();
let sweeps = 0;
const sweepsPerYear = Math.round(FAUNA_YEAR_DAYS / SWEEP);
for (let year = 1; year <= YEARS; year += 1) {
  for (let i = 0; i < sweepsPerYear; i += 1) {
    if (process.env.NOTAKE) fauna.fishTake.fill(0);
    fish.update(0, SWEEP, waters);
    fauna.sweep(SWEEP, weather, FIRST, LAST);
    sweeps += 1;
  }
  if (TREND) {
    if (year % 2 === 0) trend();
  } else if (year === 1 || year % 5 === 0 || year === YEARS) report(`year ${year}`);
}
console.log(`${sweeps} sweeps in ${(performance.now() - t1).toFixed(0)} ms (${((performance.now() - t1) / sweeps).toFixed(1)} ms each), rows ${rows}`);

const diag = process.env.DIAG;
if (diag) {
  const id = LIVES.findIndex((life) => life.key === diag);
  const best = Array.from({ length: count }, (_, p) => p).filter((p) => p >= FIRST * columns && p < LAST * columns).sort((a, b) => fauna.stockOf(b, id, Stage.Adult) - fauna.stockOf(a, id, Stage.Adult)).slice(0, 3);
  for (const patch of best) {
    const info = fauna.inspect(patch, id);
    console.log(`patch ${patch} A=${fauna.stockOf(patch, id, Stage.Adult).toFixed(4)} suit=${fauna.patches.suitAdult[patch * LIFE_COUNT + id]!.toFixed(2)} need/animal=${info.demand.toFixed(2)}`);
    for (const e of info.prey.filter((x) => x.flow > 0 || x.stock > 0).sort((a, b) => b.flow - a.flow).slice(0, 8)) console.log(`   eats ${e.key} stage ${e.stage} stock ${e.stock.toFixed(3)} flow ${e.flow.toFixed(4)}`);
    for (const e of info.fish) console.log(`   fish ${e.key} bio(scaled) ${e.bio.toFixed(2)} flow ${e.flow.toFixed(3)}`);
  }
}

if (TREND) {
  console.log('species'.padEnd(18) + history.map((_, i) => `by${i === 0 ? 0 : i * 2}`.padStart(10)).join(''));
  for (let id = 0; id < LIFE_COUNT; id += 1) console.log(LIVES[id]!.key.padEnd(18) + history.map((h) => h[id]!.toFixed(h[id]! < 10 ? 2 : 0).padStart(10)).join(''));
}

if (process.env.RHO) {
  for (const key of process.env.RHO.split(',')) {
    const id = LIVES.findIndex((life) => life.key === key);
    const mean = (s: number): string => (fauna.intakeWeight[id * 3 + s]! > 0 ? (fauna.intakeSum[id * 3 + s]! / fauna.intakeWeight[id * 3 + s]!).toFixed(2) : 'n/a');
    console.log(`${key}: mean intake ratio hatchling ${mean(0)} juvenile ${mean(1)} adult ${mean(2)}`);
  }
}
