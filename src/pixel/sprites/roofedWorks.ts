import type { Rgba } from '../color.ts';
import { and, not } from '../field.ts';
import type { Mask } from '../field.ts';
import { createGrid, outline, put, stamp } from '../grid.ts';
import type { Grid, Stamp } from '../grid.ts';
import type { Light } from '../light.ts';
import { CHAR, EARTH, EMBER, FIRE, INK, PAPER, SHADOW, STONE, STONE_WARM, WOOD } from '../palette.ts';
import { flat, shade } from '../shade.ts';
import type { Region } from '../shade.ts';
import type { Clip, Piece, Sprite } from '../sprite.ts';
import { TILE_CELLS, castShadow, groundShadow } from '../view.ts';

/**
 * A work area once it is roofed: one building with its ridge running away from the viewer, so
 * the gable and the door face the front and the two pitches show as two faces, the sunward one
 * lit and the other in shade. What it is doing inside is no longer visible — the smoke at the
 * vent and the glow at the door are all the map has left to say it with.
 */
const CELLS = TILE_CELLS;

const SUN: readonly Light[] = [{ kind: 'sun', toward: [-0.55, -0.72, 0.65], strength: 1 }];

const MID = 15.5;
const LEFT = 5;
const RIGHT = 26;
const BASE = 29;
const WALL_TOP = 20;
const APEX = 13;
const RIDGE_BACK = 3;
const EAVE = 2.5;
/** How far the roof falls per cell out from the ridge. */
const PITCH = 0.72;

const fromRidge = (x: number): number => Math.abs(x - MID);

/** The gable and the wall under it: one pentagon facing the viewer. */
const FRONT: Mask = (x, y) =>
  x >= LEFT && x <= RIGHT && y <= BASE && y >= APEX + fromRidge(x) * (WALL_TOP - APEX) / (MID - LEFT);

const ROOF: Mask = (x, y) => {
  if (x < LEFT - EAVE || x > RIGHT + EAVE) return false;
  const top = RIDGE_BACK + fromRidge(x) * PITCH;
  const front = APEX + fromRidge(x) * PITCH + 1;
  return y >= top && y <= front;
};
const WEST = and(ROOF, (x) => x < MID);
const EAST = and(ROOF, (x) => x >= MID);

const DOOR: Mask = (x, y) => x >= 13 && x <= 18 && y >= 21 && y <= BASE - 1 && !(y === 21 && (x === 13 || x === 18));

const VENT_AT = { x: 15, y: 7 };

interface Look {
  roof: { west: Region['material']; east: Region['material'] };
  wall: Region['material'];
  /** What is drawn over the wall and roof before the ink: courses, posts, tiles. */
  dress: (grid: Grid) => void;
}

function building(look: Look, lights: readonly Light[]): Grid {
  const regions: Region[] = [
    { mask: and(FRONT, not(DOOR)), material: look.wall },
    { mask: WEST, material: look.roof.west },
    { mask: EAST, material: look.roof.east },
  ];
  const grid = shade(CELLS, regions, lights);
  look.dress(grid);
  for (let y = 0; y < CELLS; y += 1) {
    for (let x = 0; x < CELLS; x += 1) if (DOOR(x, y) && !ROOF(x, y)) put(grid, x, y, CHAR[0]!);
  }
  outline(grid, INK);
  castShadow(grid, groundShadow(MID + 2, BASE, 26, 503, 0.22), SHADOW);
  return grid;
}

const fill = (grid: Grid, mask: Mask, color: (x: number, y: number) => Rgba | undefined): void => {
  for (let y = 0; y < CELLS; y += 1) {
    for (let x = 0; x < CELLS; x += 1) {
      if (!mask(x, y)) continue;
      const c = color(x, y);
      if (c !== undefined) put(grid, x, y, c);
    }
  }
};

