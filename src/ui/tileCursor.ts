import { ALERT, ALERT_SHADE, BUBBLE, MIND, SELECTION, SELECTION_SHADE } from '../render/palette.ts';
import { NOWHERE, type TileIndex } from '../sim/grid.ts';
import type { World } from '../sim/world.ts';
import type { IconName } from '../pixel/ui/metrics.ts';
import { NEURONS } from '../sim/mind/neurons.ts';
import { BUBBLE_SLOTS, Bubble, Glyph } from '../sim/people/bubbles.ts';
import type { People } from '../sim/people/people.ts';
import { icon } from './mindArt.ts';

function outline(
  ctx: CanvasRenderingContext2D,
  world: World,
  index: TileIndex,
  color: string,
  inset: number,
): void {
  const { minX, minY, maxX, maxY } = world.grid.bounds(index);
  const pixel = 1 / ctx.getTransform().a;
  const edge = inset * pixel;

  ctx.strokeStyle = color;
  ctx.lineWidth = pixel;
  ctx.strokeRect(
    minX + edge + pixel / 2,
    minY + edge + pixel / 2,
    maxX - minX - edge * 2 - pixel,
    maxY - minY - edge * 2 - pixel,
  );
}

export function drawTileCursor(
  ctx: CanvasRenderingContext2D,
  world: World,
  hovered: TileIndex,
  opened: TileIndex,
): void {
  if (hovered === NOWHERE && opened === NOWHERE) return;

  ctx.save();
  if (opened !== NOWHERE) {
    outline(ctx, world, opened, SELECTION_SHADE, 0);
    outline(ctx, world, opened, SELECTION, 1);
  }
  if (hovered !== NOWHERE && hovered !== opened) outline(ctx, world, hovered, SELECTION, 0);
  ctx.restore();
}

const MARK_HALF_TILES = 0.62;

const MARK_ARM_TILES = 0.22;

export function drawPersonMark(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const pixel = 1 / ctx.getTransform().a;
  const half = Math.round(MARK_HALF_TILES / pixel) * pixel;
  const arm = Math.max(pixel * 2, Math.round(MARK_ARM_TILES / pixel) * pixel);
  const left = Math.round((x - half) / pixel) * pixel;
  const top = Math.round((y - half) / pixel) * pixel;
  const corners = [
    [left, top, 1, 1],
    [left + half * 2, top, -1, 1],
    [left, top + half * 2, 1, -1],
    [left + half * 2, top + half * 2, -1, -1],
  ] as const;

  ctx.save();
  for (const [colour, grow] of [
    [SELECTION_SHADE, pixel],
    [SELECTION, 0],
  ] as const) {
    ctx.fillStyle = colour;
    for (const [cx, cy, dx, dy] of corners) {
      const across = dx > 0 ? cx : cx - arm;
      const down = dy > 0 ? cy : cy - arm;
      ctx.fillRect(across - grow, (dy > 0 ? cy : cy - pixel) - grow, arm + grow * 2, pixel + grow * 2);
      ctx.fillRect((dx > 0 ? cx : cx - pixel) - grow, down - grow, pixel + grow * 2, arm + grow * 2);
    }
  }
  ctx.restore();
}

const ALERT_PIXEL_SCREEN = 2;

const ALERT_LIFT_TILES = 0.9;

const ALERT_BOB_HZ = 3;

const ALERT_ART: readonly string[] = ['.XX.', '.XX.', '.XX.', '.XX.', '....', '.XX.'];

export function drawAlert(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const pixel = ALERT_PIXEL_SCREEN / ctx.getTransform().a;
  const bob = Math.floor(time * ALERT_BOB_HZ) % 2 === 0 ? 0 : pixel;
  const left = Math.round((x - (ALERT_ART[0]!.length * pixel) / 2) / pixel) * pixel;
  const top = Math.round((y - ALERT_LIFT_TILES - ALERT_ART.length * pixel - bob) / pixel) * pixel;

  ctx.save();
  for (const [colour, grow] of [
    [ALERT_SHADE, pixel],
    [ALERT, 0],
  ] as const) {
    ctx.fillStyle = colour;
    ALERT_ART.forEach((row, line) => {
      for (let at = 0; at < row.length; at += 1) {
        if (row[at] === 'X') ctx.fillRect(left + at * pixel - grow, top + line * pixel - grow, pixel + grow * 2, pixel + grow * 2);
      }
    });
  }
  ctx.restore();
}

