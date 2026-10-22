import { and } from '../field.ts';
import type { Mask } from '../field.ts';
import { outline } from '../grid.ts';
import type { Light } from '../light.ts';
import type { Ramp } from '../color.ts';
import { BONE, CHAR, CLOTH, EARTH, EMBER, INK, SHADOW, STONE } from '../palette.ts';
import { flat, shade } from '../shade.ts';
import type { Region } from '../shade.ts';
import type { Sprite } from '../sprite.ts';
import { castShadow, groundShadow } from '../view.ts';

const CELLS = 32;

const SUN: Light = { kind: 'sun', toward: [-0.55, -0.72, 0.65], strength: 1 };

interface House {
  cx: number;
  half: number;
  ridge: number;
  eaves: number;
  foot: number;
}

function roofOf({ cx, half, ridge, eaves }: House): Mask {
  return (x, y) => {
    if (y < ridge || y > eaves) return false;
    const down = (y - ridge) / (eaves - ridge);
    return Math.abs(x - cx) <= 1 + down * (half - 1);
  };
}

function wallOf({ cx, half, eaves, foot }: House): Mask {
  return (x, y) => y > eaves && y <= foot && Math.abs(x - cx) <= half - 1;
}

interface Build {
  wall: Ramp;
  roof: Ramp;
  pale: number;
  lit: number;
  dark: number;
}

function regionsFor(house: House, build: Build): Region[] {
  const roof = roofOf(house);
  const wall = wallOf(house);
  return [
    {
      mask: wall,
      material: { ramp: build.wall, profile: flat, relief: 0, ambient: build.pale, contrast: 0 },
    },
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

const HUTS: readonly House[] = [
  { cx: 12, half: 5, ridge: 11, eaves: 20, foot: FOOT },
  { cx: 21, half: 4, ridge: 14, eaves: 21, foot: FOOT },
];

const MUD: Build = { wall: EARTH, roof: CLOTH, pale: 0.42, lit: 0.9, dark: 0.58 };

export const townHuts = markOf(
  'town-huts',
  HUTS.flatMap((hut) => regionsFor(hut, MUD)),
  13,
);

const VILLAGE: readonly House[] = [
  { cx: 9.5, half: 4.5, ridge: 6, eaves: 11, foot: 17 },
  { cx: 22, half: 4, ridge: 7, eaves: 12, foot: 17 },
  { cx: 15.5, half: 6.5, ridge: 12, eaves: 18, foot: FOOT },
];

const TILED: Build = { wall: BONE, roof: EMBER, pale: 0.62, lit: 0.62, dark: 0.3 };

const DOOR: Mask = (x, y) => y >= 23 && y <= FOOT && x >= 15 && x <= 16;

export const townVillage = markOf(
  'town-village',
  [...VILLAGE.flatMap((house) => regionsFor(house, TILED)), doorway(and(DOOR, wallOf(VILLAGE[2]!)))],
  16,
);

const HALL: readonly House[] = [
  { cx: 18.5, half: 5, ridge: 12, eaves: 17, foot: FOOT },
  { cx: 26, half: 3.5, ridge: 15, eaves: 19, foot: FOOT },
];

const TOWER = { cx: 10, half: 4.5, top: 9 };

const SLATE: Build = { wall: STONE, roof: STONE, pale: 0.85, lit: 0.46, dark: 0.24 };

const SHAFT: Mask = (x, y) => y >= TOWER.top && y <= FOOT && Math.abs(x - TOWER.cx) <= TOWER.half;
const MERLONS: Mask = and(
  (x, y) => y >= TOWER.top - 2 && y < TOWER.top && Math.abs(x - TOWER.cx) <= TOWER.half,
  (x) => Math.round(x - TOWER.cx) % 2 === 0,
);

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
    { mask: and(SHAFT, (x) => x > TOWER.cx + 1), material: { ramp: STONE, profile: flat, relief: 0, ambient: 0.5, contrast: 0, speckle: 0.12 } },
    { mask: MERLONS, material: { ramp: STONE, profile: flat, relief: 0, ambient: 0.7, contrast: 0 } },
    { mask: and(CAP, (x) => x < TOWER.cx), material: { ramp: EMBER, profile: flat, relief: 0, ambient: 0.62, contrast: 0 } },
    { mask: and(CAP, (x) => x >= TOWER.cx), material: { ramp: EMBER, profile: flat, relief: 0, ambient: 0.3, contrast: 0 } },
    doorway((x, y) => y >= 23 && y <= FOOT && x >= 9 && x <= 10),
  ],
  19,
);