const THATCHED: Look = {
  roof: {
    west: { ramp: STONE_WARM, profile: flat, relief: 0, ambient: 0.78, contrast: 0.1, speckle: 0.28 },
    east: { ramp: STONE_WARM, profile: flat, relief: 0, ambient: 0.42, contrast: 0.1, speckle: 0.28 },
  },
  wall: { ramp: EARTH, profile: flat, relief: 0, ambient: 0.62, contrast: 0.12, speckle: 0.3 },
  dress: (grid) => {
    // Straw runs down the slope, so the streaks do too; the cut ends along the eaves are darker.
    fill(grid, ROOF, (x, y) => {
      const west = x < MID;
      const along = Math.round(y - fromRidge(x) * PITCH);
      if (y >= APEX + fromRidge(x) * PITCH) return west ? STONE_WARM[3] : STONE_WARM[1];
      if (Math.abs(x - MID) < 1) return STONE_WARM[2];
      if ((along + (west ? 0 : 1)) % 3 === 0 && (x + y) % 2 === 0) return west ? STONE_WARM[4] : STONE_WARM[2];
      return undefined;
    });
    // Corner posts and door posts, and wattle showing where the daub has fallen away.
    fill(grid, FRONT, (x, y) => {
      if (ROOF(x, y)) return undefined;
      if (x === LEFT + 1 || x === RIGHT - 1) return y > WALL_TOP ? WOOD[2] : undefined;
      if (x === 12 || x === 19) return y >= 21 ? WOOD[1] : undefined;
      if (x >= 7 && x <= 9 && y >= 24 && y <= 26) return (x + y) % 2 === 0 ? WOOD[2] : WOOD[1];
      return undefined;
    });
    stamp(grid, 12, 20, [[0, 0, WOOD[2]!], [1, 0, WOOD[2]!], [2, 0, WOOD[2]!], [3, 0, WOOD[2]!], [4, 0, WOOD[2]!], [5, 0, WOOD[2]!], [6, 0, WOOD[2]!], [7, 0, WOOD[2]!]]);
    // The smoke hole in the ridge, with a little hood of straw over its back.
    stamp(grid, VENT_AT.x - 1, VENT_AT.y - 1, [
      [0, 0, STONE_WARM[5]!], [1, 0, STONE_WARM[6]!], [2, 0, STONE_WARM[5]!], [3, 0, STONE_WARM[3]!],
      [0, 1, STONE_WARM[3]!], [1, 1, CHAR[0]!], [2, 1, CHAR[0]!], [3, 1, STONE_WARM[1]!],
      [1, 2, CHAR[1]!], [2, 2, CHAR[1]!],
    ]);
  },
};

const CHIMNEY: Mask = (x, y) => x >= 19 && x <= 22 && y >= 4 && y <= 10;

const STONE_LOOK: Look = {
  roof: {
    west: { ramp: EMBER, profile: flat, relief: 0, ambient: 0.55, contrast: 0.1, speckle: 0.12 },
    east: { ramp: EMBER, profile: flat, relief: 0, ambient: 0.18, contrast: 0.1, speckle: 0.12 },
  },
  wall: { ramp: STONE_WARM, profile: flat, relief: 0, ambient: 0.7, contrast: 0.1, speckle: 0.2 },
  dress: (grid) => {
    // Tiles in courses parallel to the eaves, a dark lap under each one.
    fill(grid, ROOF, (x, y) => {
      const west = x < MID;
      if (Math.abs(x - MID) < 1) return EMBER[0];
      if (y >= APEX + fromRidge(x) * PITCH) return west ? EMBER[1] : EMBER[0];
      if (Math.round(fromRidge(x)) % 3 === 0) return west ? EMBER[1] : EMBER[0];
      if ((Math.round(y - fromRidge(x) * PITCH) + Math.floor(fromRidge(x) / 3)) % 2 === 0 && Math.round(fromRidge(x)) % 3 === 1) {
        return west ? EMBER[3] : EMBER[1];
      }
      return undefined;
    });
    // Brick courses with the joints staggered, and a lintel over the door.
    fill(grid, FRONT, (x, y) => {
      if (ROOF(x, y)) return undefined;
      if ((BASE - y) % 2 === 1) return STONE[5];
      return (x + ((BASE - y) % 4 === 0 ? 0 : 2)) % 4 === 0 ? STONE[5] : undefined;
    });
    fill(grid, (x, y) => x >= 12 && x <= 19 && y === 20, () => STONE[3]);
    // The chimney up the east pitch, in brick, with its cap.
    fill(grid, CHIMNEY, (x, y) => {
      if (y === 4) return STONE[4];
      if (y % 2 === 0) return STONE[5];
      return x === 19 ? STONE_WARM[5] : (x + (y % 4 === 1 ? 0 : 2)) % 4 === 0 ? STONE[5] : STONE_WARM[3];
    });
  },
};

