import { and, blob, capsule, noise, not, or } from '../field.ts';
import type { Mask } from '../field.ts';
import { outline, stamp } from '../grid.ts';
import type { Grid, Stamp } from '../grid.ts';
import type { Light } from '../light.ts';
import { EARTH, FIRE, FOLIAGE, INK, NEEDLE, PAPER, STONE, WOOD } from '../palette.ts';
import { cone, dome, shade } from '../shade.ts';
import type { Material, Region } from '../shade.ts';
import { TILT, groundShadow } from '../view.ts';
import { groundStep } from './decals.ts';
import type { Decal } from './decals.ts';

/**
 * The things that stand up off the ground: trees, bushes, boulders.
 *
 * Shaded, like the well and the woodcutter, rather than drawn row by row. They are objects in
 * the world with a shape the sun falls on, and at forty texels a crown is far past the size
 * where every cell is a decision — it is a decision about lobes and light.
 *
 * **In the map's three-quarter view** (`view.ts`): a tree is a trunk with a crown on top of it
 * and a shadow lying on the ground beside its foot, not a crown seen from above. Seen from above
 * it was the right size and the wrong camera, and stood next to a villager drawn from the front
 * it looked like a green disc on the grass.
 *
 * **Drawn at the size of the people.** A villager is sixteen texels tall, a texel a hand's
 * breadth. So an oak is two villagers wide and over two tall, a pine narrower and taller, a bush
 * up to a villager's waist.
 */

const SUN: Light = { kind: 'sun', toward: [-0.55, -0.72, 0.65], strength: 1 };

interface Standing {
  size: number;
  foot: { x: number; y: number };
  regions: readonly Region[];
  /** Where the shadow lies on the ground. */
  shadow: Mask;
  /** Small marks laid on after the shading — berries, lichen. */
  marks?: readonly { at: [number, number]; stamp: Stamp }[];
}

/**
 * Shades a standing thing, inks it, and lays its shadow under it in the ground's darkest step.
 *
 * The shadow is ground, not a colour: the grass under an oak is the same grass in shade, and a
 * grey patch would be a hole in the map the moment the tree stood on sand or snow.
 */
function stand(name: string, density: Decal['density'], thing: Standing): Decal {
  // Grown to take the whole shadow. It falls down and to the right of the foot, past the square
  // the thing itself fits in, and cut off at that square's edge it came out as dark rectangles
  // all over the forest floor. The masks are in the same cells either way, so growing the square
  // only adds room on the right and below.
  let size = thing.size;
  for (let y = 0; y < thing.size * 2; y += 1) {
    for (let x = 0; x < thing.size * 2; x += 1) {
      if (thing.shadow(x, y)) size = Math.max(size, x + 1, y + 1);
    }
  }

  const grid: Grid = shade(size, thing.regions, [SUN]);
  for (const mark of thing.marks ?? []) stamp(grid, mark.at[0], mark.at[1], mark.stamp);
  outline(grid, INK);

  const cells = new Uint32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const at = y * size + x;
      const color = grid.cells[at]!;
      if ((color & 0xff) !== 0) cells[at] = color;
      else if (thing.shadow(x, y)) cells[at] = groundStep(0);
    }
  }

  return { name, width: size, height: size, foot: thing.foot, density, stands: true, cells };
}

const BARK: Material = { ramp: EARTH, relief: 2, ambient: 0.15, contrast: 0.85, speckle: 0.15 };
const LEAVES: Material = { ramp: FOLIAGE, relief: 4, ambient: 0.1, contrast: 0.85, speckle: 0.35 };

/**
 * An oak: a trunk, and a crown of lobes held up on it.
 *
 * Each lobe is domed on its own — one dome over the whole crown is a green ball on a stick — and
 * they are laid top first, so the lower lobes, which are the nearer ones in this view, overlap
 * the ones behind them and carry the shade along the bottom of the crown.
 */
