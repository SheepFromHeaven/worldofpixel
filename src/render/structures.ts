import { PARCEL } from '../sim/parcels.ts';
import { CLAMP_ID, HEARTH_DESIGN_ID, PIT_FIRING_ID } from '../sim/designs.ts';
import type { Design, DesignId } from '../sim/types.ts';
import { TILT } from '../pixel/view.ts';
import { withAlpha } from './palette.ts';
import { SOURCES, drawTile, frameAt, tilePieces } from './sprites.ts';
import type { TilePiece, Tint } from './sprites.ts';

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
 * tile is a fixed number of cells, so the drawing has one size and anything sized off it takes
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
  void radius;
  // Laid in world units, never scaled to a radius: the tile's cells are the ground's own texels.
  // Nothing is drawn until the tile has decoded, and nothing at a rung too coarse for it.
  const tile = structureTile(design);
  // Somebody at work is the whole tile in one drawing, villager and all — the axe leaves the
  // stump for their hands, and the pail goes down the shaft, neither of which can be sorted
  // between two pieces. Empty, a building is drawn as the several things it is (`tilePieces`).
  const name = options.worker === 'man' ? 'work-man' : 'work';
  const work = options.worker ? SOURCES[tile]?.clips.find((clip) => clip.name === name) : undefined;
  if (work) {
    drawTile(ctx, tile, x, y, name, frameAt(options.time, work.frames, work.fps));
    return;
  }
  drawPieces(ctx, tile, x, y, options);
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
