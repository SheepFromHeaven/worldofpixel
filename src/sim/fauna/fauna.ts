import { trapezoid } from '../plants/niche.ts';
import { hash2 } from '../rng.ts';
import { FISH, FISH_COUNT } from '../fish/species.ts';
import type { World } from '../world.ts';
import type { Diet } from './diet.ts';
import { buildDiet, flowSlot } from './diet.ts';
import { FAUNA_YEAR_DAYS, LIFE_COUNT, LIVES, needOf, PATCH_AREA, STAGES, Stage } from './life.ts';
import type { PatchData } from './patches.ts';
import { buildPatches } from './patches.ts';

export interface FaunaWeather {
  readonly celsius: Float32Array;
  readonly snow: Float32Array;
  readonly cellOf: Int32Array;
}

export const CYCLE_DAYS = 0.004;

export interface FaunaTuning {
  hunger: number;
  efficiency: number;
  starve: number;
  crowd: number;
  plantSmall: number;
  plantLarge: number;
  insectDensity: number;
  fishScale: number;
  fishAttack: number;
  seedFill: number;
  maxStep: number;
}

export const DEFAULT_TUNING: FaunaTuning = {
  hunger: 0.5,
  efficiency: 0.3,
  starve: 3,
  crowd: 2,
  plantSmall: 450,
  plantLarge: 360,
  insectDensity: 3,
  fishScale: 25,
  fishAttack: 1,
  seedFill: 0.04,
  maxStep: 0.05,
};

export const FEED_MAX = 2;
export const FEMALE = 0.5;
export const HABITAT_LOSS = 8;
export const REFUGE = 0.03;
export const MAX_TAKE = 0.6;
export const SMALL_MASS = 0.05;
export const DISPERSAL = 0.8;
export const FISH_FORAGE_SHARE = 0.25;
export const FISH_REFUGE = 0.1;
export const NEST_NEED = 4;
export const MAX_RANGE_GAIN = 6;
export const NEST_FLOOR = 0.35;
export const NEST_GAIN = 2.5;
export const BREED_FLOOR = 0.2;
export const SWITCH = 0.12;
export const FISH_SWITCH_KG = 0.3;
export const MIGRATE_SHARP = 3;
export const MIGRATE_BOOST = 5;
export const MIGRATE_FLOOR = 0.02;
export const HERBIVORE_SEED = 1;

const S = LIFE_COUNT;
const BINS = 181;
const BIN_FLOOR = -40;
const BIN_STEP = 2;
const TINY = 1e-9;
const ACTIVE_SUIT = 0.06;
const GHOST = 1e-4;
const SNOW_FROM = 0.1;
const SNOW_TO = 0.4;
const FROM_ZERO = 0.12;

const smooth = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const binOf = (celsius: number): number => {
  const bin = Math.round((celsius - BIN_FLOOR) * BIN_STEP);
  return bin < 0 ? 0 : bin >= BINS ? BINS - 1 : bin;
};

const tableOf = (range: (id: number) => readonly [number, number, number, number]): Float32Array => {
  const table = new Float32Array(S * BINS);
  for (let id = 0; id < S; id += 1) {
    const r = range(id);
    for (let bin = 0; bin < BINS; bin += 1) table[id * BINS + bin] = trapezoid(r, bin / BIN_STEP + BIN_FLOOR);
  }
  return table;
};

const perLife = (pick: (id: number) => number): Float32Array => Float32Array.from({ length: S }, (_, id) => pick(id));

