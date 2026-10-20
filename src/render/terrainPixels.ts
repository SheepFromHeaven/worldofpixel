import type { Rgba } from '../pixel/color.ts';
import { PARCEL, parcelId, parcelIndex, parcelOf, siteOf } from '../sim/parcels.ts';
import type { CellId } from '../sim/types.ts';
import type { Detail } from '../sim/parcels.ts';
import { SEA_LEVEL, groundBiomeAt, riverRunsIn, terrainAt, waterSheet } from '../sim/terrain.ts';
import type { WaterSheet } from '../sim/terrain.ts';
import { Water } from '../sim/hydrology.ts';
import { Biome } from '../sim/types.ts';
import type { GameWorld } from '../sim/world.ts';
import { BIOME_RAMPS, PATH, PATH_RAMPS } from './palette.ts';
import { neighbours, positionOf, wornness } from '../sim/footpaths.ts';
import { LIVE_MIPS, MIPS, RIDGES, decalCells, dugAt, felledAt, groundSprites, groundVersion, placementsIn, siteTrees } from './groundSprites.ts';
import type { GroundSprites, Material, Placement } from './groundSprites.ts';

/**
 * The ground as texels, read off the lattice the simulation already uses.
 *
 * A square tile sheet is no use here: the ground is Voronoi cells, and what a cell *is* comes
 * from the climate and height sampled at its site. So the pattern is generated from that data
 * rather than looked up — a cell's own environment picks its ramp, world-anchored noise picks
 * the step, and neighbouring cells dither into each other across their shared edge.
 *
 * **The cell is the authority, not the field underneath it.** It would be cheaper to sample the
 * terrain continuously per texel and skip the lattice entirely, and the result would be smooth
 * and wrong: the simulation decides a parcel's biome from its *site*, so a continuous texture
 * would paint forest over the corner of a parcel the rules call meadow, and the ground would be
 * lying about what can be built on it.
 */

/**
 * How many texels a parcel spans at the sharpest level. This is *the* pixel of the game: the
 * ground is drawn on it and so is every sprite, because a tile whose cells are a different size
 * from the ground's is two pixel grids on one screen, and the eye reads the finer one as a
 * picture lying on the map rather than as part of it.
 *
 * Thirty-two because that is the grid the sprites are authored on — a well is 32 cells over a
 * parcel, a villager 16 over half of one. The art settles this, not the terrain: coarsening the
 * ground is a constant, coarsening a villager to four cells is the end of the drawing.
 */
export const TEXELS_PER_PARCEL = 32;

/** The finest texel there is, and so the size of one cell of any sprite. */
export const TEXEL = PARCEL / TEXELS_PER_PARCEL;

/**
 * One rung of the ground: a lattice to read cells from, and how many texels to cut each cell
 * into. A chunk is always baked at one buffer pixel to the texel and then magnified by whatever
 * the zoom asks for.
 */
export interface GroundLevel {
  detail: Detail;
  spacing: number;
  texels: number;
  /** A texel's size in world units. */
  texel: number;
  /** Cells to a chunk, so that every chunk bakes the same 256-pixel canvas. */
  cells: number;
}

const CHUNK_TEXELS = 256;

/**
 * How few texels a mosaic cell may be cut into before the lattice has to coarsen.
 *
 * Under about four the cells stop reading as ground laid out in plots and start reading as
 * noise — there is no room inside one for the dither at its edge to be an edge.
 */
const MOSAIC_MIN_TEXELS = 3.5;

/**
 * The lattice a rung paints its mosaic on: the parcel lattice, doubled only as often as it must
 * be to keep a cell worth drawing.
 *
 * **It is anchored to the parcel, and that is the whole of it.** Sites are a pure function of
 * the lattice *and its spacing* — two spacings share no cell and no boundary — so a ladder of
 * spacings chosen per rung paints a different country at every one of them. A desert cell that
 * is one plot wide on the parcel lattice is a blob eight plots across on a lattice eight times
 * as coarse, in a place no parcel is desert; one scroll click moved it and changed its size,
 * which is exactly the jump the water had before `floodedAt`.
 *
 * Held at `PARCEL`, the four closest rungs paint the simulation's *own* cells — the ones
 * `parcelOf` reads and the cursor reports — so over the whole range anyone plays at, the ground
 * does not merely stop jumping, it stops being an approximation. Further out a parcel is no
 * longer worth drawing and the lattice doubles with the texel, which still steps by halves and
 * still shares the parcel's own jitter.
 */
const mosaic = (texel: number): number => {
  let spacing = PARCEL;
  while (spacing < texel * MOSAIC_MIN_TEXELS) spacing *= 2;
  return spacing;
};

/**
 * A rung's *lattice* and its *detail* are two different things, and the second is the coarser
 * one: `detail` is what the rest of the game means by how close you are standing — whether a
 * town is a mark or a place you can build in — and it has to keep changing at the zooms it
 * always changed at, however finely the ground itself is stepped underneath it.
 */
const level = (detail: Detail, texel: number): GroundLevel => {
  const spacing = mosaic(texel);
  return { detail, spacing, texels: spacing / texel, texel, cells: (CHUNK_TEXELS * texel) / spacing };
};

/**
 * The rungs, widest first, each one a texel half the size of the one below it.
 *
 * **Halves, not quarters.** A chunk baked at a pixel to the texel and then magnified by a
 * fraction comes out with some texels a pixel wide and some two, which reads as variation in the
 * ground; magnified by 2.85 it comes out with some two and some three, and *that* reads as a
 * fault — a regular ripple of fatter rows every third texel. Keeping every rung within a factor
 * of two of the next means the magnification never leaves the range where the unevenness is
 * invisible, which is the whole reason there are this many rungs rather than three.
 *
 * A rung is now *only* a texel: the lattice follows from it. It used to be a pair chosen by
 * hand, with the rule that a rung changed one of the two and never both — which kept each step
 * to a factor of two but left the lattice free to be a different one at nearly every rung, and
 * a lattice that changes is a mosaic that changes. Derived, the lattice holds still for as long
 * as it can and then takes the same halving step the texel does.
 */
export const LEVELS: readonly GroundLevel[] = Array.from({ length: 9 }, (_, i) =>
  level(
    (['vast', 'vast', 'coarse', 'coarse', 'coarse', 'coarse', 'medium', 'medium', 'fine'] as const)[i]!,
    (PARCEL / TEXELS_PER_PARCEL) * 2 ** (8 - i),
  ),
);

/**
 * How small a texel is allowed to get before the ground drops back to a coarser rung.
 *
 * Two, not one. A rung is held until its own texels are *four* buffer pixels and then handed on
 * to one whose texels are two, so the ground is chunky everywhere and stays chunky for a long
 * stretch of zoom. Switching at one pixel instead — the obvious reading of "as sharp as it can
 * be" — spends most of the range at the smallest pixel there is, and every time you zoom in the
 * ground resets to specks just as it was getting somewhere.
 */
export const MIN_TEXEL_PIXELS = 2;

/**
 * The sharpest rung whose texels are still at least `MIN_TEXEL_PIXELS` across. The rung below is
 * always half the size, so the magnification this leaves is between two and four.
 */
export function levelFor(zoom: number): GroundLevel {
  for (let i = LEVELS.length - 1; i > 0; i -= 1) {
    if (LEVELS[i]!.texel * zoom >= MIN_TEXEL_PIXELS) return LEVELS[i]!;
  }
  return LEVELS[0]!;
}

/**
 * How wide the dither between two cells runs, as a fraction of the lattice spacing. Narrow
 * enough that a cell still reads as itself in the middle, wide enough that the seam is a fade
 * and not a line.
 */
const FADE = 0.38;

/**
 * How near a second site has to be before the outer ring of the search is certainly pointless.
 * Squared, because the search never takes a square root it does not have to.
 */
const SETTLED = 1.15 ** 2;

/**
 * Ordered dither. The threshold comes from the texel's *world* index, never from its place in
 * the chunk being baked — a pattern anchored to the chunk paints the chunk grid onto the map as
 * a checkerboard, which reads as a rendering fault rather than the seeding mistake it is.
 */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const threshold = (ix: number, iy: number): number =>
  ((BAYER[((iy % 4) + 4) % 4]?.[((ix % 4) + 4) % 4] ?? 0) + 0.5) / 16;

/**
 * The lattice over a region, flattened.
 *
 * Typed arrays indexed by arithmetic rather than objects in a `Map`: the inner loop runs
 * twenty-five times per texel and millions of times per chunk, and keying that on
 * `parcelId(column, row)` means building a string every single time. That one line was the
 * difference between a chunk taking half a second and taking a fiftieth of one.
 */
/**
 * A continuous shade resolved onto a short ramp by ordered dither.
 *
 * Rounding to the nearest step gives flat bands with hard edges between them; white noise gives
 * television static. The Bayer threshold spreads the remainder over a 4x4 block instead, so a
 * gradient comes out as one step stippling into the next — which is how pixel art has always
 * drawn more colours than it has.
 */
