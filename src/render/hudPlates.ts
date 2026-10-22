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
  MARK_SCALE,
  SHEET_VERSION,
  TEXT_SCALE,
  foldToFont,
} from '../pixel/ui/metrics.ts';
import type { IconName, PlateName } from '../pixel/ui/metrics.ts';

export type { IconName, PlateName };

const sheets = new Map<string, HTMLImageElement>();
const asked = new Set<string>();

function sheet(path: string): HTMLImageElement | undefined {
  if (!asked.has(path)) {
    asked.add(path);
    const image = new Image();
    image.src = `${path}?v=${SHEET_VERSION}`;
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

const ICON_PX = ICON_CELLS * ICON_SCALE;

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
  scale?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  alpha?: number;
}

export function pixelTextWidth(text: string, scale = TEXT_SCALE): number {
  return foldToFont(text).length * BOX.w * scale;
}

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

const labels = new Map<string, HTMLCanvasElement>();

const LABEL_BUDGET = 256;

function labelOf(text: string, color: string, halo: string): HTMLCanvasElement | undefined {
  const key = `${text}|${color}|${halo}`;
  const known = labels.get(key);
  if (known) return known;
  if (!sheet(`/ui/font-${MARK_SCALE}x.png`)) return undefined;

  const width = pixelTextWidth(text, MARK_SCALE);
  const height = BOX.h * MARK_SCALE;
  const canvas = document.createElement('canvas');
  canvas.width = width + 2;
  canvas.height = height + 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  const middle = { x: 1, y: 1 + height / 2 };
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      drawPixelText(ctx, text, middle.x + dx, middle.y + dy, { scale: MARK_SCALE, color: halo });
    }
  }
  drawPixelText(ctx, text, middle.x, middle.y, { scale: MARK_SCALE, color });

  if (labels.size >= LABEL_BUDGET) labels.clear();
  labels.set(key, canvas);
  return canvas;
}

export function drawMapLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  top: number,
  color: string,
  halo: string,
): boolean {
  const label = labelOf(foldToFont(text), color, halo);
  if (!label) return false;

  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(label, Math.round(cx - label.width / 2), Math.round(top));
  ctx.restore();
  ctx.imageSmoothingEnabled = smoothing;
  return true;
}
