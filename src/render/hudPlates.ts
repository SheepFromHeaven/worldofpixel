import {
  BOX,
  FIRST_CODE,
  FONT_COLS,
  GLYPH,
  ICON_CELLS,
  ICON_COLS,
  ICON_NAMES,
  ICON_SCALE,
  LAST_CODE,
  PLATE_CELLS,
  PLATE_SCALE,
  PLATE_SLICE,
  TEXT_SCALE,
  foldToFont,
} from '../pixel/ui/metrics.ts';
import type { IconName, PlateName } from '../pixel/ui/metrics.ts';

export type { IconName, PlateName };

/**
 * The baked HUD sheets, laid onto a canvas rather than onto an element.
 *
 * The build bar and the picker are elements and get their tiles from `border-image`; the
 * designer grid and the blueprint sheet are canvases and cannot. They are the *same* tiles —
 * one plate drawn two ways — because the whole direction depends on it: a block you drag onto
 * the designer grid has to be the piece you picked up off the board, not a drawing of it.
 *
 * Two rules, and they are the same rule the map's tiles follow. A plate is only ever drawn at a
 * **whole-number magnification** of the pixels it was baked at, and it is only ever laid on
 * **whole device pixels**. A nine-slice stretched to an arbitrary width would otherwise put a
 * cell and a half of bevel down one side and half a cell down the other, which is exactly the
 * soft edge the bevel exists to avoid.
 */

const sheets = new Map<string, HTMLImageElement>();
const asked = new Set<string>();

/** The sheet, or nothing until it has decoded. Nothing is drawn before then; nothing waits. */
function sheet(path: string): HTMLImageElement | undefined {
  if (!asked.has(path)) {
    asked.add(path);
    const image = new Image();
    image.src = path;
    image.decode().then(
      () => sheets.set(path, image),
      () => undefined,
    );
  }
  return sheets.get(path);
}

export interface PlateRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The canvas, in device pixels, with whatever transform the caller set taken off.
 *
 * Everything here draws under the identity transform and puts the rectangle back by hand. A
 * nine-slice drawn through a scaled transform has its corners scaled by the device ratio *and*
 * by whatever fraction the layout landed on, and the second of those is not a whole number.
 */
function device(
  ctx: CanvasRenderingContext2D,
  rect: PlateRect,
): { left: number; top: number; width: number; height: number; unit: number } | undefined {
  const t = ctx.getTransform();
  if (t.b !== 0 || t.c !== 0) return undefined;

  const left = Math.round(t.a * rect.x + t.e);
  const top = Math.round(t.d * rect.y + t.f);
  return {
    left,
    top,
    width: Math.round(t.a * (rect.x + rect.w) + t.e) - left,
    height: Math.round(t.d * (rect.y + rect.h) + t.f) - top,
    // At least one: on a 1x display the sheet is laid down at the size it was baked.
    unit: Math.max(1, Math.round(Math.abs(t.a))),
  };
}

function withoutSmoothing(ctx: CanvasRenderingContext2D, draw: () => void): void {
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  draw();
  ctx.restore();
  ctx.imageSmoothingEnabled = smoothing;
}

/** The baked plate's corner, in its own pixels. */
const CORNER = PLATE_SLICE * PLATE_SCALE;
const PLATE_PX = PLATE_CELLS * PLATE_SCALE;

/**
 * A plate stretched over a rectangle: four corners laid down untouched, four edges stretched
 * along bands that are one colour to begin with, and the middle filled.
 *
 * Nearest-neighbour throughout, which is what makes stretching an edge honest — the band is
 * uniform down its length, so repeating its cells is the same picture at any size.
 */
export function drawPlate(
  ctx: CanvasRenderingContext2D,
  name: PlateName,
  rect: PlateRect,
): boolean {
  const image = sheet(`/ui/${name}.png`);
  const box = device(ctx, rect);
  if (!image || !box) return false;

  // Below two corners there is no middle left to stretch, and the two would overlap into a
  // thicker bevel than the plate has. The corners shrink together instead, which keeps the
  // drawing symmetrical at the cost of cutting the face out of it — at that size there is no
  // face to speak of anyway.
  const corner = Math.min(CORNER * box.unit, Math.floor(box.width / 2), Math.floor(box.height / 2));
  if (corner <= 0) return false;
  const source = Math.min(CORNER, Math.floor(PLATE_PX / 2));

  const sx = [0, source, PLATE_PX - source];
  const sw = [source, PLATE_PX - source * 2, source];
  const dx = [box.left, box.left + corner, box.left + box.width - corner];
  const dw = [corner, box.width - corner * 2, corner];
  const sy = [0, source, PLATE_PX - source];
  const sh = sw;
  const dy = [box.top, box.top + corner, box.top + box.height - corner];
  const dh = [corner, box.height - corner * 2, corner];

  withoutSmoothing(ctx, () => {
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        if (dw[col]! <= 0 || dh[row]! <= 0) continue;
        ctx.drawImage(
          image,
          sx[col]!, sy[row]!, sw[col]!, sh[row]!,
          dx[col]!, dy[row]!, dw[col]!, dh[row]!,
        );
      }
    }
  });

  return true;
}

