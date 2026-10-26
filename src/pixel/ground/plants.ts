import type { Ramp, Rgba } from '../color.ts';
import type { Mask } from '../field.ts';
import { and, blob, capsule, noise, not, or } from '../field.ts';
import { CHAR, EARTH, EMBER, FIRE, FOLIAGE, GRAPE, HEATH, JUNGLE, NEEDLE, OLIVE, PALM, PAPER, RED, SCRUB, STONE, TUNDRA, WATER, WILLOW, WOOD } from '../palette.ts';
import type { Material, Region } from '../shade.ts';
import { dome, flat } from '../shade.ts';
import type { Decal } from './decals.ts';
import type { Bump, Grain, LitProp, Standing, Traits } from './objects.ts';
import { LIT_FOLK } from './folk.ts';
import { LIT_BARE, LIT_TREES, TREE_ARTS } from './flora.ts';
import { canopyHoles, crownOf, fronds, LEAVES, lit, shared, STOREYS } from './objects.ts';

type Density = Decal['density'];

interface Spot {
  x: number;
  y: number;
}

const surface = (ramp: Ramp, relief = 1.5, grit = 0.3, speckle = 0.3): Material => ({
  ramp,
  profile: dome,
  relief,
  ambient: 0.1,
  contrast: 0.85,
  speckle,
  grit,
});

const colour = (rgba: Rgba): Ramp => [rgba];

const standing = (
  size: number,
  foot: Spot,
  regions: readonly Region[],
  height: number,
  extra: Pick<Standing, 'holes' | 'crown'> = {},
): Standing => ({ size, foot, shadow: () => false, height, regions, ...extra });

const middle = (size: number): Spot => ({ x: Math.floor(size / 2), y: Math.floor(size / 2) });

const around = (from: Spot, angle: number, reach: number): Spot => ({
  x: from.x + Math.cos(angle) * reach,
  y: from.y + Math.sin(angle) * reach,
});

interface TuftOptions {
  size: number;
  blades: number;
  tall: number;
  ramp: Ramp;
  spread?: number;
  heads?: Ramp;
}

function tuft(seed: number, options: TuftOptions): Standing {
  const { tall } = options;
  const reach = tall * 0.8;
  const size = Math.max(options.size, Math.ceil(reach * 2 + 8));
  const foot = middle(size);

  const blades = Array.from({ length: options.blades }, (_, i) => {
    const angle = (i / options.blades) * Math.PI * 2 + (noise(seed, i) - 0.5) * 0.9;
    const length = reach * (0.55 + noise(seed, i + 60) * 0.45);
    const curl = (noise(seed, i + 90) - 0.5) * 0.7;
    const half = around(foot, angle, length * 0.5);
    const tip = around(foot, angle + curl, length);
    return { half, tip };
  });
  blades.sort((a, b) => a.tip.x + a.tip.y - (b.tip.x + b.tip.y));

  const regions: Region[] = blades.map((blade) => ({
    mask: or(capsule(foot.x, foot.y, blade.half.x, blade.half.y, 0.95), capsule(blade.half.x, blade.half.y, blade.tip.x, blade.tip.y, 0.8)),
    material: surface(options.ramp, 1, 0.25, 0.35),
  }));

  const heads = options.heads;
  if (heads) {
    blades.forEach((blade, i) => {
      if (i % 2 === 0) regions.push({ mask: blob(blade.tip.x, blade.tip.y, 1.3, 1.3, 0.2, seed + i), material: surface(heads, 0.8, 0.2, 0.2) });
    });
  }

  return standing(size, foot, regions, tall * 0.4);
}

type Stage = 'bloom' | 'bud' | 'seed';

function flower(seed: number, petal: Rgba, size = 14, stage: Stage = 'bloom'): Standing {
  const foot = middle(size);
  const leaves = 3 + Math.floor(noise(seed, 1) * 3);
  const petals = 5 + Math.floor(noise(seed, 3) * 3);
  const turn = noise(seed, 2) * Math.PI * 2;

  const regions: Region[] = [];
  if (stage === 'seed') {
    const stalks = 3 + Math.floor(noise(seed, 4) * 3);
    for (let i = 0; i < stalks; i += 1) {
      const tip = around(foot, turn + (i / stalks) * Math.PI * 2 + (noise(seed, i + 20) - 0.5) * 0.7, 3.4 + noise(seed, i + 24) * 2);
      regions.push({ mask: capsule(foot.x, foot.y, tip.x, tip.y, 0.5), material: surface(colour(WOOD[2]!), 0.6, 0.3, 0.3) });
      regions.push({ mask: blob(tip.x, tip.y, 0.9, 0.9, 0.2, seed + i), material: surface(colour(WOOD[1]!), 0.8, 0.2, 0.2) });
    }
    return standing(size, foot, regions, 2);
  }
  const reach = stage === 'bud' ? 0.7 : 1;
  for (let i = 0; i < leaves; i += 1) {
    const tip = around(foot, turn + (i / leaves) * Math.PI * 2 + (noise(seed, i + 8) - 0.5) * 0.6, (4.2 + noise(seed, i + 12) * 1.2) * reach);
    regions.push({ mask: capsule(foot.x, foot.y, tip.x, tip.y, 1.15), material: surface(FOLIAGE, 1, 0.2, 0.3) });
  }
  if (stage === 'bud') {
    regions.push({ mask: blob(foot.x, foot.y, 1.1, 1.1, 0.1, seed + 5), material: surface(FOLIAGE.slice(3), 0.8, 0.1, 0.1) });
    regions.push({ mask: blob(foot.x, foot.y, 0.7, 0.7, 0.1, seed + 6), material: surface(colour(petal), 0.8, 0.1, 0.1) });
    return standing(size, foot, regions, 2);
  }
  for (let i = 0; i < petals; i += 1) {
    const at = around(foot, turn + (i / petals) * Math.PI * 2, 1.9);
    regions.push({ mask: blob(at.x, at.y, 1.3, 1.3, 0.2, seed + i), material: surface(colour(petal), 0.8, 0.15, 0.2) });
  }
  regions.push({ mask: blob(foot.x, foot.y, 1.1, 1.1, 0.1, seed + 9), material: surface(colour(FIRE[5]!), 0.6, 0.1, 0.1) });
  return standing(size, foot, regions, 3);
}

