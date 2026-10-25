import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { encodePng } from '../../src/pixel/png.ts';

export type Rgb = readonly [number, number, number];

export const OUT = join(import.meta.dirname, '..', '..', 'docs', 'wiki');

export function hex(value: string): Rgb {
  const n = Number.parseInt(value.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

export function ramp(stops: readonly Rgb[], t: number): Rgb {
  const clamped = Math.min(1, Math.max(0, t));
  const at = clamped * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(at));
  return mix(stops[i]!, stops[i + 1]!, at - i);
}

export function save(name: string, pixels: Uint8Array, width: number, height: number): string {
  const path = join(OUT, 'img', name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodePng(pixels, width, height));
  return `img/${name}`;
}

export interface MapOptions {
  columns: number;
  rows: number;
  step: number;
  zoom?: number;
  colourAt: (column: number, row: number) => Rgb;
  overlay?: (pixels: Uint8Array, width: number, height: number, scale: number) => void;
}

export function renderMap(name: string, options: MapOptions): string {
  const zoom = options.zoom ?? 1;
  const cells = Math.floor(options.columns / options.step);
  const rows = Math.floor(options.rows / options.step);
  const width = cells * zoom;
  const height = rows * zoom;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cells; x += 1) {
      const [r, g, b] = options.colourAt(x * options.step, y * options.step);
      for (let dy = 0; dy < zoom; dy += 1) {
        for (let dx = 0; dx < zoom; dx += 1) pixels.set([r, g, b, 255], ((y * zoom + dy) * width + x * zoom + dx) * 4);
      }
    }
  }
  options.overlay?.(pixels, width, height, zoom / options.step);
  return save(name, pixels, width, height);
}

export function line(pixels: Uint8Array, width: number, height: number, ax: number, ay: number, bx: number, by: number, colour: Rgb): void {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 2));
  for (let i = 0; i <= steps; i += 1) {
    const x = Math.round(ax + ((bx - ax) * i) / steps);
    const y = Math.round(ay + ((by - ay) * i) / steps);
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    pixels.set([colour[0], colour[1], colour[2], 255], (y * width + x) * 4);
  }
}