export class Fauna {
  readonly patches: PatchData;
  readonly diet: Diet;
  readonly stock: Float32Array;
  readonly fed: Float32Array;
  readonly fishBio: Float32Array;
  readonly fishTake: Float32Array;
  private readonly activeStart: Int32Array;
  private readonly active: Uint8Array;
  private readonly act: Float32Array;
  private readonly breed: Float32Array;
  private readonly tolerance: Float32Array;
  private readonly need: Float32Array;
  private readonly kgPer: Float32Array;
  private readonly plantShare: Float32Array;
  private readonly plantSmall: Uint8Array;
  private readonly rangeGain: Float32Array;
  private readonly refugeAt: Float32Array;
  private readonly switchAt: Float32Array;
  private readonly fishSwitch: Float32Array;
  private readonly density: Float32Array;
  private readonly lifespan: Float32Array;
  private readonly mature: Float32Array;
  private readonly incubation: Float32Array;
  private readonly clutch: Float32Array;
  private readonly live: Uint8Array;
  private readonly fourStages: Uint8Array;
  private readonly eggLoss: Float32Array;
  private readonly youngLoss: Float32Array;
  private readonly roam: Float32Array;
  private readonly migrant: Float32Array;
  private readonly lastVisit: Float64Array;
  readonly intakeWeight = new Float64Array(S * 3);
  readonly intakeSum = new Float64Array(S * 3);
  private readonly demand = new Float32Array(S * 3);
  private readonly rho = new Float32Array(S * 3).fill(1);
  private readonly taken = new Float32Array(S * STAGES);
  private readonly touched: number[] = [];
  private readonly flowScratch: Float32Array;
  private clock = 0;
  private debt = 0;
  private cursor = 0;
  revision = 0;

  constructor(
    world: World,
    private readonly seed: number,
    private readonly tuning: FaunaTuning = DEFAULT_TUNING,
  ) {
    const t = tuning;
    this.patches = buildPatches(world);
    this.diet = buildDiet();
    const { count, rows } = this.patches;
    this.stock = new Float32Array(count * S * STAGES);
    this.fed = new Float32Array(count * S).fill(1);
    this.fishBio = new Float32Array(count * FISH_COUNT);
    this.fishTake = new Float32Array(count * FISH_COUNT);
    this.lastVisit = new Float64Array(rows);
    this.act = tableOf((id) => LIVES[id]!.temperature);
    this.breed = tableOf((id) => LIVES[id]!.breed);
    this.tolerance = tableOf((id) => {
      const t = LIVES[id]!.temperature;
      return [t[0] - 16, t[0] - 6, t[3] + 3, t[3] + 12];
    });
    this.need = new Float32Array(S * 3);
    this.kgPer = new Float32Array(S * STAGES);
    this.plantShare = new Float32Array(S * 3);
    this.plantSmall = new Uint8Array(S * 3);
    for (let id = 0; id < S; id += 1) {
      const life = LIVES[id]!;
      for (let stage = 0; stage < STAGES; stage += 1) this.kgPer[id * STAGES + stage] = life.mass[stage]!;
      for (let stage = 1; stage < STAGES; stage += 1) {
        this.need[id * 3 + stage - 1] = needOf(life.mass[stage]!, life.group) * life.appetite * t.hunger;
        this.plantShare[id * 3 + stage - 1] = life.plant[stage - 1]!;
        this.plantSmall[id * 3 + stage - 1] = life.mass[stage]! < SMALL_MASS ? 1 : 0;
      }
    }
    this.rangeGain = perLife((id) => Math.min(MAX_RANGE_GAIN, Math.max(1, Math.sqrt(1 / (LIVES[id]!.density * PATCH_AREA)))));
    this.refugeAt = perLife((id) => REFUGE * LIVES[id]!.density * PATCH_AREA);
    this.switchAt = perLife((id) => SWITCH * LIVES[id]!.density * PATCH_AREA);
    this.fishSwitch = Float32Array.from({ length: FISH_COUNT }, (_, f) => FISH_SWITCH_KG * FISH[f]!.school * FISH[f]!.mass * t.fishScale);
    this.density = perLife((id) => LIVES[id]!.density * PATCH_AREA * (LIVES[id]!.group === 'insect' ? t.insectDensity : 1));
    this.lifespan = perLife((id) => LIVES[id]!.lifespan);
    this.mature = perLife((id) => LIVES[id]!.mature);
    this.incubation = perLife((id) => LIVES[id]!.incubation);
    this.clutch = perLife((id) => LIVES[id]!.clutch);
    this.live = Uint8Array.from({ length: S }, (_, id) => (LIVES[id]!.live ? 1 : 0));
    this.fourStages = Uint8Array.from({ length: S }, (_, id) => (LIVES[id]!.stages === 4 ? 1 : 0));
    this.eggLoss = perLife((id) => LIVES[id]!.eggLoss);
    this.youngLoss = perLife((id) => LIVES[id]!.youngLoss);
    this.roam = perLife((id) => LIVES[id]!.roam);
    this.migrant = perLife((id) => LIVES[id]!.migrant);
    let widest = 0;
    for (const list of [this.diet.flows, this.diet.fish]) for (let slot = 0; slot + 1 < list.start.length; slot += 1) widest = Math.max(widest, list.start[slot + 1]! - list.start[slot]!);
    this.flowScratch = new Float32Array(widest + 1);

    this.activeStart = new Int32Array(count + 1);
    const lists: number[] = [];
    const { suitAdult, suitYoung, suitEgg } = this.patches;
    for (let patch = 0; patch < count; patch += 1) {
      this.activeStart[patch] = lists.length;
      for (let id = 0; id < S; id += 1) {
        const at = patch * S + id;
        if (suitAdult[at]! > ACTIVE_SUIT || suitYoung[at]! > ACTIVE_SUIT || suitEgg[at]! > ACTIVE_SUIT) lists.push(id);
      }
    }
    this.activeStart[count] = lists.length;
    this.active = Uint8Array.from(lists);
  }

