import { cracks, fbm, scatter, wrap } from './periodic.ts';
import type { Cracks, Point } from './periodic.ts';
import { TILT } from '../view.ts';
import { Steps, press } from './steps.ts';
import type { Motif } from './steps.ts';

/**
 * The ground's own drawings: one seamless square of ramp steps per kind of ground, several kinds
 * per material, read at world position by the renderer.
 *
 * Generated rather than drawn row by row. A texture is 4096 texels that have to wrap at all four
 * edges and leave the sun room to work, and the decisions worth making in one — how big the
 * patches are, which way a ripple runs, how often a stone turns up — are a handful of numbers
 * each. The marks laid into it (a blade, a pebble, a leaf) *are* drawn row by row, as motifs,
 * because at three texels every one of them is a choice.
 *
 * **Most of the drawing sits on steps 1–3.** The renderer still lights the hillside by moving a
 * texel up or down its ramp, so a texture that already spends steps 0 and 4 everywhere leaves the
 * sun nothing to say; the ends of the ramp are kept for the marks that need them — the lit top of
 * a stone, the shadow under it.
 */

/**
 * Four parcels across. A texture repeats across the whole map, and at two parcels the repeat is
 * close enough that the eye finds it from any distance — the same dark blob every other plot.
 */
export const TEXTURE = 128;

/** Noise read in feature sizes rather than lattice counts, so the tile can change size alone. */
const field = (x: number, y: number, size: number, octaves: number, salt: number, tall = size): number =>
  fbm(x, y, TEXTURE, TEXTURE / size, octaves, salt, TEXTURE / tall);

export const MATERIALS = ['meadow', 'forest', 'highland', 'marsh', 'tundra', 'desert', 'path'] as const;
export type Material = (typeof MATERIALS)[number];

/**
 * Which way a ridge runs, for the drawings that have one. Named by the ridge rather than by the
 * wind: `ns` is a ridge running north–south, which a wind from the west builds.
 *
 * Four drawings rather than one turned four ways. Rotating pixel art resamples it, and a ridge
 * turned through 45 degrees by arithmetic comes out as a ragged staircase where a drawn one is a
 * clean one.
 */
export const RIDGES = ['ns', 'ew', 'nesw', 'nwse'] as const;
export type Ridge = (typeof RIDGES)[number];

export interface GroundTexture {
  name: string;
  material: Material;
  ridge?: Ridge;
  draw: () => Steps;
}

/** Splits the ground into broad patches a step darker or lighter: where the grass grows thick. */
function patches(steps: Steps, salt: number, size: number, low: number, high: number): void {
  steps.each((x, y, step) => {
    const n = field(x, y, size, 2, salt);
    return n < low ? step - 1 : n > high ? step + 1 : step;
  });
}

/** Lays one motif at each point, chosen by the point's own pick so the choice is fixed. */
function strew(steps: Steps, points: readonly Point[], motifs: readonly Motif[]): void {
  for (const point of points) {
    const motif = motifs[Math.floor(point.pick * motifs.length)];
    if (motif) press(steps, point.x, point.y, motif);
  }
}

/**
 * The bevel round anything split into plates: lit where the plate rises out of a crack on its
 * top-left side, shaded where it falls into one on its bottom-right. Without it a crack is a
 * line drawn on the ground; with it the ground is in pieces.
 */
function bevel(steps: Steps, crack: (x: number, y: number) => boolean, lit: number, shaded: number, line: number): void {
  const before = new Steps(TEXTURE);
  before.cells.set(steps.cells);
  steps.each((x, y) => {
    if (crack(x, y)) return line;
    if (crack(x - 1, y) || crack(x, y - 1)) return lit;
    if (crack(x + 1, y) || crack(x, y + 1)) return shaded;
    return before.get(x, y);
  });
}

