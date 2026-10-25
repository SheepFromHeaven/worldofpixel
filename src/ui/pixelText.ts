import { BOX, FIRST_CODE, FONT_COLS, foldToFont, GLYPH, LAST_CODE, MARK_SCALE, SHEET_VERSION } from '../pixel/ui/metrics.ts';

const sheet = new Image();
sheet.src = `/ui/font-${MARK_SCALE}x.png?v=${SHEET_VERSION}`;

const tinted = new Map<string, HTMLCanvasElement>();

function tintedSheet(colour: string): HTMLCanvasElement | null {
  if (!sheet.complete || sheet.naturalWidth === 0) return null;

  const found = tinted.get(colour);
  if (found) return found;

  const canvas = document.createElement('canvas');
  canvas.width = sheet.naturalWidth;
  canvas.height = sheet.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(sheet, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  tinted.set(colour, canvas);
  return canvas;
}

export function textWidth(text: string): number {
  return foldToFont(text).length * BOX.w - (BOX.w - GLYPH.w);
}

export const TEXT_HEIGHT = GLYPH.h;

function stamp(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, colour: string): void {
  const source = tintedSheet(colour);
  if (!source) return;

  const folded = foldToFont(text);
  for (let at = 0; at < folded.length; at += 1) {
    const code = Math.min(LAST_CODE, Math.max(FIRST_CODE, folded.charCodeAt(at))) - FIRST_CODE;
    ctx.drawImage(source, (code % FONT_COLS) * BOX.w, Math.floor(code / FONT_COLS) * BOX.h, BOX.w, BOX.h, x + at * BOX.w, y, BOX.w, BOX.h);
  }
}

export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, colour: string, shade: string): void {
  const left = Math.round(x);
  const top = Math.round(y);
  ctx.imageSmoothingEnabled = false;
  stamp(ctx, text, left + 1, top + 1, shade);
  stamp(ctx, text, left, top, colour);
}
