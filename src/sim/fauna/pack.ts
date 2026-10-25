import type { Fauna } from './fauna.ts';
import { LIFE_COUNT, LIVES, PATCH_AREA, Stage } from './life.ts';

export const LEVEL_LOG_MIN = -6;
export const LEVEL_LOG_MAX = 1;
export const FILL_SCALE = 170;

export interface FaunaMirror {
  columns: number;
  rows: number;
  levels: Uint8Array;
  suit: Uint8Array;
  version: number;
}

export interface FaunaFrame {
  columns: number;
  rows: number;
  levels: Uint8Array;
  suit: Uint8Array | null;
  version: number;
}

const encode = (animals: number): number => {
  if (animals <= 0) return 0;
  const density = animals / PATCH_AREA;
  const level = (Math.log10(density) - LEVEL_LOG_MIN) / (LEVEL_LOG_MAX - LEVEL_LOG_MIN);
  return level <= 0 ? 0 : Math.min(255, 1 + Math.round(level * 254));
};

export const decodeDensity = (byte: number): number => (byte <= 0 ? 0 : 10 ** (LEVEL_LOG_MIN + ((byte - 1) / 254) * (LEVEL_LOG_MAX - LEVEL_LOG_MIN)));

export class FaunaPacker {
  private readonly levels: Uint8Array;
  private cursor = 0;
  private version = 0;

  constructor(private readonly fauna: Fauna) {
    this.levels = new Uint8Array(LIFE_COUNT * fauna.patches.count * 4);
  }

  private packSpecies(id: number): void {
    const { fauna, levels } = this;
    const { count } = fauna.patches;
    const life = LIVES[id]!;
    const out = id * count * 4;
    if (life.group === 'game') return;
    const insect = life.group === 'insect';
    for (let patch = 0; patch < count; patch += 1) {
      const at = out + patch * 4;
      if (insect) {
        const reference = fauna.capacity(patch, id);
        const fill = reference > 0 ? fauna.stockOf(patch, id, Stage.Adult) / reference : 0;
        levels[at] = Math.min(255, Math.round(fill * FILL_SCALE));
        continue;
      }
      levels[at] = encode(fauna.stockOf(patch, id, Stage.Adult));
      levels[at + 1] = encode(fauna.stockOf(patch, id, Stage.Juvenile));
      levels[at + 2] = encode(fauna.stockOf(patch, id, Stage.Hatchling));
      levels[at + 3] = encode(fauna.stockOf(patch, id, Stage.Egg));
    }
  }

  suit(): Uint8Array {
    const { fauna } = this;
    const { count, suitAdult, suitYoung, suitEgg } = fauna.patches;
    const out = new Uint8Array(LIFE_COUNT * count * 4);
    const byte = (value: number): number => Math.round(Math.min(1, value) * 255);
    for (let id = 0; id < LIFE_COUNT; id += 1) {
      for (let patch = 0; patch < count; patch += 1) {
        const at = (id * count + patch) * 4;
        const from = patch * LIFE_COUNT + id;
        out[at] = byte(suitAdult[from]!);
        out[at + 1] = byte(suitYoung[from]!);
        out[at + 2] = byte(suitEgg[from]!);
      }
    }
    return out;
  }

  all(): FaunaFrame {
    for (let id = 0; id < LIFE_COUNT; id += 1) this.packSpecies(id);
    this.version += 1;
    const { columns, rows } = this.fauna.patches;
    return { columns, rows, levels: this.levels.slice(), suit: this.suit(), version: this.version };
  }

  step(): FaunaFrame | null {
    this.packSpecies(this.cursor);
    this.cursor += 1;
    if (this.cursor < LIFE_COUNT) return null;
    this.cursor = 0;
    this.version += 1;
    const { columns, rows } = this.fauna.patches;
    return { columns, rows, levels: this.levels.slice(), suit: null, version: this.version };
  }
}
