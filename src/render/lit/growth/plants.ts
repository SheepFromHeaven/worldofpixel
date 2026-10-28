import { growPalm } from './palm.ts';
import { between, seeded } from './random.ts';
import type { Grown, Limb, Tuft } from './types.ts';
import type { Vec3 } from './vec.ts';

export type PlantKind = 'blades' | 'kelp' | 'tops' | 'flowers' | 'fern' | 'shrub' | 'cactus' | 'barrel' | 'mushrooms' | 'culms' | 'palm';

export interface PlantSpec {
  kind: PlantKind;
  height: number;
  density?: number;
  lean?: number;
  droop?: number;
  width?: number;
  head?: number;
  tufts?: number;
  spread?: number;
  wave?: number;
}

export interface Blade {
  base: Vec3;
  lean: readonly [number, number];
  height: number;
  droop: number;
  width: number;
  tip: number;
  tone: number;
  serrate: boolean;
  wave: number;
}

export interface Berry {
  at: Vec3;
  radius: number;
  tone: number;
}

export interface PlantModel {
  grown: Grown;
  blades: Blade[];
}

export type PlantRole = 'plain' | 'bud' | 'seed';

export const PLANT_SPECS: Readonly<Record<string, PlantSpec>> = {
  'meadow.tuft': { kind: 'blades', height: 0.75, density: 2.2, lean: 0.5, droop: 0.25, width: 0.9 },
  'meadow.clover': { kind: 'blades', height: 0.3, density: 1.4, lean: 0.9, droop: 0.2, width: 1.3 },
  'meadow.flowers': { kind: 'flowers', height: 0.85, head: 0.3 },
  'desert.flower': { kind: 'flowers', height: 0.8, head: 0.28 },
  'highland.tussock': { kind: 'blades', height: 0.9, density: 2.4, lean: 0.6, droop: 0.35, width: 0.9 },
  'highland.heather': { kind: 'blades', height: 0.5, density: 2, lean: 0.7, droop: 0.2, width: 1 },
  'herb.savannagrass': { kind: 'blades', height: 1.25, density: 1.6, lean: 0.4, droop: 0.2, width: 0.9 },
  'herb.steppegrass': { kind: 'blades', height: 0.8, density: 2, lean: 0.5, droop: 0.3, width: 0.9 },
  'herb.tussock': { kind: 'blades', height: 0.9, density: 2.2, lean: 0.55, droop: 0.3, width: 0.9 },
  'herb.dunegrass': { kind: 'blades', height: 1.1, density: 1.4, lean: 0.7, droop: 0.4, width: 0.9 },
  'herb.desertgrass': { kind: 'blades', height: 0.7, density: 1.8, lean: 0.5, droop: 0.25, width: 0.8 },
  'herb.junglefloor': { kind: 'blades', height: 0.9, density: 1.2, lean: 1, droop: 0.35, width: 1.8 },
  'herb.woodland': { kind: 'blades', height: 0.55, density: 1.5, lean: 0.8, droop: 0.3, width: 1.4 },
  'herb.sedge': { kind: 'blades', height: 1, density: 2, lean: 0.5, droop: 0.3, width: 0.9 },
  'marsh.sedge': { kind: 'blades', height: 1, density: 2, lean: 0.5, droop: 0.3, width: 0.9 },
  'marsh.reeds': { kind: 'blades', height: 1.9, density: 1.2, lean: 0.25, droop: 0.1, width: 1.1, head: 0.1 },
  'aqua.reeds': { kind: 'blades', height: 1.9, density: 1.2, lean: 0.25, droop: 0.1, width: 1.1, head: 0.1 },
  'aqua.seagrass': { kind: 'tops', height: 0.3, density: 0.45, lean: 0.25, width: 0.9, wave: 0.12 },
  'aqua.kelp': { kind: 'tops', height: 0.4, density: 0.2, lean: 0.35, width: 1.5, wave: 0.15, head: 1 },
  'aqua.weed': { kind: 'blades', height: 0.9, density: 1.6, lean: 0.8, droop: 0.4, width: 1, wave: 0.3 },
  'desert.scrub': { kind: 'blades', height: 0.7, density: 1.6, lean: 0.9, droop: 0.1, width: 0.9 },
  'forest.fern': { kind: 'fern', height: 0.6, density: 0.7 },
  'bush.fern': { kind: 'fern', height: 0.6, density: 0.7 },
  'forest.mushrooms': { kind: 'mushrooms', height: 0.7, head: 0.34 },
  'bush.shrub': { kind: 'shrub', height: 1, tufts: 7 },
  'bush.berry': { kind: 'shrub', height: 1, tufts: 8 },
  'bush.thorn': { kind: 'shrub', height: 0.9, tufts: 5, spread: 1.2 },
  'bush.maquis': { kind: 'shrub', height: 0.9, tufts: 6 },
  'bush.heather': { kind: 'shrub', height: 0.6, tufts: 7, spread: 1.2 },
  'bush.tundrashrub': { kind: 'shrub', height: 0.5, tufts: 6, spread: 1.3 },
  'bush.juniper': { kind: 'shrub', height: 1.1, tufts: 6, spread: 0.85 },
  'bush.grapevine': { kind: 'shrub', height: 1.2, tufts: 6, spread: 0.8 },
  'bush.liana': { kind: 'shrub', height: 1.5, tufts: 7, spread: 0.7 },
  'bush.treefern': { kind: 'palm', height: 1 },
  'bush.banana': { kind: 'palm', height: 1 },
  'bush.bamboo': { kind: 'culms', height: 2.2 },
  'bush.cactus': { kind: 'cactus', height: 1.8 },
  'desert.cactus': { kind: 'cactus', height: 1.9 },
  'desert.barrel': { kind: 'barrel', height: 0.95 },
};