  capacity(patch: number, id: number): number {
    return this.patches.suitAdult[patch * S + id]! * this.density[id]!;
  }

  private supplyEstimate(patch: number, id: number): number {
    const { flows, fish } = this.diet;
    const slot = flowSlot(id, Stage.Adult);
    const base = patch * S;
    let total = 0;
    for (let e = flows.start[slot]!; e < flows.start[slot + 1]!; e += 1) {
      const q = flows.prey[e]!;
      const free = this.stock[(base + q) * STAGES + flows.stage[e]!]! - this.refugeAt[q]! * this.patches.suitAdult[base + q]!;
      if (free > 0) total += flows.coef[e]! * free;
    }
    for (let e = fish.start[slot]!; e < fish.start[slot + 1]!; e += 1) total += fish.weight[e]! * this.tuning.fishAttack * this.fishBio[patch * FISH_COUNT + fish.prey[e]!]! * this.tuning.fishScale * 0.5;
    return total * this.rangeGain[id]!;
  }

  populate(): void {
    const { count, suitAdult, plant } = this.patches;
    const order = Array.from({ length: S }, (_, id) => id).sort((a, b) => LIVES[a]!.mass[Stage.Adult]! - LIVES[b]!.mass[Stage.Adult]!);
    this.stock.fill(0);
    for (const id of order) {
      const life = LIVES[id]!;
      const eater = life.eats !== 0;
      const herbivore = life.plant[2]! > 0;
      for (let patch = 0; patch < count; patch += 1) {
        const suit = suitAdult[patch * S + id]!;
        if (suit < ACTIVE_SUIT) continue;
        if (hash2(patch, id, this.seed + 7001) > 0.35 + 0.65 * Math.min(1, suit * 3)) continue;
        const capacity = this.capacity(patch, id);
        let adults = 0.5 * capacity;
        if (eater) {
          const needed = this.need[id * 3 + 2]!;
          const fromPrey = this.supplyEstimate(patch, id);
          const fromPlants = herbivore ? plant[patch]! * (life.mass[Stage.Adult]! < SMALL_MASS ? this.tuning.plantSmall : this.tuning.plantLarge) * 0.1 : 0;
          adults = Math.min(adults, (this.tuning.seedFill * (fromPrey + fromPlants)) / Math.max(needed, 1e-9));
        } else if (herbivore && life.group !== 'insect') {
          adults = Math.min(adults, (this.tuning.seedFill * plant[patch]! * (life.mass[Stage.Adult]! < SMALL_MASS ? this.tuning.plantSmall : this.tuning.plantLarge) * HERBIVORE_SEED) / Math.max(this.need[id * 3 + 2]!, 1e-9));
        }
        adults *= 0.6 + 0.8 * hash2(patch, id, this.seed + 7002);
        const at = (patch * S + id) * STAGES;
        this.stock[at + Stage.Adult] = adults;
        if (life.stages === 4) this.stock[at + Stage.Juvenile] = adults * 0.25;
        this.stock[at + Stage.Hatchling] = adults * 0.2;
        if (!life.live) this.stock[at + Stage.Egg] = adults * 0.3;
      }
    }
  }