function clover(seed: number, size = 12): Standing {
  const foot = middle(size);
  const leaves = 3 + Math.floor(noise(seed, 1) * 2);
  const regions: Region[] = Array.from({ length: leaves }, (_, i) => {
    const at = around(foot, (i / leaves) * Math.PI * 2 + noise(seed, i), 2.3);
    return { mask: blob(at.x, at.y, 1.9, 1.7, 0.2, seed + i), material: surface(FOLIAGE, 1, 0.2, 0.3) };
  });
  return standing(size, foot, regions, 1.5);
}

interface RockOptions {
  size: number;
  radius: number;
  ramp: Ramp;
  lichen?: boolean;
  snow?: boolean;
}

function rock(seed: number, options: RockOptions): Standing {
  const { radius, ramp } = options;
  const size = Math.max(options.size, Math.ceil(radius * 2 + 8));
  const foot = middle(size);
  const body = blob(foot.x, foot.y, radius, radius * (0.78 + noise(seed, 2) * 0.2), 0.14, seed);
  const top = and(body, blob(foot.x - radius * 0.15, foot.y - radius * 0.25, radius * 0.7, radius * 0.5, 0.15, seed + 5));

  const facets: Bump[] = Array.from({ length: 4 }, (_, i) => ({
    x: foot.x + (noise(seed, i + 10) - 0.5) * radius * 1.1,
    y: foot.y + (noise(seed, i + 20) - 0.5) * radius * 0.9,
    r: radius * (0.55 + noise(seed, i + 30) * 0.4),
    h: radius * (0.5 + noise(seed, i + 40) * 0.5),
    shape: 'cone',
  }));

  const rough: Material = { ramp, profile: flat, relief: 0, ambient: 0.08, contrast: 0.8, speckle: 0.35, grit: 0.7 };
  const regions: Region[] = [{ mask: body, material: rough }];

  if (options.lichen) {
    for (let i = 0; i < 3; i += 1) {
      const at = { x: foot.x + (noise(seed, i + 50) - 0.5) * radius * 1.3, y: foot.y + (noise(seed, i + 60) - 0.5) * radius * 1.0 };
      regions.push({ mask: and(body, blob(at.x, at.y, radius * 0.3, radius * 0.22, 0.3, seed + i)), material: surface(colour(FIRE[2]!), 0.5, 0.3, 0.3) });
    }
  }
  if (options.snow) {
    regions.push({
      mask: and(top, not(blob(foot.x + radius * 0.5, foot.y, radius * 0.4, radius * 0.4, 0.2, seed + 7))),
      material: { ramp: PAPER, profile: flat, relief: 0, ambient: 0.5, contrast: 0.45, grit: 0.3 },
    });
  }

  return standing(size, foot, regions, radius * 0.6, { crown: crownOf(facets) });
}

function stones(seed: number, size: number, count: number, ramp: Ramp, reach: number): Standing {
  const foot = middle(size);
  const spots = Array.from({ length: count }, (_, i) => ({
    x: foot.x + (noise(seed, i) - 0.5) * size * 0.5,
    y: foot.y + (noise(seed, i + 20) - 0.5) * size * 0.5,
    r: reach * (0.7 + noise(seed, i + 40) * 0.6),
  }));
  spots.sort((a, b) => a.y - b.y);
  const regions: Region[] = spots.map((spot, i) => ({
    mask: blob(spot.x, spot.y, spot.r, spot.r * 0.85, 0.22, seed + i),
    material: { ramp, profile: dome, relief: spot.r * 0.7, ambient: 0.08, contrast: 0.8, speckle: 0.3, grit: 0.5 },
  }));
  return standing(size, foot, regions, reach * 0.5);
}

interface BushLook {
  ramp?: Ramp;
  berries?: boolean;
  count?: number;
  spread?: number;
  fringe?: number;
  twigs?: number;
  flowers?: Rgba;
}

function bush(seed: number, radius: number, look: BushLook = {}): Standing {
  const size = Math.ceil(radius * 2.8 + 8);
  const foot = middle(size);
  const count = (look.count ?? 6) + Math.floor(noise(seed, 1) * 3);
  const spread = look.spread ?? 1;
  const leaves: Material = { ...LEAVES, ramp: look.ramp ?? LEAVES.ramp, grit: 0.35 };

  const lobes = Array.from({ length: count }, (_, i) => {
    const at = around(foot, (i / count) * Math.PI * 2 + noise(seed, i), radius * (0.25 + noise(seed, i + 10) * 0.45) * spread);
    return { ...at, r: radius * (0.42 + noise(seed, i + 20) * 0.18), h: radius * (0.5 + noise(seed, i + 30) * 0.5) };
  });
  lobes.push({ ...foot, r: radius * 0.55, h: radius * (0.7 + noise(seed, 5) * 0.3) });
  lobes.sort((a, b) => a.x + a.y - (b.x + b.y));

  const regions: Region[] = lobes.map((lobe, i) => ({
    mask: blob(lobe.x, lobe.y, lobe.r, lobe.r, 0.16, seed + i),
    material: { ...leaves, relief: lobe.r * 0.5 },
  }));

  for (let i = 0; i < (look.twigs ?? 0); i += 1) {
    const from = around(foot, noise(seed, i + 90) * Math.PI * 2, radius * 0.2);
    const to = around(foot, noise(seed, i + 100) * Math.PI * 2, radius * (0.9 + noise(seed, i + 110) * 0.5));
    regions.push({ mask: capsule(from.x, from.y, to.x, to.y, 0.6), material: { ramp: WOOD, relief: 1, ambient: 0.2, contrast: 0.8 } });
  }

  if (look.berries) {
    for (let i = 0; i < 6; i += 1) {
      const at = around(foot, noise(seed, i + 70) * Math.PI * 2, radius * noise(seed, i + 80) * 0.9);
      regions.push({ mask: blob(at.x, at.y, 0.95, 0.95, 0.1, seed + i), material: { ...surface(colour(i % 3 === 0 ? FIRE[3]! : RED), 0.6, 0.1, 0.1), accent: true } });
    }
  }

  if (look.flowers) {
    for (let i = 0; i < 9; i += 1) {
      const at = around(foot, noise(seed, i + 120) * Math.PI * 2, radius * noise(seed, i + 130) * 0.9);
      regions.push({ mask: blob(at.x, at.y, 0.9, 0.9, 0.1, seed + i), material: surface(colour(look.flowers), 0.6, 0.1, 0.1) });
    }
  }

  return standing(size, foot, regions, radius * 0.5, {
    holes: canopyHoles(foot, radius * 0.9, seed, look.fringe ?? 0.7),
    crown: crownOf(lobes.map((lobe) => ({ x: lobe.x, y: lobe.y, r: lobe.r * 1.2, h: lobe.h }))),
  });
}