function rampStep(ramp: readonly Rgba[], shade: number, ix: number, iy: number): number {
  const t = Math.min(1, Math.max(0, shade)) * (ramp.length - 1);
  const low = Math.floor(t);
  return t - low > threshold(ix + 2, iy + 1) ? Math.min(low + 1, ramp.length - 1) : low;
}

function rampDither(ramp: readonly Rgba[], shade: number, ix: number, iy: number): Rgba {
  return ramp[rampStep(ramp, shade, ix, iy)] ?? ramp[0] ?? 0;
}

interface Lattice {
  firstColumn: number;
  firstRow: number;
  columns: number;
  rows: number;
  x: Float64Array;
  y: Float64Array;
  elevation: Float64Array;
  biome: Uint8Array;
  /** Whether each site stands in standing water, so the inner loop reads it rather than a table. */
  wet: Uint8Array;
}

const RAMPS: readonly (readonly Rgba[])[] = [
  BIOME_RAMPS[Biome.Meadow],
  BIOME_RAMPS[Biome.Forest],
  BIOME_RAMPS[Biome.Highland],
  BIOME_RAMPS[Biome.Marsh],
  BIOME_RAMPS[Biome.Tundra],
  BIOME_RAMPS[Biome.Desert],
  BIOME_RAMPS[Biome.Ocean],
  BIOME_RAMPS[Biome.Lake],
  BIOME_RAMPS[Biome.River],
];

const RAMP_INDEX: Record<Biome, number> = {
  [Biome.Meadow]: 0,
  [Biome.Forest]: 1,
  [Biome.Highland]: 2,
  [Biome.Marsh]: 3,
  [Biome.Tundra]: 4,
  [Biome.Desert]: 5,
  [Biome.Ocean]: 6,
  [Biome.Lake]: 7,
  [Biome.River]: 8,
};

/**
 * Which side of the shore a ramp is on: the one boundary that is not a fade.
 *
 * A lake counts, and has to. A coast is a coast whether the water behind it is salt or fresh,
 * and a lake dithered into its bank while the sea beside it is cut clean reads as two different
 * rules for the same thing — which is exactly what it was. Rivers are not in here: a river is
 * a ribbon drawn over the ground rather than a cell of it, so it never reaches this table.
 */
const WET: readonly boolean[] = RAMPS.map((_, index) =>
  index === RAMP_INDEX[Biome.Ocean] || index === RAMP_INDEX[Biome.Lake],
);

interface Site {
  x: number;
  y: number;
  elevation: number;
  biome: number;
}

/**
 * Every site worked out so far, kept between bakes.
 *
 * A site costs a string hash and three fields of fractal noise, and that came to over half the
 * time a chunk took — paid again for every chunk, though a site is a pure function of its place
 * on the lattice and can never change. Neighbouring chunks share their border sites, a chunk
 * re-baked at a new zoom rung shares all of them, and panning back shares everything.
 *
 * Keyed on a number rather than `${column}:${row}`: building a string here would hand back the
 * cost the cache was meant to save.
 */
const sites = new Map<number, Map<number, Site>>();

/**
 * Which world the sites belong to. A site is a pure function of the lattice *and the seed*, and
 * leaving the seed out of the key does not look like a cache bug: the new map simply comes out
 * as the old one, in full, because every cell it asks for is already there under the same
 * number. The chunks are keyed properly and still hand back the stale ground, which is what
 * makes this one hard to see.
 */
let cachedSeed: number | null = null;

/** Enough for a very large window at the widest parcel zoom, with room to pan. */
const SITE_BUDGET = 120_000;

function siteAt(world: GameWorld, spacing: number, column: number, row: number): Site {
  if (cachedSeed !== world.seed) {
    sites.clear();
    cachedSeed = world.seed;
  }

  let cache = sites.get(spacing);
  if (!cache) {
    cache = new Map();
    sites.set(spacing, cache);
  }

  const key = (column + 0x8000) * 0x10000 + (row + 0x8000);
  const known = cache.get(key);
  if (known) return known;

  const where = siteOf(world.seed, spacing, column, row);
  const environment = terrainAt(world.seed, where);
  const site: Site = {
    x: where.x,
    y: where.y,
    elevation: environment.elevation,
    biome: RAMP_INDEX[groundBiomeAt(world.seed, where)],
  };

  if (cache.size >= SITE_BUDGET) cache.clear();
  cache.set(key, site);
  return site;
}

function latticeOver(
  world: GameWorld,
  spacing: number,
  firstColumn: number,
  firstRow: number,
  columns: number,
  rows: number,
): Lattice {
  const count = columns * rows;
  const lattice: Lattice = {
    firstColumn,
    firstRow,
    columns,
    rows,
    x: new Float64Array(count),
    y: new Float64Array(count),
    elevation: new Float64Array(count),
    biome: new Uint8Array(count),
    wet: new Uint8Array(count),
  };

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const site = siteAt(world, spacing, firstColumn + column, firstRow + row);
      const at = row * columns + column;
      lattice.x[at] = site.x;
      lattice.y[at] = site.y;
      lattice.elevation[at] = site.elevation;
      lattice.biome[at] = site.biome;
      lattice.wet[at] = WET[site.biome]! ? 1 : 0;
    }
  }

  return lattice;
}

/**
 * Value noise with nothing allocated per sample.
 *
 * `sim/rng.ts` has noise already, and it builds a generator closure for each of a sample's four
 * corners — fine for the handful of calls the simulation makes, eight allocations a texel here,
 * and millions of them a chunk. This is a copy with the allocation taken out. It does *not* have
 * to agree with the simulation's noise and must never be used where something does: the mottle
 * is decoration, and everything the rules care about still comes off `terrainAt`.
 */
function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x85ebca6b) ^ seed;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

function mottle(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);

  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);

  const top = a + (b - a) * u;
  return top + (c + (d - c) * u - top) * v;
}

/**
 * How much a hillside may lighten or darken, and the slope at which it gives all it has.
 *
 * The reference is a gradient — height per world unit — rather than a difference between two
 * samples, because the difference grows with however far apart they are taken and the rungs
 * take them at their own texel. Normalised, the same hillside comes out equally shaded at every
 * zoom, which is the whole point of hanging it off the field rather than off the picture.
 *
 * Two tenths is about one step of a five-step ramp: enough that a valley reads as a valley,
 * little enough that the biome is still the thing the colour says.
 */
const RELIEF = 0.45;
const RELIEF_SLOPE = 0.0035;

/** How much wider the slope of the whole country is measured than the slope of the hill. */
const BROAD = 7;

/**
 * The lie of the land under a point: positive where it faces the sun, negative where it turns
 * away. A function of world position alone, so it bakes into chunks like everything else.
 *
 * **The sun is off the top-left, and that is not a free choice.** Every sprite on the map is lit
 * from there — it is what the hatching on the pencil drawings takes its light from, and what the
 * well's own pixels are shaded by. A ground lit from anywhere else puts the shadows on the map
 * at odds with the shadows on the things standing on it, which reads as the tiles having been
 * cut from a different picture.
 */
function slopeToward(level: FieldLevel, x: number, y: number, span: number): number {
  const toward = level.height[waterCell(level, x - span, y - span)]!;
  const away = level.height[waterCell(level, x + span, y + span)]!;

  // Lit where the ground rises away from the sun, which is the flank that faces back into it.
  return (away - toward) / (span * 2 * Math.SQRT2);
}

function relief(level: FieldLevel, x: number, y: number, span: number): number {
  // The shape of the land, with the lie of the whole country taken out of it.
  //
  // A plain that tilts one way tilts the same way for miles, so lighting the raw slope paints
  // every acre of it with the same brightness — the region comes out pale or dark as a block,
  // which reads as a stain on the map rather than as ground with a shape. What should catch
  // the light is the hill *on* the tilt, so the broad slope is measured as well and subtracted:
  // flat country stays flat however it leans, and a valley cut into a slope still has a lit
  // side and a dark one.
  const local = slopeToward(level, x, y, span);
  const broad = slopeToward(level, x, y, span * BROAD);
  return Math.max(-1, Math.min(1, (local - broad) / RELIEF_SLOPE)) * RELIEF;
}

/**
 * The blotching on the ground, in world units, and the grain of the paper, in texels.
 *
 * The two octaves are not the same kind of thing and must not be scaled the same way. The
 * blotch is a feature of the *ground* — a patch of scrub, a drier shoulder — so it has a size
 * in the world and keeps it at every rung, the way a lake does. The grain is the tooth of the
 * paper the map is drawn on, which belongs to the drawing rather than to the country, so it is
 * a fixed number of texels and comes out the same coarseness however far you are standing.
 *
 * Scaling the blotch by the rung instead is what made the land read as a different country at
 * every zoom: the pattern is the same noise field stretched by a factor of two at every rung,
 * so one scroll click moved every blotch and doubled its size while the coast under it stayed
 * put.
 */
