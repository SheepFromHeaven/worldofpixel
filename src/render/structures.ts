import { PARCEL } from '../sim/parcels.ts';
import { CLAMP_ID, HEARTH_DESIGN_ID, PIT_FIRING_ID } from '../sim/designs.ts';
import { ItemType } from '../sim/types.ts';
import type { Design, DesignId } from '../sim/types.ts';
import { TILT } from '../pixel/view.ts';
import { INK, INK_SOFT, ITEM_COLORS, RED_PENCIL, withAlpha } from './palette.ts';
import { SOURCES, drawTile, frameAt, tilePieces } from './sprites.ts';
import type { TilePiece, Tint } from './sprites.ts';
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
  /** Who is inside working it, for a land work that shows them at it. */
  worker?: 'woman' | 'man';
  /**
   * One piece of the drawing, when the caller is sorting the pieces separately (`tilePieces`) —
   * the pit of a hearth, the fire out of it, one stone of a works' ring. Omitted draws the lot.
   */
  piece?: TilePiece;
  /**
   * What the plume off a clamp is tinted with, and whether there is one at all. A rig with
   * nothing running is not smoking, so the baked plume is left out of the drawing entirely.
   */
  smoke?: Tint;
  /**
   * How hard the fire under this building is being driven, as an index into `CHARGE_STEPS` —
   * the same three settings the room's slab is a strip of. The control and the readout are the
   * same drawing, so a hearth banked low burns low here.
   */
  fire?: number;
}

/** The hearth's fire, one drawing per banking. Indexed like `CHARGE_STEPS`. */
const BURN_CLIPS = ['burn-banked', 'burn', 'burn-roaring'] as const;

/** How hot a rig is, as the light it throws: a step of `GLOW_LIGHT`, and how far up the steps. */
export interface GlowLight {
  color: string;
  /** 0 at black heat, 1 at white. */
  level: number;
}

/** The size the drawings below are made at; `drawStructure` scales from here. */
const NOMINAL_RADIUS = 26;

/** Half the pencil shed's width, at that nominal size. */
const SHED_WIDTH = NOMINAL_RADIUS * 0.8;

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
 * The pencil shed, which stands in until the building's tile has decoded and is the drawing at
 * the zooms where a tile is too small to cut honestly.
 *
 * One shed whatever is inside. It used to bolt a chimney, a trough and a stack of crates onto
 * the walls according to what squares the floor plan held, which was the plan printed on the
 * map in another hand; there is no floor plan now, and what a building is for is a method in
 * the book that changes from one day to the next.
 */