interface VineLook {
  ramp: Ramp;
  strands: number;
  fruit?: Rgba;
}

function vine(seed: number, radius: number, look: VineLook): Standing {
  const size = Math.ceil(radius * 2.8 + 8);
  const foot = middle(size);
  const leaves: Material = { ...LEAVES, ramp: look.ramp, grit: 0.35 };
  const regions: Region[] = [];
  const bumps: Bump[] = [];
  const cane: Material = { ramp: WOOD, relief: 1, ambient: 0.2, contrast: 0.8 };

  for (let i = 0; i < look.strands; i += 1) {
    let at = around(foot, noise(seed, i) * Math.PI * 2, radius * 0.15);
    let angle = noise(seed, i + 20) * Math.PI * 2;
    for (let step = 0; step < 4; step += 1) {
      angle += (noise(seed, i * 7 + step + 40) - 0.5) * 1.3;
      const next = around(at, angle, radius * (0.28 + noise(seed, i * 7 + step + 60) * 0.18));
      regions.push({ mask: capsule(at.x, at.y, next.x, next.y, 0.55), material: cane });
      const r = radius * (0.2 + noise(seed, i * 7 + step + 80) * 0.12);
      regions.push({ mask: blob(next.x, next.y, r, r, 0.2, seed + i * 5 + step), material: { ...leaves, relief: r * 0.5 } });
      bumps.push({ x: next.x, y: next.y, r: r * 1.3, h: radius * (0.35 + noise(seed, i * 7 + step + 100) * 0.4) });
      if (look.fruit && step >= 2 && noise(seed, i * 7 + step + 120) > 0.35) {
        regions.push({ mask: blob(next.x + 0.8, next.y + 0.8, 1, 1, 0.1, seed + i), material: { ...surface(colour(look.fruit), 0.6, 0.1, 0.1), accent: true } });
      }
      at = next;
    }
  }
  return standing(size, foot, regions, radius * 0.4, { holes: canopyHoles(foot, radius, seed, 0.9), crown: crownOf(bumps) });
}

function fern(seed: number, size = 24, k = 1): Standing {
  const foot = middle(size);
  const fronds = 7 + Math.floor(noise(seed, 1) * 4);
  const turn = noise(seed, 2) * Math.PI * 2;

  const list = Array.from({ length: fronds }, (_, i) => ({
    angle: turn + (i / fronds) * Math.PI * 2 + (noise(seed, i) - 0.5) * 0.3,
    length: (7 + noise(seed, i + 10) * 3.5) * k,
  }));
  list.sort((a, b) => Math.cos(a.angle) + Math.sin(a.angle) - (Math.cos(b.angle) + Math.sin(b.angle)));

  const regions: Region[] = list.map((frond) => {
    const tip = around(foot, frond.angle, frond.length);
    let mask: Mask = capsule(foot.x, foot.y, tip.x, tip.y, 0.8);
    for (let t = 0.3; t < 0.95; t += 0.16) {
      const at = around(foot, frond.angle, frond.length * t);
      const across = { x: -Math.sin(frond.angle), y: Math.cos(frond.angle) };
      const len = 2.7 * k * (1.1 - t);
      mask = or(mask, capsule(at.x - across.x * len, at.y - across.y * len, at.x + across.x * len, at.y + across.y * len, 0.65));
    }
    return { mask, material: surface(FOLIAGE, 1, 0.3, 0.4) };
  });
  return standing(size, foot, regions, 3);
}

function mushrooms(seed: number, cap: Rgba, spotted: boolean, size = 14): Standing {
  const foot = middle(size);
  const count = 1 + Math.floor(noise(seed, 1) * 3);
  const regions: Region[] = [];

  const heads = Array.from({ length: count }, (_, i) => ({
    ...around(foot, noise(seed, i) * Math.PI * 2, count === 1 ? 0 : 2.6 + noise(seed, i + 5)),
    r: 2.1 + noise(seed, i + 20) * 0.9,
  }));
  heads.sort((a, b) => a.y - b.y);

  for (const head of heads) {
    regions.push({ mask: blob(head.x, head.y, head.r, head.r, 0.1, seed + Math.floor(head.x)), material: surface(colour(cap), 1.6, 0.2, 0.2) });
    if (spotted) {
      for (let i = 0; i < 3; i += 1) {
        const at = around(head, noise(seed, i + 40) * Math.PI * 2, head.r * 0.5 * noise(seed, i + 50));
        regions.push({ mask: blob(at.x, at.y, 0.55, 0.55, 0.1, seed + i), material: surface(colour(PAPER[4]!), 0.3, 0, 0) });
      }
    }
  }
  return standing(size, foot, regions, 3);
}

function stump(seed: number, size = 18): Standing {
  return stumpOf(seed, 4.6 + noise(seed, 1) * 0.9, size);
}

function stumpOf(seed: number, half: number, size: number): Standing {
  const foot = middle(size);

  const regions: Region[] = [];
  for (let i = 0; i < 3; i += 1) {
    const tip = around(foot, noise(seed, i + 3) * Math.PI * 2, half * 1.25);
    regions.push({ mask: capsule(foot.x, foot.y, tip.x, tip.y, 1.05), material: { ramp: WOOD, profile: dome, relief: 1.5, ambient: 0.1, contrast: 0.8, speckle: 0.4, grit: 0.7 } });
  }
  regions.push(
    { mask: blob(foot.x, foot.y, half, half, 0.07, seed), material: { ramp: WOOD, profile: dome, relief: 1.5, ambient: 0.1, contrast: 0.8, speckle: 0.4, grit: 0.7 } },
    { mask: blob(foot.x, foot.y, half * 0.82, half * 0.82, 0.06, seed + 2), material: surface(EARTH.slice(2, 5), 0.8, 0.2, 0.3) },
    { mask: blob(foot.x, foot.y, half * 0.55, half * 0.55, 0.1, seed + 3), material: surface(colour(EARTH[4]!), 0.5, 0.15, 0.2) },
    { mask: blob(foot.x, foot.y, half * 0.25, half * 0.25, 0.1, seed + 4), material: surface(colour(EARTH[3]!), 0.4, 0.1, 0.1) },
  );
  return standing(size, foot, regions, 4);
}