function oak(radius: number, seed: number): Standing {
  const size = Math.ceil(radius * 2.9);
  const foot = { x: Math.round(size / 2), y: size - 4 };
  const crown = { x: foot.x, y: foot.y - radius * 0.55 - radius * 0.88 };

  const lobes: { x: number; y: number; r: number }[] = [{ x: crown.x, y: crown.y, r: radius * 0.66 }];
  const count = 7 + Math.floor(noise(seed, 0) * 3);
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + noise(seed, i) * 0.6;
    const reach = radius * (0.48 + noise(seed, i + 20) * 0.12);
    lobes.push({
      x: crown.x + Math.cos(angle) * reach,
      y: crown.y + Math.sin(angle) * reach * 0.86,
      r: radius * (0.4 + noise(seed, i + 40) * 0.1),
    });
  }
  lobes.sort((a, b) => a.y - b.y);

  const trunk = or(
    capsule(foot.x, foot.y - 1, foot.x, crown.y + radius * 0.4, radius * 0.13),
    blob(foot.x, foot.y, radius * 0.24, radius * 0.24 * TILT, 0.1, seed + 3),
  );
  const branches = or(
    capsule(foot.x, crown.y + radius * 0.55, foot.x - radius * 0.35, crown.y + radius * 0.2, radius * 0.07),
    capsule(foot.x, crown.y + radius * 0.6, foot.x + radius * 0.4, crown.y + radius * 0.25, radius * 0.07),
  );

  return {
    size,
    foot,
    shadow: groundShadow(foot.x, foot.y, radius * 2, seed, 0.3),
    regions: [
      { mask: or(trunk, branches), material: BARK },
      ...lobes.map((lobe, i) => ({ mask: blob(lobe.x, lobe.y, lobe.r, lobe.r * 0.92, 0.14, seed + i), material: LEAVES })),
    ],
  };
}

/**
 * A pine: tiers of boughs stacked up a short trunk, each tier a skirt with a ragged hem.
 *
 * The tiers are drawn bottom first so each one's hem overlaps the tier below it — which is what
 * makes a spruce read as stepped boughs rather than as a green triangle. Lit as cones, so the
 * left of every tier takes the sun and the right falls into shade.
 */
function pine(radius: number, height: number, seed: number, snow: boolean): Standing {
  const size = Math.ceil(Math.max(radius * 2 + 8, height + 8));
  const foot = { x: Math.round(size / 2), y: size - 4 };
  const base = foot.y - 3;
  const apex = base - height;
  const tiers = 4;

  const skirt = (index: number): Mask => {
    const top = apex + (height * index) / (tiers + 0.6);
    const hem = apex + (height * (index + 1.6)) / (tiers + 0.6);
    const width = radius * (0.45 + (0.55 * (index + 1)) / tiers);
    return (x, y) => {
      if (y < top || y > hem + 1) return false;
      const along = (y - top) / (hem - top || 1);
      const half = width * (index === 0 ? along : 0.35 + 0.65 * along);
      const ragged = hem - 1.4 * Math.abs(Math.sin((x - foot.x) * 0.95 + index * 1.7 + seed));
      return Math.abs(x - foot.x) <= half && y <= ragged;
    };
  };
  const skirts = Array.from({ length: tiers }, (_, i) => skirt(i));
  const needles: Material = { ramp: NEEDLE, profile: cone, relief: radius * 0.45, ambient: 0.08, contrast: 0.9, speckle: 0.25 };

  const regions: Region[] = [
    { mask: capsule(foot.x, foot.y, foot.x, base - 2, 1.3), material: BARK },
    ...skirts.map((mask) => ({ mask, material: needles })),
  ];

  if (snow) {
    // Along the top of each tier, where a bough is flat enough to hold it, and in clumps rather
    // than a sheet — a full white cap is a snowball with a green fringe.
    const white: Material = { ramp: PAPER, profile: dome, relief: 1, ambient: 0.45, contrast: 0.5 };
    skirts.forEach((mask, i) => {
      const above = skirts.slice(i + 1);
      // The sunny side of the bough more than the shaded one, and broken where the noise says.
      const lying: Mask = (x, y) =>
        mask(x, y) &&
        !mask(x, y - 1 - (noise(x, i, seed + 1) > 0.5 ? 1 : 0)) &&
        !above.some((upper) => upper(x, y)) &&
        x - foot.x < radius * 0.35 &&
        noise(x, y, seed) > 0.35;
      regions.push({ mask: lying, material: white });
    });
  }

  return { size, foot, shadow: groundShadow(foot.x, foot.y, radius * 1.8, seed, 0.45), regions };
}

