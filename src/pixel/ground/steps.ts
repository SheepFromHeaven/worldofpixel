import { wrap } from './periodic.ts';

export const STEPS = 5;

export class Steps {
  readonly cells: Uint8Array;

  constructor(readonly size: number, fill = 2) {
    this.cells = new Uint8Array(size * size).fill(fill);
  }

  get(x: number, y: number): number {
    return this.cells[wrap(y, this.size) * this.size + wrap(x, this.size)]!;
  }

  set(x: number, y: number, step: number): void {
    this.cells[wrap(y, this.size) * this.size + wrap(x, this.size)] = Math.max(0, Math.min(STEPS - 1, step));
  }

  each(paint: (x: number, y: number, step: number) => number): void {
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) this.set(x, y, paint(x, y, this.get(x, y)));
    }
  }
}

export type Motif = readonly string[];

export function press(steps: Steps, x: number, y: number, motif: Motif, under?: number): void {
  const width = motif[0]?.length ?? 0;
  const base = under ?? steps.get(x, y);
  motif.forEach((row, dy) => {
    if (row.length !== width) throw new Error(`motif: row ${dy} is ${row.length} wide, expected ${width}`);
    for (let dx = 0; dx < width; dx += 1) {
      const key = row[dx]!;
      const at = { x: x + dx, y: y + dy };
      switch (key) {
        case '.':
          break;
        case '+':
          steps.set(at.x, at.y, base + 1);
          break;
        case '^':
          steps.set(at.x, at.y, base + 2);
          break;
        case '-':
          steps.set(at.x, at.y, base - 1);
          break;
        case 'v':
          steps.set(at.x, at.y, base - 2);
          break;
        default: {
          const step = Number(key);
          if (!Number.isInteger(step) || step < 0 || step >= STEPS) throw new Error(`motif: no meaning for "${key}"`);
          steps.set(at.x, at.y, step);
        }
      }
    }
  });
}
