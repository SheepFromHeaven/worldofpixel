import { BlockKind, ItemType } from '../sim/types.ts';
import type { Design } from '../sim/types.ts';
import { BLOCK_COLORS, INK, INK_SOFT, ITEM_COLORS, RED_PENCIL } from './palette.ts';
import { SOURCES, drawTile, frameAt, tilePieces } from './sprites.ts';
import type { TilePiece } from './sprites.ts';
import {
  drawWobblyCircle,
  drawWobblyLine,
  drawWobblyPath,
  hatchRegion,
  pencil,
  strokeWeight,
} from './scribble.ts';

export interface StructureOptions {
  /** Seconds since start — drives flames, smoke and the waterwheel. */
  time: number;
  /** Whether the building is actually doing work this tick. */
  working: boolean;
  /** Who is inside working it, for a land work that shows them at it. */
  worker?: 'woman' | 'man';
  /**
   * One piece of the drawing, when the caller is sorting the pieces separately (`tilePieces`) —
   * the pit of a hearth, the fire out of it, one stone of a works' ring. Omitted draws the lot.
   */
  piece?: TilePiece;
}

/** The size the drawings below are made at; `drawStructure` scales from here. */
const NOMINAL_RADIUS = 26;

function shadow(ctx: CanvasRenderingContext2D, r: number, width: number): void {
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(r * 0.12, r * 0.62, width * 1.15, r * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function smoke(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, seed: number): void {
  pencil(ctx, INK_SOFT, strokeWeight.texture, 0.55);
  for (let i = 0; i < 3; i += 1) {
    const drift = ((time * 12 + i * 9) % 27) / 27;
    drawWobblyCircle(ctx, x + Math.sin(drift * 4 + i) * 3.5, y - drift * 20, 1.8 + drift * 3.6, {
      amplitude: 0.7,
      seed: seed + i,
    });
  }
}

/**
 * A workshop, drawn as a workshop. What the design is made of shows in what is bolted to it —
 * a chimney over a combine block, a trough where it draws, a stack of crates at the door it
 * ships from — rather than by printing the floor plan on the map. The plan belongs on the
 * blueprint sheet; out here the player is looking at a village.
 */
function drawWorkshop(
  ctx: CanvasRenderingContext2D,
  design: Design,
  r: number,
  options: StructureOptions,
): void {
  const kinds = new Set(design.blocks.map((block) => block.kind));
  const width = Math.min(r * 0.95, r * (0.5 + design.blocks.length * 0.045));
  const eaves = -r * 0.12;
  const ground = r * 0.52;
  const ridge = -r * (0.62 + design.blocks.length * 0.012);

  if (kinds.has(BlockKind.Source)) {
    // The ground opened beside the shed: a mouth with rings coming off it.
    pencil(ctx, BLOCK_COLORS[BlockKind.Source], strokeWeight.detail);
    const mx = -width - r * 0.34;
    const my = ground - r * 0.04;
    drawWobblyLine(ctx, mx - r * 0.3, my, mx + r * 0.3, my, { amplitude: 0.4, step: r * 0.4 });
    for (let ring = 0; ring < 2; ring += 1) {
      const radius = r * (0.26 - ring * 0.1);
      const arc = [];
      for (let i = 0; i <= 6; i += 1) {
        const theta = Math.PI + (i / 6) * Math.PI;
        arc.push({ x: mx + Math.cos(theta) * radius, y: my + Math.sin(theta) * radius * 0.9 });
      }
      drawWobblyPath(ctx, arc, { amplitude: 0.3, step: r * 0.3, seed: 540 + ring });
    }
  }

  if (kinds.has(BlockKind.Input)) {
    // The trough carriers tip their loads into, set against the near wall.
    pencil(ctx, BLOCK_COLORS[BlockKind.Input], strokeWeight.detail);
    drawWobblyPath(
      ctx,
      [
        { x: -width - r * 0.42, y: ground - r * 0.22 },
        { x: -width + r * 0.02, y: ground - r * 0.22 },
        { x: -width - r * 0.04, y: ground },
        { x: -width - r * 0.36, y: ground },
      ],
      { amplitude: 0.5, step: r * 0.4 },
      true,
    );
    drawWobblyLine(ctx, -width - r * 0.38, ground - r * 0.16, -width - r * 0.02, ground - r * 0.16, {
      amplitude: 0.4,
      step: r,
    });
  }

  pencil(ctx, INK, strokeWeight.form);
  drawWobblyPath(
    ctx,
    [
      { x: -width, y: ground },
      { x: -width, y: eaves },
      { x: width, y: eaves },
      { x: width, y: ground },
    ],
    { amplitude: 0.7, step: r * 0.45 },
    true,
  );

  const roof = [
    { x: -width * 1.22, y: eaves },
    { x: 0, y: ridge },
    { x: width * 1.22, y: eaves },
  ];
  drawWobblyPath(ctx, roof, { amplitude: 0.8, step: r * 0.5 }, true);
  pencil(ctx, INK_SOFT, strokeWeight.texture, 0.5);
  hatchRegion(ctx, roof, { spacing: 4, angle: 1.2, seed: design.blocks.length + 7, alpha: 0.4 });

  // Door, and a shutter once the shed is wide enough to have somewhere to put one.
  pencil(ctx, INK, strokeWeight.detail);
  drawWobblyPath(
    ctx,
    [
      { x: -width * 0.22, y: ground },
      { x: -width * 0.22, y: ground - r * 0.34 },
      { x: width * 0.16, y: ground - r * 0.34 },
      { x: width * 0.16, y: ground },
    ],
    { amplitude: 0.4, step: r * 0.5 },
  );
  if (width > r * 0.6) {
    drawWobblyPath(
      ctx,
      [
        { x: width * 0.4, y: eaves + r * 0.12 },
        { x: width * 0.78, y: eaves + r * 0.12 },
        { x: width * 0.78, y: eaves + r * 0.42 },
        { x: width * 0.4, y: eaves + r * 0.42 },
      ],
      { amplitude: 0.35, step: r * 0.5 },
      true,
    );
  }

  if (kinds.has(BlockKind.Combine)) {
    const chimneyX = -width * 0.62;
    pencil(ctx, INK, strokeWeight.detail);
    drawWobblyPath(
      ctx,
      [
        { x: chimneyX - r * 0.1, y: ridge * 0.55 },
        { x: chimneyX - r * 0.1, y: ridge * 1.25 },
        { x: chimneyX + r * 0.12, y: ridge * 1.25 },
        { x: chimneyX + r * 0.12, y: ridge * 0.55 },
      ],
      { amplitude: 0.4, step: r * 0.4 },
    );
    if (options.working) smoke(ctx, chimneyX, ridge * 1.3, options.time, 480);
  }

  if (kinds.has(BlockKind.Storage)) {
    // Sacks stacked against the wall — a store says so from across the valley.
    pencil(ctx, BLOCK_COLORS[BlockKind.Storage], strokeWeight.detail);
    for (let i = 0; i < 3; i += 1) {
      const sx = -width * 0.55 + i * r * 0.36;
      const sy = ground - r * 0.02;
      drawWobblyPath(
        ctx,
        [
          { x: sx - r * 0.14, y: sy },
          { x: sx - r * 0.1, y: sy - r * 0.3 },
          { x: sx + r * 0.1, y: sy - r * 0.3 },
          { x: sx + r * 0.14, y: sy },
        ],
        { amplitude: 0.4, step: r * 0.3, seed: 700 + i },
        true,
      );
    }
  }

  if (kinds.has(BlockKind.Output)) {
    // Crates on the loading side, so a building that ships something says so from a distance.
    pencil(ctx, BLOCK_COLORS[BlockKind.Output], strokeWeight.detail);
    for (let i = 0; i < 2; i += 1) {
      const cx = width + r * (0.2 + i * 0.03);
      const cy = ground - r * (0.08 + i * 0.26);
      const size = r * 0.21;
      drawWobblyPath(
        ctx,
        [
          { x: cx - size, y: cy - size },
          { x: cx + size, y: cy - size },
          { x: cx + size, y: cy + size },
          { x: cx - size, y: cy + size },
        ],
        { amplitude: 0.4, step: r * 0.4, seed: 90 + i },
        true,
      );
    }
  }
}

/**
 * The settlement's fire: a ring of stones, crossed logs, a flame that never goes out — and the
 * town's bins stacked around it, because the hearth is where everything nobody needs ends up.
 */
function drawHearth(ctx: CanvasRenderingContext2D, r: number, time: number): void {
  pencil(ctx, BLOCK_COLORS[BlockKind.Storage], strokeWeight.detail);
  for (let i = 0; i < 4; i += 1) {
    const theta = Math.PI * 0.25 + (i / 4) * Math.PI * 2;
    const sx = Math.cos(theta) * r * 1.35;
    const sy = Math.sin(theta) * r * 0.78 + r * 0.2;
    drawWobblyPath(
      ctx,
      [
        { x: sx - r * 0.2, y: sy + r * 0.05 },
        { x: sx - r * 0.15, y: sy - r * 0.38 },
        { x: sx + r * 0.15, y: sy - r * 0.38 },
        { x: sx + r * 0.2, y: sy + r * 0.05 },
      ],
      { amplitude: 0.5, step: r * 0.3, seed: 720 + i },
      true,
    );
  }

  pencil(ctx, INK_SOFT, strokeWeight.detail);
  for (let i = 0; i < 8; i += 1) {
    const theta = (i / 8) * Math.PI * 2;
    drawWobblyCircle(ctx, Math.cos(theta) * r * 0.95, Math.sin(theta) * r * 0.5 + r * 0.25, r * 0.17, {
      amplitude: 0.6,
      seed: 300 + i,
    });
  }

  pencil(ctx, ITEM_COLORS[ItemType.Dirt], strokeWeight.form);
  drawWobblyLine(ctx, -r * 0.6, r * 0.3, r * 0.6, -r * 0.1, { amplitude: 0.8, step: r * 0.6, seed: 311 });
  drawWobblyLine(ctx, -r * 0.6, -r * 0.1, r * 0.6, r * 0.3, { amplitude: 0.8, step: r * 0.6, seed: 312 });

  pencil(ctx, RED_PENCIL, strokeWeight.form);
  for (let i = 0; i < 3; i += 1) {
    const flicker = Math.sin(time * 6 + i * 2.1) * r * 0.1;
    drawWobblyPath(
      ctx,
      [
        { x: (i - 1) * r * 0.28, y: 0 },
        { x: (i - 1) * r * 0.28 + flicker, y: -r * 0.55 },
        { x: (i - 1) * r * 0.18 - flicker, y: -r * (0.85 + i * 0.12) },
      ],
      { amplitude: 0.7, step: r * 0.4, seed: 320 + i },
    );
  }
  smoke(ctx, 0, -r * 1.1, time, 330);
}

/**
 * Which tile a design is drawn as. The caller needs this to ask for the drawing's pieces before
 * it knows anything else about it — what a building looks like is this module's business, but
 * *where its parts stand* is the painter's depth sort.
 */
/**
 * The piece the caller asked for, or every piece of the tile back to front.
 *
 * A clip's own frame count decides how it animates: the hearth's bed and its flames are three
 * frames each and its ring is one, so the frame cannot be a number this function guesses.
 */
function drawPieces(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  options: StructureOptions,
): boolean {
  const source = SOURCES[name];
  if (!source) return false;

  const wanted = options.piece?.clip;
  const clips = wanted ? [wanted] : tilePieces(name).map((piece) => piece.clip ?? 'default');

  let drawn = false;
  for (const clip of clips) {
    const entry = source.clips.find((declared) => declared.name === clip);
    const step = entry && entry.frames > 1 ? frameAt(options.time, entry.frames, entry.fps) : 0;
    drawn = drawTile(ctx, name, x, y, clip, step) || drawn;
  }
  return drawn;
}

export function structureTile(design: Design): string {
  if (design.blocks.some((block) => block.kind === BlockKind.Hearth)) return 'hearth';
  const opened = design.blocks.find((block) => block.kind === BlockKind.Source)?.item;
  if (opened === ItemType.Water) return 'well';
  if (opened === ItemType.Dirt) return 'dig';
  if (opened === ItemType.Wood) return 'woodcutter';
  return 'works';
}

export function drawStructure(
  ctx: CanvasRenderingContext2D,
  design: Design,
  x: number,
  y: number,
  radius: number,
  options: StructureOptions,
): void {
  // A building that opens the ground is drawn as the opening: a pool for water, a hole with its
  // spoil beside it for earth. These are the drawings that used to be scattered over the map as
  // deposits — there are none now, so the one place they still mean something is the building
  // that draws from the ground. Any other design is a shed with its workings bolted on.
  const tile = structureTile(design);
  const isHearth = tile === 'hearth';
  const ground = tile === 'works' || isHearth ? undefined : tile;

  ctx.save();
  ctx.translate(x, y);
  // Drawn at a nominal size and scaled to the radius asked for, so the same drawing works under
  // the cursor, on a parcel, and shrunk into a village seen from far off.
  const unit = radius / NOMINAL_RADIUS;
  ctx.scale(unit, unit);
  const r = NOMINAL_RADIUS;

  if (!isHearth && !ground) {
    ctx.restore();
    // The shed, as a tile like everything else standing on the ground. It was the last thing on
    // the map still drawn in pencil, which left a building looking like a sketch laid over the
    // land rather than something standing on it. One drawing whatever is inside: what a works
    // *does* is the room's question, and a floor plan printed out here would make a parcel read
    // as a diagram of a village.
    //
    // A floor and nine stones, each standing where it stands: the piece says which. Asked for the
    // whole building — a ghost under the cursor, or a rung too coarse to sort in pieces — they go
    // down back to front, which for one tile on bare ground is the same picture.
    if (drawPieces(ctx, 'works', x, y, options)) return;

    // The pencil shed stands in until the tile has decoded, and is the drawing at the zooms
    // where a tile is too small to cut honestly.
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(unit, unit);
    shadow(ctx, r, Math.min(r * 0.95, r * (0.5 + design.blocks.length * 0.045)));
    drawWorkshop(ctx, design, r, options);
    ctx.restore();
    return;
  }

  ctx.restore();

  // Laid in world units like the hearth, and for the same reason: the tile's cells are the
  // ground's own texels, and stretching one to a radius is what breaks that. The pencil shed
  // stands in until the tile has decoded, and at the zooms where a tile is too small to cut
  // honestly it is the drawing.
  if (ground) {
    // Someone inside: the tile with them at work in it. They are off the map while they are here,
    // so this is the only place they show.
    // Somebody at work is the whole tile in one drawing, villager and all — the axe leaves the
    // stump for their hands, and the pail goes down the shaft, neither of which can be sorted
    // between two pieces. So a manned land work is one piece for as long as they are in it; empty,
    // it is drawn as the several things it is (`tilePieces`).
    const name = options.worker === 'man' ? 'work-man' : 'work';
    const work = options.worker ? SOURCES[ground]?.clips.find((clip) => clip.name === name) : undefined;
    const drawn = work
      ? drawTile(ctx, ground, x, y, name, frameAt(options.time, work.frames, work.fps))
      : drawPieces(ctx, ground, x, y, options);
    if (drawn) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(unit, unit);
    shadow(ctx, r, Math.min(r * 0.95, r * (0.5 + design.blocks.length * 0.045)));
    drawWorkshop(ctx, design, r, options);
    ctx.restore();
    return;
  }

  // The tile is laid in world units, not scaled to the radius: its cells are the ground's own
  // texels, and a tile stretched to fit a radius is the one thing that breaks that. The fire is
  // three frames rather than a flicker off the clock — a pixel is one colour or another, and a
  // flame interpolated between two states is neither. The pencil hearth stands in until the tile
  // has decoded.
  if (drawPieces(ctx, 'hearth', x, y, options)) return;

  // The drop shadow belongs to the pencil drawing, which needs something to sit it on the paper.
  // The tile does not: a fire pit is a hollow rather than a thing standing up, and the tile has
  // its own inked rim. It is also sized from the design's radius, which is wider than the tile —
  // harmless while the tile was a parcel across and covered it, a grey smear round the fire once
  // the tile came down to half of one.
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(unit, unit);
  shadow(ctx, r, r * 0.9);
  drawHearth(ctx, r, options.time);
  ctx.restore();
}