function trunkOf(seed: number, half: number, size: number): Standing {
  const foot = middle(size);
  const bark: Material = { ramp: WOOD.slice(0, 3), profile: dome, relief: 2.5, ambient: 0.08, contrast: 0.9, speckle: 0.5, grit: 0.9 };
  const regions: Region[] = [];

  const flares = 4 + Math.floor(noise(seed, 1) * 2);
  for (let i = 0; i < flares; i += 1) {
    const tip = around(foot, (i / flares) * Math.PI * 2 + noise(seed, i + 3), half * 1.3);
    regions.push({ mask: capsule(foot.x, foot.y, tip.x, tip.y, 1.1), material: bark });
  }
  regions.push({ mask: blob(foot.x, foot.y, half, half, 0.12, seed), material: bark });

  for (let i = 0; i < 7; i += 1) {
    const tip = around(foot, (i / 7) * Math.PI * 2 + noise(seed, i + 20) * 0.5, half * 0.85);
    regions.push({ mask: capsule(foot.x, foot.y, tip.x, tip.y, 0.5), material: surface(colour(WOOD[0]!), 0.4, 0.2, 0.1) });
  }
  const moss = around(foot, noise(seed, 40) * Math.PI * 2, half * 0.45);
  regions.push({ mask: blob(moss.x, moss.y, half * 0.5, half * 0.4, 0.3, seed + 4), material: surface(FOLIAGE.slice(0, 2), 0.6, 0.4, 0.3) });
  return standing(size, foot, regions, 4);
}

function torchPost(seed: number, size = 9): Standing {
  const foot = middle(size);
  const regions: Region[] = [];
  const stones = 5;
  for (let i = 0; i < stones; i += 1) {
    const at = around(foot, (i / stones) * Math.PI * 2 + noise(seed, i) * 0.4, 2.6);
    regions.push({ mask: blob(at.x, at.y, 1, 0.9, 0.2, seed + i), material: { ramp: STONE, profile: dome, relief: 1, ambient: 0.08, contrast: 0.8, speckle: 0.3, grit: 0.5 } });
  }
  regions.push(
    { mask: blob(foot.x, foot.y, 1.9, 1.9, 0.1, seed + 9), material: surface(colour(CHAR[1]!), 0.5, 0.4, 0.3) },
    { mask: blob(foot.x, foot.y, 1, 1, 0.08, seed + 10), material: surface(WOOD.slice(1, 4), 0.8, 0.5, 0.3) },
  );
  return standing(size, foot, regions, 2);
}

function flame(seed: number, frame: number, size = 9): Standing {
  const foot = middle(size);
  const turn = noise(seed, frame) * Math.PI * 2;
  const regions: Region[] = [
    { mask: blob(foot.x, foot.y, 1.8 + noise(seed, frame + 3) * 0.4, 1.8 + noise(seed, frame + 5) * 0.4, 0.35, seed + frame * 17), material: surface(colour(FIRE[2]!), 0.5, 0, 0) },
    { mask: blob(foot.x, foot.y, 1.2 + noise(seed, frame + 7) * 0.3, 1.2 + noise(seed, frame + 9) * 0.3, 0.3, seed + frame * 19), material: surface(colour(FIRE[4]!), 0.5, 0, 0) },
    { mask: blob(foot.x, foot.y, 0.7, 0.7, 0.3, seed + frame * 23), material: surface(colour(FIRE[7]!), 0.5, 0, 0) },
  ];
  for (let i = 0; i < 2; i += 1) {
    const at = around(foot, turn + i * 3.1 + noise(seed, frame * 7 + i), 2.7 + noise(seed, frame * 5 + i + 20) * 0.8);
    regions.push({ mask: blob(at.x, at.y, 0.45, 0.45, 0.1, seed + i), material: surface(colour(FIRE[5]!), 0.4, 0, 0) });
  }
  return standing(size, foot, regions, 3);
}

function fallenTree(seed: number, pine: boolean, size = 36): Standing {
  const foot = middle(size);
  const length = pine ? 15 : 12;
  const radius = pine ? 1.9 : 2.7;
  const angle = noise(seed, 1) * Math.PI * 2;
  const far = around(foot, angle, length);
  const bark: Material = { ramp: WOOD, profile: dome, relief: 2, ambient: 0.1, contrast: 0.8, speckle: 0.4, grit: 0.8 };
  const plate: Material = { ramp: WOOD.slice(0, 3), profile: dome, relief: 2.5, ambient: 0.08, contrast: 0.9, speckle: 0.5, grit: 0.9 };

  const regions: Region[] = [];
  for (let i = 0; i < 4; i += 1) {
    const tip = around(foot, angle + Math.PI + (i - 1.5) * 0.7 + noise(seed, i + 3) * 0.3, radius * 2.3);
    regions.push({ mask: capsule(foot.x, foot.y, tip.x, tip.y, 1.1), material: plate });
  }
  regions.push({ mask: capsule(foot.x, foot.y, far.x, far.y, radius), material: bark });
  regions.push({ mask: blob(foot.x, foot.y, radius * 1.5, radius * 1.5, 0.15, seed), material: plate });

  const leaf = pine ? NEEDLE : FOLIAGE;
  for (let i = 0; i < 6; i += 1) {
    const along = 0.45 + noise(seed, i + 10) * 0.65;
    const at = around(foot, angle, length * along);
    const aside = around(at, angle + Math.PI / 2, (noise(seed, i + 20) - 0.5) * 6);
    regions.push({ mask: blob(aside.x, aside.y, 2.2 + noise(seed, i + 30) * 1.4, 2 + noise(seed, i + 40), 0.3, seed + i), material: { ...LEAVES, ramp: leaf, relief: 2, grit: 0.4 } });
  }
  return standing(size, foot, regions, 3);
}

function log(seed: number, size = 26): Standing {
  const foot = middle(size);
  const radius = 2.6 + noise(seed, 1) * 0.8;
  const angle = noise(seed, 2) * Math.PI;
  const from = around(foot, angle + Math.PI, 7);
  const to = around(foot, angle, 7);
  const stub = around(foot, angle + Math.PI / 2, radius + 2.2);

  const bark: Material = { ramp: WOOD, profile: dome, relief: 2, ambient: 0.1, contrast: 0.8, speckle: 0.4, grit: 0.8 };
  const regions: Region[] = [
    { mask: capsule(foot.x, foot.y, stub.x, stub.y, 1.2), material: bark },
    { mask: capsule(from.x, from.y, to.x, to.y, radius), material: bark },
    { mask: blob(to.x, to.y, radius * 0.85, radius * 0.85, 0.05, seed + 1), material: surface(EARTH.slice(2, 5), 0.6, 0.2, 0.3) },
    { mask: blob(to.x, to.y, radius * 0.4, radius * 0.4, 0.1, seed + 2), material: surface(colour(EARTH[4]!), 0.4, 0.1, 0.1) },
  ];
  return standing(size, foot, regions, radius * 1.2);
}