export const familyOf = (name: string): string => name.split('.').slice(0, 2).join('.');

export const roleOf = (name: string): PlantRole => (name.includes('.bud.') ? 'bud' : name.includes('.seed.') ? 'seed' : 'plain');

const NO_GROWN: Grown = { limbs: [], tufts: [], ragged: 0.1, holes: 0, clump: 0, envelope: 0.3, bark: 0 };

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));

function bladeField(spec: PlantSpec, radius: number, random: () => number, count: number, spread: number): Blade[] {
  const blades: Blade[] = [];
  for (let blade = 0; blade < count; blade += 1) {
    const angle = random() * Math.PI * 2;
    const reach = Math.sqrt(random()) * radius * spread;
    const outward: readonly [number, number] = [Math.cos(angle), Math.sin(angle)];
    const centred = 1 - 0.45 * (reach / Math.max(1, radius * spread));
    const height = Math.max(2, radius * spec.height * between(random, 0.6, 1.1) * centred);
    const lean = (spec.lean ?? 0.5) * height * between(random, 0.25, 1) * (0.4 + 0.6 * (reach / Math.max(1, radius * spread)));
    const swing = between(random, -0.5, 0.5);
    blades.push({
      base: [outward[0] * reach, outward[1] * reach * 0.8, 0],
      lean: [outward[0] * lean + swing * height * 0.15, outward[1] * lean + swing * height * 0.1],
      height,
      droop: (spec.droop ?? 0.2) * between(random, 0.6, 1.3),
      width: (spec.width ?? 1) * between(random, 0.8, 1.3),
      tip: 0.5,
      tone: random(),
      serrate: false,
      wave: (spec.wave ?? 0) * height * between(random, 0.6, 1.2),
    });
  }
  return blades;
}