/**
 * A crack pattern with the ruler taken out of it.
 *
 * Straight Voronoi edges read as paving: someone laid these. Read through a wandering offset
 * the same edges kink the way a joint in rock or a split in drying mud does, and `gaps` lets a
 * crack fade out partway, so two plates are sometimes one piece of ground with a flaw in it
 * rather than every cell walled off from its neighbours.
 */
function joints(split: Cracks, width: number, wander: number, salt: number, gaps = 0) {
  const look = (x: number, y: number): number => {
    const wx = Math.round(x + wander * (field(x, y, 16, 2, salt) - 0.5) * 2);
    const wy = Math.round(y + wander * (field(x, y, 16, 2, salt + 1) - 0.5) * 2);
    return wrap(wy, TEXTURE) * TEXTURE + wrap(wx, TEXTURE);
  };
  return {
    crack: (x: number, y: number): boolean =>
      split.edge[look(x, y)]! < width && !(gaps > 0 && field(x, y, 16, 1, salt + 2) < gaps),
    plate: (x: number, y: number): number => split.sites[split.site[look(x, y)]!]!.pick,
  };
}

/**
 * A round lump lit from the top-left: a cushion of moss, a hummock, a drift. Sets steps outright
 * rather than relative, so a cushion reads the same wherever it lands. Foreshortened like
 * anything else lying on the ground (`view.ts`), so a round pad is drawn wider than it is tall.
 */
function cushion(steps: Steps, cx: number, cy: number, radius: number, lit: number, body: number, rim: number): void {
  const reach = Math.ceil(radius) + 1;
  for (let dy = -reach; dy <= reach; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) {
      const d = Math.hypot(dx, dy / TILT);
      if (d > radius) continue;
      const facing = (dx + dy) / (radius || 1);
      const step = d > radius - 1 && facing > 0 ? rim : facing < -0.45 && d > radius * 0.35 ? lit : body;
      steps.set(cx + dx, cy + dy, step);
    }
  }
}

/** A stretch of parallel ridges, by phase: where along the ridge's own wave each texel falls. */
function phaseOf(ridge: Ridge, x: number, y: number, waves: number): number {
  const along = ridge === 'ns' ? x : ridge === 'ew' ? y : ridge === 'nesw' ? x + y : x - y;
  return (along * waves) / TEXTURE;
}

const frac = (value: number): number => value - Math.floor(value);

/**
 * Grass at the scale of the people walking on it.
 *
 * A villager is sixteen texels tall, so a texel is about a hand's breadth and a blade of grass
 * is one or two of them. Drawn three tall, as they first were, every blade was knee-high and a
 * tree beside it — forty texels of crown — looked like a shrub in a hayfield.
 */
const BLADES: readonly Motif[] = [
  ['+', '-'],
  ['+.+'],
  ['+'],
  ['.+', '+-'],
];

const TALL_BLADES: readonly Motif[] = [
  ['+.', '+-'],
  ['+.+', '.+-'],
  ['+', '+', '-'],
];

const STUBBLE: readonly Motif[] = [['+'], ['-'], ['+-'], ['.+', '-.']];

const LEAVES: readonly Motif[] = [
  ['^+', '+-'],
  ['.^', '^+', '+-'],
  ['^+.', '.+-'],
  ['+', '-'],
];

const TWIGS: readonly Motif[] = [
  ['+...', '-+..', '.-+.', '..-.'],
  ['...+', '..+-', '.+-.', '.-..'],
];

const NEEDLES: readonly Motif[] = [
  ['+.', '.+'],
  ['.+', '+.'],
  ['^.', '.+'],
  ['.^', '+.'],
];

const STONES: readonly Motif[] = [
  ['^+', '+-'],
  ['.^+.', '^++-', '.+--'],
  ['^^+', '++-', '.--'],
  ['^', '-'],
];

const PEBBLES: readonly Motif[] = [
  ['^-'],
  ['^+', '--'],
  ['.^.', '^+-', '.-.'],
];

const SEDGE: readonly Motif[] = [
  ['.+...', '.+.+.', '++.+.', '.+++-', '..--.'],
  ['+.+', '+.+', '+++', '.--'],
  ['.+', '++', '+-'],
];