  update(days: number, weather: FaunaWeather): void {
    if (days <= 0) return;
    const { rows } = this.patches;
    this.clock += days;
    this.debt += (days / CYCLE_DAYS) * rows;
    let steps = Math.floor(this.debt);
    this.debt -= steps;
    if (steps > rows) steps = rows;
    for (let i = 0; i < steps; i += 1) {
      this.row(this.cursor, weather);
      this.cursor = (this.cursor + 1) % rows;
    }
    this.revision += steps;
  }

  sweep(days: number, weather: FaunaWeather, firstRow = 0, lastRow = this.patches.rows): void {
    this.clock += days;
    for (let row = firstRow; row < lastRow; row += 1) this.row(row, weather);
    this.revision += 1;
  }

  private row(row: number, weather: FaunaWeather): void {
    const { columns, rows } = this.patches;
    const elapsed = this.clock - this.lastVisit[row]!;
    this.lastVisit[row] = this.clock;
    const dt = Math.min(this.tuning.maxStep, elapsed / FAUNA_YEAR_DAYS);
    if (dt <= 0) return;
    for (let column = 0; column < columns; column += 1) this.step(row * columns + column, dt, weather);
    for (let column = 0; column < columns; column += 1) {
      const patch = row * columns + column;
      if (column + 1 < columns) this.disperse(patch, patch + 1, dt, weather);
      if (row + 1 < rows) this.disperse(patch, patch + columns, dt, weather);
    }
  }