/** An acacia: a forked trunk holding a crown wide and flat as a table. */
function acacia(radius: number, seed: number): Standing {
  const size = Math.ceil(radius * 2.5);
  const foot = { x: Math.round(size / 2), y: size - 4 };
  const top = foot.y - radius * 1.1;
  const trunk = or(
    capsule(foot.x, foot.y, foot.x, foot.y - radius * 0.45, radius * 0.1),
    or(
      capsule(foot.x, foot.y - radius * 0.45, foot.x - radius * 0.4, top + 2, radius * 0.07),
      capsule(foot.x, foot.y - radius * 0.45, foot.x + radius * 0.45, top + 2, radius * 0.07),
    ),
  );
  const lobes = [0, 1, 2, 3, 4].map((i) =>
    blob(foot.x + (i - 2) * radius * 0.38, top + (i % 2) * 1.5 - 1, radius * 0.42, radius * 0.22, 0.2, seed + i),
  );
  const dry: Material = { ramp: FOLIAGE, relief: 2, ambient: 0.05, contrast: 0.75, speckle: 0.45 };
  return {
    size,
    foot,
    shadow: groundShadow(foot.x, foot.y, radius * 2, seed, 0.25),
    regions: [{ mask: trunk, material: BARK }, ...lobes.map((mask) => ({ mask, material: dry }))],
  };
}

/** A dead tree: a trunk forking into bare limbs that reach up and out. */
function snag(height: number, seed: number): Standing {
  const size = Math.ceil(height + 8);
  const foot = { x: Math.round(size / 2), y: size - 4 };
  const top = foot.y - height;
  let body: Mask = capsule(foot.x, foot.y, foot.x, top + height * 0.25, 1.5);
  for (let i = 0; i < 4; i += 1) {
    const from = foot.y - height * (0.35 + i * 0.15);
    const side = i % 2 === 0 ? -1 : 1;
    const reach = height * (0.35 - i * 0.04) * (0.8 + noise(seed, i) * 0.4);
    const ex = foot.x + side * reach;
    const ey = from - reach * 0.9;
    body = or(body, capsule(foot.x, from, ex, ey, 0.9));
    body = or(body, capsule(ex - side * reach * 0.4, ey + reach * 0.35, ex - side * reach * 0.1, ey - reach * 0.35, 0.6));
  }
  return {
    size,
    foot,
    shadow: groundShadow(foot.x, foot.y, height * 0.5, seed, 0.45),
    regions: [{ mask: body, material: { ramp: WOOD, relief: 1.5, ambient: 0.25, contrast: 0.7 } }],
  };
}

const BERRY: Stamp = [[0, 0, FIRE[3]!], [1, 1, FIRE[1]!]];

/** A bush: a round body sat on the ground, smaller lobes heaped on it. */
function bush(radius: number, seed: number, berries: boolean): Standing {
  const size = Math.ceil(radius * 2.6 + 4);
  const foot = { x: Math.round(size / 2), y: size - 4 };
  const c = { x: foot.x, y: foot.y - radius * 0.75 };
  const lobes = [
    blob(c.x - radius * 0.3, c.y - radius * 0.35, radius * 0.55, radius * 0.5, 0.15, seed + 3),
    blob(c.x + radius * 0.35, c.y - radius * 0.2, radius * 0.5, radius * 0.45, 0.15, seed + 1),
    // The body, after the lobes behind it and before the one in front.
    and(blob(c.x, c.y, radius, radius * 0.8, 0.16, seed), (_x, y) => y <= foot.y),
    blob(c.x - radius * 0.2, c.y + radius * 0.25, radius * 0.5, radius * 0.4, 0.15, seed + 2),
  ];
  const marks = berries
    ? [0, 1, 2, 3, 4].map((i) => ({
        at: [Math.round(c.x + (noise(seed, i) - 0.5) * radius * 1.3), Math.round(c.y + (noise(seed, i + 5) - 0.5) * radius)] as [number, number],
        stamp: BERRY,
      }))
    : [];
  return {
    size,
    foot,
    shadow: groundShadow(foot.x, foot.y, radius * 2, seed, 0.3),
    regions: lobes.map((mask) => ({ mask, material: { ...LEAVES, relief: 3 } })),
    marks,
  };
}