function cactus(seed: number, size = 18, k = 1): Standing {
  const foot = middle(size);
  const skin = surface(FOLIAGE.slice(1, 5), 3, 0.8, 0.3);
  const arms = 2 + Math.floor(noise(seed, 1) * 2);
  const turn = noise(seed, 2) * Math.PI * 2;

  const regions: Region[] = [];
  for (let i = 0; i < arms; i += 1) {
    const angle = turn + (i / arms) * Math.PI * 2 + (noise(seed, i + 6) - 0.5) * 0.7;
    const tip = around(foot, angle, (5.2 + noise(seed, i + 9) * 1.4) * k);
    regions.push({ mask: or(capsule(foot.x, foot.y, tip.x, tip.y, 1.5 * k), blob(tip.x, tip.y, 1.7 * k, 1.7 * k, 0.08, seed + i)), material: skin });
  }
  regions.push(
    { mask: blob(foot.x, foot.y, 2.7 * k, 2.7 * k, 0.06, seed), material: skin },
    { mask: blob(foot.x, foot.y, 0.9, 0.9, 0.1, seed + 1), material: surface(colour(EMBER[3]!), 0.5, 0.1, 0.1) },
  );
  return standing(size, foot, regions, 8);
}

function barrel(seed: number, size = 14): Standing {
  const foot = middle(size);
  const radius = 4 + noise(seed, 1) * 0.8;
  const ribs = 8;
  const skin = surface(FOLIAGE.slice(1, 5), 2, 0.4, 0.3);

  const regions: Region[] = [{ mask: blob(foot.x, foot.y, radius, radius, 0.04, seed), material: skin }];
  for (let i = 0; i < ribs; i += 1) {
    const tip = around(foot, (i / ribs) * Math.PI * 2, radius * 0.88);
    regions.push({ mask: capsule(foot.x, foot.y, tip.x, tip.y, 0.95), material: surface(FOLIAGE.slice(1, 5), 2, 0.3, 0.3) });
  }
  regions.push({ mask: blob(foot.x, foot.y, 1.2, 1.2, 0.1, seed + 1), material: surface(colour(FIRE[5]!), 0.5, 0.1, 0.1) });
  return standing(size, foot, regions, 5);
}

function puddle(seed: number, size = 16): Standing {
  const foot = middle(size);
  const water: Material = { ramp: [WATER[1]!, WATER[3]!], profile: flat, relief: 0, ambient: 0.4, contrast: 0.5, speckle: 0.3 };
  return standing(size, foot, [{ mask: blob(foot.x, foot.y, 5.5 + noise(seed, 1) * 1.5, 4.2, 0.25, seed), material: water }], 0.3);
}

function lichen(seed: number, size = 12): Standing {
  const foot = middle(size);
  const regions: Region[] = [FIRE[2]!, FIRE[3]!, FIRE[2]!].map((tone, i) => ({
    mask: blob(foot.x + (noise(seed, i) - 0.5) * 5, foot.y + (noise(seed, i + 5) - 0.5) * 4, 1.8 + noise(seed, i + 9), 1.5, 0.3, seed + i),
    material: surface(colour(tone), 0.4, 0.3, 0.3),
  }));
  return standing(size, foot, regions, 0.4);
}

function moss(seed: number, size = 16): Standing {
  const foot = middle(size);
  const tones = [FOLIAGE[1]!, FOLIAGE[2]!, FOLIAGE[1]!, FOLIAGE[3]!, FOLIAGE[2]!];
  const regions: Region[] = tones.map((tone, i) => ({
    mask: blob(foot.x + (noise(seed, i) - 0.5) * 7, foot.y + (noise(seed, i + 5) - 0.5) * 5, 2.4 + noise(seed, i + 9) * 1.4, 1.9 + noise(seed, i + 14), 0.35, seed + i),
    material: surface(colour(tone), 0.5, 0.35, 0.35),
  }));
  return standing(size, foot, regions, 0.5);
}

function lilyPad(seed: number, size = 16): Standing {
  const foot = middle(size);
  const radius = 4.2 + noise(seed, 1) * 1.1;
  const notch = noise(seed, 2) * Math.PI * 2;
  const cut = capsule(foot.x, foot.y, foot.x + Math.cos(notch) * radius * 1.6, foot.y + Math.sin(notch) * radius * 1.6, 0.9);
  const pad = and(blob(foot.x, foot.y, radius, radius * 0.92, 0.08, seed), not(cut));
  const regions: Region[] = [{ mask: pad, material: surface(FOLIAGE.slice(1, 4), 0.6, 0.2, 0.3) }];
  if (noise(seed, 3) > 0.45) {
    const at = around(foot, noise(seed, 4) * Math.PI * 2, radius * 0.35);
    regions.push({ mask: blob(at.x, at.y, 1.9, 1.9, 0.2, seed + 5), material: surface(colour(PAPER[4]!), 0.8, 0.1, 0.1) });
    regions.push({ mask: blob(at.x, at.y, 0.8, 0.8, 0.1, seed + 6), material: surface(colour(FIRE[5]!), 0.4, 0, 0) });
  }
  return standing(size, foot, regions, 0.3);
}

function algae(seed: number, size = 16): Standing {
  const foot = middle(size);
  const tones = [WILLOW[1]!, WILLOW[2]!, FOLIAGE[2]!, WILLOW[0]!, WILLOW[2]!, WILLOW[1]!];
  const regions: Region[] = tones.map((tone, i) => ({
    mask: blob(foot.x + (noise(seed, i) - 0.5) * 9, foot.y + (noise(seed, i + 6) - 0.5) * 7, 2.2 + noise(seed, i + 12) * 2.4, 1.6 + noise(seed, i + 18) * 1.6, 0.45, seed + i),
    material: surface(colour(tone), 0.3, 0.4, 0.4),
  }));
  return standing(size, foot, regions, 0.2);
}

function leaves(seed: number, size = 10): Standing {
  const foot = middle(size);
  const tones = [FIRE[2]!, FIRE[4]!, EARTH[3]!];
  const regions: Region[] = tones.map((tone, i) => ({
    mask: blob(foot.x + (noise(seed, i) - 0.5) * 5, foot.y + (noise(seed, i + 5) - 0.5) * 4, 1.5, 1.1, 0.3, seed + i),
    material: surface(colour(tone), 0.4, 0.2, 0.2),
  }));
  return standing(size, foot, regions, 0.4);
}

