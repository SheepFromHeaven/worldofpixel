import { flowOf } from '../aquatic.ts';
import { trapezoid } from '../plants/niche.ts';
import { hash2 } from '../rng.ts';
import type { TileIndex } from '../grid.ts';
import { NOWHERE } from '../grid.ts';
import { Biome } from '../types.ts';
import type { World } from '../world.ts';
import { DEPTH_UNIT_METRES } from '../aquatic.ts';
import type { Fauna } from '../fauna/fauna.ts';
import { PATCH_TILES } from '../fauna/life.ts';
import type { FishSpecies } from './species.ts';
import { activityOf, FISH, FISH_COUNT, fishIdOf, GLIDE } from './species.ts';
import { SHOAL_CAPACITY, Shoals } from './shoals.ts';

export interface FishEnvironment {
  temperatureAt(tile: TileIndex): number;
  daylightAt(x: number, y: number): number;
}

export const Water = { Land: 0, River: 1, Lake: 2, Sea: 3 } as const;

export const ECO_DAYS = 0.05;

const START_STRIDE = 10;
const RIVER_START_CHANCE = 0.1;
const START_PRESENCE = 0.9;
const MIN_START_FIT = 0.15;
const OPEN_SEA_REACH_TILES = 60;
const CELL_TILES = 8;
const THINK_MIN_SECONDS = 0.7;
const THINK_SPREAD_SECONDS = 1.2;
const TURN_RATE = 0.75;
const PROBES = 9;
const PROBE_SPREAD = 0.3;
const PROBE_TILES = 3.5;
const PREY_PULL = 0.8;
const PERSISTENCE = 0.15;
const WANDER = 0.12;
const MAX_SWIM_SECONDS = 0.5;
const SPLIT_AT = 1.7;
const HUNT_REACH_TILES = 14;
const MAX_PREY_SHARE = 0.08;
const STRAYS_PER_TICK = 16;
const STRAY_SHARE = 0.25;
const STRAY_MIN_FIT = 0.5;
const COVER_SAMPLES: readonly (readonly [number, number])[] = [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]];
const COVER_GAIN = 2.5;
const UNCOVERED_FLOOR = 0.45;
const NO_HABITAT_DECAY_PER_DAY = 2;
const STARVE_BELOW = 0.4;
const STARVE_RATE = 3;
const BASE_MORTALITY = 0.25;
const FORAGE_FLOOR = 0.5;
const INCUBATION_PER_RATE = 0.15;
const FRY_PER_RATE = 1.5;
const EGG_LOSS_PER_RATE = 3;
const FRY_LOSS_PER_RATE = 1.5;
const FRY_MASS_SHARE = 0.05;
const MIN_SPAWN_WINDOW = 0.15;
const FORAGE_APPETITE = 2;
const FORAGER_BASE = 0.85;
const HATCH_SURVIVAL = (1 / INCUBATION_PER_RATE) / (1 / INCUBATION_PER_RATE + EGG_LOSS_PER_RATE);
const FRY_SURVIVAL = (1 / FRY_PER_RATE) / (1 / FRY_PER_RATE + FRY_LOSS_PER_RATE);
const LAY_FACTOR = 1 / (HATCH_SURVIVAL * FRY_SURVIVAL);

