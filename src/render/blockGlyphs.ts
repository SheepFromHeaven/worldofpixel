import { hashString } from '../sim/rng.ts';
import { BlockKind, STEP } from '../sim/types.ts';
import type { Block, Direction } from '../sim/types.ts';
import { BLOCK_COLORS, INK, RED_PENCIL } from './palette.ts';
import { drawWobblyCircle, drawWobblyLine, drawWobblyPath, pencil, strokeWeight } from './scribble.ts';

export interface GlyphOptions {
  /** Seconds since start — drives the cog and the flames. */
  time: number;
  working?: boolean;
  weight?: number;
  alpha?: number;
}

/**
 * One drawing of each block kind, drawn into a square of the caller's own units and used
 * everywhere a block appears: the plan of a building on the map, the blueprint sheet, and the
 * designer's grid. Three hand-drawn copies of a funnel would have drifted apart by the second
 * block kind anyone added.
 */
export function drawFacingArrow(
  ctx: CanvasRenderingContext2D,
  facing: Direction,
  cx: number,
  cy: number,
  size: number,
  reach = 0.42,
): void {
  const step = STEP[facing];
  const tipX = cx + step.x * size * reach;
  const tipY = cy + step.y * size * reach;
  const tailX = cx - step.x * size * reach;
  const tailY = cy - step.y * size * reach;
  const wing = size * 0.14;

  drawWobblyLine(ctx, tailX, tailY, tipX, tipY, {
    amplitude: 0.35,
    step: size,
    seed: hashString(`arrow${facing}${Math.round(cx)}${Math.round(cy)}`),
  });
  drawWobblyLine(ctx, tipX, tipY, tipX - step.x * wing + step.y * wing, tipY - step.y * wing - step.x * wing, {
    amplitude: 0.25,
    step: size,
  });
  drawWobblyLine(ctx, tipX, tipY, tipX - step.x * wing - step.y * wing, tipY - step.y * wing + step.x * wing, {
    amplitude: 0.25,
    step: size,
  });
}

/**
 * The ground opened: a mouth with what is coming out of it rising over the rim. Deliberately
 * nothing like the funnel — a source is not a door, and the two are the whole of the siting
 * decision when a design is raised.
 */
function wellhead(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  const cx = x + s / 2;
  const rim = y + s * 0.74;
  drawWobblyLine(ctx, x + s * 0.12, rim, x + s * 0.88, rim, { amplitude: 0.35, step: s * 0.5 });

  for (let ring = 0; ring < 3; ring += 1) {
    const radius = s * (0.34 - ring * 0.1);
    const points = [];
    for (let i = 0; i <= 6; i += 1) {
      const theta = Math.PI + (i / 6) * Math.PI;
      points.push({ x: cx + Math.cos(theta) * radius, y: rim + Math.sin(theta) * radius * 0.9 });
    }
    drawWobblyPath(ctx, points, { amplitude: 0.3, step: s * 0.4, seed: 540 + ring });
  }
}

function funnel(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  drawWobblyPath(
    ctx,
    [
      { x: x + s * 0.16, y: y + s * 0.24 },
      { x: x + s * 0.84, y: y + s * 0.24 },
      { x: x + s * 0.62, y: y + s * 0.74 },
      { x: x + s * 0.38, y: y + s * 0.74 },
    ],
    { amplitude: 0.6, step: s * 0.5 },
    true,
  );
}

function crate(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  drawWobblyPath(
    ctx,
    [
      { x: x + s * 0.2, y: y + s * 0.26 },
      { x: x + s * 0.8, y: y + s * 0.26 },
      { x: x + s * 0.8, y: y + s * 0.76 },
      { x: x + s * 0.2, y: y + s * 0.76 },
    ],
    { amplitude: 0.6, step: s * 0.5 },
    true,
  );
  drawWobblyLine(ctx, x + s * 0.2, y + s * 0.42, x + s * 0.8, y + s * 0.42, { amplitude: 0.4, step: s });
}

/** A bin: wider than the crate at a door, with a rim and staves, so a store reads as a store. */
function bin(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  drawWobblyPath(
    ctx,
    [
      { x: x + s * 0.14, y: y + s * 0.32 },
      { x: x + s * 0.86, y: y + s * 0.32 },
      { x: x + s * 0.76, y: y + s * 0.82 },
      { x: x + s * 0.24, y: y + s * 0.82 },
    ],
    { amplitude: 0.5, step: s * 0.5 },
    true,
  );
  drawWobblyLine(ctx, x + s * 0.1, y + s * 0.28, x + s * 0.9, y + s * 0.28, {
    amplitude: 0.4,
    step: s * 0.5,
  });
  for (const stave of [0.38, 0.62]) {
    drawWobblyLine(ctx, x + s * stave, y + s * 0.34, x + s * (stave + 0.02), y + s * 0.8, {
      amplitude: 0.3,
      step: s,
      seed: Math.round(stave * 100),
    });
  }
}