function twig(seed: number, size = 14): Standing {
  const foot = middle(size);
  const angle = noise(seed, 1) * Math.PI;
  const from = around(foot, angle + Math.PI, 4.5);
  const to = around(foot, angle, 4.5);
  const side = around(foot, angle + (noise(seed, 2) > 0.5 ? 0.7 : -0.7), 3.2);
  const mask = or(capsule(from.x, from.y, to.x, to.y, 0.6), capsule(foot.x, foot.y, side.x, side.y, 0.5));
  return standing(size, foot, [{ mask, material: surface(colour(WOOD[1]!), 0.6, 0.4, 0.3) }], 1);
}

interface Species {
  name: string;
  density: Density;
  variants: number;
  make: (seed: number) => Standing;
  traits: Traits;
  grain: readonly Grain[];
  thin?: number;
  stages?: (stage: Stage, seed: number) => Standing;
}

const MARK_SHARE = 0.3;

const patch = (salt: number, scale: number, cover: number): Grain => ({ salt, scale, cover });

const SOFT = (sway: number): Traits => ({ sway, canopy: false, bend: true });
const STILL: Traits = { sway: 0, canopy: false, bend: false };
const SHRUB: Traits = { sway: 0.6, canopy: false, bend: false, torchShadow: true };
const CASTS: Traits = { sway: 0, canopy: false, bend: false, torchShadow: true };

