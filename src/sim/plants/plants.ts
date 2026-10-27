import { Cover } from '../covers.ts';
import { rainScore } from '../eco.ts';
import { CLIFF_BARREN, CLIFF_SEED_LOSS, STEEP_ONE } from '../steep.ts';
import { FERTILITY_ONE } from '../terrain/surface.ts';
import type { TileIndex } from '../grid.ts';
import { hash2 } from '../rng.ts';
import { bandStep, latitudeAt, latitudesOf } from '../terrain/climate.ts';
import { Biome } from '../types.ts';
import type { World } from '../world.ts';
import type { PlantColumns, PlantEnvironment } from './generate.ts';
import { formOf } from './generate.ts';
import {
  backgroundHazard,
  DAYS_PER_YEAR,
  decodeHeight,
  encodeHeight,
  growthRate,
  grown,
  lightResponse,
  sizeShare,
  stageOfPlant,
} from './growth.ts';
import { fitness } from './niche.ts';
import type { Species } from './species.ts';
import { SNAG, SPECIES } from './species.ts';

export type FruitLayer = 'canopy' | 'under';

export const SWEEP_DAYS = 2;

export const GROWTH_SPEED = 100;

const UNWANTED = 0.08;

const UNWANTED_GROUND = 0.3;

const MAX_TILES_PER_CALL = 1 << 17;

const SHADE_K = 0.35;

const WATER_CAPACITY = 7;

const WATER_CURVE = 1.3;

const THIRST_FLOOR = 0.5;

const BLOCKED_WEAR = 32;

const EDGE = 3;

const INFANT_HAZARD = 0.8;

const INFANT_YEARS = 1.5;

const STARVED_BELOW = 0.25;

const STARVED_HAZARD = 0.5;

const DARK_HAZARD = 0.6;

const DROUGHT_BELOW = 0.6;

const DROUGHT_HAZARD = 0.5;

const SNAG_YEARS = 12;

const SNAG_CHANCE = 0.4;

const TALL_ENOUGH_TO_FALL = 3;

const ROT_HALF_LIFE_YEARS = 8;

const RIPENING = 0.25;

const ROTTING = 0.15;

const HERB_SPREAD_PER_YEAR = 6;

const HERB_STARVED_HAZARD = 1;

const GUST = 0.9;

const HEIGHT_METRES = new Float32Array(256).map((_, byte) => decodeHeight(byte));

const CROWN = new Float32Array(SPECIES.length + 1);
const HEIGHT_MAX = new Float32Array(SPECIES.length + 1);
const THIRST = new Float32Array(SPECIES.length + 1);
const RATE = new Float32Array(SPECIES.length + 1);
const MATURE_DAYS = new Float32Array(SPECIES.length + 1);
SPECIES.forEach((species, index) => {
  CROWN[index + 1] = species.crown;
  HEIGHT_MAX[index + 1] = species.height;
  THIRST[index + 1] = species.thirst;
  RATE[index + 1] = growthRate(species);
  MATURE_DAYS[index + 1] = species.matureAge * DAYS_PER_YEAR;
});

const SHADE_WEIGHTS: readonly (readonly [number, number, number])[] = (() => {
  const out: [number, number, number][] = [];
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const far = dx * dx + dy * dy;
      out.push([dx, dy, far === 1 ? 0.55 : far === 2 ? 0.4 : far === 4 ? 0.2 : far === 5 ? 0.14 : 0.08]);
    }
  }
  return out;
})();

const SOIL_FLOOR = 0.25;

export class Plants {
  readonly canopy: Uint8Array;
  readonly canopyAge: Uint16Array;
  readonly canopyHeight: Uint8Array;
  readonly under: Uint8Array;
  readonly underAge: Uint16Array;
  readonly underHeight: Uint8Array;
  readonly herb: Uint8Array;
  readonly canopyTaken: Uint8Array;
  readonly underTaken: Uint8Array;

  readonly disturbed = new Set<TileIndex>();
  phase = 0;
  sweepTarget = SWEEP_DAYS;