const TUSSOCKS: readonly Motif[] = [
  ['.+.', '+^+', '.--'],
  ['+.+.', '.+^+', '..--'],
  ['.+', '+-'],
];

const GRAINS: readonly Motif[] = [['+'], ['+', '-'], ['-']];

function meadowGrass(): Steps {
  const steps = new Steps(TEXTURE, 2);
  patches(steps, 11, 16, 0.3, 0.76);
  strew(steps, scatter(TEXTURE, 3, 12, 0.75, 0), BLADES);
  return steps;
}

function meadowLush(): Steps {
  const steps = new Steps(TEXTURE, 2);
  patches(steps, 21, 16, 0.42, 0.85);
  strew(steps, scatter(TEXTURE, 3, 22, 0.8, 0), TALL_BLADES);
  strew(steps, scatter(TEXTURE, 4, 23, 0.6), BLADES);
  return steps;
}

function meadowWorn(): Steps {
  const steps = new Steps(TEXTURE, 3);
  patches(steps, 31, 16, 0.25, 0.62);
  strew(steps, scatter(TEXTURE, 4, 32, 0.6), STUBBLE);
  strew(steps, scatter(TEXTURE, 8, 33, 0.5), BLADES);
  return steps;
}

function forestFloor(): Steps {
  const steps = new Steps(TEXTURE, 1);
  patches(steps, 41, 16, 0.33, 0.7);
  strew(steps, scatter(TEXTURE, 4, 42, 0.75), LEAVES);
  strew(steps, scatter(TEXTURE, 16, 43, 0.6), TWIGS);
  return steps;
}

function forestMoss(): Steps {
  const steps = new Steps(TEXTURE, 1);
  patches(steps, 51, 8, 0.3, 1);
  // Pads a hand or two across. Bigger and they stand up off the floor like a stand of saplings,
  // which is a forest drawn inside the forest at the wrong size.
  for (const point of scatter(TEXTURE, 5, 52, 0.8)) {
    cushion(steps, point.x, point.y, 1.2 + point.pick * 1, 3, 2, 0);
  }
  strew(steps, scatter(TEXTURE, 4, 53, 0.35), STUBBLE);
  return steps;
}

function forestNeedles(): Steps {
  const steps = new Steps(TEXTURE, 1);
  patches(steps, 61, 16, 0.3, 0.72);
  strew(steps, scatter(TEXTURE, 2, 62, 0.45, 0), NEEDLES);
  strew(steps, scatter(TEXTURE, 16, 63, 0.5), TWIGS);
  return steps;
}

function highlandScree(): Steps {
  const steps = new Steps(TEXTURE, 2);
  patches(steps, 71, 16, 0.33, 0.7);
  strew(steps, scatter(TEXTURE, 5, 72, 0.8), STONES);
  return steps;
}

function highlandSlab(): Steps {
  const steps = new Steps(TEXTURE, 2);
  const rock = joints(cracks(TEXTURE, 18, 81), 1, 3, 84, 0.28);
  steps.each((x, y) => (rock.plate(x, y) < 0.4 ? 2 : 3));
  patches(steps, 85, 16, 0.3, 1);
  bevel(steps, rock.crack, 4, 1, 0);
  strew(steps, scatter(TEXTURE, 8, 82, 0.4), STUBBLE);
  return steps;
}

function highlandHeath(): Steps {
  const steps = new Steps(TEXTURE, 2);
  patches(steps, 91, 16, 0.4, 0.75);
  strew(steps, scatter(TEXTURE, 5, 92, 0.85), TUSSOCKS);
  strew(steps, scatter(TEXTURE, 16, 93, 0.5), STONES);
  return steps;
}

function marshSedge(): Steps {
  const steps = new Steps(TEXTURE, 2);
  patches(steps, 101, 16, 0.38, 0.72);
  strew(steps, scatter(TEXTURE, 6, 102, 0.85), SEDGE);
  return steps;
}