const MARKS: readonly Species[] = [
  { name: 'meadow.flowers.yellow', density: { meadow: 1.6 }, variants: 3, make: (s) => flower(s, FIRE[5]!), traits: SOFT(1.2), grain: [patch(1, 13, 0.22), patch(11, 8, 0.6)], stages: (stage, s) => flower(s, FIRE[5]!, 14, stage) },
  { name: 'meadow.flowers.white', density: { meadow: 1.6 }, variants: 3, make: (s) => flower(s + 7, PAPER[4]!), traits: SOFT(1.2), grain: [patch(1, 13, 0.22), patch(12, 8, 0.6)], stages: (stage, s) => flower(s + 7, PAPER[4]!, 14, stage) },
  { name: 'meadow.flowers.red', density: { meadow: 0.8 }, variants: 3, make: (s) => flower(s + 13, RED), traits: SOFT(1.2), grain: [patch(1, 13, 0.22), patch(13, 8, 0.6)], stages: (stage, s) => flower(s + 13, RED, 14, stage) },
  { name: 'meadow.flowers.blue', density: { meadow: 0.8 }, variants: 3, make: (s) => flower(s + 19, WATER[5]!), traits: SOFT(1.2), grain: [patch(1, 13, 0.22), patch(14, 8, 0.6)], stages: (stage, s) => flower(s + 19, WATER[5]!, 14, stage) },
  { name: 'meadow.clover', density: { meadow: 1.2 }, variants: 3, make: (s) => clover(s + 23), traits: SOFT(0.5), grain: [patch(2, 9, 0.3)] },
  { name: 'meadow.tuft', density: { meadow: 1.5, highland: 1.5, path: 1.5 }, variants: 3, make: (s) => tuft(s + 29, { size: 14, blades: 8, tall: 7, ramp: FOLIAGE }), traits: SOFT(1.5), grain: [patch(3, 7, 0.55)] },
  { name: 'meadow.stone', density: { meadow: 0.4, path: 0.4 }, variants: 3, make: (s) => stones(s + 31, 12, 2, STONE, 2), traits: CASTS, grain: [patch(4, 20, 0.3)] },
  { name: 'forest.fern', density: { forest: 1.4 }, variants: 3, make: (s) => fern(s + 37), traits: SOFT(1), grain: [patch(5, 11, 0.28)] },
  { name: 'forest.mushrooms.red', density: { forest: 0.4, marsh: 0.6 }, variants: 3, make: (s) => mushrooms(s + 41, RED, true), traits: STILL, grain: [patch(6, 8, 0.14)] },
  { name: 'forest.mushrooms.brown', density: { forest: 0.5, marsh: 1.1 }, variants: 3, make: (s) => mushrooms(s + 43, EARTH[3]!, false), traits: STILL, grain: [patch(7, 8, 0.14)] },
  { name: 'forest.leaves', density: { forest: 1.2 }, variants: 3, make: (s) => leaves(s + 47), traits: STILL, grain: [patch(8, 6, 0.5)] },
  { name: 'forest.stump', density: { forest: 0.15 }, variants: 3, make: (s) => stump(s + 53), traits: CASTS, grain: [patch(9, 25, 0.3)] },
  { name: 'forest.log', density: { forest: 0.12 }, variants: 3, make: (s) => log(s + 59), traits: CASTS, grain: [patch(10, 25, 0.3)] },
  { name: 'highland.rocks', density: { highland: 1, tundra: 1 }, variants: 3, make: (s) => stones(s + 61, 14, 3, STONE, 2.4), traits: CASTS, grain: [patch(15, 18, 0.3)] },
  { name: 'highland.heather', density: { highland: 0.6 }, variants: 3, make: (s) => tuft(s + 67, { size: 14, blades: 7, tall: 5, ramp: FOLIAGE, heads: colour(EMBER[3]!) }), traits: SOFT(1.2), grain: [patch(16, 10, 0.25)] },
  { name: 'highland.tussock', density: { highland: 1.2, tundra: 1.2 }, variants: 3, make: (s) => tuft(s + 71, { size: 14, blades: 11, tall: 7, ramp: FOLIAGE.slice(0, 4), spread: 0.26 }), traits: SOFT(1.6), grain: [patch(17, 8, 0.4)] },
  { name: 'marsh.reeds', density: { marsh: 1.2 }, variants: 3, make: (s) => tuft(s + 73, { size: 16, blades: 8, tall: 12, ramp: FOLIAGE.slice(1, 5), spread: 0.16, heads: colour(WOOD[2]!) }), traits: SOFT(1.8), grain: [patch(18, 8, 0.3)] },
  { name: 'marsh.puddle', density: { marsh: 0.7 }, variants: 3, make: (s) => puddle(s + 79), traits: STILL, grain: [patch(19, 14, 0.2)] },
  { name: 'swamp.moss', density: { marsh: 1.6, forest: 0.5 }, variants: 3, make: (s) => moss(s + 137), traits: STILL, grain: [patch(30, 11, 0.4)] },
  { name: 'herb.savannagrass', density: {}, variants: 3, make: (s) => tuft(s + 211, { size: 16, blades: 10, tall: 12, ramp: SCRUB, spread: 0.2 }), traits: SOFT(1.8), grain: [patch(31, 12, 0.5)] },
  { name: 'herb.steppegrass', density: {}, variants: 3, make: (s) => tuft(s + 223, { size: 14, blades: 8, tall: 5, ramp: SCRUB.slice(0, 3), spread: 0.22 }), traits: SOFT(1.4), grain: [patch(32, 10, 0.55)] },
  { name: 'herb.tussock', density: {}, variants: 3, make: (s) => tuft(s + 229, { size: 14, blades: 11, tall: 6, ramp: TUNDRA, spread: 0.26 }), traits: SOFT(1.4), grain: [patch(33, 8, 0.45)] },
  { name: 'herb.dunegrass', density: {}, variants: 3, make: (s) => tuft(s + 233, { size: 16, blades: 7, tall: 10, ramp: SCRUB.slice(1, 4), spread: 0.3 }), traits: SOFT(2), grain: [patch(34, 9, 0.4)] },
  { name: 'herb.desertgrass', density: {}, variants: 3, make: (s) => tuft(s + 239, { size: 14, blades: 6, tall: 5, ramp: WOOD.slice(1, 4), spread: 0.3 }), traits: SOFT(1.2), grain: [patch(35, 14, 0.4)] },
  { name: 'herb.junglefloor', density: {}, variants: 3, make: (s) => tuft(s + 241, { size: 16, blades: 12, tall: 9, ramp: JUNGLE, spread: 0.3 }), traits: SOFT(1.2), grain: [patch(36, 8, 0.6)] },
  { name: 'herb.woodland', density: {}, variants: 3, make: (s) => clover(s + 251), traits: SOFT(0.5), grain: [patch(37, 9, 0.5)] },
  { name: 'herb.moss', density: {}, variants: 3, make: (s) => moss(s + 257), traits: STILL, grain: [patch(38, 9, 0.5)] },
  { name: 'herb.sedge', density: {}, variants: 3, make: (s) => tuft(s + 263, { size: 14, blades: 8, tall: 9, ramp: FOLIAGE.slice(0, 4), spread: 0.18 }), traits: SOFT(1.6), grain: [patch(39, 9, 0.5)] },
  { name: 'marsh.sedge', density: { marsh: 1.4 }, variants: 3, make: (s) => tuft(s + 83, { size: 14, blades: 7, tall: 8, ramp: FOLIAGE.slice(0, 4) }), traits: SOFT(1.5), grain: [patch(20, 9, 0.35)] },
  { name: 'tundra.lichen', density: { tundra: 0.4, highland: 0.3 }, variants: 3, make: (s) => lichen(s + 89), traits: STILL, grain: [patch(21, 10, 0.3)] },
  { name: 'tundra.stone', density: { tundra: 0.6 }, variants: 3, make: (s) => stones(s + 97, 12, 2, STONE, 2.2), traits: CASTS, grain: [patch(22, 20, 0.3)] },
  { name: 'tundra.twig', density: { tundra: 0.3, marsh: 0.3 }, variants: 3, make: (s) => twig(s + 101), traits: STILL, grain: [patch(23, 14, 0.3)] },
  { name: 'desert.cactus', density: { desert: 0.25 }, variants: 3, make: (s) => cactus(s + 103), traits: { ...SOFT(0.15), torchShadow: true }, grain: [patch(24, 30, 0.6)], thin: 0.5 },
  { name: 'desert.barrel', density: { desert: 0.3 }, variants: 3, make: (s) => barrel(s + 107), traits: CASTS, grain: [patch(25, 30, 0.6)], thin: 0.5 },
  { name: 'desert.scrub', density: { desert: 0.6 }, variants: 3, make: (s) => tuft(s + 109, { size: 14, blades: 8, tall: 6, ramp: WOOD.slice(1, 4), spread: 0.24 }), traits: { ...SOFT(1.2), torchShadow: true }, grain: [patch(26, 12, 0.45)] },
  { name: 'desert.stones', density: { desert: 0.4 }, variants: 3, make: (s) => stones(s + 113, 12, 2, EARTH.slice(1, 5), 2.2), traits: CASTS, grain: [patch(27, 20, 0.4)] },
  { name: 'desert.flower', density: { desert: 0.3 }, variants: 3, make: (s) => flower(s + 127, FIRE[5]!), traits: SOFT(1), grain: [patch(28, 14, 0.2)], stages: (stage, s) => flower(s + 127, FIRE[5]!, 14, stage) },
  { name: 'aqua.reeds', density: {}, variants: 3, make: (s) => tuft(s + 139, { size: 18, blades: 9, tall: 14, ramp: FOLIAGE.slice(1, 5), spread: 0.14, heads: colour(WOOD[1]!) }), traits: SOFT(1.8), grain: [] },
  { name: 'aqua.lily', density: {}, variants: 3, make: (s) => lilyPad(s + 149), traits: STILL, grain: [] },
  { name: 'aqua.algae', density: {}, variants: 3, make: (s) => algae(s + 151), traits: STILL, grain: [] },
  { name: 'aqua.seagrass', density: {}, variants: 3, make: (s) => tuft(s + 157, { size: 16, blades: 10, tall: 9, ramp: NEEDLE.slice(1, 4), spread: 0.2 }), traits: SOFT(1.4), grain: [] },
  { name: 'aqua.kelp', density: {}, variants: 3, make: (s) => tuft(s + 163, { size: 18, blades: 8, tall: 13, ramp: [WOOD[0]!, WOOD[1]!, FOLIAGE[0]!, FOLIAGE[1]!], spread: 0.12 }), traits: SOFT(1.6), grain: [] },
  { name: 'aqua.weed', density: {}, variants: 3, make: (s) => tuft(s + 167, { size: 14, blades: 12, tall: 7, ramp: WILLOW.slice(0, 3), spread: 0.3 }), traits: SOFT(2.2), grain: [] },
  { name: 'path.pebbles', density: { path: 1 }, variants: 3, make: (s) => stones(s + 131, 10, 3, STONE, 1.4), traits: STILL, grain: [patch(29, 4, 0.5)] },
];

interface Shaped {
  name: string;
  density: Density;
  variants: number;
  make: (seed: number, scale: number) => Standing;
}

const spiny = (ramp: Ramp, radius: number, look: BushLook): Shaped['make'] => (s, k) => bush(s, radius * k, { ramp, ...look });