function growBlades(spec: PlantSpec, radius: number, random: () => number): PlantModel {
  const count = clamp(Math.round((spec.density ?? 2) * radius * 0.9), 6, 64);
  const blades = bladeField(spec, radius, random, count, 0.55);
  const tufts: Tuft[] = [];
  if (spec.head) {
    for (const blade of blades) {
      if (random() > 0.45) continue;
      const size = Math.max(1.2, radius * spec.head);
      tufts.push({ at: [blade.base[0] + blade.lean[0], blade.base[1] + blade.lean[1], blade.height * (1 - blade.droop)], across: size * 0.55, up: size * 1.5, tone: between(random, 0.2, 0.9), open: 1 });
    }
  }
  return { grown: { ...NO_GROWN, tufts }, blades };
}

function growFlowers(spec: PlantSpec, radius: number, random: () => number, role: PlantRole): PlantModel {
  const tufts: Tuft[] = [];
  const blades: Blade[] = [];
  const stems = clamp(Math.round(radius * 0.45), 2, 5);
  for (let stem = 0; stem < stems; stem += 1) {
    const angle = random() * Math.PI * 2;
    const reach = Math.sqrt(random()) * radius * 0.4;
    const base: Vec3 = [Math.cos(angle) * reach, Math.sin(angle) * reach * 0.8, 0];
    const height = Math.max(3, radius * spec.height * between(random, 0.7, 1.2));
    const lean = radius * 0.3 * random();
    const droop = role === 'seed' ? 0.12 : 0.04;
    const tip: readonly [number, number] = [Math.cos(angle) * lean, Math.sin(angle) * lean * 0.8];
    blades.push({ base, lean: tip, height, droop, width: 0.9, tip: 0.8, tone: between(random, 0.45, 0.8), serrate: false, wave: 0 });
    const size = Math.max(1.4, radius * (spec.head ?? 0.3) * (role === 'bud' ? 0.6 : role === 'seed' ? 0.5 : 1) * between(random, 0.85, 1.15));
    tufts.push({ at: [base[0] + tip[0], base[1] + tip[1], height * (1 - droop) + size * 0.2], across: size, up: size * (role === 'bud' ? 1.1 : 0.8), tone: between(random, 0.35, 0.9), open: 1 });
  }
  const leaves = bladeField({ kind: 'blades', height: 0.35, lean: 1.1, droop: 0.3, width: 1.3 }, radius, random, clamp(Math.round(radius * 0.7), 3, 8), 0.45);
  return { grown: { ...NO_GROWN, tufts }, blades: [...blades, ...leaves] };
}

function growKelp(spec: PlantSpec, radius: number, random: () => number): PlantModel {
  const blades: Blade[] = [];
  const tufts: Tuft[] = [];
  const stipes = clamp(Math.round(radius * 0.25), 2, 4);
  for (let stipe = 0; stipe < stipes; stipe += 1) {
    const angle = random() * Math.PI * 2;
    const reach = Math.sqrt(random()) * radius * 0.3;
    const base: Vec3 = [Math.cos(angle) * reach, Math.sin(angle) * reach * 0.8, 0];
    const height = Math.max(8, radius * spec.height * between(random, 0.75, 1.1));
    const lean = height * 0.14 * random();
    const droop = 0.12;
    const tip: readonly [number, number] = [Math.cos(angle) * lean, Math.sin(angle) * lean * 0.8];
    blades.push({ base, lean: tip, height, droop, width: 1.1, tip: 0.55, tone: between(random, 0.3, 0.7), serrate: false, wave: height * 0.1 });
    for (const along of [0.3, 0.45, 0.6, 0.75, 0.9]) {
      const bent = Math.pow(along, 1.7);
      const at: Vec3 = [base[0] + tip[0] * bent, base[1] + tip[1] * bent, height * (along - droop * along * along * along)];
      const side = random() < 0.5 ? -1 : 1;
      const length = radius * 0.45 * (1.1 - along * 0.5);
      blades.push({ base: at, lean: [side * length, (random() - 0.5) * length * 0.4], height: length * 0.8, droop: 0.5, width: 1.6, tip: 0.3, tone: between(random, 0.35, 0.9), serrate: true, wave: 0 });
      if (along < 0.8) tufts.push({ at: [at[0], at[1], at[2] + 0.6], across: 0.9, up: 1.2, tone: 0.85, open: 1 });
    }
  }
  return { grown: { ...NO_GROWN, tufts, ragged: 0 }, blades };
}

