import {
  RADIAL_EDGE,
  RADIAL_EDGE_DIM,
  RADIAL_HANDLE,
  RADIAL_HOT,
  RADIAL_PLATE,
  RADIAL_TEXT,
  RADIAL_TEXT_DIM,
  RADIAL_TEXT_SHADE,
} from '../render/palette.ts';
import type { Vec2 } from '../sim/geometry.ts';
import type { TileIndex } from '../sim/grid.ts';
import { NOWHERE } from '../sim/grid.ts';
import { drawText, TEXT_HEIGHT, textWidth } from './pixelText.ts';

export interface Slice {
  label: string;
  reason: string | null;
  run: () => void;
  children?: Slice[];
  back?: boolean;
}

export const DEAD_RADIUS = 5;

export const INNER_RADIUS = 14;

export const OUTER_RADIUS = 44;

export const FLICK_RADIUS = 10;

const LABEL_GAP = 5;

const TAU = Math.PI * 2;

const SIDE_BIAS = 0.3;

function unpack(colour: number): [number, number, number, number] {
  return [(colour >>> 24) & 255, (colour >>> 16) & 255, (colour >>> 8) & 255, colour & 255];
}

export class RadialMenuController {
  private anchor: Vec2 | null = null;
  private slices: Slice[] = [];
  private levels: Slice[][] = [];
  private target: TileIndex = NOWHERE;
  private hot = -1;
  private pointer: Vec2 | null = null;

  private raster: HTMLCanvasElement | null = null;
  private rasterKey = '';

  get isOpen(): boolean {
    return this.anchor !== null;
  }

  get tile(): TileIndex {
    return this.anchor ? this.target : NOWHERE;
  }

  open(anchor: Vec2, tile: TileIndex, slices: Slice[]): boolean {
    if (slices.length === 0) return false;

    this.anchor = { x: Math.round(anchor.x), y: Math.round(anchor.y) };
    this.pointer = this.anchor;
    this.slices = slices;
    this.levels = [];
    this.target = tile;
    this.hot = -1;
    return true;
  }

  close(): void {
    this.anchor = null;
    this.slices = [];
    this.levels = [];
    this.target = NOWHERE;
    this.hot = -1;
    this.pointer = null;
  }

  move(point: Vec2): void {
    if (!this.anchor) return;
    this.pointer = point;
    this.hot = this.sliceAt(point);
  }

  release(point: Vec2): boolean {
    if (!this.anchor) return false;

    this.move(point);
    const reach = Math.hypot(point.x - this.anchor.x, point.y - this.anchor.y);
    if (reach < FLICK_RADIUS) return false;

    this.commit(this.hot);
    return true;
  }

  click(point: Vec2): boolean {
    if (!this.anchor) return false;

    this.move(point);
    const reach = Math.hypot(point.x - this.anchor.x, point.y - this.anchor.y);
    if (reach >= INNER_RADIUS - 2 && reach <= OUTER_RADIUS + LABEL_GAP) this.commit(this.hot);
    else this.close();
    return true;
  }

  sliceAt(point: Vec2): number {
    if (!this.anchor) return -1;

    const dx = point.x - this.anchor.x;
    const dy = point.y - this.anchor.y;
    if (Math.hypot(dx, dy) < DEAD_RADIUS) return -1;

    const count = this.slices.length;
    const turn = (((Math.atan2(dy, dx) - this.start()) % TAU) + TAU) % TAU;
    return Math.round(turn / (TAU / count)) % count;
  }

  angleOf(slice: number): number {
    return this.start() + (slice * TAU) / this.slices.length;
  }

  private start(): number {
    return this.slices.length === 2 ? 0 : -Math.PI / 2;
  }

  private commit(slice: number): void {
    const chosen = this.slices[slice];
    if (chosen?.reason === null && chosen.back) {
      this.slices = this.levels.pop() ?? this.slices;
      this.hot = -1;
      this.rasterKey = '';
      return;
    }
    if (chosen?.reason === null && chosen.children && chosen.children.length > 0) {
      this.levels.push(this.slices);
      this.slices = [...chosen.children, { label: 'Back', reason: null, run: () => undefined, back: true }];
      this.hot = -1;
      this.rasterKey = '';
      return;
    }
    this.close();
    if (chosen && chosen.reason === null) chosen.run();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { anchor } = this;
    if (!anchor) return;

    const raster = this.rasterised();
    const half = OUTER_RADIUS + 2;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(raster, anchor.x - half, anchor.y - half);

    this.drawHandle(ctx, anchor);
    this.drawLabels(ctx, anchor);
  }

