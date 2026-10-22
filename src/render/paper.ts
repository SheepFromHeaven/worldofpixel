import { prng } from '../sim/rng.ts';
import { INK_FAINT, PAPER, PAPER_SHADE, PAPER_WARM } from './palette.ts';

const SHEET_BUDGET = 4;
const sheets = new Map<string, HTMLCanvasElement>();

function bakePaper(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const wash = ctx.createRadialGradient(width * 0.4, height * 0.35, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.75);
  wash.addColorStop(0, PAPER);
  wash.addColorStop(0.7, PAPER_WARM);
  wash.addColorStop(1, PAPER_SHADE);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);

  const random = prng(4242);
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = INK_FAINT;
  for (let i = 0; i < Math.round((width * height) / 1400); i += 1) {
    const x = random() * width;
    const y = random() * height;
    ctx.fillRect(x, y, 1 + random(), 1 + random());
  }

  ctx.globalAlpha = 1;
  const edge = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.72);
  edge.addColorStop(0, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(90, 72, 44, 0.16)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, width, height);

  return canvas;
}

export function drawPaper(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const key = `${Math.round(width)}x${Math.round(height)}`;
  let sheet = sheets.get(key);
  if (!sheet) {
    sheet = bakePaper(width, height);
    sheets.set(key, sheet);
    while (sheets.size > SHEET_BUDGET) sheets.delete([...sheets.keys()][0] as string);
  }
  ctx.drawImage(sheet, 0, 0);
}