const wrap = (angle: number): number => {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

const ROOM_REACH_TILES = 3;

function roomAround(world: World): Uint8Array {
  const { grid } = world;
  const { columns, rows } = grid;
  const wet = new Uint8Array(grid.count);
  for (let i = 0; i < grid.count; i += 1) wet[i] = world.river[i] === 1 || world.biome[i] === Biome.Lake || world.biome[i] === Biome.Ocean ? 1 : 0;
  const across = new Uint8Array(grid.count);
  for (let row = 0; row < rows; row += 1) {
    const at = row * columns;
    let sum = 0;
    for (let column = 0; column < Math.min(columns, ROOM_REACH_TILES); column += 1) sum += wet[at + column]!;
    for (let column = 0; column < columns; column += 1) {
      const entering = column + ROOM_REACH_TILES;
      const leaving = column - ROOM_REACH_TILES - 1;
      if (entering < columns) sum += wet[at + entering]!;
      if (leaving >= 0) sum -= wet[at + leaving]!;
      across[at + column] = sum;
    }
  }
  const room = new Uint8Array(grid.count);
  const window = (ROOM_REACH_TILES * 2 + 1) ** 2;
  for (let column = 0; column < columns; column += 1) {
    let sum = 0;
    for (let row = 0; row < Math.min(rows, ROOM_REACH_TILES); row += 1) sum += across[row * columns + column]!;
    for (let row = 0; row < rows; row += 1) {
      const entering = row + ROOM_REACH_TILES;
      const leaving = row - ROOM_REACH_TILES - 1;
      if (entering < rows) sum += across[entering * columns + column]!;
      if (leaving >= 0) sum -= across[leaving * columns + column]!;
      room[row * columns + column] = Math.round((sum / window) * 255);
    }
  }
  return room;
}

export class Fish {
  readonly shoals = new Shoals();
  private readonly fish = new Float32Array(SHOAL_CAPACITY);
  readonly eggs = new Float32Array(SHOAL_CAPACITY);
  readonly fry = new Float32Array(SHOAL_CAPACITY);
  private readonly fed = new Float32Array(SHOAL_CAPACITY);
  private readonly think = new Float32Array(SHOAL_CAPACITY);
  private readonly goal = new Float32Array(SHOAL_CAPACITY);
  private readonly activity = new Float32Array(SHOAL_CAPACITY).fill(1);
  private readonly spare: number[] = [];
  private readonly preyOf: boolean[][];
  private readonly isPrey: boolean[];
  private readonly covered: boolean[];
  private readonly speciesIndex = new Map<FishSpecies, number>();
  private readonly cellColumns: number;
  private readonly cells: number;
  private readonly head: Int32Array;
  private readonly next = new Int32Array(SHOAL_CAPACITY);
  private readonly density: (Float32Array | null)[];
  private readonly room: Uint8Array;
  private ecoClock = 0;
  private ticks = 0;

  constructor(
    private readonly world: World,
    private readonly seed: number,
    private readonly fauna: Fauna | null = null,
  ) {
    const { grid } = world;
    this.cellColumns = Math.ceil(grid.columns / CELL_TILES);
    this.cells = this.cellColumns * Math.ceil(grid.rows / CELL_TILES);
    this.head = new Int32Array(this.cells).fill(-1);
    this.preyOf = FISH.map((species) => FISH.map((other) => species.prey.includes(other.key)));
    this.covered = FISH.map((species) => Object.keys(species.cover).length > 0);
    FISH.forEach((species, id) => this.speciesIndex.set(species, id));
    this.isPrey = FISH.map((_, id) => this.preyOf.some((row) => row[id]));
    this.room = roomAround(world);
    this.density = FISH.map((_, id) => (this.isPrey[id] ? new Float32Array(this.cells) : null));
  }

  get count(): number {
    let live = 0;
    for (let i = 0; i < this.shoals.n; i += 1) if (this.shoals.species[i] !== 0) live += 1;
    return live;
  }

  waterOf(tile: TileIndex): number {
    const { world } = this;
    if (world.river[tile] === 1) return Water.River;
    const biome = world.biome[tile];
    return biome === Biome.Lake ? Water.Lake : biome === Biome.Ocean ? Water.Sea : Water.Land;
  }

  private coverOf(species: FishSpecies, tile: TileIndex): number {
    if (!this.covered[this.speciesIndex.get(species)!]) return 1;
    const { world } = this;
    const { grid } = world;
    const column = grid.columnOf(tile);
    const row = grid.rowOf(tile);
    let total = 0;
    for (const [dc, dr] of COVER_SAMPLES) {
      const at = grid.at(column + dc, row + dr);
      if (at !== NOWHERE) total += species.cover[world.aqua[at]!] ?? 0;
    }
    return UNCOVERED_FLOOR + (1 - UNCOVERED_FLOOR) * Math.min(1, (total / COVER_SAMPLES.length) * COVER_GAIN);
  }

  fitness(species: FishSpecies, tile: TileIndex, celsius: number): number {
    const kind = this.waterOf(tile);
    if (kind === Water.Land || (species.water === 'salt') !== (kind === Water.Sea)) return 0;
    const { world } = this;
    const flow = kind === Water.River ? flowOf(world.flow[tile]!) : 0;
    const fit =
      trapezoid(species.temperature, celsius) *
      trapezoid(species.depth, world.depth[tile]! * DEPTH_UNIT_METRES) *
      trapezoid(species.flow, flow) *
      trapezoid(species.shore, world.shore[tile]!);
    if (fit <= 0) return 0;
    const need = Math.min(0.6, Math.max(0.1, species.length * 0.6));
    return fit * Math.min(1, this.room[tile]! / 255 / need) * this.coverOf(species, tile);
  }

  private spawn(species: number, x: number, y: number, size: number): number {
    const slot = this.spare.pop() ?? (this.shoals.n < SHOAL_CAPACITY ? this.shoals.n++ : -1);
    if (slot < 0) return -1;
    const { shoals } = this;
    shoals.species[slot] = species;
    shoals.posX[slot] = x;
    shoals.posY[slot] = y;
    shoals.heading[slot] = hash2(slot, this.ticks, this.seed + 71) * Math.PI * 2;
    this.goal[slot] = shoals.heading[slot]!;
    this.fish[slot] = size;
    this.eggs[slot] = 0;
    this.fry[slot] = 0;
    this.fed[slot] = 1;
    this.think[slot] = hash2(slot, this.ticks, this.seed + 73) * THINK_SPREAD_SECONDS;
    this.activity[slot] = 1;
    shoals.size[slot] = Math.min(65535, Math.round(size));
    return slot;
  }

  private kill(slot: number): void {
    this.shoals.species[slot] = 0;
    this.fish[slot] = 0;
    this.eggs[slot] = 0;
    this.fry[slot] = 0;
    this.shoals.size[slot] = 0;
    this.spare.push(slot);
  }

  populate(env: FishEnvironment): void {
    const { world, seed } = this;
    const { grid } = world;
    const place = (column: number, row: number, tile: TileIndex, salt: number): void => {
      const kind = this.waterOf(tile);
      if (kind === Water.Land) return;
      if (kind === Water.Sea && world.shore[tile]! > OPEN_SEA_REACH_TILES) return;
      const celsius = env.temperatureAt(tile);
      for (let id = 0; id < FISH_COUNT; id += 1) {
        const species = FISH[id]!;
        const fit = this.fitness(species, tile, celsius);
        if (fit < MIN_START_FIT || hash2(column, row, seed + salt + id * 7) > fit * species.common * START_PRESENCE) continue;
        const size = species.school * fit * (0.6 + 0.4 * hash2(column, row, seed + salt + id * 7 + 1));
        if (size >= 1) this.spawn(id + 1, grid.x(column) + hash2(column, row, seed + salt + id) - 0.5, grid.y(row) + hash2(column, row, seed + salt + id + 3) - 0.5, size);
      }
    };

    for (let row = 0; row < grid.rows; row += START_STRIDE) {
      for (let column = 0; column < grid.columns; column += START_STRIDE) {
        const jitterColumn = Math.min(grid.columns - 1, column + Math.floor(hash2(column, row, seed + 901) * START_STRIDE));
        const jitterRow = Math.min(grid.rows - 1, row + Math.floor(hash2(column, row, seed + 902) * START_STRIDE));
        place(jitterColumn, jitterRow, jitterRow * grid.columns + jitterColumn, 910);
      }
    }
    for (let tile = 0; tile < grid.count; tile += 1) {
      if (world.river[tile] !== 1) continue;
      const column = tile % grid.columns;
      const row = Math.floor(tile / grid.columns);
      if (hash2(column, row, seed + 903) > RIVER_START_CHANCE) continue;
      place(column, row, tile, 920);
    }
  }

  update(seconds: number, days: number, env: FishEnvironment): void {
    this.ticks += 1;
    const { shoals } = this;
    const step = Math.min(seconds, MAX_SWIM_SECONDS);
    if (step > 0) {
      for (let i = 0; i < shoals.n; i += 1) {
        if (shoals.species[i] === 0) continue;
        this.steer(i, step, env);
        this.swim(i, step, env);
      }
    }
    this.ecoClock += days;
    if (this.ecoClock >= ECO_DAYS) {
      this.ecology(this.ecoClock, env);
      this.ecoClock = 0;
    }
  }

  private swim(i: number, seconds: number, env: FishEnvironment): void {
    const { shoals, world } = this;
    const species = FISH[shoals.species[i]! - 1]!;
    const heading = shoals.heading[i]!;
    const distance = species.speed * GLIDE * this.activity[i]! * seconds;
    const x = shoals.posX[i]! + Math.cos(heading) * distance;
    const y = shoals.posY[i]! + Math.sin(heading) * distance;
    const tile = world.grid.atPoint({ x, y });
    const livable = tile !== NOWHERE && this.fitness(species, tile, env.temperatureAt(tile)) > 0;
    if (!livable) {
      const turn = (hash2(i, this.ticks, this.seed + 81) < 0.5 ? -1 : 1) * (1.2 + hash2(i, this.ticks, this.seed + 82));
      shoals.heading[i] = wrap(heading + turn);
      this.goal[i] = shoals.heading[i]!;
      return;
    }
    shoals.posX[i] = x;
    shoals.posY[i] = y;
    shoals.depth[i] = world.depth[tile]!;
  }

  private steer(i: number, seconds: number, env: FishEnvironment): void {
    const { shoals, world } = this;
    const heading = shoals.heading[i]!;
    this.think[i] = this.think[i]! - seconds;
    if (this.think[i]! <= 0) {
      const id = shoals.species[i]!;
      const species = FISH[id - 1]!;
      this.activity[i] = activityOf(species, env.daylightAt(shoals.posX[i]!, shoals.posY[i]!));
      this.think[i] = THINK_MIN_SECONDS + hash2(i, this.ticks, this.seed + 83) * THINK_SPREAD_SECONDS;
      let best = heading;
      let bestScore = -1;
      for (let k = 0; k < PROBES; k += 1) {
        const angle = heading + (k - (PROBES - 1) / 2) * PROBE_SPREAD;
        const px = shoals.posX[i]! + Math.cos(angle) * PROBE_TILES;
        const py = shoals.posY[i]! + Math.sin(angle) * PROBE_TILES;
        const tile = world.grid.atPoint({ x: px, y: py });
        if (tile === NOWHERE) continue;
        const fit = this.fitness(species, tile, env.temperatureAt(tile));
        const prey = species.prey.length > 0 ? this.preySignal(id - 1, px, py) : 0;
        const score =
          fit * (1 + PREY_PULL * prey) +
          PERSISTENCE * (1 - Math.abs(k - (PROBES - 1) / 2) / PROBES) * (fit > 0 ? 1 : 0) +
          WANDER * hash2(i * PROBES + k, this.ticks, this.seed + 84);
        if (score > bestScore) {
          bestScore = score;
          best = angle;
        }
      }
      this.goal[i] = best;
    }
    const diff = wrap(this.goal[i]! - heading);
    const limit = TURN_RATE * seconds;
    shoals.heading[i] = wrap(heading + Math.max(-limit, Math.min(limit, diff)));
  }

  private patchOf(x: number, y: number): number {
    const { grid } = this.world;
    const columns = Math.ceil(grid.columns / PATCH_TILES);
    return Math.floor(grid.row(y) / PATCH_TILES) * columns + Math.floor(grid.column(x) / PATCH_TILES);
  }

  measure(): void {
    this.index();
    this.ledger();
  }

  private ledger(): void {
    const { fauna, shoals } = this;
    if (!fauna) return;
    const { fishBio, fishTake } = fauna;
    fishBio.fill(0);
    for (let i = 0; i < shoals.n; i += 1) {
      const id = shoals.species[i]!;
      if (id === 0) continue;
      const at = this.patchOf(shoals.posX[i]!, shoals.posY[i]!) * FISH_COUNT + id - 1;
      fishBio[at] = fishBio[at]! + (this.fish[i]! + FRY_MASS_SHARE * this.fry[i]!) * FISH[id - 1]!.mass;
    }
    for (let i = 0; i < shoals.n; i += 1) {
      const id = shoals.species[i]!;
      if (id === 0) continue;
      const at = this.patchOf(shoals.posX[i]!, shoals.posY[i]!) * FISH_COUNT + id - 1;
      const taken = fishTake[at]!;
      if (taken <= 0) continue;
      const bio = fishBio[at]!;
      const own = this.fish[i]!;
      const cut = Math.min(0.6 * own, (taken * own) / Math.max(bio, 1e-9));
      this.fish[i] = own - cut;
      this.fry[i] = this.fry[i]! * (1 - Math.min(0.6, taken / Math.max(bio, 1e-9)));
    }
    fishTake.fill(0);
  }

  private cellAt(x: number, y: number): number {
    const { grid } = this.world;
    return Math.floor(grid.row(y) / CELL_TILES) * this.cellColumns + Math.floor(grid.column(x) / CELL_TILES);
  }

  private preySignal(predator: number, x: number, y: number): number {
    let biomass = 0;
    const cell = this.cellAt(x, y);
    for (let id = 0; id < FISH_COUNT; id += 1) if (this.preyOf[predator]![id]) biomass += this.density[id]![cell]!;
    return Math.min(1, biomass / 4);
  }

  private index(): void {
    const { shoals } = this;
    this.head.fill(-1);
    for (const grid of this.density) grid?.fill(0);
    for (let i = 0; i < shoals.n; i += 1) {
      const id = shoals.species[i]!;
      if (id === 0) continue;
      const cell = this.cellAt(shoals.posX[i]!, shoals.posY[i]!);
      this.next[i] = this.head[cell]!;
      this.head[cell] = i;
      const grid = this.density[id - 1];
      if (grid) grid[cell] = grid[cell]! + this.fish[i]! * FISH[id - 1]!.mass;
    }
  }

  private hunt(i: number, species: FishSpecies, id: number, days: number): number {
    const { shoals } = this;
    const want = species.appetite * this.fish[i]! * species.mass * days;
    if (want <= 0) return 1;
    const row = Math.floor(this.cellAt(shoals.posX[i]!, shoals.posY[i]!) / this.cellColumns);
    const column = this.cellAt(shoals.posX[i]!, shoals.posY[i]!) % this.cellColumns;
    let eaten = 0;
    for (let dr = -1; dr <= 1 && eaten < want; dr += 1) {
      for (let dc = -1; dc <= 1 && eaten < want; dc += 1) {
        const r = row + dr;
        const c = column + dc;
        if (r < 0 || c < 0 || c >= this.cellColumns || r * this.cellColumns + c >= this.cells) continue;
        for (let other = this.head[r * this.cellColumns + c]!; other >= 0 && eaten < want; other = this.next[other]!) {
          const otherId = shoals.species[other]!;
          if (otherId === 0 || !this.preyOf[id - 1]![otherId - 1]) continue;
          if (Math.hypot(shoals.posX[other]! - shoals.posX[i]!, shoals.posY[other]! - shoals.posY[i]!) > HUNT_REACH_TILES) continue;
          const preyMass = FISH[otherId - 1]!.mass;
          const stockKg = (this.fish[other]! + FRY_MASS_SHARE * this.fry[other]!) * preyMass;
          if (stockKg <= 0) continue;
          const take = Math.min(want - eaten, stockKg * MAX_PREY_SHARE);
          const share = take / stockKg;
          this.fish[other] = this.fish[other]! * (1 - share);
          this.fry[other] = this.fry[other]! * (1 - share);
          eaten += take;
        }
      }
    }
    return Math.min(1, eaten / want);
  }

  private ecology(days: number, env: FishEnvironment): void {
    const { shoals, world } = this;
    this.index();
    this.ledger();
    const limit = shoals.n;
    for (let i = 0; i < limit; i += 1) {
      const id = shoals.species[i]!;
      if (id === 0) continue;
      const species = FISH[id - 1]!;
      const tile = world.grid.atPoint({ x: shoals.posX[i]!, y: shoals.posY[i]! });
      const fit = tile === NOWHERE ? 0 : this.fitness(species, tile, env.temperatureAt(tile));
      const hunting = species.prey.length > 0;
      let satiation = hunting ? this.hunt(i, species, id, days) : 1;
      let forageSat = 1;
      if (this.fauna && species.forage.eats !== 0 && tile !== NOWHERE) {
        const want = species.appetite * FORAGE_APPETITE * this.fish[i]! * species.mass * days;
        forageSat = want > 0 ? Math.min(1, this.fauna.forage(this.patchOf(shoals.posX[i]!, shoals.posY[i]!), id - 1, want) / want) : 1;
        if (hunting) satiation = Math.max(satiation, forageSat);
      }
      this.fed[i] = this.fed[i]! * 0.6 + (FORAGE_FLOOR + (1 - FORAGE_FLOOR) * satiation) * 0.4;
      const fed = this.fed[i]!;

      let size = this.fish[i]!;
      const capacity = species.school * fit;
      const celsius = tile === NOWHERE ? 0 : env.temperatureAt(tile);
      const window = Math.max(MIN_SPAWN_WINDOW, trapezoid(species.spawn, celsius));
      let laid = 0;
      let deaths = 0;
      if (capacity > 0.01) {
        const vigour = hunting ? 0.4 + 0.6 * fed : species.forage.eats !== 0 ? FORAGER_BASE + (1 - FORAGER_BASE) * forageSat : 1;
        const growth = species.rate * size * (1 - size / capacity) * vigour;
        const replacement = species.rate * BASE_MORTALITY * size;
        laid = Math.max(0, growth) * window * LAY_FACTOR;
        deaths = replacement + Math.max(0, -growth);
      } else {
        deaths = NO_HABITAT_DECAY_PER_DAY * size;
      }
      if (hunting && fed < STARVE_BELOW) deaths += species.rate * size * (STARVE_BELOW - fed) * STARVE_RATE;

      const hatchRate = 1 / (INCUBATION_PER_RATE / species.rate);
      const growRate = 1 / (FRY_PER_RATE / species.rate);
      const eggs1 = (this.eggs[i]! + days * laid) / (1 + days * (hatchRate + EGG_LOSS_PER_RATE * species.rate));
      const hatched = days * hatchRate * eggs1;
      const fry1 = (this.fry[i]! + hatched) / (1 + days * (growRate + FRY_LOSS_PER_RATE * species.rate));
      const matured = days * growRate * fry1;
      this.eggs[i] = eggs1;
      this.fry[i] = fry1;
      this.fish[i] = Math.max(0, size + matured - Math.min(size, deaths * days));
      size = this.fish[i]!;

      if (size < 1) {
        this.kill(i);
        continue;
      }
      if (size > SPLIT_AT * species.school) {
        const spawned = this.spawn(
          id,
          shoals.posX[i]! + (hash2(i, this.ticks, this.seed + 91) - 0.5) * 3,
          shoals.posY[i]! + (hash2(i, this.ticks, this.seed + 92) - 0.5) * 3,
          size / 2,
        );
        this.fish[i] = spawned >= 0 ? size / 2 : SPLIT_AT * species.school;
        size = this.fish[i]!;
      }
      shoals.size[i] = Math.min(65535, Math.round(size));
    }
    this.recolonise(env);
  }

  private recolonise(env: FishEnvironment): void {
    const { world, seed, shoals } = this;
    const { grid } = world;
    for (let k = 0; k < STRAYS_PER_TICK; k += 1) {
      const column = Math.floor(hash2(k, this.ticks, seed + 93) * grid.columns);
      const row = Math.floor(hash2(k, this.ticks, seed + 94) * grid.rows);
      const tile = row * grid.columns + column;
      if (this.waterOf(tile) === Water.Land) continue;
      const celsius = env.temperatureAt(tile);
      const species = Math.floor(hash2(k, this.ticks, seed + 95) * FISH_COUNT);
      const fit = this.fitness(FISH[species]!, tile, celsius);
      if (fit < STRAY_MIN_FIT) continue;
      const x = grid.x(column);
      const y = grid.y(row);
      const cell = this.cellAt(x, y);
      let crowded = false;
      for (let other = this.head[cell]!; other >= 0; other = this.next[other]!) if (shoals.species[other] === species + 1) crowded = true;
      if (crowded) continue;
      this.spawn(species + 1, x, y, FISH[species]!.school * fit * STRAY_SHARE);
    }
  }

  nearestFresh(x: number, y: number, reach: number): { x: number; y: number } | null {
    const { shoals, world } = this;
    let best = -1;
    let least = reach * reach;
    for (let shoal = 0; shoal < shoals.n; shoal += 1) {
      if (shoals.species[shoal] === 0 || this.fish[shoal]! < 2) continue;
      const near = (shoals.posX[shoal]! - x) ** 2 + (shoals.posY[shoal]! - y) ** 2;
      if (near >= least) continue;
      const water = this.waterOf(world.grid.atPoint({ x: shoals.posX[shoal]!, y: shoals.posY[shoal]! }));
      if (water === Water.Land || water === Water.Sea) continue;
      least = near;
      best = shoal;
    }
    return best < 0 ? null : { x: shoals.posX[best]!, y: shoals.posY[best]! };
  }

  take(x: number, y: number, reach: number): boolean {
    const { shoals } = this;
    let best = -1;
    let least = reach * reach;
    for (let shoal = 0; shoal < shoals.n; shoal += 1) {
      if (shoals.species[shoal] === 0 || this.fish[shoal]! < 2) continue;
      const near = (shoals.posX[shoal]! - x) ** 2 + (shoals.posY[shoal]! - y) ** 2;
      if (near >= least) continue;
      least = near;
      best = shoal;
    }
    if (best < 0) return false;
    this.fish[best] = this.fish[best]! - 1;
    return true;
  }

  totals(): number[] {
    const out = new Array<number>(FISH_COUNT).fill(0);
    for (let i = 0; i < this.shoals.n; i += 1) {
      const id = this.shoals.species[i]!;
      if (id !== 0) out[id - 1] = out[id - 1]! + this.fish[i]!;
    }
    return out;
  }
}

export { fishIdOf };