const BLOTCH = PARCEL * 1.7;
const GRAIN_TEXELS = 13.4;

/**
 * How many texels across a blotch has to be before it is worth drawing.
 *
 * Under about six the blotch is sampled so sparsely that it stops reading as a patch of ground
 * and becomes white noise — the same mistake as point-sampling a pond with a texel wider than
 * it is. The widest rungs hold it at that floor instead, which costs them a blotch that belongs
 * to the world and gives them one that at least has a shape.
 */
const BLOTCH_MIN_TEXELS = 6;

/**
 * Which step of a cell's ramp a texel takes.
 *
 * Two octaves of noise for the mottle, and the cell's own elevation on top of it so that high
 * ground comes out pale and hollows dark. Both are read at the texel's world position, so the
 * pattern belongs to the ground rather than to the cell — a pattern anchored to each cell would
 * restart at every edge and turn the map back into a mosaic.
 */
function step(elevation: number, x: number, y: number, texel: number, seed: number): number {
  // Weighted to the fine octave now that the sun has the coarse end of the range. The broad
  // mottle used to make the blotches at about the size of a hill, which is exactly the scale
  // the relief wants to speak at — two signals of the same size and only one of them meaning
  // anything. The fine octave is the texture of the paper and keeps all of its weight.
  const blotch = Math.max(BLOTCH, texel * BLOTCH_MIN_TEXELS);
  const paper = texel * GRAIN_TEXELS;
  const coarse = mottle(x / blotch, y / blotch, seed + 101);
  const fine = mottle(x / paper, y / paper, seed + 211);
  const grain = coarse * 0.3 + fine * 0.7;
  const height = (elevation - 0.5) * 0.55;

  // The mottle used to take nearly the whole range on its own, which left the sun nowhere to
  // put a shadow: anything added to a shade already at the top of the ramp is the same colour
  // as the shade without it. Half the range to the grain, a share to how high the ground is,
  // and the rest held back for the light.
  return grain * 0.42 + height + 0.32;
}

/**
 * Standing water comes off the field, never off the rung's lattice.
 *
 * A lake is a few cells of the field across, and every rung's lattice is coarser than that:
 * painted as whole cells, a lake is whichever *sites* happen to be standing in it, so it is
 * drawn as a Voronoi polygon in roughly the right place, and it changes shape and jumps half a
 * cell the moment the rung changes. The water is a fact about the world, so it is read from the
 * world — the lattice still owns the colour of the land, which is what keeps the ground a
 * mosaic of cells rather than a photograph of one.
 *
 * What this gives up is the exactness the cells had: the painted shore can sit up to half a
 * field cell from where `biomeAt` puts it, so a parcel whose site is within a unit of the bank
 * can be drawn on the wrong side of it. That is the same tolerance the river ribbon already
 * has, and the middle of a parcel — which is what the rules read and what the cursor reports —
 * is never in doubt.
 */

/** A grid of cells over the world: the field's own, or one of the coarsenings of it below. */
interface CellFrame {
  columns: number;
  rows: number;
  minX: number;
  minY: number;
  spacing: number;
}

/**
 * One coarsening of the field, in the same frame as it. Level 0 is the field itself.
 *
 * The bed goes down the pyramid beside the water because the two are asked at the same place
 * and for the same reason. A texel wider than a cell has to be told what stands over a *square*
 * of the world rather than over a point, and that is as true of how the ground lies as it is of
 * whether it is wet: point-sampled, a hillside read at the widest rungs is whichever hair of it
 * the texel's centre happened to land on, which comes out as noise that changes completely
 * every time the rung does.
 */
interface FieldLevel extends CellFrame {
  water: Uint8Array;
  height: Float32Array;
}

/**
 * The water, coarsened by halves, built on demand and kept for the world it belongs to.
 *
 * A rung whose texel is wider than a field cell has to ask about an *area*, not a point. Point
 * sampling a lake four cells across with a texel sixteen across hits it or misses it depending
 * on where the texel's centre happens to fall: the ponds that survive are scattered at random
 * and drawn in the wrong place, and the map comes out stippled with blue — which is the clearest
 * sign of a world filled in by an algorithm. Four cells reduced to the answer most of them gave
 * is the question the texel is really asking: is this square of the world water?
 *
 * It also makes the coarse rungs honest about size rather than about position: a lake too small
 * to cover a texel is not drawn at all, the way a river too narrow for one is not, and the big
 * water keeps the outline it has at every other rung.
 */
const mips: FieldLevel[] = [];
let mipSeed: number | null = null;

/** As deep as a level is worth building: past this the whole world is a handful of cells. */
const MAX_MIP = 8;

function fieldLevel(sheet: WaterSheet, seed: number, texel: number): FieldLevel {
  if (mipSeed !== seed) {
    mips.length = 0;
    mipSeed = seed;
  }

  if (mips.length === 0) {
    const { grid } = sheet;
    mips.push({
      columns: grid.columns,
      rows: grid.rows,
      minX: grid.minX,
      minY: grid.minY,
      spacing: grid.spacing,
      water: sheet.water,
      height: sheet.height,
    });
  }

  const want = Math.min(
    MAX_MIP,
    Math.max(0, Math.round(Math.log2(texel / sheet.grid.spacing))),
  );

  while (mips.length <= want) {
    const under = mips[mips.length - 1]!;
    const columns = Math.max(1, under.columns >> 1);
    const rows = Math.max(1, under.rows >> 1);
    const water = new Uint8Array(columns * rows);
    const height = new Float32Array(columns * rows);

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        let ocean = 0;
        let lake = 0;
        let bed = 0;
        let taken = 0;
        for (let dy = 0; dy < 2; dy += 1) {
          const r = row * 2 + dy;
          if (r >= under.rows) continue;
          for (let dx = 0; dx < 2; dx += 1) {
            const c = column * 2 + dx;
            if (c >= under.columns) continue;
            const at = r * under.columns + c;
            const kind = under.water[at]!;
            if (kind === Water.Ocean) ocean += 1;
            else if (kind === Water.Lake) lake += 1;
            bed += under.height[at]!;
            taken += 1;
          }
        }

        // Half the square has to be wet for the square to be, and the sea takes a tie: a coast
        // that gained ground every time it was halved would walk out into the ocean.
        water[row * columns + column] =
          ocean + lake < 2 ? Water.None : ocean >= lake ? Water.Ocean : Water.Lake;

        // The bed takes the mean rather than a vote: it is a surface and not a kind, and the
        // mean of four heights is the one answer that leaves the slope between two squares
        // measuring the same hillside the finer level measured.
        height[row * columns + column] = taken === 0 ? 0 : bed / taken;
      }
    }

    mips.push({
      columns,
      rows,
      minX: under.minX,
      minY: under.minY,
      spacing: under.spacing * 2,
      water,
      height,
    });
  }

  return mips[want]!;
}

function waterCell(frame: CellFrame, x: number, y: number): number {
  let column = Math.floor((x - frame.minX) / frame.spacing);
  let row = Math.floor((y - frame.minY) / frame.spacing);
  column = column < 0 ? 0 : column >= frame.columns ? frame.columns - 1 : column;
  row = row < 0 ? 0 : row >= frame.rows ? frame.rows - 1 : row;
  return row * frame.columns + column;
}

/**
 * How far the shore is allowed off the line the cells draw, as a fraction of a cell.
 *
 * The mask steps by two across a shore, so this is half of what it says: a fifth of a cell
 * either way. Enough to take the corners off and no more — the water has to stay where the
 * field put it, because the rules read the field.
 */
const SHORE_WANDER = 0.8;

/** The sign of a cell in the mask: water pulls up, land pulls down. */
const wetSign = (level: FieldLevel, column: number, row: number): number => {
  const c = column < 0 ? 0 : column >= level.columns ? level.columns - 1 : column;
  const r = row < 0 ? 0 : row >= level.rows ? level.rows - 1 : row;
  return level.water[r * level.columns + c]! === Water.None ? -1 : 1;
};

/**
 * What water stands over a point.
 *
 * Away from a shore this is the field's own answer, read off the cell the point is in — the
 * same cell `biomeAt` reads, so the rules and the paint agree about open water.
 *
 * At a shore the cell on its own is not enough: a rung drawing several texels to a cell would
 * come out with a staircase of right angles a dozen pixels on a side. So the water is read as a
 * surface instead — the mask taken between the four cells around the point, which crosses zero
 * exactly halfway between a wet centre and a dry one, with a little noise on the crossing to
 * keep the line off the grid. The shore moves by a fifth of a cell at most, which is under half
 * a parcel: the middle of a parcel, which is what the rules read and the cursor reports, is
 * never in doubt.
 *
 * The noise is a function of world position alone, so two chunks meeting on a beach draw the
 * same beach.
 */