const ICON_PX = ICON_CELLS * ICON_SCALE;

/**
 * An icon centred on a point, at the largest whole-number magnification that fits `size`.
 *
 * `size` is a wish, not a measurement. A sixteen-cell drawing squeezed into nineteen pixels is
 * not a smaller icon, it is the same icon with three rows of it twice as tall as the rest —
 * which on a face this small is the difference between a funnel and a smear. One cell to one
 * pixel is the floor; below that nothing is drawn and the caller's own mark stands.
 */
export function drawIcon(
  ctx: CanvasRenderingContext2D,
  name: IconName,
  cx: number,
  cy: number,
  size: number,
  alpha = 1,
): boolean {
  const image = sheet('/ui/icons.png');
  const box = device(ctx, { x: cx - size / 2, y: cy - size / 2, w: size, h: size });
  if (!image || !box) return false;

  const cells = Math.floor(Math.min(box.width, box.height) / ICON_CELLS);
  if (cells < 1) return false;
  const span = ICON_CELLS * cells;

  const slot = ICON_NAMES.indexOf(name);
  if (slot < 0) return false;
  const col = slot % ICON_COLS;
  const row = Math.floor(slot / ICON_COLS);

  const left = box.left + Math.round((box.width - span) / 2);
  const top = box.top + Math.round((box.height - span) / 2);

  withoutSmoothing(ctx, () => {
    const was = ctx.globalAlpha;
    ctx.globalAlpha = was * alpha;
    ctx.drawImage(image, col * ICON_PX, row * ICON_PX, ICON_PX, ICON_PX, left, top, span, span);
    ctx.globalAlpha = was;
  });

  return true;
}

/**
 * The HUD's font, in whatever colour the caller asks for.
 *
 * The sheet is one set of white glyphs and the colour is laid over them, the same way the DOM
 * labels take their colour from `currentColor` through a CSS mask. A sheet per colour would be
 * the obvious alternative and is the wrong one: the bake would have to know every colour the
 * sheets are ever drawn in, which is a list that lives in the renderer and grows there.
 *
 * Tinted copies are kept, because compositing a mask is far too slow to do per glyph per frame
 * and the designer redraws every one of them sixty times a second.
 */
const tinted = new Map<string, HTMLCanvasElement>();

function tint(color: string, scale: number): HTMLCanvasElement | undefined {
  const key = `${color}@${scale}`;
  const known = tinted.get(key);
  if (known) return known;

  const image = sheet(`/ui/font-${scale}x.png`);
  if (!image) return undefined;

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  tinted.set(key, canvas);
  return canvas;
}

export interface TextOptions {
  /** A whole-number magnification of the 5x7; the sheets are baked at 2 and 3. */
  scale?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  alpha?: number;
}

/** How wide a line comes out, in the caller's own units, so a label can be placed before it is drawn. */
export function pixelTextWidth(text: string, scale = TEXT_SCALE): number {
  return foldToFont(text).length * BOX.w * scale;
}

/**
 * A line of text with its left edge at `x` and its baseline-ish middle at `y`.
 *
 * Centred vertically on `y` rather than sat on a baseline, because every caller here is placing
 * a label in the middle of a tile rather than setting a paragraph — and a box that is nine cells
 * tall with two of them under the baseline has no middle the caller can work out for itself.
 */
export function drawPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: TextOptions = {},
): boolean {
  const scale = options.scale ?? TEXT_SCALE;
  const font = tint(options.color ?? '#40392c', scale);
  const line = foldToFont(text);
  const width = pixelTextWidth(line, scale);
  const height = BOX.h * scale;
  const shift = options.align === 'center' ? -width / 2 : options.align === 'right' ? -width : 0;
  const box = device(ctx, { x: x + shift, y: y - height / 2, w: width, h: height });
  if (!font || !box) return false;

  const unit = box.unit;

  withoutSmoothing(ctx, () => {
    const was = ctx.globalAlpha;
    ctx.globalAlpha = was * (options.alpha ?? 1);

    [...line].forEach((character, index) => {
      const code = character.codePointAt(0) ?? 32;
      const slot = (code < FIRST_CODE || code > LAST_CODE ? 63 : code) - FIRST_CODE;
      const col = slot % FONT_COLS;
      const row = Math.floor(slot / FONT_COLS);

      ctx.drawImage(
        font,
        col * BOX.w * scale,
        row * BOX.h * scale,
        GLYPH.w * scale,
        BOX.h * scale,
        box.left + index * BOX.w * scale * unit,
        box.top,
        GLYPH.w * scale * unit,
        BOX.h * scale * unit,
      );
    });

    ctx.globalAlpha = was;
  });

  return true;
}
