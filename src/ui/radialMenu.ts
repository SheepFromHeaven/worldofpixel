import {
  RADIAL_HANDLE,
  RADIAL_PLAQUE,
  RADIAL_PLAQUE_EDGE,
  RADIAL_TEXT,
  RADIAL_TEXT_DIM,
  RADIAL_TEXT_HOT,
  RADIAL_TEXT_SHADE,
  RADIAL_WOOD,
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

const LABEL_GAP = 6;

const PLAQUE_PAD = 3;

const KNOB = 4;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

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
      const reach = OUTER_RADIUS + LABEL_GAP + PLAQUE_PAD;

      const x = anchor.x + cos * reach;
      const y = anchor.y + sin * reach - TEXT_HEIGHT / 2;
      const left = Math.round(cos > SIDE_BIAS ? x : cos < -SIDE_BIAS ? x - width : x - width / 2);
      const top = Math.round(y + (Math.abs(cos) <= SIDE_BIAS ? sin * (TEXT_HEIGHT / 2 + PLAQUE_PAD + 1) : 0));

      const dim = slice.reason !== null;
      const hot = at === this.hot;
      const note = dim && hot && slice.reason ? slice.reason : null;
      const across = note ? Math.max(width, textWidth(note)) : width;
      const noteLeft = cos > SIDE_BIAS ? left : cos < -SIDE_BIAS ? left + width - across : left + (width - across) / 2;
      const boxLeft = Math.round(Math.min(left, noteLeft)) - PLAQUE_PAD;
      const boxHeight = TEXT_HEIGHT + PLAQUE_PAD * 2 + (note ? TEXT_HEIGHT + 3 : 0);

      ctx.fillStyle = RADIAL_PLAQUE_EDGE;
      ctx.fillRect(boxLeft - 1, top - PLAQUE_PAD - 1, across + PLAQUE_PAD * 2 + 3, boxHeight + 2);
      ctx.fillStyle = RADIAL_PLAQUE;
      ctx.fillRect(boxLeft, top - PLAQUE_PAD, across + PLAQUE_PAD * 2 + 1, boxHeight);

      const colour = dim ? RADIAL_TEXT_DIM : hot ? RADIAL_TEXT_HOT : RADIAL_TEXT;
      drawText(ctx, slice.label, left, top, colour, RADIAL_TEXT_SHADE);
      if (note) drawText(ctx, note, noteLeft, top + TEXT_HEIGHT + 3, RADIAL_TEXT_DIM, RADIAL_TEXT_SHADE);
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
    const wood = {
      ink: unpack(RADIAL_WOOD.ink),
      dark: unpack(RADIAL_WOOD.dark),
      base: unpack(RADIAL_WOOD.base),
      light: unpack(RADIAL_WOOD.light),
      hot: unpack(RADIAL_WOOD.hot),
      grain: unpack(RADIAL_WOOD.grain),
      knob: unpack(RADIAL_WOOD.knob),
    };
    const count = this.slices.length;
    const centre = size / 2;
    const width = Math.PI / count;

    for (let py = 0; py < size; py += 1) {
      for (let px = 0; px < size; px += 1) {
        const dx = px + 0.5 - centre;
        const dy = py + 0.5 - centre;
        const reach = Math.hypot(dx, dy);
        let colour: [number, number, number, number] | null = null;

        if (reach <= KNOB) {
          const light = -(dx + dy) / (KNOB * 1.4);
          colour = reach > KNOB - 1 ? wood.ink : light > 0.35 ? wood.knob : light < -0.35 ? wood.dark : wood.light;
        } else if (reach >= INNER_RADIUS && reach <= OUTER_RADIUS) {
          const turn = (((Math.atan2(dy, dx) - this.start()) % TAU) + TAU) % TAU;
          const slice = Math.round(turn / (TAU / count)) % count;
          const off = Math.abs(((turn - slice * (TAU / count) + Math.PI) % TAU) - Math.PI);
          const enabled = this.slices[slice]?.reason === null;
          const hot = slice === this.hot && enabled;
          const dither = (BAYER[(py % 4) * 4 + (px % 4)]! + 0.5) / 16;
          const lit = -(dx + dy) / (reach * 1.42);

          colour = hot ? wood.hot : wood.base;
          if (Math.floor(reach) % 6 === 0 && dither < 0.6) colour = hot ? wood.light : wood.grain;
          if (!enabled && dither < 0.5) colour = wood.dark;
          if (reach > OUTER_RADIUS - 3) colour = lit > 0.2 ? (hot ? wood.knob : wood.light) : lit < -0.3 ? wood.dark : colour;
          if (reach < INNER_RADIUS + 3) colour = lit > 0.2 ? wood.dark : lit < -0.3 ? (hot ? wood.knob : wood.light) : colour;
          const onSeam = count > 1 && reach * Math.sin(Math.max(0, width - off)) < 0.9;
          if (reach < INNER_RADIUS + 1 || reach > OUTER_RADIUS - 1 || onSeam) colour = wood.ink;
        }
        if (!colour) continue;

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
