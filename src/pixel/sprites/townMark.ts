import { and } from '../field.ts';
import type { Mask } from '../field.ts';
import { outline } from '../grid.ts';
import type { Grid } from '../grid.ts';
import type { Light } from '../light.ts';
import type { Ramp } from '../color.ts';
import { BONE, CHAR, CLOTH, EARTH, EMBER, INK, SHADOW, STONE } from '../palette.ts';
import { flat, shade } from '../shade.ts';
import type { Region } from '../shade.ts';
import type { Sprite } from '../sprite.ts';
import { castShadow, groundShadow } from '../view.ts';

const CELLS = 32;

/**
 * The marks a town is drawn as from too far off to see the town, one per stage of it.
 *
 * A mark is a *symbol* and not a tile, which is the one thing to keep hold of here. Everything
 * else on the map is a thing standing on the ground and is drawn one sprite cell to the ground's
 * own texel, so it keeps the patch of world it covers and coarsens as the ground does. A mark
 * covers no world at all — it says "a town is here" — and it has to say it as loudly from the
 * world view as from one rung in, so it is drawn at a fixed size in buffer pixels and follows no
 * rung. `drawTile` is therefore not the way in; `drawMark` is.
 *
 * **There is one per stage because the far view has nothing else to say it with.** Up close the
 * difference between a fire on bare ground and a town of sixty buildings is the whole screen;
 * at the distance the mark is drawn at, one drawing for both says a settlement is a settlement
 * and the map of a country stops being worth reading. A new town is marked by its *fire* — which
 * is all that is there, and the hearth tile already draws it — and from there the mark grows:
 * mud and thatch, then whitewash and tile, then stone.
 *
 * The materials are the game's own and are not free choices. Mud is `EARTH`, which is the dirt a
 * mixer works; whitewash and the town's red are `BONE` and `EMBER`, which is what a border stone
 * is made of, so the mark over a town and the stones round its edge are the same two materials.
 */
const SUN: Light = { kind: 'sun', toward: [-0.55, -0.72, 0.65], strength: 1 };

interface House {
  /** The middle of the house; a half lands the ridge between two columns rather than on one. */
  cx: number;
  /** Half the span at the eaves, where the roof is widest. */
  half: number;
  ridge: number;
  eaves: number;
  foot: number;
}

/**
 * The roof, as the gable end the viewer sees: narrow at the ridge and widening to the eaves.
 *
 * The ridge is two cells rather than one. A pitch drawn to a point comes out as an arrowhead at
 * this size — the ink round it takes the apex and what is left is a spike.
 */
function roofOf({ cx, half, ridge, eaves }: House): Mask {
  return (x, y) => {
    if (y < ridge || y > eaves) return false;
    const down = (y - ridge) / (eaves - ridge);
    return Math.abs(x - cx) <= 1 + down * (half - 1);
  };
}

/**
 * The wall under it, set in a cell each side so the roof overhangs as a roof does — and taller
 * than the roof is deep.
 *
 * Those two numbers are the whole of whether this reads as a house. A wide roof on a short wall
 * is a toadstool, which is exactly what the first pass came out as: the ink round a nine-cell
 * roof and a six-cell wall closes the gap between them and leaves a cap on a stalk.
 */
function wallOf({ cx, half, eaves, foot }: House): Mask {
  return (x, y) => y > eaves && y <= foot && Math.abs(x - cx) <= half - 1;
}

interface Build {
  wall: Ramp;
  roof: Ramp;
  /** How far up its ramp a wall sits. Mud is dark and stone is pale out of the same arithmetic. */
  pale: number;
  /** Where the roof's two faces sit on theirs: thatch is pale straw, slate is nearly black. */
  lit: number;
  dark: number;
}

/**
 * One house, drawn as four flat faces.
 *
 * **The pitch is two faces, not one face lit.** A roof given a profile and left to the sun comes
 * out as a wedge of pale cells wandering across it — the shading of a shape the lighting takes
 * to be a lump, which is what a triangle's depth field says a triangle is. At sixteen-odd cells
 * a roof has two sides, the ridge between them, and that is the whole drawing: the side towards
 * the sun sits a few steps up the ramp from the side away from it, both flat, and the ridge is
 * the line where they meet. Nothing else reads as a pitch this small.
 */
function regionsFor(house: House, build: Build): Region[] {
  const roof = roofOf(house);
  const wall = wallOf(house);
  return [
    {
      mask: wall,
      material: { ramp: build.wall, profile: flat, relief: 0, ambient: build.pale, contrast: 0 },
    },
    // The eaves' own shadow on the wall under them. One cell, and it is what stops the roof
    // reading as a shape laid on the wall rather than as a thing standing out over it.
    {
      mask: and(wall, (_x, y) => y <= house.eaves + 1),
      material: { ramp: build.wall, profile: flat, relief: 0, ambient: build.pale - 0.28, contrast: 0 },
    },
    {
      mask: and(roof, (x) => x < house.cx),
      material: { ramp: build.roof, profile: flat, relief: 0, ambient: build.lit, contrast: 0 },
    },
    {
      mask: and(roof, (x) => x >= house.cx),
      material: { ramp: build.roof, profile: flat, relief: 0, ambient: build.dark, contrast: 0 },
    },
  ];
}

const doorway = (mask: Mask): Region => ({
  mask,
  material: { ramp: CHAR, profile: flat, relief: 0, ambient: 0.45, contrast: 0 },
});

/**
 * Every mark stands its feet on the same row and casts one shadow, not one per building: three
 * blobs at this size come out as dark commas with daylight between them, which reads as holes in
 * the ground. A common foot is also what keeps the name the same distance under every stage.
 */
const FOOT = 26;