  private cursor = 0;
  private owed = 0;
  private sweeps = 0;
  private sweepClock = 0;
  private sweepDays = SWEEP_DAYS * GROWTH_SPEED;
  private readonly south: Uint8Array;
  private readonly westward: Uint8Array;
  private readonly offsets: Int32Array;

  constructor(
    private readonly world: World,
    columns: PlantColumns,
    private readonly environment: PlantEnvironment | null,
  ) {
    this.canopy = columns.canopy;
    this.canopyAge = columns.canopyAge;
    this.canopyHeight = columns.canopyHeight;
    this.under = columns.under;
    this.underAge = columns.underAge;
    this.underHeight = columns.underHeight;
    this.herb = columns.herb;
    this.canopyTaken = columns.canopyTaken;
    this.underTaken = columns.underTaken;

    const { grid } = world;
    this.offsets = Int32Array.from(SHADE_WEIGHTS, ([dx, dy]) => dy * grid.columns + dx);
    this.south = new Uint8Array(grid.rows);
    this.westward = new Uint8Array(grid.rows);
    const latitudes = latitudesOf(world.seed);
    for (let row = 0; row < grid.rows; row += 1) {
      const degrees = latitudeAt(latitudes, grid.y(row));
      this.south[row] = degrees < 0 ? 1 : 0;
      this.westward[row] = bandStep(degrees) < 0 ? 1 : 0;
    }
  }

  get dynamic(): boolean {
    return this.environment !== null;
  }

  columns(): PlantColumns {
    return {
      canopy: this.canopy,
      canopyAge: this.canopyAge,
      canopyHeight: this.canopyHeight,
      under: this.under,
      underAge: this.underAge,
      underHeight: this.underHeight,
      herb: this.herb,
      canopyTaken: this.canopyTaken,
      underTaken: this.underTaken,
    };
  }

  heightOf(tile: TileIndex, layer: FruitLayer): number {
    return HEIGHT_METRES[layer === 'canopy' ? this.canopyHeight[tile]! : this.underHeight[tile]!]!;
  }

  speciesAt(tile: TileIndex, layer: 'canopy' | 'under' | 'herb'): Species | null {
    const id = layer === 'canopy' ? this.canopy[tile]! : layer === 'under' ? this.under[tile]! : this.herb[tile]!;
    return id === 0 ? null : SPECIES[id - 1]!;
  }

  ageYearsAt(tile: TileIndex, layer: FruitLayer): number {
    return (layer === 'canopy' ? this.canopyAge[tile]! : this.underAge[tile]!) / DAYS_PER_YEAR;
  }

  syncCover(tile: TileIndex): boolean {
    const { world } = this;
    const current = world.cover[tile]!;
    if (current === Cover.Boulder) return false;
    const form = formOf(this.canopy[tile]!, this.canopyHeight[tile]!, this.under[tile]!, this.underHeight[tile]!, this.herb[tile]!, (byte) => HEIGHT_METRES[byte]!);
    const next = form ?? (current === Cover.Fallen ? Cover.Fallen : Cover.Bare);
    if (next === current) return false;
    world.cover[tile] = next;
    return true;
  }

  private release(tile: TileIndex): void {
    this.disturbed.add(tile);
    this.world.touch(tile);
  }

  fell(tile: TileIndex): boolean {
    if (this.canopy[tile] === 0) return false;
    this.canopy[tile] = 0;
    this.canopyAge[tile] = 0;
    this.canopyHeight[tile] = 0;
    this.canopyTaken[tile] = 0;
    this.world.cover[tile] = Cover.Fallen;
    this.release(tile);
    return true;
  }

  clearAll(tile: TileIndex): void {
    this.canopy[tile] = 0;
    this.canopyAge[tile] = 0;
    this.canopyHeight[tile] = 0;
    this.canopyTaken[tile] = 0;
    this.under[tile] = 0;
    this.underAge[tile] = 0;
    this.underHeight[tile] = 0;
    this.underTaken[tile] = 0;
    this.herb[tile] = 0;
    if (this.world.cover[tile] !== Cover.Boulder) this.world.cover[tile] = Cover.Bare;
    this.release(tile);
  }