const GLYPH_ART: Record<number, readonly string[]> = {
  [Glyph.Query]: ['.XXX.', 'X...X', '....X', '..XX.', '..X..', '.....', '..X..'],
  [Glyph.Plus]: ['.....', '..X..', '..X..', 'XXXXX', '..X..', '..X..', '.....'],
  [Glyph.Bang]: ['.XX.', '.XX.', '.XX.', '.XX.', '....', '.XX.', '.XX.'],
  [Glyph.Dots]: ['.......', '.......', '.......', '.......', '.......', 'X.X.X..', '.......'],
};

const BUBBLE_CELL = 18;

const BUBBLE_HEIGHT = 26;

const BUBBLE_LIFT_TILES = 0.9;

export function drawBubbleOf(ctx: CanvasRenderingContext2D, people: People, person: number, time: number): void {
  const at = person * BUBBLE_SLOTS;
  const kind = people.bubble[at]!;
  if (kind === Bubble.None) return;
  const glyphs = [people.bubble[at + 1]!, people.bubble[at + 2]!, people.bubble[at + 3]!].filter((glyph) => glyph !== Glyph.None);
  const unit = 1 / ctx.getTransform().a;
  const bob = Math.sin(time * 3 + person) * 1.5 * unit;
  const width = glyphs.length * BUBBLE_CELL + 10;
  const cx = people.posX[person]!;
  const base = people.posY[person]! - BUBBLE_LIFT_TILES + bob;
  const left = cx - (width / 2) * unit;
  const top = base - (BUBBLE_HEIGHT + 12) * unit;
  const round = 5 * unit;

  ctx.save();
  ctx.fillStyle = BUBBLE.fill;
  ctx.strokeStyle = BUBBLE.edge;
  ctx.lineWidth = 2 * unit;
  ctx.beginPath();
  ctx.roundRect(left, top, width * unit, BUBBLE_HEIGHT * unit, round);
  ctx.fill();
  ctx.stroke();
  if (kind === Bubble.Thought) {
    for (const [offset, radius] of [[6, 3.4], [11, 2]] as const) {
      ctx.beginPath();
      ctx.arc(cx - (offset - 4) * unit * 0.5, top + (BUBBLE_HEIGHT + offset) * unit, radius * unit, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(cx - 5 * unit, top + BUBBLE_HEIGHT * unit - unit);
    ctx.lineTo(cx, top + (BUBBLE_HEIGHT + 10) * unit);
    ctx.lineTo(cx + 5 * unit, top + BUBBLE_HEIGHT * unit - unit);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 5 * unit, top + BUBBLE_HEIGHT * unit);
    ctx.lineTo(cx, top + (BUBBLE_HEIGHT + 10) * unit);
    ctx.lineTo(cx + 5 * unit, top + BUBBLE_HEIGHT * unit);
    ctx.stroke();
  }

  glyphs.forEach((glyph, slot) => {
    const middleX = left + (5 + slot * BUBBLE_CELL + BUBBLE_CELL / 2) * unit;
    const middleY = top + (BUBBLE_HEIGHT / 2) * unit;
    if (glyph >= Glyph.Neuron) {
      icon(ctx, `neuron-${NEURONS[glyph - Glyph.Neuron]?.id ?? 'flint'}` as IconName, middleX, middleY, 16 * unit);
      return;
    }
    const art = GLYPH_ART[glyph];
    if (!art) return;
    const pixel = 2 * unit;
    ctx.fillStyle = glyph === Glyph.Query ? BUBBLE.query : glyph === Glyph.Bang ? BUBBLE.bang : BUBBLE.ink;
    art.forEach((row, line) => {
      for (let column = 0; column < row.length; column += 1) {
        if (row[column] === 'X') ctx.fillRect(middleX + (column - row.length / 2) * pixel, middleY + (line - art.length / 2) * pixel, pixel, pixel);
      }
    });
  });
  ctx.restore();
}

const PULSE_SECONDS_FULL = 1.6;

const PULSE_REACH_TILES = 1.1;

const PULSE_DOTS = 12;

export function drawPulse(ctx: CanvasRenderingContext2D, x: number, y: number, left: number): void {
  const pixel = ALERT_PIXEL_SCREEN / ctx.getTransform().a;
  const grown = 1 - Math.min(1, left / PULSE_SECONDS_FULL);
  const radius = 0.25 + PULSE_REACH_TILES * grown;
  ctx.save();
  ctx.fillStyle = MIND.pulse;
  ctx.globalAlpha = Math.min(1, left * 1.6);
  for (let dot = 0; dot < PULSE_DOTS; dot += 1) {
    const angle = (dot / PULSE_DOTS) * Math.PI * 2;
    const at = Math.round((x + Math.cos(angle) * radius) / pixel) * pixel;
    const down = Math.round((y - 0.35 + Math.sin(angle) * radius * 0.6) / pixel) * pixel;
    ctx.fillRect(at, down, pixel, pixel);
  }
  ctx.restore();
}