  private step(patch: number, dt: number, weather: FaunaWeather): void {
    const { suitAdult, suitYoung, suitEgg, plant } = this.patches;
    const first = this.activeStart[patch]!;
    const last = this.activeStart[patch + 1]!;
    if (first === last) return;
    const cell = weather.cellOf[patch]!;
    const thaw = 1 - smooth(SNOW_FROM, SNOW_TO, weather.snow[cell]!);
    const bin = binOf(weather.celsius[cell]!);
    const { stock, demand, rho, need, act: actTable, diet, kgPer, plantShare, plantSmall, flowScratch, refugeAt, taken, touched } = this;
    const base = patch * S;
    const { flows, fish } = diet;
    const fishBase = patch * FISH_COUNT;

    let poolDemand0 = 0;
    let poolDemand1 = 0;
    for (let k = first; k < last; k += 1) {
      const id = this.active[k]!;
      const si = (base + id) * STAGES;
      const act = actTable[id * BINS + bin]! * thaw;
      const tf = FROM_ZERO + (1 - FROM_ZERO) * act;
      for (let s = 0; s < 3; s += 1) {
        const d = stock[si + 1 + s]! * need[id * 3 + s]! * tf;
        demand[id * 3 + s] = d;
        const share = plantShare[id * 3 + s]!;
        if (share > 0 && d > 0) {
          if (plantSmall[id * 3 + s] === 1) poolDemand0 += d * share;
          else poolDemand1 += d * share;
        }
      }
    }
    const flow0 = plant[patch]! * this.tuning.plantSmall;
    const flow1 = plant[patch]! * this.tuning.plantLarge;

    for (let k = first; k < last; k += 1) {
      const id = this.active[k]!;
      const act = actTable[id * BINS + bin]! * thaw;
      for (let s = 0; s < 3; s += 1) {
        const dem = demand[id * 3 + s]!;
        if (dem <= TINY) {
          rho[id * 3 + s] = 1;
          continue;
        }
        const slot = flowSlot(id, s + 1);
        const from = flows.start[slot]!;
        const to = flows.start[slot + 1]!;
        let preyFlow = 0;
        for (let e = from; e < to; e += 1) {
          const q = flows.prey[e]!;
          const n = stock[(base + q) * STAGES + flows.stage[e]!]!;
          const suit = suitAdult[base + q]!;
          const free = n - refugeAt[q]! * suit;
          if (free <= 0) {
            flowScratch[e - from] = 0;
            continue;
          }
          const flow = (flows.coef[e]! * free * free) / (free + this.switchAt[q]! * suit);
          flowScratch[e - from] = flow;
          preyFlow += flow;
        }
        let fishFlow = 0;
        const fishFrom = fish.start[slot]!;
        const fishTo = fish.start[slot + 1]!;
        for (let e = fishFrom; e < fishTo; e += 1) {
          const bio = this.fishBio[fishBase + fish.prey[e]!]! * this.tuning.fishScale;
          fishFlow += (fish.weight[e]! * bio * bio) / (bio + this.fishSwitch[fish.prey[e]!]!);
        }
        fishFlow *= this.tuning.fishAttack * (1 - FISH_REFUGE);
        let plantFlow = 0;
        const share = plantShare[id * 3 + s]!;
        if (share > 0) {
          const small = plantSmall[id * 3 + s] === 1;
          const pool = small ? poolDemand0 : poolDemand1;
          if (pool > TINY) plantFlow = (small ? flow0 : flow1) * ((dem * share) / pool) * share;
        }
        const supply = act * ((preyFlow + fishFlow) * this.rangeGain[id]! + plantFlow);
        const ratio = FEED_MAX * (supply / (supply + dem + TINY));
        rho[id * 3 + s] = ratio;
        const weight = stock[(base + id) * STAGES + 1 + s]!;
        this.intakeWeight[id * 3 + s] = this.intakeWeight[id * 3 + s]! + weight;
        this.intakeSum[id * 3 + s] = this.intakeSum[id * 3 + s]! + weight * ratio;
        if (supply <= TINY) continue;
        const huntShare = (ratio * dem * act) / supply;
        if (preyFlow > 0) {
          for (let e = from; e < to; e += 1) {
            const flow = flowScratch[e - from]!;
            if (flow <= 0) continue;
            const slotAt = flows.slot[e]!;
            if (taken[slotAt] === 0) touched.push(slotAt);
            taken[slotAt] = taken[slotAt]! + flow * huntShare;
          }
        }
        if (fishFlow > 0) {
          const scale = this.tuning.fishAttack * (1 - FISH_REFUGE) * huntShare * dt;
          for (let e = fishFrom; e < fishTo; e += 1) {
            const where = fishBase + fish.prey[e]!;
            const bio = this.fishBio[where]! * this.tuning.fishScale;
            if (bio > 0) this.fishTake[where] = this.fishTake[where]! + (fish.weight[e]! * bio * bio * scale) / (bio + this.fishSwitch[fish.prey[e]!]!) / this.tuning.fishScale;
          }
        }
      }
    }

    for (let t = 0; t < touched.length; t += 1) {
      const slotAt = touched[t]!;
      const q = (slotAt / STAGES) | 0;
      const at = (base + q) * STAGES + (slotAt % STAGES);
      const n = stock[at]!;
      const removed = Math.min(MAX_TAKE * n, (taken[slotAt]! * dt) / kgPer[slotAt]!);
      stock[at] = n - removed;
      taken[slotAt] = 0;
    }
    touched.length = 0;

    for (let k = first; k < last; k += 1) {
      const id = this.active[k]!;
      const si = (base + id) * STAGES;
      const e0 = stock[si + Stage.Egg]!;
      const h0 = stock[si + Stage.Hatchling]!;
      const j0 = stock[si + Stage.Juvenile]!;
      const a0 = stock[si + Stage.Adult]!;
      if (e0 + h0 + j0 + a0 <= TINY) continue;
      const act = actTable[id * BINS + bin]! * thaw;
      const cold = 2 * (1 - this.tolerance[id * BINS + bin]!);
      const sAdult = suitAdult[base + id]!;
      const sYoung = suitYoung[base + id]!;
      const sEgg = suitEgg[base + id]!;
      const rhoH = rho[id * 3]!;
      const rhoJ = rho[id * 3 + 1]!;
      const rhoA = rho[id * 3 + 2]!;
      this.fed[base + id] = this.fed[base + id]! + (rhoA - this.fed[base + id]!) * Math.min(1, dt * 6);

      const kn = sAdult * this.density[id]!;
      const crowd = (a0 + 0.6 * j0 + 0.3 * h0) / Math.max(kn, 1e-6);
      const crowding = this.tuning.crowd * Math.min(6, Math.max(0, crowd - 1));
      const starveA = (this.tuning.starve * Math.max(0, 0.9 - rhoA)) / 0.9;
      const starveJ = (this.tuning.starve * 1.4 * Math.max(0, 0.9 - rhoJ)) / 0.9;
      const starveH = (this.tuning.starve * 1.6 * Math.max(0, 0.9 - rhoH)) / 0.9;
      const lossAdult = HABITAT_LOSS * (1 - Math.min(1, 5 * sAdult));
      const lossYoung = HABITAT_LOSS * (1 - Math.min(1, 5 * sYoung));
      const lossEgg = 6 * (1 - Math.min(1, NEST_NEED * sEgg));

      const dem = demand[id * 3 + 2]!;
      const surplus = Math.max(0, rhoA - 1) * dem;
      const live = this.live[id] === 1;
      const perOffspring = live ? kgPer[id * STAGES + Stage.Hatchling]! : kgPer[id * STAGES + Stage.Egg]!;
      const window = (BREED_FLOOR + (1 - BREED_FLOOR) * this.breed[id * BINS + bin]!) * thaw;
      const nest = sEgg > 0.01 ? Math.min(1, NEST_FLOOR + NEST_GAIN * sEgg) : 0;
      const capacity = this.clutch[id]! * a0 * FEMALE * window * nest;
      const births = Math.min((this.tuning.efficiency * surplus) / perOffspring, capacity);

      const develop = Math.sqrt(act);
      const hatchRate = live ? 0 : develop / this.incubation[id]!;
      const four = this.fourStages[id] === 1;
      const durationH = four ? 0.35 * this.mature[id]! : this.mature[id]!;
      const durationJ = 0.65 * this.mature[id]!;
      const growH = (develop * Math.min(1.3, Math.max(0.1, rhoH))) / durationH;
      const growJ = (develop * Math.min(1.3, Math.max(0.1, rhoJ))) / durationJ;
      const young = this.youngLoss[id]!;

      const e1 = (e0 + (live ? 0 : dt * births)) / (1 + dt * (hatchRate + this.eggLoss[id]! + lossEgg + 0.3 * cold));
      const hatched = dt * hatchRate * e1;
      const h1 = (h0 + hatched + (live ? dt * births : 0)) / (1 + dt * (growH + young + starveH + lossYoung + 0.5 * crowding + cold));
      const grownH = dt * growH * h1;
      let j1 = 0;
      let grownJ = grownH;
      if (four) {
        j1 = (j0 + grownH) / (1 + dt * (growJ + young * 0.5 + starveJ + lossAdult + 0.7 * crowding + cold));
        grownJ = dt * growJ * j1;
      }
      const a1 = (a0 + grownJ) / (1 + dt * (1 / this.lifespan[id]! + starveA + lossAdult + crowding + cold));
      const ghost = GHOST * Math.max(kn, 1e-3);
      stock[si + Stage.Egg] = e1 < ghost ? 0 : e1;
      stock[si + Stage.Hatchling] = h1 < ghost ? 0 : h1;
      stock[si + Stage.Juvenile] = j1 < ghost ? 0 : j1;
      stock[si + Stage.Adult] = a1 < ghost ? 0 : a1;
    }
  }

