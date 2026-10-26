import { FISH } from '../fish/species.ts';
import type { Life } from './life.ts';
import { LIFE_COUNT, LIVES, Medium, STAGES, Stage, Taxon } from './life.ts';

export interface EdgeList {
  readonly start: Int32Array;
  readonly prey: Int16Array;
  readonly stage: Uint8Array;
  readonly weight: Float32Array;
  readonly slot: Int32Array;
  readonly coef: Float32Array;
}

export interface Diet {
  readonly flows: EdgeList;
  readonly fish: EdgeList;
  readonly forage: EdgeList;
}

const MIN_WEIGHT = 0.15;
const MAX_EDGES = 24;
const BANK_CONTACT = 0.25;
const SEA_SHORE_CONTACT = 0.1;
const EGG_WEIGHT = 0.6;
const YOUNG_PREY_MIN = 1e-6;
const YOUNG_PREY_MAX = 0.12;

const eaters: readonly number[] = [Stage.Hatchling, Stage.Juvenile, Stage.Adult];

export const flowSlot = (life: number, stage: number): number => life * 3 + (stage - 1);

const contact = (predator: number, prey: number): number => {
  if ((predator & prey) !== 0) return 1;
  const landFresh = ((predator & Medium.Land) !== 0 && (prey & Medium.Fresh) !== 0) || ((predator & Medium.Fresh) !== 0 && (prey & Medium.Land) !== 0);
  if (landFresh) return BANK_CONTACT;
  const landSea = ((predator & Medium.Land) !== 0 && (prey & Medium.Sea) !== 0) || ((predator & Medium.Sea) !== 0 && (prey & Medium.Land) !== 0);
  return landSea ? SEA_SHORE_CONTACT : 0;
};

const sizeFit = (ratio: number, min: number, max: number): number => {
  if (ratio < min || ratio > max) return 0;
  const ideal = Math.sqrt(Math.max(min, 1e-9) * max);
  const spread = Math.max(0.7, Math.log(max / Math.max(min, 1e-9)) / 3);
  const off = Math.log(ratio / ideal);
  return Math.exp(-(off * off) / (2 * spread * spread));
};

interface Pending {
  prey: number;
  stage: number;
  weight: number;
}

function pack(input: Pending[][], lives: boolean): EdgeList {
  const lists = input.map((list) => (list.length > MAX_EDGES ? [...list].sort((a, b) => b.weight - a.weight).slice(0, MAX_EDGES) : list));
  const total = lists.reduce((sum, list) => sum + list.length, 0);
  const start = new Int32Array(lists.length + 1);
  const prey = new Int16Array(total);
  const stage = new Uint8Array(total);
  const weight = new Float32Array(total);
  const slot = new Int32Array(total);
  const coef = new Float32Array(total);
  let at = 0;
  lists.forEach((list, listIndex) => {
    start[listIndex] = at;
    for (const edge of list) {
      prey[at] = edge.prey;
      stage[at] = edge.stage;
      weight[at] = edge.weight;
      slot[at] = edge.prey * STAGES + edge.stage;
      const eaten = lives ? LIVES[edge.prey] : undefined;
      coef[at] = eaten ? edge.weight * eaten.harvest[edge.stage]! * eaten.mass[edge.stage]! : 0;
      at += 1;
    }
  });
  start[lists.length] = at;
  return { start, prey, stage, weight, slot, coef };
}

function livesEaten(eats: number, realm: number, mass: number, min: number, max: number, eggEater: boolean, self: number): Pending[] {
  const out: Pending[] = [];
  for (const prey of LIVES) {
    if (prey.index === self || (eats & prey.taxon) === 0) continue;
    for (let stage: number = Stage.Hatchling; stage <= Stage.Adult; stage += 1) {
      if (stage === Stage.Juvenile && prey.stages < 4) continue;
      const size = prey.mass[stage]!;
      if (size <= 0) continue;
      const weight = sizeFit(size / mass, min, max) * contact(realm, prey.realm[stage]!);
      if (weight >= MIN_WEIGHT) out.push({ prey: prey.index, stage, weight });
    }
    if (eggEater && prey.mass[Stage.Egg]! > 0 && !prey.live && !prey.gestates) {
      const weight = EGG_WEIGHT * contact(realm, prey.realm[Stage.Egg]!);
      if (weight >= MIN_WEIGHT) out.push({ prey: prey.index, stage: Stage.Egg, weight });
    }
  }
  return out;
}

export function buildDiet(): Diet {
  const flows: Pending[][] = [];
  const fish: Pending[][] = [];
  for (let id = 0; id < LIFE_COUNT; id += 1) {
    const life = LIVES[id]!;
    for (const stage of eaters) {
      const mass = life.mass[stage]!;
      const realm = life.realm[stage]!;
      const young = stage < Stage.Adult && life.eats !== 0 && life.group !== 'insect';
      const eats = young ? life.eats | Taxon.Insect : life.eats;
      const smallest = young ? Math.min(life.preyMin, YOUNG_PREY_MIN) : life.preyMin;
      const largest = young ? Math.max(life.preyMax, YOUNG_PREY_MAX) : life.preyMax;
      flows.push(life.mass[stage]! > 0 && eats !== 0 ? livesEaten(eats, realm, mass, smallest, largest, life.eggEater, id) : []);
      const fishEdges: Pending[] = [];
      if ((life.eats & Taxon.Fish) !== 0 && mass > 0) {
        FISH.forEach((species, index) => {
          const water = species.water === 'salt' ? Medium.Sea : Medium.Fresh;
          const weight = sizeFit(species.mass / mass, life.preyMin, life.preyMax) * contact(realm, water);
          if (weight >= MIN_WEIGHT) fishEdges.push({ prey: index, stage: Stage.Adult, weight });
        });
      }
      fish.push(fishEdges);
    }
  }

  const forage: Pending[][] = FISH.map((species) => {
    const water = species.water === 'salt' ? Medium.Sea : Medium.Fresh;
    if (species.forage.eats === 0) return [];
    return livesEaten(species.forage.eats, water, species.mass, species.forage.min, species.forage.max, species.forage.eggs, -1);
  });

  return { flows: pack(flows, true), fish: pack(fish, false), forage: pack(forage, true) };
}

export const lifeAt = (id: number): Life => LIVES[id]!;