  trample(tile: TileIndex): boolean {
    if (this.under[tile] === 0 && this.herb[tile] === 0) return false;
    this.under[tile] = 0;
    this.underAge[tile] = 0;
    this.underHeight[tile] = 0;
    this.underTaken[tile] = 0;
    this.herb[tile] = 0;
    this.syncCover(tile);
    this.release(tile);
    return true;
  }

  localPhase(tile: TileIndex): number {
    const row = this.world.grid.rowOf(tile);
    return this.south[row] === 1 ? (this.phase + 0.5) % 1 : this.phase;
  }

  ripeness(species: Species, phase: number): number {
    const fruit = species.fruit;
    if (!fruit || phase < fruit.from || phase > fruit.to) return 0;
    const progress = (phase - fruit.from) / (fruit.to - fruit.from);
    if (progress < RIPENING) return progress / RIPENING;
    if (progress > 1 - ROTTING) return (1 - progress) / ROTTING;
    return 1;
  }

  fruitKcal(tile: TileIndex, layer: FruitLayer): number {
    const id = layer === 'canopy' ? this.canopy[tile]! : this.under[tile]!;
    if (id === 0) return 0;
    const species = SPECIES[id - 1]!;
    if (!species.fruit) return 0;
    const age = layer === 'canopy' ? this.canopyAge[tile]! : this.underAge[tile]!;
    if (age < MATURE_DAYS[id]!) return 0;
    const metres = HEIGHT_METRES[layer === 'canopy' ? this.canopyHeight[tile]! : this.underHeight[tile]!]!;
    const crop = species.fruit.kcal * sizeShare(species, metres) ** 2;
    const taken = (layer === 'canopy' ? this.canopyTaken[tile]! : this.underTaken[tile]!) / 255;
    return Math.max(0, crop * (this.ripeness(species, this.localPhase(tile)) - taken));
  }

  pick(tile: TileIndex, layer: FruitLayer, kcal: number): number {
    const available = this.fruitKcal(tile, layer);
    const eaten = Math.min(available, kcal);
    if (eaten <= 0) return 0;
    const id = layer === 'canopy' ? this.canopy[tile]! : this.under[tile]!;
    const species = SPECIES[id - 1]!;
    const metres = HEIGHT_METRES[layer === 'canopy' ? this.canopyHeight[tile]! : this.underHeight[tile]!]!;
    const crop = species.fruit!.kcal * sizeShare(species, metres) ** 2;
    const share = Math.ceil((eaten / crop) * 255);
    const taken = layer === 'canopy' ? this.canopyTaken : this.underTaken;
    taken[tile] = Math.min(255, taken[tile]! + share);
    this.release(tile);
    return eaten;
  }

  advance(days: number, phase: number): void {
    if (!this.environment) return;
    this.phase = phase;
    const { count } = this.world;
    this.sweepClock += days;
    this.owed += (days / this.sweepTarget) * count;
    const budget = Math.min(Math.floor(this.owed), MAX_TILES_PER_CALL);
    if (budget <= 0) return;
    this.owed = Math.min(this.owed - budget, MAX_TILES_PER_CALL);

    const end = Math.min(count, this.cursor + budget);
    for (let tile = this.cursor; tile < end; tile += 1) this.visit(tile);

    if (end >= count) {
      this.cursor = 0;
      this.sweeps += 1;
      this.sweepDays = Math.max(this.sweepTarget * 0.5, this.sweepClock) * GROWTH_SPEED;
      this.sweepClock = 0;
    } else {
      this.cursor = end;
    }
  }

  private roll(tile: TileIndex, use: number): number {
    return hash2(tile, this.sweeps * 16 + use, this.world.seed + 4049);
  }

