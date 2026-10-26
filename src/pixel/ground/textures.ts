import { TILT } from '../view.ts';
import type { Cracks, Point } from './periodic.ts';
import { cracks, fbm, hash, scatter, wrap } from './periodic.ts';
import type { Motif } from './steps.ts';
import { Steps, press } from './steps.ts';

export const TEXTURE = 128;

const field = (x: number, y: number, size: number, octaves: number, salt: number, tall = size): number =>
  fbm(x, y, TEXTURE, TEXTURE / size, octaves, salt, TEXTURE / tall);

export const MATERIALS = ['meadow', 'forest', 'highland', 'marsh', 'tundra', 'desert', 'rock', 'karst', 'volcanic', 'salt', 'badlands', 'path'] as const;
export type Material = (typeof MATERIALS)[number];

export const RIDGES = ['ns', 'ew', 'nesw', 'nwse'] as const;
export type Ridge = (typeof RIDGES)[number];

export interface GroundTexture {
  name: string;
  material: Material;
  ridge?: Ridge;
  draw: () => Steps;
}

function patches(steps: Steps, salt: number, size: number, low: number, high: number): void {
  steps.each((x, y, step) => {
    const n = field(x, y, size, 2, salt);
    return n < low ? step - 1 : n > high ? step + 1 : step;
  });
}

function strew(steps: Steps, points: readonly Point[], motifs: readonly Motif[]): void {
  for (const point of points) {
    const motif = motifs[Math.floor(point.pick * motifs.length)];
    if (motif) press(steps, point.x, point.y, motif);
  }
}

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

function phaseOf(ridge: Ridge, x: number, y: number, waves: number): number {
  const along = ridge === 'ns' ? x : ridge === 'ew' ? y : ridge === 'nesw' ? x + y : x - y;
  return (along * waves) / TEXTURE;
}

const frac = (value: number): number => value - Math.floor(value);

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

function rockSlab(): Steps {
  const steps = new Steps(TEXTURE, 2);
  const rock = joints(cracks(TEXTURE, 22, 301), 1, 3, 302, 0.2);
  steps.each((x, y) => (rock.plate(x, y) < 0.33 ? 1 : rock.plate(x, y) < 0.7 ? 2 : 3));
  patches(steps, 303, 16, 0.3, 0.75);
  bevel(steps, rock.crack, 4, 0, 0);
  strew(steps, scatter(TEXTURE, 9, 304, 0.45), STUBBLE);
  return steps;
}

function rockBlocks(): Steps {
  const steps = new Steps(TEXTURE, 2);
  const rock = joints(cracks(TEXTURE, 12, 311), 1, 2, 312, 0.1);
  steps.each((x, y) => (rock.plate(x, y) < 0.5 ? 2 : 3));
  patches(steps, 313, 8, 0.3, 0.7);
  bevel(steps, rock.crack, 4, 1, 0);
  strew(steps, scatter(TEXTURE, 6, 314, 0.4), PEBBLES);
  return steps;
}

function rockLichen(): Steps {
  const steps = new Steps(TEXTURE, 2);
  patches(steps, 321, 16, 0.3, 0.7);
  strew(steps, scatter(TEXTURE, 7, 322, 0.6), STONES);
  for (const point of scatter(TEXTURE, 9, 323, 0.7)) cushion(steps, point.x, point.y, 1.4 + point.pick * 1.6, 4, 3, 1);
  return steps;
}

function karstPavement(): Steps {
  const steps = new Steps(TEXTURE, 3);
  const slabs = joints(cracks(TEXTURE, 15, 331), 1.5, 2, 332, 0.12);
  steps.each((x, y) => (slabs.plate(x, y) < 0.5 ? 3 : 2));
  patches(steps, 333, 16, 0.25, 0.8);
  bevel(steps, slabs.crack, 4, 1, 0);
  strew(steps, scatter(TEXTURE, 10, 334, 0.4), STUBBLE);
  return steps;
}

function karstRubble(): Steps {
  const steps = new Steps(TEXTURE, 3);
  patches(steps, 341, 16, 0.3, 0.7);
  strew(steps, scatter(TEXTURE, 4, 342, 0.85), STONES);
  strew(steps, scatter(TEXTURE, 5, 343, 0.5), PEBBLES);
  return steps;
}

function karstRunnels(): Steps {
  const steps = new Steps(TEXTURE, 3);
  steps.each((x, y) => {
    const f = frac(phaseOf('nwse', x, y, 10) + 0.7 * (field(x, y, 24, 2, 351) - 0.5));
    if (f < 0.14) return 1;
    if (f < 0.26) return 4;
    return field(x, y, 16, 2, 352) > 0.6 ? 2 : 3;
  });
  strew(steps, scatter(TEXTURE, 12, 353, 0.4), STUBBLE);
  return steps;
}

function volcanicAsh(): Steps {
  const steps = new Steps(TEXTURE, 1);
  patches(steps, 361, 16, 0.3, 0.72);
  strew(steps, scatter(TEXTURE, 3, 362, 0.5), GRAINS);
  strew(steps, scatter(TEXTURE, 7, 363, 0.4), [['^'], ['+'], ['+', '.']]);
  return steps;
}