export const SURFACE_DEPTH = 7;

function growTops(spec: PlantSpec, radius: number, random: () => number): PlantModel {
  const blades: Blade[] = [];
  const tufts: Tuft[] = [];
  const kelp = spec.head !== undefined;
  const count = clamp(Math.round((spec.density ?? 0.4) * radius * 0.7), kelp ? 2 : 4, kelp ? 4 : 9);
  for (let blade = 0; blade < count; blade += 1) {
    const angle = random() * Math.PI * 2;
    const reach = Math.sqrt(random()) * radius * 0.3;
    const above = Math.max(2, radius * spec.height * between(random, 0.5, 1.1));
    const lean = (spec.lean ?? 0.3) * above * between(random, 0.4, 1);
    const base: Vec3 = [Math.cos(angle) * reach, Math.sin(angle) * reach * 0.8, -SURFACE_DEPTH];
    blades.push({ base, lean: [Math.cos(angle) * lean, Math.sin(angle) * lean * 0.8], height: SURFACE_DEPTH + above, droop: kelp ? 0.05 : 0.18, width: spec.width ?? 1, tip: 0.45, tone: random(), serrate: false, wave: (spec.wave ?? 0) * above * between(random, 0.6, 1.2) });
    if (kelp) {
      const surface: Vec3 = [base[0] + Math.cos(angle) * lean, base[1] + Math.sin(angle) * lean * 0.8, above * 0.8];
      for (let frond = 0; frond < 3; frond += 1) {
        const side = random() * Math.PI * 2;
        const length = radius * between(random, 0.25, 0.45);
        blades.push({ base: [surface[0], surface[1], surface[2] - 1], lean: [Math.cos(side) * length, Math.sin(side) * length * 0.8], height: 1.5, droop: 0.6, width: 1.6, tip: 0.3, tone: between(random, 0.35, 0.9), serrate: true, wave: 0 });
      }
      tufts.push({ at: [surface[0], surface[1], surface[2]], across: 1, up: 1.3, tone: 0.8, open: 1 });
    }
  }
  return { grown: { ...NO_GROWN, tufts, ragged: 0 }, blades };
}

function growFern(spec: PlantSpec, radius: number, random: () => number): PlantModel {
  const count = clamp(Math.round(radius * (spec.density ?? 0.7)), 5, 12);
  const golden = random() * Math.PI * 2;
  const blades: Blade[] = [];
  for (let frond = 0; frond < count; frond += 1) {
    const angle = golden + frond * 2.4 + (random() - 0.5) * 0.3;
    const reach = radius * 0.9 * between(random, 0.7, 1);
    const height = radius * spec.height * between(random, 0.55, 1);
    blades.push({
      base: [Math.cos(angle) * radius * 0.06, Math.sin(angle) * radius * 0.05, 0],
      lean: [Math.cos(angle) * reach, Math.sin(angle) * reach * 0.8],
      height,
      droop: between(random, 0.55, 0.85),
      width: Math.max(1.3, radius * 0.17),
      tip: 0.35,
      tone: random(),
      serrate: true,
      wave: 0,
    });
  }
  return { grown: NO_GROWN, blades };
}

