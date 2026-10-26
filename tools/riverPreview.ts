import { writeFileSync } from 'node:fs';
import { encodePng } from '../src/pixel/png.ts';
import { TileGrid } from '../src/sim/grid.ts';
import { buildCoarse } from '../src/sim/terrain/coarse.ts';
import type { RiverSegment } from '../src/sim/terrain/hydrology.ts';
import { buildNetwork } from '../src/sim/terrain/riverNetwork.ts';
import { buildWindow, windowIndex } from '../src/sim/terrain/window.ts';
import { buildField } from '../src/sim/terrain/worldfield.ts';
import { Biome } from '../src/sim/types.ts';

const SEED = Number(process.env.SEED ?? 20250214);
const SIZE = Number(process.env.SIZE ?? 192);
const ACROSS = Number(process.env.ACROSS ?? 3);
const ZOOM = Number(process.env.ZOOM ?? 2);
const HALO = Number(process.env.HALO ?? 32);
const out = process.env.OUT ?? '/tmp/rivers.png';
const WITH_ORIGINAL = process.env.ORIGINAL === '1';

const coarse = buildCoarse(SEED, 8);
const network = buildNetwork(coarse);
const fine = TileGrid.world(1);
const span = SIZE * ACROSS;
console.log(`world ${fine.columns}x${fine.rows}, ${network.count} river samples`);

let best: [number, number] = [96, 96];
if (process.env.X0 && process.env.Y0) best = [Number(process.env.X0), Number(process.env.Y0)];
else {
  let bestScore = -1;
  const step = 64;
  for (let row = 96; row + span < fine.rows - 96; row += step) {
    for (let column = 96; column + span < fine.columns - 96; column += step) {
      let score = 0;
      for (let i = 0; i < network.count; i += 1) {
        const c = network.x[i]! + 64;
        const r = network.y[i]! + 64;
        if (c >= column && c < column + span && r >= row && r < row + span) score += network.flux[i]! >= 30000 ? 3 : 1;
      }
      if (score > bestScore) {
        bestScore = score;
        best = [column, row];
      }
    }
  }
}
const [x0, y0] = best;
console.log(`region ${x0},${y0} size ${span}`);

const BIOME_COLOURS: Record<number, [number, number, number]> = {
  [Biome.Meadow]: [128, 168, 84],
  [Biome.Forest]: [58, 110, 62],
  [Biome.Highland]: [150, 140, 126],
  [Biome.Marsh]: [96, 130, 104],
  [Biome.Tundra]: [196, 204, 200],
  [Biome.Desert]: [214, 188, 124],
  [Biome.Ocean]: [30, 60, 110],
  [Biome.Lake]: [60, 110, 170],
  [Biome.River]: [90, 150, 210],
};

interface Panel {
  label: string;
  biome: Uint8Array;
  height: Float32Array;
  segments: RiverSegment[];
  seams: boolean;
}

const mosaic = (label: string, useNetwork: boolean): Panel => {
  const biome = new Uint8Array(span * span);
  const height = new Float32Array(span * span);
  const segments: RiverSegment[] = [];
  for (let wy = 0; wy < ACROSS; wy += 1) {
    for (let wx = 0; wx < ACROSS; wx += 1) {
      const win = buildWindow(coarse, useNetwork ? network : null, x0 + wx * SIZE, y0 + wy * SIZE, SIZE, SIZE, { halo: HALO });
      for (let row = 0; row < SIZE; row += 1) {
        for (let column = 0; column < SIZE; column += 1) {
          const i = windowIndex(win, x0 + wx * SIZE + column, y0 + wy * SIZE + row);
          const at = (wy * SIZE + row) * span + wx * SIZE + column;
          biome[at] = win.biome[i]!;
          height[at] = win.terrain[i]!;
        }
      }
      const minX = win.grid.minX + HALO;
      const minY = win.grid.minY + HALO;
      for (const s of win.rivers.segments) {
        const inside = (x: number, y: number): boolean => x >= minX && x < minX + SIZE && y >= minY && y < minY + SIZE;
        if (inside(s.ax, s.ay) || inside(s.bx, s.by)) segments.push(s);
      }
    }
  }
  return { label, biome, height, segments, seams: true };
};