function floodedAt(level: FieldLevel, x: number, y: number, smooth: boolean, seed: number): number {
  const at = waterCell(level, x, y);
  const here = level.water[at]!;
  if (!smooth) return here;

  // Only a point with a shore in reach can come out as anything but its own cell, and nine
  // reads settle that far more cheaply than two fields of noise.
  const column = at % level.columns;
  const row = (at - column) / level.columns;
  let shore = false;
  for (let r = row - 1; r <= row + 1 && !shore; r += 1) {
    if (r < 0 || r >= level.rows) continue;
    for (let c = column - 1; c <= column + 1; c += 1) {
      if (c < 0 || c >= level.columns) continue;
      if (level.water[r * level.columns + c]! !== here) {
        shore = true;
        break;
      }
    }
  }
  if (!shore) return here;

  const fx = (x - level.minX) / level.spacing - 0.5;
  const fy = (y - level.minY) / level.spacing - 0.5;
  const left = Math.floor(fx);
  const top = Math.floor(fy);
  const u = fx - left;
  const v = fy - top;

  const above =
    wetSign(level, left, top) + (wetSign(level, left + 1, top) - wetSign(level, left, top)) * u;
  const below =
    wetSign(level, left, top + 1) +
    (wetSign(level, left + 1, top + 1) - wetSign(level, left, top + 1)) * u;
  const surface = above + (below - above) * v;

  const wave = level.spacing * 2.4;
  const fine = level.spacing * 0.8;
  const wobble =
    (mottle(x / wave, y / wave, seed + 911) * 0.55 +
      mottle(x / fine, y / fine, seed + 947) * 0.45 -
      0.5) *
    2 *
    SHORE_WANDER;

  if (surface <= wobble) return Water.None;
  if (here !== Water.None) return here;

  // Dry in its own cell but wet on the surface: the kind comes from whichever wet cell of the
  // four has the most say in that, so a beach beside the sea does not come out as a lake.
  let kind: number = Water.Ocean;
  let best = -1;
  for (let dy = 0; dy <= 1; dy += 1) {
    for (let dx = 0; dx <= 1; dx += 1) {
      const c = Math.min(Math.max(left + dx, 0), level.columns - 1);
      const r = Math.min(Math.max(top + dy, 0), level.rows - 1);
      const found = level.water[r * level.columns + c]!;
      if (found === Water.None) continue;
      const weight = (dx === 0 ? 1 - u : u) * (dy === 0 ? 1 - v : v);
      if (weight > best) {
        best = weight;
        kind = found;
      }
    }
  }
  return kind;
}

/**
 * A rectangle of texels as packed RGBA, indexed from a texel lattice that spans the whole world.
 *
 * Taking world texel indices rather than a bounds rectangle is what keeps two chunks agreeing
 * about where a texel starts: the same ground computed in two different bakes has to come out
 * on the same lattice, or the seam between them is a half-texel shear.
 */
/**
 * A paved run, as the line between two neighbouring road cells' sites.
 *
 * Paths are worked out from the lattice rather than drawn over it, which is the whole of this:
 * a road cell is a cell, its site is where the walking goes, and a run of them is the segments
 * between those sites. Junctions need no special case — three runs meeting just overlap — and
 * neither do the ends, since a lone paved cell is a segment of no length and comes out as the
 * round patch it should be.
 */
interface Run {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** How far either side of its centre line the bare earth reaches. */
  half: number;
  minY: number;
  maxY: number;
}

/**
 * The middle of a junction, where three paved cells all touch each other.
 *
 * Runs only reach along the lines between sites, so three of them meeting leave a bare triangle
 * in the middle of what should be one worn patch — the same hole the old drawn roads had, for
 * the same reason, and it needs the same answer. The triangle stands on three sites that are
 * each other's neighbours, so it can never cover ground nobody paved.
 */
interface Junction {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  cx: number;
  cy: number;
  minY: number;
  maxY: number;
}

/**
 * Half the width of a path and the band it dithers out over, as fractions of a *parcel*.
 *
 * Of a parcel, never of the rung's own spacing. A road is laid on the parcel lattice and is a
 * fixed thing in the world; the rung only decides how finely it gets sampled. Scaled by the
 * rung instead, a path would be twice as wide a step out and its cells would be looked up on
 * the wrong lattice entirely.
 */
const PATH_HALF = 0.15;
const PATH_FADE = 0.075;

/**
 * How far a built parcel's bare earth reaches from its site, as a fraction of a parcel: the lot
 * cleared and trodden for the building, wider than the building's own tile so a ring of it shows
 * all round — and painted in the same pass as the roads, so a road arriving at it merges into
 * it rather than stopping at the edge of a sprite. At the width of a road it was a patch the
 * building's tile covered entirely, and every building stood on grass with its road vanishing
 * underneath it.
 */
const LOT_HALF = 0.5;

/**
 * How many texels of path are worth drawing. Under about two the path is a dotted line that
 * comes and goes with the dither as the camera moves, so the coarser rungs leave it out — the
 * same reasoning as a tile that has run out of halvings.
 */
const PATH_MIN_TEXELS = 2;

/**
 * Every cell that is bare earth under a building: its lot. A building's lot is trodden ground —
 * nobody keeps a lawn under a workshop. The paths between are not cells but lines between the
 * ground's worn nodes (`footpaths.ts`), and are added in `runsIn`.
 */
function pavedCells(world: GameWorld): { column: number; row: number }[] {
  const cells: { column: number; row: number }[] = [];
  for (const settlement of world.settlements.values()) {
    // A site still being felled has no lot yet; one being dug has as much of one as is dug.
    for (const building of settlement.buildings.values()) if (dugAt(building) > 0) cells.push(parcelIndex(building.cellId));
  }
  return cells;
}

/** How worn a node must be before it shows on the ground at all: a dozen footfalls or so. */
const PATH_SHOWS = 0.1;

/**
 * The worn ground as runs: a strip of dirt between every pair of neighbouring nodes that both show,
 * a faint trail at first and a road's width once worn right in. Each pair once.
 */
function footpathRuns(world: GameWorld): Run[] {
  const runs: Run[] = [];
  const reach = PARCEL * (PATH_HALF + PATH_FADE);
  for (const id of world.wear.keys()) {
    const here = wornness(world, id);
    if (here < PATH_SHOWS) continue;
    const a = positionOf(world, id);
    for (const next of neighbours(world, id)) {
      if (next <= id) continue;
      const there = wornness(world, next);
      if (there < PATH_SHOWS) continue;
      const b = positionOf(world, next);
      runs.push({
        ax: a.x, ay: a.y, bx: b.x, by: b.y,
        half: PARCEL * PATH_HALF * (0.3 + 0.7 * Math.min(here, there)),
        minY: Math.min(a.y, b.y) - reach,
        maxY: Math.max(a.y, b.y) + reach,
      });
    }
  }
  return runs;
}

function runsIn(
  world: GameWorld,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): { runs: Run[]; junctions: Junction[] } {
  const reach = PARCEL * (PATH_HALF + PATH_FADE);
  const lot = PARCEL * (LOT_HALF + PATH_FADE);
  const runs: Run[] = [];

  // Each lot to its own size: a building up has all of it, a site being dug as much as is dug —
  // the patch spreads out from the middle of the plot as the digging goes on.
  for (const settlement of world.settlements.values()) {
    for (const building of settlement.buildings.values()) {
      const dug = dugAt(building);
      if (dug <= 0) continue;
      const { column, row } = parcelIndex(building.cellId);
      const at = siteOf(world.seed, PARCEL, column, row);
      runs.push({ ax: at.x, ay: at.y, bx: at.x, by: at.y, half: PARCEL * LOT_HALF * dug, minY: at.y - lot, maxY: at.y + lot });
    }
  }
  runs.push(...footpathRuns(world));

  return {
    runs: runs.filter(
      (run) =>
        Math.min(run.ax, run.bx) - Math.max(lot, reach) <= maxX &&
        Math.max(run.ax, run.bx) + Math.max(lot, reach) >= minX &&
        run.minY <= maxY &&
        run.maxY >= minY,
    ),
    junctions: [],
  };
}