function growShrub(spec: PlantSpec, radius: number, random: () => number): PlantModel {
  const limbs: Limb[] = [];
  const tufts: Tuft[] = [];
  const height = radius * spec.height;
  const count = spec.tufts ?? 6;
  const spread = spec.spread ?? 1;
  for (let tuft = 0; tuft < count; tuft += 1) {
    const level = (tuft + random() * 0.8) / count;
    const angle = random() * Math.PI * 2;
    const reach = radius * 0.5 * spread * Math.sqrt(random()) * (1 - 0.5 * level);
    const at: Vec3 = [Math.cos(angle) * reach, Math.sin(angle) * reach * 0.8, height * (0.3 + 0.6 * level)];
    const across = radius * between(random, 0.34, 0.5) * (1 - 0.3 * level) * Math.min(1, spread);
    limbs.push({ from: [0, 0, 0], to: [at[0] * 0.8, at[1] * 0.8, at[2] * 0.7], fromRadius: 1, toRadius: 0.6 });
    tufts.push({ at, across, up: across * 0.8, tone: clamp(0.25 + 0.5 * level + (random() - 0.5) * 0.3, 0, 1), open: clamp(0.4 + level, 0, 1) });
  }
  return { grown: { ...NO_GROWN, limbs, tufts, ragged: 0.22, holes: 0.04, envelope: 0.5, bark: 0.1 }, blades: [] };
}

function growCactus(spec: PlantSpec, radius: number, random: () => number): PlantModel {
  const height = radius * spec.height;
  const girth = Math.max(1.6, radius * 0.3);
  const limbs: Limb[] = [{ from: [0, 0, 0], to: [0, 0, height], fromRadius: girth, toRadius: girth * 0.85 }];
  const tufts: Tuft[] = [{ at: [0, 0, height], across: girth * 0.8, up: girth * 0.6, tone: 0.8, open: 1 }];
  const arms = random() < 0.5 ? 1 : 2;
  for (let arm = 0; arm < arms; arm += 1) {
    const side = arm === 0 ? 1 : -1;
    const out = radius * 0.55;
    const low = height * between(random, 0.3, 0.5);
    const top = low + height * between(random, 0.25, 0.4);
    const armGirth = girth * 0.7;
    limbs.push({ from: [0, 0, low], to: [side * out, 0, low], fromRadius: armGirth, toRadius: armGirth });
    limbs.push({ from: [side * out, 0, low], to: [side * out, 0, top], fromRadius: armGirth, toRadius: armGirth * 0.85 });
    tufts.push({ at: [side * out, 0, top], across: armGirth * 0.8, up: armGirth * 0.6, tone: 0.8, open: 1 });
  }
  return { grown: { ...NO_GROWN, limbs, tufts, ragged: 0, envelope: 0.6 }, blades: [] };
}

function growBarrel(spec: PlantSpec, radius: number): PlantModel {
  const height = radius * spec.height;
  const girth = radius * 0.6;
  const limbs: Limb[] = [
    { from: [0, 0, 0], to: [0, 0, height * 0.35], fromRadius: girth * 0.8, toRadius: girth },
    { from: [0, 0, height * 0.35], to: [0, 0, height * 0.7], fromRadius: girth, toRadius: girth * 0.9 },
    { from: [0, 0, height * 0.7], to: [0, 0, height], fromRadius: girth * 0.8, toRadius: girth * 0.5 },
  ];
  return { grown: { ...NO_GROWN, limbs, ragged: 0 }, blades: [] };
}

function growMushrooms(spec: PlantSpec, radius: number, random: () => number): PlantModel {
  const limbs: Limb[] = [];
  const tufts: Tuft[] = [];
  const count = clamp(Math.round(radius * 0.4), 2, 5);
  for (let one = 0; one < count; one += 1) {
    const angle = random() * Math.PI * 2;
    const reach = Math.sqrt(random()) * radius * 0.5;
    const at: Vec3 = [Math.cos(angle) * reach, Math.sin(angle) * reach * 0.8, 0];
    const size = random();
    const height = Math.max(2.5, radius * spec.height * (0.5 + 0.7 * size));
    const cap = Math.max(1.8, radius * (spec.head ?? 0.34) * (0.7 + 0.5 * size));
    const lean: Vec3 = [(random() - 0.5) * 1.2, (random() - 0.5) * 1, 0];
    limbs.push({ from: at, to: [at[0] + lean[0], at[1] + lean[1], height], fromRadius: Math.max(0.8, cap * 0.35), toRadius: Math.max(0.7, cap * 0.28) });
    tufts.push({ at: [at[0] + lean[0], at[1] + lean[1], height], across: cap, up: cap * 0.45, tone: between(random, 0.35, 0.85), open: 1 });
  }
  return { grown: { ...NO_GROWN, limbs, tufts, ragged: 0.05, envelope: 0.4 }, blades: [] };
}