function volcanicLava(): Steps {
  const steps = new Steps(TEXTURE, 1);
  const flow = joints(cracks(TEXTURE, 18, 371), 1.2, 4, 372, 0.15);
  steps.each((x, y) => (flow.plate(x, y) < 0.4 ? 1 : flow.plate(x, y) < 0.8 ? 2 : 1));
  patches(steps, 373, 16, 0.3, 0.75);
  bevel(steps, flow.crack, 3, 0, 0);
  steps.each((x, y, step) => {
    const f = frac(phaseOf('nesw', x, y, 12) + 1.2 * (field(x, y, 32, 2, 374) - 0.5));
    return f < 0.07 && field(x, y, 8, 1, 375) > 0.4 ? step + 1 : step;
  });
  strew(steps, scatter(TEXTURE, 14, 376, 0.3), [['^']]);
  return steps;
}

function volcanicCinder(): Steps {
  const steps = new Steps(TEXTURE, 1);
  patches(steps, 381, 8, 0.35, 0.7);
  strew(steps, scatter(TEXTURE, 3, 382, 0.8), [['^-'], ['+'], ['^', '-'], ['+-']]);
  strew(steps, scatter(TEXTURE, 9, 383, 0.5), PEBBLES);
  return steps;
}

function saltCrust(): Steps {
  const steps = new Steps(TEXTURE, 3);
  const pan = joints(cracks(TEXTURE, 10, 391), 1, 1.5, 392);
  steps.each((x, y) => (pan.plate(x, y) < 0.3 ? 2 : 3));
  steps.each((x, y, step) => (pan.crack(x, y) ? 4 : pan.crack(x + 1, y + 1) ? 1 : step));
  patches(steps, 393, 16, 0.25, 0.85);
  return steps;
}

function saltFlat(): Steps {
  const steps = new Steps(TEXTURE, 3);
  patches(steps, 401, 32, 0.3, 0.7);
  strew(steps, scatter(TEXTURE, 6, 402, 0.3), [['4'], ['+']]);
  strew(steps, scatter(TEXTURE, 9, 403, 0.2), [['1'], ['v']]);
  return steps;
}

function saltMud(): Steps {
  const steps = new Steps(TEXTURE, 3);
  const damp = (x: number, y: number): boolean => field(x, y, 16, 2, 411) < 0.3;
  steps.each((x, y, step) => {
    if (damp(x, y)) return damp(x - 1, y - 1) ? 1 : 2;
    return field(x, y, 8, 2, 412) > 0.55 ? 4 : step;
  });
  return steps;
}

function badlandsStrata(): Steps {
  const steps = new Steps(TEXTURE, 2);
  steps.each((x, y) => {
    const warp = (field(x, y, 32, 2, 421) - 0.5) * 10;
    const at = y + warp;
    const band = wrap(Math.floor(at / 8), 16);
    const within = frac(at / 8);
    const tone = 1 + Math.floor(hash(band, 0, 422) * 3);
    if (within < 0.12) return 4;
    if (within > 0.88) return 0;
    return tone;
  });
  strew(steps, scatter(TEXTURE, 8, 423, 0.4), STUBBLE);
  return steps;
}

function badlandsClay(): Steps {
  const steps = new Steps(TEXTURE, 2);
  const clay = joints(cracks(TEXTURE, 14, 431), 1, 2.5, 432, 0.1);
  steps.each((x, y) => (clay.plate(x, y) < 0.4 ? 3 : 2));
  patches(steps, 433, 16, 0.3, 0.75);
  bevel(steps, clay.crack, 4, 1, 0);
  return steps;
}

function badlandsShards(): Steps {
  const steps = new Steps(TEXTURE, 2);
  patches(steps, 441, 16, 0.3, 0.7);
  strew(steps, scatter(TEXTURE, 4, 442, 0.8), [['^-'], ['+'], ['.^', '^-']]);
  strew(steps, scatter(TEXTURE, 8, 443, 0.5), PEBBLES);
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
  { name: 'rock.slab', material: 'rock', draw: rockSlab },
  { name: 'rock.blocks', material: 'rock', draw: rockBlocks },
  { name: 'rock.lichen', material: 'rock', draw: rockLichen },
  { name: 'karst.pavement', material: 'karst', draw: karstPavement },
  { name: 'karst.rubble', material: 'karst', draw: karstRubble },
  { name: 'karst.runnels', material: 'karst', draw: karstRunnels },
  { name: 'volcanic.ash', material: 'volcanic', draw: volcanicAsh },
  { name: 'volcanic.lava', material: 'volcanic', draw: volcanicLava },
  { name: 'volcanic.cinder', material: 'volcanic', draw: volcanicCinder },
  { name: 'salt.crust', material: 'salt', draw: saltCrust },
  { name: 'salt.flat', material: 'salt', draw: saltFlat },
  { name: 'salt.mud', material: 'salt', draw: saltMud },
  { name: 'badlands.strata', material: 'badlands', draw: badlandsStrata },
  { name: 'badlands.clay', material: 'badlands', draw: badlandsClay },
  { name: 'badlands.shards', material: 'badlands', draw: badlandsShards },
  { name: 'path.trodden', material: 'path', draw: pathTrodden },
  { name: 'path.gravel', material: 'path', draw: pathGravel },
];