  private drawHandle(ctx: CanvasRenderingContext2D, anchor: Vec2): void {
    const { pointer } = this;
    const dx = (pointer?.x ?? anchor.x) - anchor.x;
    const dy = (pointer?.y ?? anchor.y) - anchor.y;
    const reach = Math.hypot(dx, dy);
    const pull = reach === 0 ? 0 : Math.min(reach, INNER_RADIUS - 3) / reach;

    ctx.fillStyle = RADIAL_HANDLE;
    ctx.fillRect(Math.round(anchor.x + dx * pull) - 1, Math.round(anchor.y + dy * pull) - 1, 2, 2);
  }

  private drawLabels(ctx: CanvasRenderingContext2D, anchor: Vec2): void {
    this.slices.forEach((slice, at) => {
      const angle = this.angleOf(at);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const width = textWidth(slice.label);
      const reach = OUTER_RADIUS + LABEL_GAP;

      const x = anchor.x + cos * reach;
      const y = anchor.y + sin * reach - TEXT_HEIGHT / 2;
      const left = cos > SIDE_BIAS ? x : cos < -SIDE_BIAS ? x - width : x - width / 2;
      const above = Math.abs(cos) <= SIDE_BIAS ? sin * (TEXT_HEIGHT / 2 + 1) : 0;

      const dim = slice.reason !== null;
      const colour = dim ? RADIAL_TEXT_DIM : RADIAL_TEXT;
      drawText(ctx, slice.label, left, y + above, colour, RADIAL_TEXT_SHADE);

      if (dim && at === this.hot && slice.reason) {
        const note = slice.reason;
        const across = textWidth(note);
        const noteLeft = cos > SIDE_BIAS ? left : cos < -SIDE_BIAS ? left + width - across : left + (width - across) / 2;
        drawText(ctx, note, noteLeft, y + above + TEXT_HEIGHT + 3, RADIAL_TEXT_DIM, RADIAL_TEXT_SHADE);
      }
    });
  }

  private rasterised(): HTMLCanvasElement {
    const key = `${this.hot}|${this.slices.length}|${this.slices.map((slice) => (slice.reason === null ? 1 : 0)).join('')}`;
    if (this.raster && key === this.rasterKey) return this.raster;

    const size = (OUTER_RADIUS + 2) * 2;
    const canvas = this.raster ?? document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const image = ctx.createImageData(size, size);
    const plate = unpack(RADIAL_PLATE);
    const hot = unpack(RADIAL_HOT);
    const edge = unpack(RADIAL_EDGE);
    const dim = unpack(RADIAL_EDGE_DIM);
    const count = this.slices.length;
    const centre = size / 2;
    const width = Math.PI / count;

    for (let py = 0; py < size; py += 1) {
      for (let px = 0; px < size; px += 1) {
        const dx = px + 0.5 - centre;
        const dy = py + 0.5 - centre;
        const reach = Math.hypot(dx, dy);
        if (reach < INNER_RADIUS || reach > OUTER_RADIUS) continue;

        const turn = (((Math.atan2(dy, dx) - this.start()) % TAU) + TAU) % TAU;
        const slice = Math.round(turn / (TAU / count)) % count;
        const off = Math.abs(((turn - slice * (TAU / count) + Math.PI) % TAU) - Math.PI);
        const enabled = this.slices[slice]?.reason === null;

        let colour = slice === this.hot && enabled ? hot : plate;
        if (!enabled && (px + py) % 2 === 0) colour = dim;
        const onSeam = count > 1 && reach * Math.sin(Math.max(0, width - off)) < 0.9;
        if (reach < INNER_RADIUS + 1 || reach > OUTER_RADIUS - 1 || onSeam) colour = slice === this.hot ? edge : dim;

        const at = (py * size + px) * 4;
        image.data[at] = colour[0];
        image.data[at + 1] = colour[1];
        image.data[at + 2] = colour[2];
        image.data[at + 3] = colour[3];
      }
    }

    ctx.putImageData(image, 0, 0);
    this.raster = canvas;
    this.rasterKey = key;
    return canvas;
  }
}