function growCulms(spec: PlantSpec, radius: number, random: () => number): PlantModel {
  const limbs: Limb[] = [];
  const tufts: Tuft[] = [];
  const count = clamp(Math.round(radius * 0.5), 4, 9);
  for (let culm = 0; culm < count; culm += 1) {
    const angle = random() * Math.PI * 2;
    const reach = Math.sqrt(random()) * radius * 0.4;
    const from: Vec3 = [Math.cos(angle) * reach, Math.sin(angle) * reach * 0.8, 0];
    const height = radius * spec.height * between(random, 0.65, 1.05);
    const lean = radius * 0.25 * random();
    const to: Vec3 = [from[0] + Math.cos(angle) * lean, from[1] + Math.sin(angle) * lean * 0.8, height];
    limbs.push({ from, to, fromRadius: 1.1, toRadius: 0.7 });
    for (let leaf = 0; leaf < 3; leaf += 1) {
      const level = 0.55 + 0.15 * leaf + random() * 0.08;
      const at: Vec3 = [from[0] + (to[0] - from[0]) * level + (random() - 0.5) * radius * 0.4, from[1] + (to[1] - from[1]) * level + (random() - 0.5) * radius * 0.3, height * level];
      const across = Math.max(1.6, radius * between(random, 0.2, 0.3));
      tufts.push({ at, across, up: across * 0.6, tone: clamp(0.3 + 0.5 * level + (random() - 0.5) * 0.3, 0, 1), open: 0.9 });
    }
  }
  return { grown: { ...NO_GROWN, limbs, tufts, ragged: 0.3, holes: 0.05, envelope: 0.3 }, blades: [] };
}

export function growPlant(spec: PlantSpec, radius: number, seed: number, role: PlantRole): PlantModel {
  const random = seeded(seed);
  switch (spec.kind) {
    case 'blades':
      return growBlades(spec, radius, random);
    case 'flowers':
      return growFlowers(spec, radius, random, role);
    case 'kelp':
      return growKelp(spec, radius, random);
    case 'tops':
      return growTops(spec, radius, random);
    case 'fern':
      return growFern(spec, radius, random);
    case 'shrub':
      return growShrub(spec, radius, random);
    case 'cactus':
      return growCactus(spec, radius, random);
    case 'barrel':
      return growBarrel(spec, radius);
    case 'mushrooms':
      return growMushrooms(spec, radius, random);
    case 'culms':
      return growCulms(spec, radius, random);
    case 'palm':
      return { grown: growPalm({ radius: radius * 0.9, age: 1, seed }), blades: [] };
  }
}

export function berriesOn(tufts: readonly Tuft[], count: number, seed: number): Berry[] {
  const random = seeded(seed + 31);
  const berries: Berry[] = [];
  if (tufts.length === 0) return berries;
  for (let berry = 0; berry < count; berry += 1) {
    const tuft = tufts[Math.floor(random() * tufts.length)]!;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const azimuth = random() * Math.PI * 2;
      const rise = between(random, -0.2, 1);
      const flat = Math.sqrt(Math.max(0, 1 - rise * rise));
      const direction: Vec3 = [Math.cos(azimuth) * flat, Math.sin(azimuth) * flat, rise];
      if (direction[1] * 0.75 + direction[2] * 0.66 < 0.25) continue;
      berries.push({
        at: [tuft.at[0] + direction[0] * tuft.across * 0.9, tuft.at[1] + direction[1] * tuft.across * 0.9, tuft.at[2] + direction[2] * tuft.up * 0.9],
        radius: between(random, 0.9, 1.25),
        tone: random(),
      });
      break;
    }
  }
  return berries;
}