function marshMud(): Steps {
  const steps = new Steps(TEXTURE, 2);
  patches(steps, 111, 8, 0.4, 0.8);
  const wet = (x: number, y: number): boolean => field(x, y, 16, 2, 112) < 0.34;
  steps.each((x, y, step) => {
    if (wet(x, y)) {
      // The glint: the inside of the far bank catches the sky, which is on the near side.
      return wet(x - 1, y - 1) && !wet(x - 2, y - 2) ? 3 : 0;
    }
    return wet(x + 1, y) || wet(x, y + 1) || wet(x - 1, y) || wet(x, y - 1) ? 1 : step;
  });
  strew(steps, scatter(TEXTURE, 8, 113, 0.5), STUBBLE);
  return steps;
}

function marshHummock(): Steps {
  const steps = new Steps(TEXTURE, 1);
  patches(steps, 121, 16, 0.3, 1);
  for (const point of scatter(TEXTURE, 9, 122, 0.85)) {
    cushion(steps, point.x, point.y, 2 + point.pick * 1.5, 3, 2, 0);
  }
  strew(steps, scatter(TEXTURE, 6, 123, 0.5), SEDGE);
  return steps;
}

function tundraSnow(): Steps {
  const steps = new Steps(TEXTURE, 3);
  // Combed by the wind: the noise is stretched along x, so the drifts lie in long low ridges.
  const level = (x: number, y: number): number => Math.floor(field(x, y, 32, 3, 131, 8) * 5);
  steps.each((x, y) => {
    const here = level(x, y);
    if (here > level(x, y - 1)) return 4;
    if (here > level(x, y + 1)) return 2;
    return 3;
  });
  strew(steps, scatter(TEXTURE, 8, 132, 0.4), [['4']]);
  return steps;
}

function tundraLichen(): Steps {
  const steps = new Steps(TEXTURE, 2);
  const crust = (x: number, y: number): boolean => field(x, y, 8, 2, 141) < 0.36;
  steps.each((x, y, step) => {
    if (crust(x, y)) return crust(x - 1, y - 1) ? 1 : 2;
    return field(x, y, 16, 2, 142) > 0.62 ? step + 1 : step;
  });
  strew(steps, scatter(TEXTURE, 4, 143, 0.5), STUBBLE);
  strew(steps, scatter(TEXTURE, 16, 144, 0.5), STONES);
  return steps;
}

function tundraFrost(): Steps {
  const steps = new Steps(TEXTURE, 3);
  const frost = joints(cracks(TEXTURE, 14, 151), 1, 1.5, 153);
  bevel(steps, frost.crack, 4, 2, 1);
  strew(steps, scatter(TEXTURE, 8, 152, 0.3), [['4']]);
  return steps;
}

function desertSand(): Steps {
  const steps = new Steps(TEXTURE, 2);
  patches(steps, 161, 16, 0, 0.72);
  strew(steps, scatter(TEXTURE, 3, 162, 0.45), GRAINS);
  return steps;
}

/**
 * Wind ripples: a ridge a texel high every eight or so, with a lit crest and a shaded lee.
 *
 * Broken into lengths by a second field, because unbroken they read as ruled lines, and wandered
 * by a third so they bend the way sand does round anything in its way.
 */
function desertRipples(ridge: Ridge): () => Steps {
  return () => {
    const steps = desertSand();
    const waves = ridge === 'ns' || ridge === 'ew' ? 16 : 12;
    const width = waves / TEXTURE;
    steps.each((x, y, step) => {
      if (field(x, y, 8, 1, 171) < 0.3) return step;
      const f = frac(phaseOf(ridge, x, y, waves) + 1.2 * (field(x, y, 32, 2, 172) - 0.5));
      if (f >= 0.8 - width && f < 0.8) return 3;
      if (f >= 0.8 && f < 0.8 + width) return 1;
      return step;
    });
    return steps;
  };
}