const LICHEN: Stamp = [[0, 0, FIRE[2]!], [1, 0, FIRE[3]!], [0, 1, FIRE[1]!]];

/**
 * A boulder: a lump sat in the ground, wider than it is tall, with its top catching the light and
 * its front face turned to the viewer in shade — the two faces are what make it a stone standing
 * up rather than a grey patch lying flat.
 */
function boulder(radius: number, seed: number, cover: 'bare' | 'lichen' | 'snow'): Standing {
  const size = Math.ceil(radius * 2.6 + 4);
  const foot = { x: Math.round(size / 2), y: size - 4 };
  const c = { x: foot.x, y: foot.y - radius * 0.62 };
  const body = and(blob(c.x, c.y, radius, radius * 0.72, 0.13, seed), (_x, y) => y <= foot.y);
  const top = and(body, blob(c.x - radius * 0.15, c.y - radius * 0.3, radius * 0.75, radius * 0.38, 0.15, seed + 5));
  const regions: Region[] = [
    { mask: body, material: { ramp: STONE, relief: radius * 0.7, ambient: 0.08, contrast: 0.8, speckle: 0.25 } },
    { mask: top, material: { ramp: STONE, relief: radius * 0.3, ambient: 0.45, contrast: 0.5, speckle: 0.2 } },
  ];
  if (cover === 'snow') {
    regions.push({
      mask: and(top, not(blob(c.x + radius * 0.5, c.y, radius * 0.4, radius * 0.4, 0.2, seed + 7))),
      material: { ramp: PAPER, relief: 1, ambient: 0.5, contrast: 0.45 },
    });
  }
  const marks =
    cover === 'lichen'
      ? [0, 1, 2].map((i) => ({
          at: [Math.round(c.x + (noise(seed, i) - 0.5) * radius * 1.2), Math.round(c.y + (noise(seed, i + 3) - 0.3) * radius * 0.6)] as [number, number],
          stamp: LICHEN,
        }))
      : [];
  return { size, foot, shadow: groundShadow(foot.x, foot.y, radius * 2, seed, 0.25), regions, marks };
}

export const OBJECTS: readonly Decal[] = [
  stand('tree.oak.1', { forest: 0.35, meadow: 0.02 }, oak(16, 301)),
  stand('tree.oak.2', { forest: 0.35, meadow: 0.02 }, oak(18, 317)),
  stand('tree.oak.3', { forest: 0.3, meadow: 0.015 }, oak(20, 331)),
  stand('tree.pine.1', { forest: 0.15, highland: 0.1 }, pine(11, 34, 401, false)),
  stand('tree.pine.2', { forest: 0.15, highland: 0.1 }, pine(13, 40, 419, false)),
  stand('tree.pine.3', { forest: 0.12, highland: 0.08, marsh: 0.03 }, pine(9, 28, 433, false)),
  stand('tree.pine.snow.1', { tundra: 0.1 }, pine(11, 34, 449, true)),
  stand('tree.pine.snow.2', { tundra: 0.08 }, pine(9, 28, 463, true)),
  stand('tree.acacia', { desert: 0.02, meadow: 0.005 }, acacia(18, 503)),
  stand('tree.dead', { marsh: 0.04, tundra: 0.02, desert: 0.01 }, snag(28, 521)),
  stand('bush.1', { meadow: 0.12, forest: 0.2, highland: 0.08 }, bush(6, 601, false)),
  stand('bush.2', { meadow: 0.1, forest: 0.2, marsh: 0.1 }, bush(5, 613, false)),
  stand('bush.berries', { meadow: 0.06, forest: 0.1 }, bush(6, 627, true)),
  stand('boulder.1', { highland: 0.15, meadow: 0.02 }, boulder(7, 701, 'bare')),
  stand('boulder.2', { highland: 0.12, desert: 0.04 }, boulder(5, 719, 'bare')),
  stand('boulder.lichen', { highland: 0.1, tundra: 0.08 }, boulder(6, 733, 'lichen')),
  stand('boulder.snow', { tundra: 0.1 }, boulder(7, 751, 'snow')),
];