function drawWorkshop(ctx: CanvasRenderingContext2D, r: number): void {
  const width = SHED_WIDTH;
  const eaves = -r * 0.12;
  const ground = r * 0.52;
  const ridge = -r * 0.7;

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
  hatchRegion(ctx, roof, { spacing: 4, angle: 1.2, seed: 7, alpha: 0.4 });

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

/**
 * The settlement's fire: a ring of stones, crossed logs, a flame that never goes out — and the
 * town's bins stacked around it, because the hearth is where everything nobody needs ends up.
 */
function drawHearth(ctx: CanvasRenderingContext2D, r: number, time: number): void {
  pencil(ctx, ITEM_COLORS[ItemType.Wood], strokeWeight.detail);
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
  for (const named of clips) {
    // The piece in the sort is `burn`, whichever banking is drawn: one fire in one bed, three
    // ways of driving it.
    const clip = named === 'burn' && options.fire !== undefined
      ? BURN_CLIPS[Math.min(Math.max(0, options.fire), BURN_CLIPS.length - 1)] ?? named
      : named;
    // A rig with nothing in it is not smoking. The plume is one of the tile's pieces like any
    // other, so the only way to say so is to leave it out — and its colour, when there is one,
    // is the clamp's whole readout.
    if (clip === 'smoke' && !options.smoke) continue;
    const entry = source.clips.find((declared) => declared.name === clip);
    const step = entry && entry.frames > 1 ? frameAt(options.time, entry.frames, entry.fps) : 0;
    drawn = drawTile(ctx, name, x, y, clip, step, false, clip === 'smoke' ? options.smoke : undefined) || drawn;
  }
  return drawn;
}

/**
 * Which tile a design is drawn as, by name.
 *
 * It was read off the floor plan — a Hearth square made a hearth, a Source square's item made
 * a well, a hole or a woodpile — and there is no plan to read. A design is a named thing the
 * chapter hands over, so the drawing is named with it. The two rigs of the heat age are
 * drawings of themselves like the land works: a hollow with the pots stacked in it, an earthed
 * cone with its vents. What they *make* is the method running on them and changes from day to
 * day, so it cannot be in the tile. Anything not listed is a works.
 */
const TILES: Readonly<Record<DesignId, string>> = {
  [HEARTH_DESIGN_ID]: 'hearth',
  [PIT_FIRING_ID]: 'pit-firing',
  [CLAMP_ID]: 'charcoal-clamp',
  well: 'well',
  digging: 'dig',
  woodcutter: 'woodcutter',
};

export function structureTile(design: Design): string {
  return TILES[design.id] ?? 'works';
}

/**
 * How wide a building is drawn, in world units.
 *
 * One number for all of them. It was a count of the squares on the floor, so a design the
 * player had laid out heavily stood wider on the map; a building is a named thing now and its
 * tile is a fixed number of cells, so the drawing has one size and the pencil stand-in takes
 * the same one.
 */
export const designRadius = (design: Design): number => {
  void design;
  return 1.1;
};

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
    shadow(ctx, r, SHED_WIDTH);
    drawWorkshop(ctx, r);
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
    shadow(ctx, r, SHED_WIDTH);
    drawWorkshop(ctx, r);
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

/** Where the fire sits in a rig's tile, from the middle of its parcel: down in the hollow. */
const CHAMBER = { x: -PARCEL * 0.03, y: PARCEL * 0.12 };

/**
 * A rig running, drawn as the heat and nothing else.
 *
 * The control and the readout are one drawing. There is no bar over a kiln, no number beside it
 * and nothing hovering: what a fire is doing is the one thing in this game you can honestly see
 * from across the yard, so it is the glow, keyed to the chamber's own temperature — absent at
 * black heat, a sullen red low down, a white that puts light on the grass a parcel out.
 *
 * Light is **added** rather than painted over. A wash of orange laid on the ground would take
 * the ground's colour away and leave a flat patch where the meadow was; added, the grass round
 * a dull fire is grass that happens to be warmer, which is what firelight does.
 *
 * Two parts, sorted apart by the caller against the tile's own pieces (`drawTowns`): the pool it
 * throws on the ground, which goes under everything the rig is made of, and the chamber itself,
 * which goes over them so the near face of the mound is lit and not merely stood in front of.
 *
 * Everything here is sized in world units and filled, never stroked, so there is no screen-pixel
 * width to divide back out: a fire lights a real patch of ground and keeps it at every zoom.
 */
export function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  glow: GlowLight,
  time: number,
  part: 'ground' | 'chamber',
): void {
  if (glow.level <= 0) return;
  // A fire breathes, so the light off it never sits still. Two rates, or it pulses like a lamp.
  const breath = 0.9 + 0.08 * Math.sin(time * 4.3) + 0.04 * Math.sin(time * 11.7);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  if (part === 'ground') {
    // Lying flat, so foreshortened like every other flat thing on the map.
    const reach = PARCEL * (0.42 + 0.3 * glow.level);
    ctx.translate(x + CHAMBER.x, y + CHAMBER.y);
    ctx.scale(1, TILT);
    const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, reach);
    pool.addColorStop(0, withAlpha(glow.color, (0.12 + 0.16 * glow.level) * breath));
    pool.addColorStop(0.45, withAlpha(glow.color, (0.06 + 0.08 * glow.level) * breath));
    pool.addColorStop(1, withAlpha(glow.color, 0));
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.arc(0, 0, reach, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.translate(x + CHAMBER.x, y + CHAMBER.y);
  const mouth = PARCEL * (0.19 + 0.1 * glow.level);
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, mouth);
  core.addColorStop(0, withAlpha(glow.color, (0.4 + 0.24 * glow.level) * breath));
  core.addColorStop(1, withAlpha(glow.color, 0));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.ellipse(0, 0, mouth, mouth * TILT * 1.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // The air over a hot chamber, which only shows once there is enough heat to see it leaving:
  // a lean column of the same light, leaning with the draught.
  if (glow.level < 0.5) {
    ctx.restore();
    return;
  }
  const rise = PARCEL * 0.5 * glow.level;
  const lean = Math.sin(time * 1.7) * PARCEL * 0.06;
  const air = ctx.createLinearGradient(0, 0, lean, -rise);
  air.addColorStop(0, withAlpha(glow.color, 0.16 * glow.level * breath));
  air.addColorStop(1, withAlpha(glow.color, 0));
  ctx.fillStyle = air;
  ctx.beginPath();
  ctx.moveTo(-mouth * 0.7, 0);
  ctx.quadraticCurveTo(lean * 2 - mouth * 0.2, -rise * 0.6, lean, -rise);
  ctx.quadraticCurveTo(lean * 2 + mouth * 0.2, -rise * 0.6, mouth * 0.7, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