const BUSHES: readonly Shaped[] = [
  { name: 'bush.shrub', density: {}, variants: 2, make: (s, k) => bush(s + 601, 6 * k) },
  { name: 'bush.berry', density: {}, variants: 2, make: (s, k) => bush(s + 627, 6 * k, { berries: true }) },
  { name: 'bush.thorn', density: {}, variants: 2, make: (s, k) => spiny(SCRUB, 5, { count: 5, spread: 1.2, fringe: 1.3, twigs: 7 })(s + 641, k) },
  { name: 'bush.maquis', density: {}, variants: 2, make: (s, k) => spiny(OLIVE, 5, { count: 8, spread: 0.8, fringe: 0.5 })(s + 653, k) },
  { name: 'bush.heather', density: {}, variants: 2, make: (s, k) => spiny(HEATH, 4.5, { count: 9, spread: 1.1, fringe: 0.3, flowers: HEATH[3]! })(s + 661, k) },
  { name: 'bush.tundrashrub', density: {}, variants: 2, make: (s, k) => spiny(TUNDRA, 3.5, { count: 6, spread: 1.3, fringe: 0.8 })(s + 673, k) },
  { name: 'bush.juniper', density: {}, variants: 2, make: (s, k) => spiny(NEEDLE, 5.5, { count: 7, spread: 0.9, fringe: 0.4 })(s + 683, k) },
  { name: 'bush.grapevine', density: {}, variants: 2, make: (s, k) => vine(s + 691, 6 * k, { ramp: FOLIAGE, strands: 7, fruit: GRAPE[1]! }) },
  { name: 'bush.liana', density: {}, variants: 2, make: (s, k) => vine(s + 701, 8 * k, { ramp: JUNGLE, strands: 9 }) },
  {
    name: 'bush.treefern',
    density: {},
    variants: 2,
    make: (s, k) => fronds(11 * k, s + 711, { ramp: PALM, count: 12, from: 0.05, to: 1, width: 0.15, rise: 0.4, feather: 0.2, hub: 0.2 }),
  },
  {
    name: 'bush.banana',
    density: {},
    variants: 2,
    make: (s, k) => fronds(11 * k, s + 721, { ramp: FOLIAGE, count: 7, from: 0.05, to: 0.9, width: 0.2, rise: 0.5, feather: 0, hub: 0.12 }),
  },
  {
    name: 'bush.bamboo',
    density: {},
    variants: 2,
    make: (s, k) => fronds(9 * k, s + 731, { ramp: PALM, count: 20, from: 0.02, to: 0.8, width: 0.09, rise: 0.9, feather: 0.1, hub: 0.1 }),
  },
  { name: 'bush.cactus', density: {}, variants: 2, make: (s, k) => cactus(s + 741, Math.ceil(18 * k) + 2, k) },
  { name: 'bush.fern', density: {}, variants: 2, make: (s, k) => fern(s + 751, Math.ceil(24 * k) + 2, k) },
];

const BOULDERS: readonly Shaped[] = [
  { name: 'boulder.1', density: { highland: 0.15, meadow: 0.02 }, variants: 2, make: (s, k) => rock(s + 701, { size: Math.ceil(7 * k * 2 + 8), radius: 7 * k, ramp: STONE }) },
  { name: 'boulder.2', density: { highland: 0.12, desert: 0.04 }, variants: 2, make: (s, k) => rock(s + 719, { size: Math.ceil(5 * k * 2 + 8), radius: 5 * k, ramp: EARTH.slice(1, 6) }) },
  { name: 'boulder.lichen', density: { highland: 0.1, tundra: 0.08 }, variants: 2, make: (s, k) => rock(s + 733, { size: Math.ceil(6 * k * 2 + 8), radius: 6 * k, ramp: STONE, lichen: true }) },
  { name: 'boulder.snow', density: { tundra: 0.1 }, variants: 2, make: (s, k) => rock(s + 751, { size: Math.ceil(7 * k * 2 + 8), radius: 7 * k, ramp: STONE, snow: true }) },
];

const shaped = (species: readonly Shaped[], traits: Traits): LitProp[] =>
  species.flatMap((entry) =>
    Array.from({ length: entry.variants }, (_, variant) =>
      STOREYS.map((storey) =>
        lit(
          `${entry.name}.v${variant}.${storey.name}`,
          shared(entry.density, storey.share / entry.variants),
          entry.make(variant * 97, storey.scale),
          1,
          traits,
        ),
      ),
    ).flat(),
  );

const marks = (): LitProp[] =>
  MARKS.flatMap((species) =>
    Array.from({ length: species.variants }, (_, variant) => {
      const traits = { ...species.traits, grain: species.grain };
      const seed = variant * 97;
      return [
        lit(`${species.name}.v${variant}`, shared(species.density, (MARK_SHARE * (species.thin ?? 1)) / species.variants), species.make(seed), 1, traits),
        ...(['bud', 'seed'] as const).flatMap((stage) =>
          species.stages ? [lit(`${species.name}.${stage}.v${variant}`, {}, species.stages(stage, seed), 1, traits)] : [],
        ),
      ];
    }).flat(),
  );

const trunks = (): LitProp[] =>
  TREE_ARTS.filter((art) => art.trunk > 0).flatMap((art) =>
    STOREYS.map((storey) => {
      const reach = art.trunk * storey.scale;
      return lit(
        `trunk.${art.name}.${storey.name}`,
        {},
        trunkOf(art.name.length * 31, reach, Math.ceil(reach * 3.2 + 6)),
        1,
        STILL,
      );
    }),
  );

const everywhere: Density = { meadow: 1, forest: 1, highland: 1, marsh: 1, tundra: 1, desert: 1 };

const fallen = (): LitProp[] =>
  [false, true].flatMap((pine) =>
    Array.from({ length: 3 }, (_, variant) =>
      lit(`fallen.${pine ? 'pine' : 'oak'}.v${variant}`, shared(everywhere, 1 / 6), fallenTree(variant * 41 + (pine ? 7 : 0), pine), 1, CASTS),
    ),
  );

const FLAME: Traits = { sway: 0, canopy: false, bend: false, emit: true };

const torches = (): LitProp[] => [
  lit('torch.post', {}, torchPost(5), 1, STILL),
  ...Array.from({ length: 4 }, (_, frame) => lit(`torch.flame.${frame}`, {}, flame(11, frame), 1, FLAME)),
];

export const LIT_PLANTS: readonly LitProp[] = [
  ...shaped(BUSHES, SHRUB),
  ...shaped(BOULDERS, CASTS),
  ...marks(),
  ...trunks(),
  ...fallen(),
  ...torches(),
];

export const LIT_PROPS: readonly LitProp[] = [...LIT_TREES, ...LIT_BARE, ...LIT_PLANTS, ...LIT_FOLK];