function cog(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, angle: number): void {
  const cx = x + s / 2;
  const cy = y + s / 2;
  const radius = s * 0.22;
  drawWobblyCircle(ctx, cx, cy, radius, { amplitude: 0.5, seed: hashString(`cog${Math.round(cx)}`) });
  for (let i = 0; i < 8; i += 1) {
    const theta = angle + (i / 8) * Math.PI * 2;
    drawWobblyLine(
      ctx,
      cx + Math.cos(theta) * radius,
      cy + Math.sin(theta) * radius,
      cx + Math.cos(theta) * radius * 1.45,
      cy + Math.sin(theta) * radius * 1.45,
      { amplitude: 0.3, step: s, seed: 600 + i },
    );
  }
}

function beltBed(ctx: CanvasRenderingContext2D, block: Block, x: number, y: number, s: number): void {
  const across = Math.abs(STEP[block.facing].x) > 0;
  const cx = x + s / 2;
  const cy = y + s / 2;
  for (const side of [-1, 1]) {
    if (across) {
      drawWobblyLine(ctx, x + s * 0.06, cy + side * s * 0.24, x + s * 0.94, cy + side * s * 0.24, {
        amplitude: 0.4,
        step: s,
        seed: 620 + side,
      });
    } else {
      drawWobblyLine(ctx, cx + side * s * 0.24, y + s * 0.06, cx + side * s * 0.24, y + s * 0.94, {
        amplitude: 0.4,
        step: s,
        seed: 622 + side,
      });
    }
  }
}

function flames(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, time: number): void {
  const cx = x + s / 2;
  const base = y + s * 0.78;
  for (let i = 0; i < 3; i += 1) {
    const flicker = Math.sin(time * 6 + i * 2.1) * s * 0.08;
    drawWobblyPath(
      ctx,
      [
        { x: cx + (i - 1) * s * 0.17, y: base },
        { x: cx + (i - 1) * s * 0.17 + flicker, y: base - s * 0.26 },
        { x: cx + (i - 1) * s * 0.11 - flicker, y: base - s * 0.5 },
      ],
      { amplitude: 0.45, step: s, seed: 650 + i },
    );
  }
}

/** The block itself, inside the square `(x, y) → (x + size, y + size)`. */
export function drawBlockFace(
  ctx: CanvasRenderingContext2D,
  block: Block,
  x: number,
  y: number,
  size: number,
  options: GlyphOptions,
): void {
  const weight = options.weight ?? strokeWeight.form;
  const alpha = options.alpha ?? 1;

  switch (block.kind) {
    case BlockKind.Source:
      pencil(ctx, BLOCK_COLORS[block.kind], weight, alpha);
      wellhead(ctx, x, y, size);
      break;
    case BlockKind.Input:
      pencil(ctx, BLOCK_COLORS[block.kind], weight, alpha);
      funnel(ctx, x, y, size);
      break;
    case BlockKind.Output:
      pencil(ctx, BLOCK_COLORS[block.kind], weight, alpha);
      crate(ctx, x, y, size);
      break;
    case BlockKind.Combine:
      pencil(ctx, INK, weight, alpha);
      cog(ctx, x, y, size, options.working ? options.time * 2.2 : 0.3);
      break;
    case BlockKind.Storage:
      pencil(ctx, BLOCK_COLORS[block.kind], weight, alpha);
      bin(ctx, x, y, size);
      break;
    case BlockKind.Transport:
      pencil(ctx, INK, weight * 0.8, alpha * 0.9);
      beltBed(ctx, block, x, y, size);
      break;
    case BlockKind.Hearth:
      pencil(ctx, RED_PENCIL, weight, alpha);
      flames(ctx, x, y, size, options.time);
      break;
  }

  // A bin is a terminus; an arrow on one would promise it hands its load on, which it does only
  // when something is actually drawn in front of it.
  if (block.kind !== BlockKind.Hearth && block.kind !== BlockKind.Storage) {
    pencil(ctx, BLOCK_COLORS[block.kind], weight * 0.75, alpha * 0.85);
    drawFacingArrow(ctx, block.facing, x + size / 2, y + size / 2, size, block.kind === BlockKind.Transport ? 0.4 : 0.46);
  }
}