/**
 * A dune: a long windward slope that climbs into light, a crest, and a short steep lee in shadow.
 * Small ripples ride the windward side — only their shaded line, which is all of a ripple that
 * shows on a face already lit.
 */
function desertDunes(ridge: Ridge): () => Steps {
  return () => {
    const steps = new Steps(TEXTURE, 2);
    const waves = 4;
    const length = TEXTURE / waves;
    const small = ridge === 'ns' || ridge === 'ew' ? 20 : 16;
    steps.each((x, y) => {
      const warp = 0.35 * (field(x, y, 32, 2, 181) - 0.5);
      const at = frac(phaseOf(ridge, x, y, waves) + warp) * length;
      if (at >= 23 && at < 25) return 4;
      if (at >= 25 && at < 30) return 1;
      const face = at >= 13 && at < 23 ? 3 : 2;
      const ripple = frac(phaseOf(ridge, x, y, small) + 0.8 * (field(x, y, 16, 1, 182) - 0.5));
      return at < 23 && ripple < small / TEXTURE && field(x, y, 8, 1, 183) > 0.35 ? face - 1 : face;
    });
    strew(steps, scatter(TEXTURE, 4, 184, 0.25), [['+']]);
    return steps;
  };
}

function desertHardpan(): Steps {
  const steps = new Steps(TEXTURE, 2);
  const mud = joints(cracks(TEXTURE, 11, 191), 0.9, 2, 192, 0.12);
  steps.each((x, y) => (mud.plate(x, y) < 0.3 ? 3 : 2));
  bevel(steps, mud.crack, 3, 1, 0);
  return steps;
}

function pathTrodden(): Steps {
  const steps = new Steps(TEXTURE, 2);
  patches(steps, 201, 16, 0.35, 0.7);
  strew(steps, scatter(TEXTURE, 6, 202, 0.6), PEBBLES);
  return steps;
}

function pathGravel(): Steps {
  const steps = new Steps(TEXTURE, 2);
  patches(steps, 211, 8, 0.3, 0.75);
  strew(steps, scatter(TEXTURE, 3, 212, 0.7), PEBBLES);
  return steps;
}

export const TEXTURES: readonly GroundTexture[] = [
  { name: 'meadow.grass', material: 'meadow', draw: meadowGrass },
  { name: 'meadow.lush', material: 'meadow', draw: meadowLush },
  { name: 'meadow.worn', material: 'meadow', draw: meadowWorn },
  { name: 'forest.floor', material: 'forest', draw: forestFloor },
  { name: 'forest.moss', material: 'forest', draw: forestMoss },
  { name: 'forest.needles', material: 'forest', draw: forestNeedles },
  { name: 'highland.scree', material: 'highland', draw: highlandScree },
  { name: 'highland.slab', material: 'highland', draw: highlandSlab },
  { name: 'highland.heath', material: 'highland', draw: highlandHeath },
  { name: 'marsh.sedge', material: 'marsh', draw: marshSedge },
  { name: 'marsh.mud', material: 'marsh', draw: marshMud },
  { name: 'marsh.hummock', material: 'marsh', draw: marshHummock },
  { name: 'tundra.snow', material: 'tundra', draw: tundraSnow },
  { name: 'tundra.lichen', material: 'tundra', draw: tundraLichen },
  { name: 'tundra.frost', material: 'tundra', draw: tundraFrost },
  { name: 'desert.sand', material: 'desert', draw: desertSand },
  ...RIDGES.map((ridge): GroundTexture => ({
    name: `desert.ripples.${ridge}`,
    material: 'desert',
    ridge,
    draw: desertRipples(ridge),
  })),
  ...RIDGES.map((ridge): GroundTexture => ({
    name: `desert.dunes.${ridge}`,
    material: 'desert',
    ridge,
    draw: desertDunes(ridge),
  })),
  { name: 'desert.hardpan', material: 'desert', draw: desertHardpan },
  { name: 'path.trodden', material: 'path', draw: pathTrodden },
  { name: 'path.gravel', material: 'path', draw: pathGravel },
];