function markOf(name: string, regions: readonly Region[], span: number): Sprite {
  return {
    name,
    cells: CELLS,
    lights: [SUN],
    draw: (lights) => {
      const grid = shade(CELLS, regions, lights);
      outline(grid, INK);
      castShadow(grid, groundShadow(16, FOOT + 1, span, 331, 0.1), SHADOW);
      return grid;
    },
  };
}

/* ---------- the stages ---------- */

/**
 * Mud and thatch: two huts, and small ones. A hamlet has to be visibly less than a village from
 * the same distance, and the only two things a mark that size can say it with are how much
 * ground it covers and how dark it is — so this one is narrow, low, and made of the dirt itself.
 */
const HUTS: readonly House[] = [
  { cx: 12, half: 5, ridge: 11, eaves: 20, foot: FOOT },
  { cx: 21, half: 4, ridge: 14, eaves: 21, foot: FOOT },
];

/**
 * Mostly roof, and the roof pale. A hut *is* its thatch — the wall under it is a couple of feet
 * of daub — and mud on mud is what the first pass came out as: two brown posts, because straw
 * and the dirt it stands on are the same colour unless the straw is taken to the top of its
 * ramp and the daub to the bottom of its.
 */
const MUD: Build = { wall: EARTH, roof: CLOTH, pale: 0.42, lit: 0.9, dark: 0.58 };

export const townHuts = markOf(
  'town-huts',
  HUTS.flatMap((hut) => regionsFor(hut, MUD)),
  13,
);

/**
 * Whitewash and tile: the three roofs this started as. Tight on purpose — the gap between the
 * two behind is two cells, which is a lane. Spread far enough apart to stand clear of each other
 * they came out as a V with a hole in the middle rather than as one place.
 */
const VILLAGE: readonly House[] = [
  { cx: 9.5, half: 4.5, ridge: 6, eaves: 11, foot: 17 },
  { cx: 22, half: 4, ridge: 7, eaves: 12, foot: 17 },
  { cx: 15.5, half: 6.5, ridge: 12, eaves: 18, foot: FOOT },
];

const TILED: Build = { wall: BONE, roof: EMBER, pale: 0.62, lit: 0.62, dark: 0.3 };

/** A doorway on the near house, and only there: a door on the two behind is a dark speck. */
const DOOR: Mask = (x, y) => y >= 23 && y <= FOOT && x >= 15 && x <= 16;

export const townVillage = markOf(
  'town-village',
  [...VILLAGE.flatMap((house) => regionsFor(house, TILED)), doorway(and(DOOR, wallOf(VILLAGE[2]!)))],
  16,
);

/**
 * Stone, and a tower over it.
 *
 * The tower is the whole of why this reads as a step up rather than as the village in grey. Grey
 * walls and slate alone are the same silhouette in duller colours, and a silhouette is all a
 * mark has at this size — something has to stand *taller*. It keeps a red cap, so the set still
 * says whose town it is: the border stones round the edge are painted in the same red.
 */
const HALL: readonly House[] = [
  { cx: 18.5, half: 5, ridge: 12, eaves: 17, foot: FOOT },
  { cx: 26, half: 3.5, ridge: 15, eaves: 19, foot: FOOT },
];

const TOWER = { cx: 10, half: 4.5, top: 9 };

/**
 * Pale walls and nearly-black roofs, both out of the one stone ramp — which is the point: slate
 * and the wall under it are the same rock, and the ramp is long enough to hold both ends of it.
 * A second grey invented for the roofs would be a second kind of stone on one map.
 */
const SLATE: Build = { wall: STONE, roof: STONE, pale: 0.85, lit: 0.46, dark: 0.24 };

/** The shaft, and the battlement over it as a row of merlons with the gaps cut out of it. */
const SHAFT: Mask = (x, y) => y >= TOWER.top && y <= FOOT && Math.abs(x - TOWER.cx) <= TOWER.half;
const MERLONS: Mask = and(
  (x, y) => y >= TOWER.top - 2 && y < TOWER.top && Math.abs(x - TOWER.cx) <= TOWER.half,
  (x) => Math.round(x - TOWER.cx) % 2 === 0,
);

/** The tower's cap, pitched the way every other roof here is, so it belongs to the same town. */
const CAP: Mask = (x, y) => {
  if (y < TOWER.top - 7 || y >= TOWER.top - 2) return false;
  const down = (y - (TOWER.top - 7)) / 5;
  return Math.abs(x - TOWER.cx) <= 1 + down * (TOWER.half + 0.5);
};

export const townStone = markOf(
  'town-stone',
  [
    ...HALL.flatMap((house) => regionsFor(house, SLATE)),
    { mask: SHAFT, material: { ramp: STONE, profile: flat, relief: 0, ambient: 0.85, contrast: 0, speckle: 0.16 } },
    // The lit and shaded halves of a round-ish shaft, as two faces for the same reason a roof is.
    { mask: and(SHAFT, (x) => x > TOWER.cx + 1), material: { ramp: STONE, profile: flat, relief: 0, ambient: 0.5, contrast: 0, speckle: 0.12 } },
    { mask: MERLONS, material: { ramp: STONE, profile: flat, relief: 0, ambient: 0.7, contrast: 0 } },
    { mask: and(CAP, (x) => x < TOWER.cx), material: { ramp: EMBER, profile: flat, relief: 0, ambient: 0.62, contrast: 0 } },
    { mask: and(CAP, (x) => x >= TOWER.cx), material: { ramp: EMBER, profile: flat, relief: 0, ambient: 0.3, contrast: 0 } },
    doorway((x, y) => y >= 23 && y <= FOOT && x >= 9 && x <= 10),
  ],
  19,
);