const panels: Panel[] = [];
if (WITH_ORIGINAL) {
  const field = buildField(SEED);
  const biome = new Uint8Array(span * span);
  const height = new Float32Array(span * span);
  for (let row = 0; row < span; row += 1) for (let column = 0; column < span; column += 1) {
    biome[row * span + column] = field.biome[(y0 + row) * fine.columns + x0 + column]!;
    height[row * span + column] = field.height[(y0 + row) * fine.columns + x0 + column]!;
  }
  panels.push({ label: 'original', biome, height, segments: field.rivers.segments, seams: false });
}
panels.push(mosaic('windows, no network', false));
panels.push(mosaic('windows, river network', true));

const side = span * ZOOM;
const width = side * panels.length + 8 * (panels.length - 1);
const pixels = new Uint8Array(width * side * 4).fill(255);
const originX = fine.minX + x0;
const originY = fine.minY + y0;

panels.forEach((panel, index) => {
  const left = index * (side + 8);
  const at = (column: number, row: number): number => panel.height[Math.min(span - 1, Math.max(0, row)) * span + Math.min(span - 1, Math.max(0, column))]!;
  for (let row = 0; row < span; row += 1) {
    for (let column = 0; column < span; column += 1) {
      const biome = panel.biome[row * span + column]!;
      const base = BIOME_COLOURS[biome] ?? [255, 0, 255];
      const lit = biome === Biome.Ocean || biome === Biome.Lake ? 1 : 1 + Math.max(-0.35, Math.min(0.35, (at(column - 1, row - 1) - at(column + 1, row + 1)) * 18));
      for (let dy = 0; dy < ZOOM; dy += 1) {
        for (let dx = 0; dx < ZOOM; dx += 1) {
          const to = ((row * ZOOM + dy) * width + left + column * ZOOM + dx) * 4;
          pixels[to] = Math.min(255, base[0] * lit);
          pixels[to + 1] = Math.min(255, base[1] * lit);
          pixels[to + 2] = Math.min(255, base[2] * lit);
          pixels[to + 3] = 255;
        }
      }
    }
  }
  for (const s of panel.segments) {
    const steps = Math.max(1, Math.ceil(Math.hypot(s.bx - s.ax, s.by - s.ay) * ZOOM));
    for (let i = 0; i <= steps; i += 1) {
      const px = (s.ax + ((s.bx - s.ax) * i) / steps - originX) * ZOOM;
      const py = (s.ay + ((s.by - s.ay) * i) / steps - originY) * ZOOM;
      const radius = Math.max(0.8, s.half * ZOOM);
      for (let dy = -Math.ceil(radius); dy <= Math.ceil(radius); dy += 1) {
        for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx += 1) {
          if (dx * dx + dy * dy > radius * radius) continue;
          const qx = Math.round(px + dx);
          const qy = Math.round(py + dy);
          if (qx < 0 || qy < 0 || qx >= side || qy >= side) continue;
          const to = (qy * width + left + qx) * 4;
          pixels[to] = 120;
          pixels[to + 1] = 190;
          pixels[to + 2] = 240;
        }
      }
    }
  }
  if (panel.seams) {
    for (let k = 1; k < ACROSS; k += 1) {
      for (let q = 0; q < side; q += 6) {
        for (const [x, y] of [[k * SIZE * ZOOM, q], [q, k * SIZE * ZOOM]] as const) {
          const to = (y * width + left + x) * 4;
          pixels[to] = 255;
          pixels[to + 1] = 60;
          pixels[to + 2] = 60;
        }
      }
    }
  }
  console.log(`panel ${index}: ${panel.label}`);
});

writeFileSync(out, encodePng(pixels, width, side));