/** Whether a point is inside a junction's triangle, by the sign of its three edge tests. */
function inside(j: Junction, x: number, y: number): boolean {
  const d1 = (x - j.bx) * (j.ay - j.by) - (j.ax - j.bx) * (y - j.by);
  const d2 = (x - j.cx) * (j.by - j.cy) - (j.bx - j.cx) * (y - j.cy);
  const d3 = (x - j.ax) * (j.cy - j.ay) - (j.cx - j.ax) * (y - j.ay);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

/** Distance from a point to a run, squared. */
function gapTo(run: Run, x: number, y: number): number {
  const dx = run.bx - run.ax;
  const dy = run.by - run.ay;
  const along = dx * dx + dy * dy;
  const t = along === 0 ? 0 : Math.max(0, Math.min(1, ((x - run.ax) * dx + (y - run.ay) * dy) / along));
  const px = run.ax + dx * t - x;
  const py = run.ay + dy * t - y;
  return px * px + py * py;
}

/**
 * What the paved cells in a patch of ground are, as one number.
 *
 * The chunk cache is keyed on this as well as the rung, so paving re-bakes the chunks the new
 * dirt actually falls in and leaves every other one alone. Without it a road would not appear
 * until its chunk happened to be evicted; keyed on the whole settlement instead, every chunk on
 * screen would re-bake on every parcel of a drag.
 */
export function pavingIn(world: GameWorld, minX: number, minY: number, maxX: number, maxY: number): number {
  // Combined by xor rather than folded in sequence, so the answer depends on *which* cells are
  // paved and not on the order they were paved in. A set iterates in insertion order, so a
  // sequential hash gives two different keys for the same ground and re-bakes a chunk that has
  // not changed — a cache key has to be a function of the state, not of how it was arrived at.
  // Over the same cells the drawing uses, never a subset of them. Fingerprint the roads alone
  // and a new building's lot never changes the key, so its dirt is baked into a canvas that is
  // thrown away and the ground stays grass for ever.
  let hash = 0;
  for (const index of pavedCells(world)) {
    // The cell's lattice square, not its site: this runs for every chunk of every frame, and
    // `siteOf` hashes a string. The square contains the site, so it can only over-report.
    // Widened by the furthest a paved parcel reaches into its neighbours' chunks — its lot and
    // the flat marks the lot treads out, both a little over half a parcel from the site — or a
    // building raised beside a chunk's edge leaves its dirt in the chunk next door for ever.
    // The trees it fells reach further and are keyed one by one below, by where each stood.
    const x = index.column * PARCEL;
    const y = index.row * PARCEL;
    const spill = PARCEL;
    if (x - spill > maxX || x + PARCEL + spill < minX || y - spill > maxY || y + PARCEL + spill < minY) continue;

    let cell = Math.imul(index.column + 0x9e37, 0x85ebca6b) ^ Math.imul(index.row + 0x7f4a, 0xc2b2ae35);
    cell = Math.imul(cell ^ (cell >>> 15), 0x2c1b3c6d);
    hash = (hash ^ (cell ^ (cell >>> 13))) >>> 0;
  }

  // And the worn ground nearby, each node by how worn it shows — in sixths, so a chunk is baked
  // again when a path through it visibly changes, not on every footfall.
  for (const [id] of world.wear) {
    const tier = Math.floor(wornness(world, id) * 6);
    if (tier === 0) continue;
    const at = positionOf(world, id);
    const spill = PARCEL;
    if (at.x - spill > maxX || at.x + spill < minX || at.y - spill > maxY || at.y + spill < minY) continue;
    let node = Math.imul(Math.round(at.x * 64) + 0x3c6e, 0x9e3779b1) ^ Math.imul(Math.round(at.y * 64) + tier * 0x10000, 0x85ebca6b);
    node = Math.imul(node ^ (node >>> 15), 0x2c1b3c6d);
    hash = (hash ^ (node ^ (node >>> 13))) >>> 0;
  }

  // And every site's clearing: the trees that are down and how far the digging has got.
  //
  // Each of those reaches exactly as far as the thing it changes, and that is the whole point of
  // doing it one tree at a time. Taken as one number over a box round the plot — which it was,
  // three parcels to cover the widest crown — every chunk within three parcels was baked again
  // on every tree and every eighth of the digging, four chunks for a change that fell inside one
  // of them, and a chunk is a thirtieth of a second. Clearing one plot cost forty-odd bakes and
  // the ground round the site churned the whole time it was being dug.
  //
  // Felled trees are counted for a building that is finished as well as one still clearing: all
  // of them are down by then, so the term stops changing instead of vanishing, and the chunks
  // that held them are not baked again for a change that is already drawn.
  const sprites = groundSprites();
  if (sprites) {
    const lot = PARCEL * (LOT_HALF + PATH_FADE);
    for (const settlement of world.settlements.values()) {
      for (const building of settlement.buildings.values()) {
        const { column, row } = parcelIndex(building.cellId);
        const at = siteOf(world.seed, PARCEL, column, row);

        const dug = Math.floor(dugAt(building) * 8);
        if (dug > 0 && at.x - lot <= maxX && at.x + lot >= minX && at.y - lot <= maxY && at.y + lot >= minY) {
          let plot = Math.imul(column + 0x51ed, 0x9e3779b1) ^ Math.imul(row + dug * 0x1000, 0x85ebca77);
          plot = Math.imul(plot ^ (plot >>> 15), 0x2c1b3c6d);
          hash = (hash ^ (plot ^ (plot >>> 13))) >>> 0;
        }

        // Nothing of this site is near: the box round the plot and the ring is where every tree
        // of it stands, so one test skips the whole site. This runs for every chunk of every
        // frame and a grown town is sixty buildings.
        const site = PARCEL * 3;
        if (at.x - site > maxX || at.x + site < minX || at.y - site > maxY || at.y + site < minY) continue;

        const trees = siteTrees(world, sprites, building);
        const down = felledAt(world, sprites, building);
        for (let i = 0; i < down; i += 1) {
          const tree = trees[i]!;
          // The crown as it is actually drawn, not a parcel's worth of margin: an oak is about a
          // parcel across and a parcel and a quarter tall, and it is drawn from its foot.
          const cells = decalCells(tree.decal, 0);
          const left = tree.x - cells.foot.x * TEXEL;
          const top = tree.y - cells.foot.y * TEXEL;
          if (left > maxX || left + cells.width * TEXEL < minX) continue;
          if (top > maxY || top + cells.height * TEXEL < minY) continue;
          let felled = Math.imul(Math.round(tree.x * 64) + 0x51ed, 0x9e3779b1) ^ Math.imul(Math.round(tree.y * 64) + 0x2f1b, 0x85ebca77);
          felled = Math.imul(felled ^ (felled >>> 15), 0x2c1b3c6d);
          hash = (hash ^ (felled ^ (felled >>> 13))) >>> 0;
        }
      }
    }
  }
  return hash >>> 0;
}

/**
 * A run of river, ready to be asked about by the row.
 *
 * Drawn the way a path is — a line with a width, dithered out at its edge — and for the same
 * reason: both are narrower than the cells they cross, so neither can be a cell's colour. The
 * difference is that the width is the river's own, out of the field, and the rules read the
 * same number. What is painted as water is exactly what cannot be built on.
 */
interface Reach {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  half: number;
  minY: number;
  maxY: number;
}

/**
 * How much of a texel a river has to fill before it is worth drawing.
 *
 * Under about a texel the stream is a dotted line that comes and goes with the dither as the
 * camera moves — the same test the paths make, except that here it is per river: a creek drops
 * out as you zoom away while the river it feeds stays, which is what a map does.
 */
const REACH_MIN_TEXELS = 0.9;

/**
 * The delta: how many steps a river's mouth is carried out past the coast, how far each one
 * goes as a multiple of the river's half-width, and how much wider it gets at every step.
 *
 * The simulation stops a river at the first cell of sea, which is right — that is where the
 * river ends. But a mouth drawn only as far as it runs has nowhere to mix, and a mouth carried
 * straight on is a canal: water leaving a river slows down as it meets the sea, so it spreads.
 * So the drawing takes it out in widening steps and `plume` takes it away again over the shelf,
 * which together read as a fan rather than as a stripe. Nothing outside this file sees the
 * longer run — the rules test the simulation's ribbon, and a parcel out at sea is sea.
 */
const DELTA_STEPS = 3;
const DELTA_STEP = 1.1;
const DELTA_SPREAD = 1.5;

function reachesOver(
  world: GameWorld,
  sheet: WaterSheet,
  texel: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): Reach[] {
  const reaches: Reach[] = [];

  for (const run of riverRunsIn(world.seed, { minX, minY, maxX, maxY })) {
    if (run.half * 2 < texel * REACH_MIN_TEXELS) continue;

    reaches.push({
      ax: run.ax,
      ay: run.ay,
      bx: run.bx,
      by: run.by,
      half: run.half,
      minY: Math.min(run.ay, run.by) - run.half,
      maxY: Math.max(run.ay, run.by) + run.half,
    });

    if (sheet.water[waterCell(sheet.grid, run.bx, run.by)] !== Water.Ocean) continue;

    const dx = run.bx - run.ax;
    const dy = run.by - run.ay;
    const along = Math.hypot(dx, dy);
    if (along === 0) continue;

    let fromX = run.bx;
    let fromY = run.by;
    let half = run.half;
    for (let step = 0; step < DELTA_STEPS; step += 1) {
      const reach = half * DELTA_STEP;
      const toX = fromX + (dx / along) * reach;
      const toY = fromY + (dy / along) * reach;
      half *= DELTA_SPREAD;
      reaches.push({
        ax: fromX,
        ay: fromY,
        bx: toX,
        by: toY,
        half,
        minY: Math.min(fromY, toY) - half,
        maxY: Math.max(fromY, toY) + half,
      });
      fromX = toX;
      fromY = toY;
    }
  }

  return reaches;
}

/**
 * How far a bank leaves the line the width puts it on, as a fraction of the river's own
 * half-width, and the two wavelengths it wanders on.
 *
 * Scaled to the river rather than to the lattice, unlike the coast's. A coast winds at the size
 * of the cells the rung draws because that is the only scale it has; a river has a width of its
 * own, and a stream a texel across wandering by a third of a *cell* would spend most of its
 * length somewhere other than where the water is.
 */
const BANK_WANDER = 0.3;

/** Where a bank stands at a point, signed: positive widens the water, negative narrows it. */
function bankOffset(x: number, y: number, bank: number, seed: number): number {
  const coarse = mottle(x / (bank * 2.4), y / (bank * 2.4), seed + 821);
  const fine = mottle(x / (bank * 0.8), y / (bank * 0.8), seed + 919);
  return (coarse * 0.62 + fine * 0.38 - 0.5) * 2 * bank * BANK_WANDER;
}

/**
 * How much of the sea's surface still belongs to the river, by the depth of the water under it.
 *
 * Fresh water coming out of a river does not stop at the coast and it does not sit on top of
 * the sea for ever: it spreads over the shallows and is gone by the time the bottom drops away.
 * Measuring it by the bed rather than by distance from the shore costs nothing — the depth is
 * already read to shade the water — and it gives an estuary the shape of its own bay, wide
 * where the shelf is wide and short where the land falls off.
 *
 * Twenty-two thousandths is about four cells of shelf on the coasts this generator makes.
 */
const PLUME = 0.022;

const plume = (bed: number): number =>
  Math.max(0, Math.min(1, (bed - (SEA_LEVEL - PLUME)) / PLUME));

/**
 * How deep into a river's water a point is: 0 at the bank, 1 in the middle, -1 outside one.
 *
 * A bank is cut, not stippled — the same rule as the coast and for the same reason, and the
 * reason it has to be the same rule is that they meet. Dithering the edge left a stream with a
 * fringe of texels that were neither water nor ground, which at this size is most of the stream.
 */
function riverDepthAt(reaches: readonly Reach[], x: number, y: number, seed: number): number {
  let closest = Infinity;
  let bank = 1;

  for (const reach of reaches) {
    const gap = gapToReach(reach, x, y);
    if (gap >= closest) continue;
    closest = gap;
    bank = reach.half;
  }
  if (closest === Infinity) return -1;

  const gap = Math.sqrt(closest) - bank;
  return gap < bankOffset(x, y, bank, seed) ? Math.min(1, -gap / bank) : -1;
}

/** Distance from a point to a run of river, squared. The same sum `gapTo` does for a path. */
function gapToReach(reach: Reach, x: number, y: number): number {
  const dx = reach.bx - reach.ax;
  const dy = reach.by - reach.ay;
  const along = dx * dx + dy * dy;
  const t = along === 0 ? 0 : Math.max(0, Math.min(1, ((x - reach.ax) * dx + (y - reach.ay) * dy) / along));
  const px = reach.ax + dx * t - x;
  const py = reach.ay + dy * t - y;
  return px * px + py * py;
}

/** How worn a given scrap of path is. Nothing but grain: dirt has no height to speak of. */
function pathShade(x: number, y: number, seed: number): number {
  const coarse = mottle(x / (PARCEL * 0.9), y / (PARCEL * 0.9), seed + 401);
  const fine = mottle(x / (PARCEL * 0.3), y / (PARCEL * 0.3), seed + 509);
  return coarse * 0.55 + fine * 0.45;
}

/**
 * What a baked chunk's identity is: the world, the rung, where it is, and what has been paved
 * inside it.
 *
 * One function rather than a template string at the call site, because every one of those four
 * has to be in there and the paving has twice been lost from it — once to a refactor and once
 * to the seed being added alongside. Dropping it costs nothing visible at the time: the chunk
 * bakes, looks right, and simply never changes again, so a new road is generated into a cache
 * nobody re-reads.
 */
export function chunkKey(
  world: GameWorld,
  rung: number,
  column: number,
  row: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
): string {
  const paving = pavingIn(world, bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  // And whether the drawn ground had arrived when it was baked: a chunk baked before it is the
  // old painting, and has to be baked again once there is something better to paint it with.
  return `${world.seed}:${rung}:${column}:${row}:${paving}:${groundVersion()}`;
}

/**
 * Every ramp the ground is painted from, by id: the biomes in `RAMP_INDEX` order, then the dirt.
 * The painter records which one each texel took, and at which step, so that a shadow laid on it
 * afterwards can darken the ground that is actually there.
 */
const GROUND_RAMPS: readonly (readonly Rgba[])[] = [
  ...RAMPS,
  PATH_RAMPS.Meadow,
  PATH_RAMPS.Forest,
  PATH_RAMPS.Highland,
  PATH_RAMPS.Marsh,
  PATH_RAMPS.Tundra,
  PATH_RAMPS.Desert,
];

/** The dirt over a ramp's biome, by ramp index — the land biomes in `RAMP_INDEX` order; water takes the meadow's. */
const pathRampOf = (biome: number): number => RAMPS.length + (biome <= RAMP_INDEX[Biome.Desert] ? biome : 0);
const isPathRamp = (ramp: number): boolean => ramp >= RAMPS.length;
const WATER_RAMPS = new Set([RAMP_INDEX[Biome.Ocean], RAMP_INDEX[Biome.Lake], RAMP_INDEX[Biome.River]]);

/** Which material each ramp's biome is drawn in, by ramp index; water has none. */
const MATERIAL_BY_RAMP: readonly (Material | null)[] = [
  'meadow', 'forest', 'highland', 'marsh', 'tundra', 'desert', null, null, null,
];

/**
 * How far one kind of ground runs before it gives way to another of the same material — flowers
 * to plain grass, sand to dunes — and how far one lie of the dunes runs before it turns. World
 * units, so a patch keeps its size at every rung.
 */
const VARIANT_SPAN = PARCEL * 3;
const RIDGE_SPAN = PARCEL * 14;

/** The mask's value at a texel, read at the texel's world index so it never knows the chunk. */
function maskAt(sprites: GroundSprites, material: Material, mip: number, ix: number, iy: number): number {
  const cells = sprites.masks.get(material)?.[mip];
  if (!cells) return 128;
  const size = sprites.size >> mip;
  return cells[(((iy % size) + size) % size) * size + (((ix % size) + size) % size)]!;
}

/**
 * Which ramp step a texel of a material takes, out of the drawn textures: which kind of that
 * ground is here (a slow field, crossed through the material's own mask where one kind gives
 * way to the next), and the texel of it at this world index.
 */
function textureStep(
  sprites: GroundSprites,
  material: Material,
  mip: number,
  ix: number,
  iy: number,
  x: number,
  y: number,
  seed: number,
): number {
  const ridge = RIDGES[Math.min(RIDGES.length - 1, Math.floor(mottle(x / RIDGE_SPAN, y / RIDGE_SPAN, seed + 811) * RIDGES.length))];
  const list = sprites.variants.get(material === 'desert' ? `desert:${ridge}` : material);
  if (!list || list.length === 0) return 2;
  const v = mottle(x / VARIANT_SPAN, y / VARIANT_SPAN, seed + 701) * list.length;
  let pick = Math.min(list.length - 1, Math.floor(v));
  const t = v - Math.floor(v);
  if (t > 0.8 && pick + 1 < list.length && maskAt(sprites, material, mip, ix, iy) < ((t - 0.8) / 0.2) * 255) pick += 1;
  const cells = list[pick]!.mips[mip]!;
  const size = sprites.size >> mip;
  return cells[(((iy % size) + size) % size) * size + (((ix % size) + size) % size)]!;
}

/**
 * Whether a texel near the edge between two cells goes over to the neighbour, `blend` being how
 * far over it is (0 deep in this cell, 0.5 on the edge itself).
 *
 * The material higher in the priority spreads, through its own mask: grass reaches into sand as
 * tufts, sand blows into nothing. The test is the same from both sides of the edge — the high
 * material's reach is `blend` from the neighbour's side and `1 - blend` from its own — so the
 * two cells agree on every texel between them. Two cells of one material dither through that
 * material's mask, which is what keeps the mosaic of cells without the checkerboard.
 */
function seam(sprites: GroundSprites, near: number, next: number, blend: number, mip: number, ix: number, iy: number): boolean {
  const a = MATERIAL_BY_RAMP[near];
  const b = MATERIAL_BY_RAMP[next];
  if (!a || !b) return threshold(ix, iy) < blend;
  if (a === b) return maskAt(sprites, a, mip, ix, iy) < blend * 255;
  const nextHigh = sprites.priority.indexOf(b) < sprites.priority.indexOf(a);
  const reach = nextHigh ? blend : 1 - blend;
  const takeHigh = maskAt(sprites, nextHigh ? b : a, mip, ix, iy) < reach * 255;
  return takeHigh === nextHigh;
}

export function texelsIn(
  world: GameWorld,
  spacing: number,
  texel: number,
  fromX: number,
  fromY: number,
  width: number,
  height: number,
): Uint32Array {
  const out = new Uint32Array(width * height);
  // Which ramp each texel was painted from, and at which step of it.
  const grounds = new Uint8Array(width * height);
  const steps = new Uint8Array(width * height);
  const paint = (at: number, ramp: number, shade: number, ix: number, iy: number): void => {
    const colors = GROUND_RAMPS[ramp]!;
    const step = rampStep(colors, shade, ix, iy);
    out[at] = colors[step] ?? 0;
    grounds[at] = ramp;
    steps[at] = step;
  };

  const fade = spacing * FADE;
  const settled = spacing * spacing * SETTLED;

  // The drawn ground, on the rungs that paint the parcel lattice; the old painting elsewhere, and
  // everywhere until the sprites have loaded.
  const mip = Math.round(Math.log2(texel / TEXEL));
  const loaded = groundSprites();
  const sprites = loaded && spacing === PARCEL && mip >= 0 && mip < MIPS ? loaded : null;

  const sheet = waterSheet(world.seed);
  const level = fieldLevel(sheet, world.seed, texel);

  // How far apart the sun's two samples are taken: half a parcel, and never finer than the
  // coarsening of the bed this rung is reading.
  //
  // Of a *parcel*, not of the rung's own cell. A hillside is a thing in the world with a size,
  // so it has to be lit the same way however close you are standing — spanned by the lattice
  // instead, every rung shaded a differently sized landform out of the same ground, and one
  // scroll click replaced every shadow on the map with a set belonging to hills twice as big.
  // That was the loudest of the jumps between rungs, louder than the cells changing size.
  //
  // The floor is what keeps the widest rungs honest rather than noisy: past the point where a
  // texel is wider than half a parcel there is no reading the hillside at all, so the sun reads
  // the coarsened bed at its own spacing — the same hills averaged down, which is what ground
  // looks like from far off, instead of a point sample of a hillside nobody can see.
  const lit = Math.max(level.spacing, PARCEL * 0.5);
  // Smoothed only where a water cell is wider than a texel. Where it is not, the cell is about
  // a pixel and the steps in the coast are the pixels the ground is drawn out of anyway.
  const smooth = level.spacing > texel;

  const firstColumn = Math.floor((fromX * texel) / spacing) - 2;
  const firstRow = Math.floor((fromY * texel) / spacing) - 2;
  const columns = Math.ceil((width * texel) / spacing) + 5;
  const rows = Math.ceil((height * texel) / spacing) + 5;
  const lattice = latticeOver(world, spacing, firstColumn, firstRow, columns, rows);

  // Drawn on any rung fine enough to carry it, not only on the parcel rung — towns are visible
  // well before the ground drops to the parcel lattice, and gating on the lattice left the roads
  // out of every zoom anyone actually plays at.
  const half = PARCEL * PATH_HALF;
  const band = PARCEL * PATH_FADE;
  const paved =
    half * 2 >= texel * PATH_MIN_TEXELS
      ? runsIn(world, fromX * texel, fromY * texel, (fromX + width) * texel, (fromY + height) * texel)
      : { runs: [], junctions: [] };
  const { runs, junctions } = paved;
  const reaches = reachesOver(
    world,
    sheet,
    texel,
    fromX * texel,
    fromY * texel,
    (fromX + width) * texel,
    (fromY + height) * texel,
  );
  const nearRow: Run[] = [];
  const nearJunctions: Junction[] = [];
  const nearReaches: Reach[] = [];

  for (let ty = 0; ty < height; ty += 1) {
    // Only the runs this row of texels can possibly touch. Rebuilt per row rather than per
    // texel: a chunk is a quarter of a million texels and a handful of runs.
    if (runs.length > 0 || junctions.length > 0) {
      nearRow.length = 0;
      nearJunctions.length = 0;
      const rowY = (fromY + ty + 0.5) * texel;
      for (const run of runs) if (rowY >= run.minY && rowY <= run.maxY) nearRow.push(run);
      for (const j of junctions) if (rowY >= j.minY && rowY <= j.maxY) nearJunctions.push(j);
    }

    if (reaches.length > 0) {
      nearReaches.length = 0;
      const rowY = (fromY + ty + 0.5) * texel;
      for (const reach of reaches) if (rowY >= reach.minY && rowY <= reach.maxY) nearReaches.push(reach);
    }


    for (let tx = 0; tx < width; tx += 1) {
      const ix = fromX + tx;
      const iy = fromY + ty;
      const x = (ix + 0.5) * texel;
      const y = (iy + 0.5) * texel;

      const column = Math.floor(x / spacing) - lattice.firstColumn;
      const row = Math.floor(y / spacing) - lattice.firstRow;

      // The river is asked about before the standing water, because the answer where the two
      // meet is neither one of them: a river crosses a lake and comes out the other side, and
      // it reaches the sea by mixing with it.
      const current = nearReaches.length > 0 ? riverDepthAt(nearReaches, x, y, world.seed) : -1;

      // Standing water next, and it answers on its own. A texel the field floods needs no cell
      // at all: the colour is the water's, and skipping the search is most of why this costs no
      // more than painting the ground from the lattice did.
      const flooded = floodedAt(level, x, y, smooth, world.seed);
      if (flooded !== Water.None) {
        const bed = level.height[waterCell(level, x, y)]!;

        // A lake swallows its rivers whole. Standing water is one surface however much runs
        // into it, and a line of current drawn across it reads as a seam in the lake rather
        // than as a river going anywhere — it was tried both ways. The sea is the one that
        // mixes, and only over its own shallows: the fresh water spreads and dithers into the
        // salt over the length of the estuary rather than ending at a line the coast drew.
        const fresh =
          current < 0 || flooded === Water.Lake ? 0 : plume(bed) * (0.4 + 0.6 * current);

        // One shade for all of it, off the bed, so the only thing the dither decides is salt
        // or fresh. Shading the river by its own depth instead put a different tone on the two
        // sides of a line that is not there.
        const shade = step(bed, x, y, texel, world.seed);
        const ramp =
          fresh > threshold(ix, iy)
            ? RAMP_INDEX[Biome.River]
            : RAMP_INDEX[flooded === Water.Lake ? Biome.Lake : Biome.Ocean];
        paint(ty * width + tx, ramp, shade, ix, iy);
        continue;
      }

      // Nearest and second nearest site, counting only the ones on dry ground.
      //
      // `cellAt` searches two rings out, and the texture has to agree with it about which parcel
      // a point is in. But a site two columns away is at least 1.15 parcels off — the jitter
      // never brings it closer — so once the inner ring has found two sites nearer than that,
      // the outer ring cannot beat either and is skipped. It usually is skipped, which is most
      // of why this got fast enough to pan over.
      //
      // A site standing in the water is no use here: this texel is dry, and a cell whose middle
      // is a lake has no colour to lend it. Dropping them is also what lets the land's mosaic
      // run right up to the bank instead of stopping at a Voronoi edge half a cell inland.
      let near = -1;
      let nearGap = Infinity;
      let next = -1;
      let nextGap = Infinity;

      for (let dy = -1; dy <= 1; dy += 1) {
        const r = row + dy;
        if (r < 0 || r >= lattice.rows) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const c = column + dx;
          if (c < 0 || c >= lattice.columns) continue;
          const at = r * lattice.columns + c;
          if (lattice.wet[at] === 1) continue;
          const ox = lattice.x[at]! - x;
          const oy = lattice.y[at]! - y;
          const gap = ox * ox + oy * oy;
          if (gap < nearGap) {
            next = near;
            nextGap = nearGap;
            near = at;
            nearGap = gap;
          } else if (gap < nextGap) {
            next = at;
            nextGap = gap;
          }
        }
      }

      if (nextGap > settled) for (let dy = -2; dy <= 2; dy += 1) {
        const r = row + dy;
        if (r < 0 || r >= lattice.rows) continue;
        for (let dx = -2; dx <= 2; dx += 1) {
          if (dx > -2 && dx < 2 && dy > -2 && dy < 2) continue;
          const c = column + dx;
          if (c < 0 || c >= lattice.columns) continue;
          const at = r * lattice.columns + c;
          if (lattice.wet[at] === 1) continue;
          const ox = lattice.x[at]! - x;
          const oy = lattice.y[at]! - y;
          const gap = ox * ox + oy * oy;
          if (gap < nearGap) {
            next = near;
            nextGap = nearGap;
            near = at;
            nearGap = gap;
          } else if (gap < nextGap) {
            next = at;
            nextGap = gap;
          }
        }
      }

      // A scrap of land with no dry site within two rings: an islet, or a spit, smaller than
      // the cells this rung reads. There is no cell to colour it with, so it takes the nearest
      // one there is and comes out as the water around it — which is what a feature under the
      // size of a cell looks like at the distance the rung is for.
      if (near < 0) {
        for (let dy = -2; dy <= 2 && near < 0; dy += 1) {
          const r = row + dy;
          if (r < 0 || r >= lattice.rows) continue;
          for (let dx = -2; dx <= 2; dx += 1) {
            const c = column + dx;
            if (c < 0 || c >= lattice.columns) continue;
            const at = r * lattice.columns + c;
            const ox = lattice.x[at]! - x;
            const oy = lattice.y[at]! - y;
            const gap = ox * ox + oy * oy;
            if (gap < nearGap) {
              near = at;
              nearGap = gap;
            }
          }
        }
        next = -1;
      }

      if (near < 0) continue;

      // How near the shared edge this texel is: the two sites are equidistant on the edge
      // itself, so the gap between those distances *is* the distance to it, doubled. The step
      // between two ramps is gradual, so the edge between them is too.
      let at = near;
      if (next >= 0) {
        const edge = (Math.sqrt(nextGap) - Math.sqrt(nearGap)) / 2;
        const blend = Math.max(0, 1 - edge / fade) / 2;
        const over = sprites
          ? seam(sprites, lattice.biome[near]!, lattice.biome[next]!, blend, mip, ix, iy)
          : threshold(ix, iy) < blend;
        if (over) at = next;
      }

      // Water over everything, the dirt included. A road may be paved right up to the bank —
      // the parcel the water misses is the ford — and where the two overlap it is the river
      // that is really there. Dirt drawn over the stream instead would read as a bridge, and
      // there are no bridges.
      if (current >= 0) {
        // Shaded off the ground under it, exactly as standing water is — the same function,
        // the same number. A river given a tone of its own is a different water from the lake
        // it runs into, and the join shows as a cut across the surface however well the two
        // colours are chosen. What the eye should read is one body of water with a shape.
        const bed = level.height[waterCell(level, x, y)]!;
        paint(ty * width + tx, RAMP_INDEX[Biome.River], step(bed, x, y, texel, world.seed), ix, iy);
        continue;
      }

      // Dirt over the ground, dithered out at its edge the same way two cells dither into each
      // other — so a path reads as ground worn bare rather than as something laid on top.
      if (nearRow.length > 0 || nearJunctions.length > 0) {
        // Each run to its own width — a road, or a building's lot — and the most worn of them
        // wins, so a road arriving at a lot runs straight into it.
        let worn = -Infinity;
        for (const run of nearRow) worn = Math.max(worn, (run.half - Math.sqrt(gapTo(run, x, y))) / band);

        // The middle of a junction is solid earth, not a fade: its edges are the lines between
        // the three sites, which the runs already cover, so there is no new boundary to soften.
        for (const j of nearJunctions) {
          if (inside(j, x, y)) {
            worn = 1;
            break;
          }
        }

        // The edge of the dirt through the path's own mask — gravel scattered out into the grass —
        // and the dirt itself out of its texture, once there is one.
        const edgeAt = sprites ? maskAt(sprites, 'path', mip, ix, iy) / 255 : threshold(ix, iy);
        if (worn > edgeAt) {
          const shade = sprites
            ? textureStep(sprites, 'path', mip, ix, iy, x, y, world.seed) / (sprites.steps - 1)
            : pathShade(x, y, world.seed);
          paint(ty * width + tx, pathRampOf(lattice.biome[at]!), shade, ix, iy);
          continue;
        }
      }

      const material = sprites ? MATERIAL_BY_RAMP[lattice.biome[at]!] : null;
      // The cell's own height says how high the ground is; the slope under the texel says
      // which way it faces. The first is flat across a cell by construction, so without the
      // second a hill is a mosaic of tones rather than a shape with a lit side and a dark one.
      // Under both, the ground's own grain: the drawn texture where there is one, which takes
      // the share of the shade the mottle had, and the mottle where there is not.
      const grain =
        sprites && material
          ? textureStep(sprites, material, mip, ix, iy, x, y, world.seed) / (sprites.steps - 1) +
            (lattice.elevation[at]! - 0.5) * 0.4
          : step(lattice.elevation[at]!, x, y, texel, world.seed);
      paint(ty * width + tx, lattice.biome[at]!, grain + relief(level, x, y, lit), ix, iy);
    }
  }

  if (sprites) stampDecals(world, sprites, mip, texel, fromX, fromY, width, height, { out, grounds, steps });
  return out;
}

/**
 * How a shadow falls on water: the water two steps darker, broken by short runs of untouched
 * surface. Laid flat like a shadow on grass it read as a hole in the river; the breaks are the
 * ripples the shade is lying on, and they sit on the world's own texel grid so a shadow that
 * spans two chunks ripples straight across the join.
 */
const WATER_SHADE = 2;
const ripple = (ix: number, iy: number): boolean => iy % 3 === 0 && ((ix + Math.floor(iy / 3) * 2) % 5 + 5) % 5 < 3;

/**
 * What grows on the ground, baked into it: the flat marks on the sharpest rung, the standing
 * things — trees, bushes, boulders — on the rungs too far out for the town to be drawn, and on
 * the rungs between, where they are drawn live with the town (`LIVE_MIPS`), their shadows alone.
 * A shadow lies on the ground, not up in the air with the tree, so it belongs to the ground
 * whatever rung it is.
 *
 * A decal's ground cells — a shadow, a tuft in the ground's own green — are resolved here,
 * against the ground actually under them: the darkest step of whatever land it is, or darker
 * water where it falls on water. Resolved against the decal's own ground instead, a forest tree
 * by a river left a green blob on the water, and on a road a green one on the dirt.
 *
 * Laid furthest first, so the nearer tree overlaps the one behind it, and read off the parcel
 * lattice like everything else in a chunk, never off the chunk: a tree on the edge of two chunks
 * is stamped into both, the same tree at the same texel.
 */
function stampDecals(
  world: GameWorld,
  sprites: GroundSprites,
  mip: number,
  texel: number,
  fromX: number,
  fromY: number,
  width: number,
  height: number,
  ground: { out: Uint32Array; grounds: Uint8Array; steps: Uint8Array },
): void {
  const bounds = { minX: fromX * texel, minY: fromY * texel, maxX: (fromX + width) * texel, maxY: (fromY + height) * texel };
  const live = mip < LIVE_MIPS;

  const lay = (placement: Placement, shadowsOnly: boolean): void => {
    const cells = decalCells(placement.decal, mip);
    const left = Math.round(placement.x / texel) - cells.foot.x - fromX;
    const top = Math.round(placement.y / texel) - cells.foot.y - fromY;
    if (left + cells.width <= 0 || top + cells.height <= 0 || left >= width || top >= height) return;
    // A flower does not grow on a path or a lot: anything flat whose foot is on bare earth is
    // trodden out. (Standing things are kept off built ground by parcel, in `placementsIn`.)
    if (!placement.decal.stands) {
      const fx = left + cells.foot.x;
      const fy = top + cells.foot.y;
      if (fx >= 0 && fy >= 0 && fx < width && fy < height && isPathRamp(ground.grounds[fy * width + fx]!)) return;
    }

    for (let cy = 0; cy < cells.height; cy += 1) {
      const ty = top + cy;
      if (ty < 0 || ty >= height) continue;
      for (let cx = 0; cx < cells.width; cx += 1) {
        const tx = left + cx;
        if (tx < 0 || tx >= width) continue;
        const cell = cells.cells[cy * cells.width + cx]!;
        const alpha = cell & 0xff;
        if (alpha === 0) continue;
        const at = ty * width + tx;
        if (alpha === 0xff) {
          if (!shadowsOnly) ground.out[at] = cell;
          continue;
        }

        const ramp = ground.grounds[at]!;
        const colors = GROUND_RAMPS[ramp]!;
        if (WATER_RAMPS.has(ramp)) {
          const ix = fromX + tx;
          const iy = fromY + ty;
          if (!ripple(ix, iy)) ground.out[at] = colors[Math.max(0, ground.steps[at]! - WATER_SHADE)] ?? 0;
        } else {
          ground.out[at] = colors[alpha - 1] ?? colors[0] ?? 0;
        }
      }
    }
  };

  if (mip === 0) for (const placement of placementsIn(world, sprites, bounds, false)) lay(placement, false);
  for (const placement of placementsIn(world, sprites, bounds, true)) lay(placement, live);
}