/** Thin and grey, as the clamp's: the renderer tints it to the colour the fire is giving. */
const bigPuff: Stamp = [
  [0, 0, STONE[6]!], [1, 0, PAPER[2]!],
  [0, 1, PAPER[1]!], [1, 1, STONE[6]!],
];
const smallPuff: Stamp = [[0, 0, PAPER[1]!], [1, 0, STONE[6]!]];

function smokeFrom(from: { x: number; y: number }, frame: number): Grid {
  const grid = createGrid(CELLS);
  const wisps: readonly (readonly [number, number, boolean])[][] = [
    [[0, -2, true], [1, -4, false], [0, -6, false]],
    [[1, -2, true], [0, -5, false], [2, -7, false]],
    [[0, -1, true], [2, -3, false], [1, -6, false]],
  ];
  for (const [dx, dy, big] of wisps[frame % wisps.length] ?? []) {
    stamp(grid, from.x + dx, from.y + dy, big ? bigPuff : smallPuff);
  }
  return grid;
}

/** The doorway lit from inside: dark at the lintel, bright where the fire's light falls on the floor. */
function glow(): Grid {
  const grid = createGrid(CELLS);
  for (let y = 21; y <= BASE - 1; y += 1) {
    for (let x = 13; x <= 18; x += 1) {
      if (!DOOR(x, y)) continue;
      const down = (y - 21) / (BASE - 22);
      const step = Math.round(down * 4 + (x === 13 || x === 18 ? -1 : 0));
      put(grid, x, y, FIRE[Math.max(0, Math.min(5, step + 1))]!);
    }
  }
  const spill = ((FIRE[4]! & 0xffffff00) | 0x50) >>> 0;
  for (const [x, y] of [[13, 29], [14, 29], [15, 29], [16, 29], [17, 29], [18, 29], [14, 30], [15, 30], [16, 30], [17, 30]] as const) {
    put(grid, x, y, spill);
  }
  return grid;
}

const CLIPS: readonly Clip[] = [
  { name: 'default', frames: 1 },
  { name: 'smoke', frames: 3, fps: 2 },
  { name: 'glow', frames: 1 },
];

/** The building stands on its front wall's base; smoke and glow go just in front so they draw over it. */
const PIECES: readonly Piece[] = [
  { clip: 'default', foot: BASE },
  { clip: 'smoke', foot: BASE + 1 },
  { clip: 'glow', foot: BASE + 1 },
];

const works = (name: string, look: Look, vent: { x: number; y: number }): Sprite => ({
  name,
  cells: CELLS,
  lights: SUN,
  clips: CLIPS,
  pieces: PIECES,
  draw: (lights, clip, frame) => {
    if (clip === 'smoke') return smokeFrom(vent, frame);
    if (clip === 'glow') return glow();
    return building(look, lights);
  },
});

export const worksRoofed = works('works-roofed', THATCHED, { x: VENT_AT.x, y: VENT_AT.y - 1 });
export const worksStone = works('works-stone', STONE_LOOK, { x: 20, y: 3 });