  private disperse(from: number, to: number, dt: number, weather: FaunaWeather): void {
    const { suitAdult } = this.patches;
    const { stock } = this;
    const binFrom = binOf(weather.celsius[weather.cellOf[from]!]!);
    const binTo = binOf(weather.celsius[weather.cellOf[to]!]!);
    for (let pass = 0; pass < 2; pass += 1) {
      const a = pass === 0 ? from : to;
      const b = pass === 0 ? to : from;
      for (let k = this.activeStart[a]!; k < this.activeStart[a + 1]!; k += 1) {
        const id = this.active[k]!;
        if (pass === 1 && this.activeHas(from, id)) continue;
        const at = a * S + id;
        const other = b * S + id;
        if (stock[at * STAGES + Stage.Adult]! + stock[other * STAGES + Stage.Adult]! + stock[at * STAGES + Stage.Juvenile]! + stock[other * STAGES + Stage.Juvenile]! <= TINY) continue;
        let attractA = suitAdult[at]! * Math.min(1.5, Math.max(0.3, this.fed[at]!));
        let attractB = suitAdult[other]! * Math.min(1.5, Math.max(0.3, this.fed[other]!));
        let rate = this.roam[id]! * DISPERSAL * dt;
        const strength = this.migrant[id]!;
        if (strength > 0) {
          const binA = a === from ? binFrom : binTo;
          const binB = a === from ? binTo : binFrom;
          const comfortA = this.act[id * BINS + binA]!;
          const comfortB = this.act[id * BINS + binB]!;
          attractA *= 1 - strength + strength * (MIGRATE_FLOOR + comfortA) ** MIGRATE_SHARP;
          attractB *= 1 - strength + strength * (MIGRATE_FLOOR + comfortB) ** MIGRATE_SHARP;
          rate *= 1 + MIGRATE_BOOST * strength * Math.abs(comfortA - comfortB);
        }
        const total = attractA + attractB;
        if (total <= 1e-6) continue;
        for (let stage = Stage.Juvenile; stage <= Stage.Adult; stage += 1) {
          const sa = at * STAGES + stage;
          const sb = other * STAGES + stage;
          const na = stock[sa]!;
          const nb = stock[sb]!;
          if (na + nb <= TINY) continue;
          const flux = (rate * (stage === Stage.Juvenile ? 0.4 : 1) * (na * attractB - nb * attractA)) / total;
          const limited = flux > 0 ? Math.min(flux, 0.5 * na) : Math.max(flux, -0.5 * nb);
          stock[sa] = na - limited;
          stock[sb] = nb + limited;
        }
      }
    }
  }