  private light(tile: TileIndex, metres: number, ownCanopy: boolean): number {
    let shade = 0;
    const { canopy, canopyHeight, offsets } = this;
    for (let k = 0; k < offsets.length; k += 1) {
      const near = tile + offsets[k]!;
      const id = canopy[near]!;
      if (id === 0) continue;
      const height = HEIGHT_METRES[canopyHeight[near]!]!;
      if (height <= metres) continue;
      shade += CROWN[id]! * Math.min(1, height / HEIGHT_MAX[id]!) * SHADE_WEIGHTS[k]![2];
    }
    if (ownCanopy) {
      const id = canopy[tile]!;
      if (id !== 0) {
        const height = HEIGHT_METRES[canopyHeight[tile]!]!;
        if (height > metres) shade += CROWN[id]! * Math.min(1, height / HEIGHT_MAX[id]!);
      }
    }
    return Math.exp(-SHADE_K * shade);
  }

  private demand(tile: TileIndex): number {
    const { canopy, canopyHeight, under, underHeight } = this;
    const columns = this.world.grid.columns;
    let total = 0;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const near = tile + dy * columns + dx;
        const tall = canopy[near]!;
        if (tall !== 0) total += (THIRST_FLOOR + (1 - THIRST_FLOOR) * THIRST[tall]!) * Math.sqrt(Math.min(1, HEIGHT_METRES[canopyHeight[near]!]! / HEIGHT_MAX[tall]!));
        const low = under[near]!;
        if (low !== 0) total += 0.5 * (THIRST_FLOOR + (1 - THIRST_FLOOR) * THIRST[low]!) * Math.sqrt(Math.min(1, HEIGHT_METRES[underHeight[near]!]! / HEIGHT_MAX[low]!));
      }
    }
    return total;
  }

  private visit(tile: TileIndex): void {
    const { world, environment } = this;
    const biome = world.biome[tile]!;
    if (biome >= Biome.Ocean || world.river[tile] === 1) return;
    const cover = world.cover[tile]!;
    if (cover === Cover.Boulder) return;

    const { grid } = world;
    const column = tile % grid.columns;
    const row = (tile - column) / grid.columns;
    if (column < EDGE || row < EDGE || column >= grid.columns - EDGE || row >= grid.rows - EDGE) return;
    if (world.wear[tile]! >= BLOCKED_WEAR || world.hasStructure(tile)) return;

    const years = this.sweepDays / DAYS_PER_YEAR;
    let changed = false;

    if (cover === Cover.Fallen && this.canopy[tile] === 0) {
      if (this.roll(tile, 0) < 1 - Math.exp((-Math.LN2 / ROT_HALF_LIFE_YEARS) * years)) {
        world.cover[tile] = Cover.Bare;
        changed = true;
      }
    }

    const celsius = world.field.temperature[tile]!;
    const rain = world.field.wet[tile]!;
    const damp = world.damp[tile]! / 255;
    const altitude = environment!.altitude[tile]! / 255;
    const salt = environment!.salt[tile]! / 255;
    const supply = Math.max(rainScore(rain), damp * 0.95);

    if (this.canopy[tile] !== 0) changed = this.tickCanopy(tile, row, years, celsius, rain, damp, altitude, salt, supply) || changed;
    if (this.under[tile] !== 0) changed = this.tickUnder(tile, row, years, celsius, rain, damp, altitude, salt, supply) || changed;
    if (this.herb[tile] !== 0) changed = this.tickHerb(tile, years, celsius, rain, damp, altitude, salt) || changed;
    else if (this.canopy[tile] === 0 || this.under[tile] === 0) changed = this.spreadHerb(tile, years, celsius, rain, damp, altitude, salt) || changed;

    if (this.syncCover(tile) || changed) world.touch(tile);
  }

  private grow(species: Species, metres: number, vigor: number, years: number, draw: number): number {
    return Math.min(255, Math.floor(encodeHeight(grown(species, metres, vigor, years)) + draw));
  }

  private tickCanopy(tile: TileIndex, row: number, years: number, celsius: number, rain: number, damp: number, altitude: number, salt: number, supply: number): boolean {
    const id = this.canopy[tile]!;
    const species = SPECIES[id - 1]!;
    const age = Math.min(65535, this.canopyAge[tile]! + this.sweepDays);
    this.canopyAge[tile] = age;
    const ageInYears = age / DAYS_PER_YEAR;

    if (id === SNAG) {
      if (this.roll(tile, 1) < 1 - Math.exp(-years / SNAG_YEARS)) {
        this.canopy[tile] = 0;
        this.canopyAge[tile] = 0;
        this.canopyHeight[tile] = 0;
        this.world.cover[tile] = Cover.Fallen;
        return true;
      }
      return false;
    }

    const metres = HEIGHT_METRES[this.canopyHeight[tile]!]!;
    const stage = stageOfPlant(species, metres);
    const fit = fitness(id, celsius, rain, damp, altitude, salt);
    const lit = lightResponse(species, this.light(tile, metres, false));
    const water = Math.min(1, (WATER_CAPACITY * supply ** WATER_CURVE) / Math.max(0.05, this.demand(tile)));
    const vigor = Math.sqrt(fit) * Math.min(lit, water) * this.soil(tile);

    const height = this.grow(species, metres, vigor, years, this.roll(tile, 2));
    this.canopyHeight[tile] = height;

    let hazard = backgroundHazard(species, ageInYears);
    hazard += INFANT_HAZARD * Math.exp(-ageInYears / INFANT_YEARS);
    if (vigor < STARVED_BELOW) hazard += STARVED_HAZARD * (1 - vigor / STARVED_BELOW);
    if (lit <= 0) hazard += DARK_HAZARD;
    if (water < DROUGHT_BELOW) hazard += DROUGHT_HAZARD * (1 - water / DROUGHT_BELOW);
    if (fit < 0.05) hazard += 1;

    if (this.roll(tile, 3) < 1 - Math.exp(-hazard * years)) {
      const tall = HEIGHT_METRES[height]!;
      this.canopy[tile] = 0;
      this.canopyAge[tile] = 0;
      this.canopyTaken[tile] = 0;
      if (tall >= TALL_ENOUGH_TO_FALL) {
        if (this.roll(tile, 4) < SNAG_CHANCE) {
          this.canopy[tile] = SNAG;
        } else {
          this.canopyHeight[tile] = 0;
          this.world.cover[tile] = Cover.Fallen;
        }
      } else {
        this.canopyHeight[tile] = 0;
      }
      return true;
    }

    if (age >= MATURE_DAYS[id]!) this.disperse(tile, row, species, id, vigor, years);
    this.rest(tile, species, 'canopy');

    return stageOfPlant(species, HEIGHT_METRES[height]!) !== stage;
  }

  private tickUnder(tile: TileIndex, row: number, years: number, celsius: number, rain: number, damp: number, altitude: number, salt: number, supply: number): boolean {
    const id = this.under[tile]!;
    const species = SPECIES[id - 1]!;
    const age = Math.min(65535, this.underAge[tile]! + this.sweepDays);
    this.underAge[tile] = age;
    const ageInYears = age / DAYS_PER_YEAR;

    const metres = HEIGHT_METRES[this.underHeight[tile]!]!;
    const stage = stageOfPlant(species, metres);
    const fit = fitness(id, celsius, rain, damp, altitude, salt);
    const lit = lightResponse(species, this.light(tile, metres, true));
    const water = Math.min(1, (WATER_CAPACITY * supply ** WATER_CURVE) / Math.max(0.05, this.demand(tile)));
    const vigor = Math.sqrt(fit) * Math.min(lit, water) * this.soil(tile);

    const height = this.grow(species, metres, vigor, years, this.roll(tile, 5));
    this.underHeight[tile] = height;

    let hazard = backgroundHazard(species, ageInYears);
    hazard += INFANT_HAZARD * Math.exp(-ageInYears / INFANT_YEARS);
    if (vigor < STARVED_BELOW) hazard += STARVED_HAZARD * (1 - vigor / STARVED_BELOW);
    if (lit <= 0) hazard += DARK_HAZARD;
    if (water < DROUGHT_BELOW) hazard += DROUGHT_HAZARD * (1 - water / DROUGHT_BELOW);
    if (fit < 0.05) hazard += 1;

    if (this.roll(tile, 6) < 1 - Math.exp(-hazard * years)) {
      this.under[tile] = 0;
      this.underAge[tile] = 0;
      this.underHeight[tile] = 0;
      this.underTaken[tile] = 0;
      return true;
    }

    if (age >= MATURE_DAYS[id]!) this.disperse(tile, row, species, id, vigor, years);
    this.rest(tile, species, 'under');

    return stageOfPlant(species, HEIGHT_METRES[height]!) !== stage;
  }

  private rest(tile: TileIndex, species: Species, layer: FruitLayer): void {
    if (!species.fruit) return;
    const taken = layer === 'canopy' ? this.canopyTaken : this.underTaken;
    if (taken[tile] === 0) return;
    const phase = this.localPhase(tile);
    if (phase < species.fruit.from || phase > species.fruit.to) taken[tile] = 0;
  }

  private tickHerb(tile: TileIndex, years: number, celsius: number, rain: number, damp: number, altitude: number, salt: number): boolean {
    const id = this.herb[tile]!;
    const species = SPECIES[id - 1]!;
    const fit = fitness(id, celsius, rain, damp, altitude, salt);
    const lit = lightResponse(species, this.light(tile, 0, true));
    let hazard = 0;
    if (fit < 0.08) hazard += HERB_STARVED_HAZARD;
    if (lit <= 0) hazard += HERB_STARVED_HAZARD * 2;
    if (hazard > 0 && this.roll(tile, 7) < 1 - Math.exp(-hazard * years)) {
      this.herb[tile] = 0;
      return true;
    }
    return false;
  }

  private soil(tile: TileIndex): number {
    return (SOIL_FLOOR + (1 - SOIL_FLOOR) * Math.min(1, this.world.field.fertility[tile]! / FERTILITY_ONE)) * (1 - CLIFF_BARREN * (this.world.steep[tile]! / STEEP_ONE));
  }

  private spreadHerb(tile: TileIndex, years: number, celsius: number, rain: number, damp: number, altitude: number, salt: number): boolean {
    if (this.herb[tile] !== 0) return false;
    const columns = this.world.grid.columns;
    const pick = Math.floor(this.roll(tile, 8) * 4);
    const near = tile + (pick === 0 ? -1 : pick === 1 ? 1 : pick === 2 ? -columns : columns);
    const id = this.herb[near]!;
    if (id === 0 || this.world.cover[tile] === Cover.Fallen) return false;
    if (this.roll(tile, 9) >= HERB_SPREAD_PER_YEAR * years) return false;
    const species = SPECIES[id - 1]!;
    const site = this.environment!.wants[tile] === Cover.Grass ? 1 : UNWANTED_GROUND;
    const chance = fitness(id, celsius, rain, damp, altitude, salt) * lightResponse(species, this.light(tile, 0, true)) * site * this.soil(tile);
    if (this.roll(tile, 10) >= chance) return false;
    this.herb[tile] = id;
    return true;
  }

  private disperse(tile: TileIndex, row: number, species: Species, id: number, vigor: number, years: number): void {
    const share = Math.sqrt(sizeShare(species, HEIGHT_METRES[species.layer === 'canopy' ? this.canopyHeight[tile]! : this.underHeight[tile]!]!));
    let seeds = species.recruits * vigor * share * years;
    let attempt = 0;
    while (seeds > 0 && attempt < 4) {
      if (this.roll(tile, 11 + attempt * 2) < Math.min(1, seeds)) this.land(tile, row, species, id, attempt);
      seeds -= 1;
      attempt += 1;
    }
  }

  private land(tile: TileIndex, row: number, species: Species, id: number, attempt: number): void {
    const { world } = this;
    const { grid } = world;
    const first = this.roll(tile, 12 + attempt * 2);
    const second = this.roll(tile, 13 + attempt * 2);
    const gale = species.dispersal === 'wind' ? 0.5 + world.wind[tile]! / 255 : 1;
    const away = species.dispersal === 'gravity' ? 1 + first * species.reach : -Math.log(1 - first * 0.999) * species.reach * gale;
    let angle = second * Math.PI * 2;
    if (species.dispersal === 'wind') {
      const aim = this.westward[row] === 1 ? Math.PI : 0;
      angle = aim + (first + second - 1) * 2 * GUST;
    }
    const dx = Math.round(Math.cos(angle) * away);
    const dy = Math.round(Math.sin(angle) * away);
    if (dx === 0 && dy === 0) return;

    const column = tile % grid.columns;
    const targetColumn = column + dx;
    const targetRow = row + dy;
    if (targetColumn < EDGE || targetRow < EDGE || targetColumn >= grid.columns - EDGE || targetRow >= grid.rows - EDGE) return;
    const target = targetRow * grid.columns + targetColumn;

    if (world.biome[target]! >= Biome.Ocean || world.river[target] === 1) return;
    const cover = world.cover[target]!;
    if (cover === Cover.Boulder || cover === Cover.Fallen) return;
    if (world.wear[target]! >= BLOCKED_WEAR || world.hasStructure(target)) return;

    const layer = species.layer;
    if (layer === 'canopy' ? this.canopy[target] !== 0 : this.under[target] !== 0) return;

    const { environment } = this;
    const fit = fitness(id, world.field.temperature[target]!, world.field.wet[target]!, world.damp[target]! / 255, environment!.altitude[target]! / 255, environment!.salt[target]! / 255);
    const lit = lightResponse(species, this.light(target, species.seedling, layer === 'under'));
    const supply = Math.max(rainScore(world.field.wet[target]!), (world.damp[target]! / 255) * 0.95);
    const water = Math.min(1, (WATER_CAPACITY * supply ** WATER_CURVE) / Math.max(0.05, this.demand(target) + 0.3)) / DROUGHT_BELOW;
    const wants = environment!.wants[target]!;
    const site = layer === 'canopy' ? (wants === Cover.Tree ? 1 : UNWANTED) : wants === Cover.Bush || wants === Cover.Scrub ? 1 : UNWANTED;
    if (this.roll(target, 14 + attempt) >= fit * lit * Math.min(1, water) * site * (1 - CLIFF_SEED_LOSS * (world.steep[target]! / STEEP_ONE) ** 2)) return;

    const height = Math.round(encodeHeight(species.seedling));
    if (layer === 'canopy') {
      this.canopy[target] = id;
      this.canopyAge[target] = 0;
      this.canopyHeight[target] = height;
      this.canopyTaken[target] = 0;
    } else {
      this.under[target] = id;
      this.underAge[target] = 0;
      this.underHeight[target] = height;
      this.underTaken[target] = 0;
    }
    this.syncCover(target);
    world.touch(target);
  }

  snapshot(): number[] {
    const out: number[] = [];
    for (const tile of this.disturbed) {
      out.push(
        tile,
        this.canopy[tile]!,
        this.canopyAge[tile]!,
        this.canopyHeight[tile]!,
        this.under[tile]!,
        this.underAge[tile]!,
        this.underHeight[tile]!,
        this.herb[tile]!,
        this.canopyTaken[tile]!,
        this.underTaken[tile]!,
        this.world.cover[tile]!,
      );
    }
    return out;
  }

  restore(saved: number[]): void {
    const stride = 11;
    for (let at = 0; at + stride <= saved.length; at += stride) {
      const tile = saved[at]!;
      this.canopy[tile] = saved[at + 1]!;
      this.canopyAge[tile] = saved[at + 2]!;
      this.canopyHeight[tile] = saved[at + 3]!;
      this.under[tile] = saved[at + 4]!;
      this.underAge[tile] = saved[at + 5]!;
      this.underHeight[tile] = saved[at + 6]!;
      this.herb[tile] = saved[at + 7]!;
      this.canopyTaken[tile] = saved[at + 8]!;
      this.underTaken[tile] = saved[at + 9]!;
      this.world.cover[tile] = saved[at + 10]!;
      this.disturbed.add(tile);
    }
  }
}
