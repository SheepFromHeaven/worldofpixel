import { DEFAULT_TUNING, Fauna } from '../../src/sim/fauna/fauna.ts';
import type { FaunaWeather } from '../../src/sim/fauna/fauna.ts';
import { FAUNA_YEAR_DAYS, LIFE_COUNT, PATCH_TILES, Stage } from '../../src/sim/fauna/life.ts';
import { Fish } from '../../src/sim/fish/fish.ts';
import { FISH_COUNT } from '../../src/sim/fish/species.ts';
import { world } from './context.ts';

export const YEARS = 16;

const SWEEP_DAYS = 0.25;

export interface Sample {
  year: number;
  adults: Float64Array;
  juveniles: Float64Array;
  hatchlings: Float64Array;
  eggs: Float64Array;
  fish: Float64Array;
  fishEggs: number;
  fishFry: number;
}

export interface Run {
  fauna: Fauna;
  fish: Fish;
  samples: Sample[];
}

let built: Run | null = null;

export function foodWebRun(): Run {
  if (built) return built;
  const w = world();
  const fauna = new Fauna(w, w.seed, { ...DEFAULT_TUNING, maxStep: SWEEP_DAYS });
  const fish = new Fish(w, w.seed, fauna);
  const { columns, count } = fauna.patches;
  const { grid } = w;
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

  const samples: Sample[] = [];
  const record = (year: number): void => {
    let fishEggs = 0;
    let fishFry = 0;
    for (let i = 0; i < fish.shoals.n; i += 1) {
      fishEggs += fish.eggs[i]!;
      fishFry += fish.fry[i]!;
    }
    samples.push({
      year,
      adults: fauna.totals(Stage.Adult),
      juveniles: fauna.totals(Stage.Juvenile),
      hatchlings: fauna.totals(Stage.Hatchling),
      eggs: fauna.totals(Stage.Egg),
      fish: Float64Array.from(fish.totals()),
      fishEggs,
      fishFry,
    });
  };
  record(0);
  const perYear = Math.round(FAUNA_YEAR_DAYS / SWEEP_DAYS);
  for (let year = 1; year <= YEARS; year += 1) {
    for (let step = 0; step < perYear; step += 1) {
      fish.update(0, SWEEP_DAYS, waters);
      fauna.sweep(SWEEP_DAYS, weather);
    }
    record(year);
  }
  built = { fauna, fish, samples };
  return built;
}

export const lifeCount = LIFE_COUNT;

export const fishCount = FISH_COUNT;
