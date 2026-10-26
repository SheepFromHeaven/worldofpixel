import { YEAR_LENGTH_IN_GAME_DAYS } from '../../src/sim/calendar.ts';
import { DEFAULT_TUNING, Fauna } from '../../src/sim/fauna/fauna.ts';
import type { FaunaWeather } from '../../src/sim/fauna/fauna.ts';
import { lifeOf, PATCH_TILES, Stage } from '../../src/sim/fauna/life.ts';
import { Fish } from '../../src/sim/fish/fish.ts';
import { seasonalTemperatureSwing, yearlyTemperatureCycle } from '../../src/sim/weather/temperature.ts';
import { world } from './context.ts';

export const WATCHED: readonly string[] = ['swallow', 'stork', 'goose', 'crane', 'hummingbird', 'starling', 'sparrow'];

const SWEEP_DAYS = 0.5;
const SETTLE_YEARS = 12;
const WARM_UP_CALENDAR_YEARS = 1;
const SNAPSHOT_SPECIES: readonly string[] = ['swallow', 'stork'];
const SNAPSHOT_PHASES: readonly number[] = [0.4, 0.9];

export interface Migration {
  phase: number[];
  north: Record<string, number[]>;
  tropics: Record<string, number[]>;
  south: Record<string, number[]>;
  snapshots: Record<string, Record<number, Float32Array>>;
  columns: number;
  rows: number;
}

let built: Migration | null = null;

export function migrationRun(): Migration {
  if (built) return built;
  const w = world();
  const fauna = new Fauna(w, w.seed, { ...DEFAULT_TUNING, maxStep: SWEEP_DAYS });
  const fish = new Fish(w, w.seed, fauna);
  const { columns, rows, count } = fauna.patches;
  const { grid } = w;
  const climate = w.field.weather;
  const celsius = new Float32Array(count);
  for (let patch = 0; patch < count; patch += 1) {
    const column = Math.min(grid.columns - 1, (patch % columns) * PATCH_TILES + PATCH_TILES / 2);
    const row = Math.min(grid.rows - 1, Math.floor(patch / columns) * PATCH_TILES + PATCH_TILES / 2);
    celsius[patch] = w.field.temperature[row * grid.columns + column]!;
  }
  const weather: FaunaWeather = { celsius, snow: new Float32Array(count), cellOf: Int32Array.from({ length: count }, (_, i) => i) };
  const waters = { temperatureAt: (tile: number) => w.field.temperature[tile]!, daylightAt: () => 0.5 };
  fish.populate(waters);
  fish.measure();
  fauna.populate();

  const sweep = (): void => {
    fish.update(0, SWEEP_DAYS, waters);
    fauna.sweep(SWEEP_DAYS, weather);
  };
  for (let step = 0; step < (SETTLE_YEARS / SWEEP_DAYS); step += 1) sweep();

  const season = (phase: number): void => {
    const cycle = yearlyTemperatureCycle(phase);
    for (let patch = 0; patch < count; patch += 1) {
      celsius[patch] = climate.warmth[patch]! + cycle * seasonalTemperatureSwing(climate.latitude[patch]!, Math.min(1, Math.max(0, climate.standing[patch]!)));
    }
  };
  const perCalendarYear = Math.round(YEAR_LENGTH_IN_GAME_DAYS / SWEEP_DAYS);
  for (let step = 0; step < WARM_UP_CALENDAR_YEARS * perCalendarYear; step += 1) {
    season((step % perCalendarYear) / perCalendarYear);
    sweep();
  }

  const ids = WATCHED.map((key) => lifeOf(key).index);
  const result: Migration = { phase: [], north: {}, tropics: {}, south: {}, snapshots: {}, columns, rows };
  for (const key of WATCHED) {
    result.north[key] = [];
    result.tropics[key] = [];
    result.south[key] = [];
  }
  for (const key of SNAPSHOT_SPECIES) result.snapshots[key] = {};
  const bandOf = (row: number): 'north' | 'tropics' | 'south' => (row < rows / 3 ? 'north' : row < (2 * rows) / 3 ? 'tropics' : 'south');
  for (let step = 0; step < perCalendarYear; step += 1) {
    const phase = step / perCalendarYear;
    season(phase);
    sweep();
    const sample = step % 4 === 0;
    if (sample) {
      result.phase.push(phase);
      ids.forEach((id, k) => {
        const total = { north: 0, tropics: 0, south: 0 };
        for (let patch = 0; patch < count; patch += 1) total[bandOf(Math.floor(patch / columns))] += fauna.stockOf(patch, id, Stage.Adult);
        const all = total.north + total.tropics + total.south || 1;
        const key = WATCHED[k]!;
        result.north[key]!.push(total.north / all);
        result.tropics[key]!.push(total.tropics / all);
        result.south[key]!.push(total.south / all);
      });
    }
    for (const target of SNAPSHOT_PHASES) {
      if (Math.abs(phase - target) < 0.5 / perCalendarYear) {
        for (const key of SNAPSHOT_SPECIES) {
          const id = lifeOf(key).index;
          const copy = new Float32Array(count);
          for (let patch = 0; patch < count; patch += 1) copy[patch] = fauna.stockOf(patch, id, Stage.Adult);
          result.snapshots[key]![target] = copy;
        }
      }
    }
  }
  built = result;
  return built;
}
