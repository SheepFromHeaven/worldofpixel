import { DEFAULT_TUNING, Fauna } from '../src/sim/fauna/fauna.ts';
import type { FaunaWeather } from '../src/sim/fauna/fauna.ts';
import { Fish } from '../src/sim/fish/fish.ts';
import { LIVES, PATCH_TILES, Stage } from '../src/sim/fauna/life.ts';
import { World } from '../src/sim/world.ts';

const SEED = Number(process.env.SEED ?? 20250214);
const SWEEPS = Number(process.env.SWEEPS ?? 8);
const keys = process.argv.slice(2);

const world = World.generate(SEED);
const fauna = new Fauna(world, SEED, { ...DEFAULT_TUNING, maxStep: 0.25 });
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
for (let i = 0; i < SWEEPS; i += 1) {
  fish.update(0, 0.25, waters);
  fauna.sweep(0.25, weather);
}

for (const key of keys) {
  const id = LIVES.findIndex((life) => life.key === key);
  const ranked = Array.from({ length: count }, (_, p) => p).sort((a, b) => fauna.stockOf(b, id, Stage.Adult) - fauna.stockOf(a, id, Stage.Adult));
  const top = ranked.slice(0, 3).map((p) => `(${(grid.minX + ((p % columns) + 0.5) * PATCH_TILES).toFixed(0)}, ${(grid.minY + (Math.floor(p / columns) + 0.5) * PATCH_TILES).toFixed(0)}) A=${fauna.stockOf(p, id, Stage.Adult).toFixed(3)} J=${fauna.stockOf(p, id, Stage.Juvenile).toFixed(3)} H=${fauna.stockOf(p, id, Stage.Hatchling).toFixed(3)} E=${fauna.stockOf(p, id, Stage.Egg).toFixed(2)}`);
  console.log(`${key}: ${top.join('  |  ')}`);
}