  private activeHas(patch: number, id: number): boolean {
    for (let k = this.activeStart[patch]!; k < this.activeStart[patch + 1]!; k += 1) if (this.active[k] === id) return true;
    return false;
  }

  forage(patch: number, fishId: number, wantKg: number): number {
    const { forage } = this.diet;
    let eaten = 0;
    for (let e = forage.start[fishId]!; e < forage.start[fishId + 1]! && eaten < wantKg; e += 1) {
      const q = forage.prey[e]!;
      const at = (patch * S + q) * STAGES + forage.stage[e]!;
      const n = this.stock[at]!;
      const free = n - REFUGE * this.capacity(patch, q);
      if (free <= 0) continue;
      const kg = this.kgPer[q * STAGES + forage.stage[e]!]!;
      const take = Math.min(wantKg - eaten, free * kg * forage.weight[e]! * FISH_FORAGE_SHARE);
      this.stock[at] = n - take / kg;
      eaten += take;
    }
    return eaten;
  }

  totals(stage: number = Stage.Adult, firstPatch = 0, lastPatch = this.patches.count): Float64Array {
    const out = new Float64Array(S);
    for (let patch = firstPatch; patch < lastPatch; patch += 1) for (let id = 0; id < S; id += 1) out[id] = out[id]! + this.stock[(patch * S + id) * STAGES + stage]!;
    return out;
  }

  inspect(patch: number, id: number): { demand: number; prey: { key: string; stage: number; stock: number; flow: number }[]; fish: { key: string; bio: number; flow: number }[] } {
    const { flows, fish } = this.diet;
    const slot = flowSlot(id, Stage.Adult);
    const base = patch * S;
    const prey: { key: string; stage: number; stock: number; flow: number }[] = [];
    for (let e = flows.start[slot]!; e < flows.start[slot + 1]!; e += 1) {
      const q = flows.prey[e]!;
      const n = this.stock[(base + q) * STAGES + flows.stage[e]!]!;
      const suit = this.patches.suitAdult[base + q]!;
      const free = n - this.refugeAt[q]! * suit;
      const flow = free > 0 ? (flows.coef[e]! * free * free) / (free + this.switchAt[q]! * suit) : 0;
      prey.push({ key: LIVES[q]!.key, stage: flows.stage[e]!, stock: n, flow });
    }
    const fishList: { key: string; bio: number; flow: number }[] = [];
    for (let e = fish.start[slot]!; e < fish.start[slot + 1]!; e += 1) {
      const bio = this.fishBio[patch * FISH_COUNT + fish.prey[e]!]! * this.tuning.fishScale;
      fishList.push({ key: FISH[fish.prey[e]!]!.key, bio, flow: (fish.weight[e]! * bio * bio) / (bio + this.fishSwitch[fish.prey[e]!]!) });
    }
    return { demand: this.need[id * 3 + 2]!, prey, fish: fishList };
  }

  stockOf(patch: number, id: number, stage: number): number {
    return this.stock[(patch * S + id) * STAGES + stage]!;
  }

  presence(id: number, stage: number = Stage.Adult, above = 0.01, firstPatch = 0, lastPatch = this.patches.count): number {
    let patches = 0;
    for (let patch = firstPatch; patch < lastPatch; patch += 1) if (this.stock[(patch * S + id) * STAGES + stage]! > above) patches += 1;
    return patches;
  }
}
