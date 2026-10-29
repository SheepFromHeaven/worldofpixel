import { behaviourOf, MIGRATED } from '../../animals/catalogue.ts';
import { stateIndexOf, statesOf } from '../../animals/types.ts';
import type { IdleHabit } from '../../animals/types.ts';
import type { Fauna } from '../fauna/fauna.ts';
import { GROUP_BASE, LIFE_COUNT, PATCH_TILES, Stage, STAGES } from '../fauna/life.ts';
import type { Vec2 } from '../geometry.ts';
import { Gait, MAMMAL_COUNT, MAMMALS, Realm, Social } from '../mammals/species.ts';
import type { MammalSpecies } from '../mammals/species.ts';
import { DAY_SECONDS } from '../calendar.ts';
import { HomeKind } from '../homes/homes.ts';
import { hash2, prng } from '../rng.ts';
import type { World } from '../world.ts';
import { abilityOf, habitsOf } from '../climb/ability.ts';
import type { Ability, ClimbHabits } from '../climb/ability.ts';
import { Forest } from '../climb/forest.ts';
import { planRun, poseAt } from '../climb/run.ts';
import type { ClimbRun } from '../climb/run.ts';
import { groundOf } from './ground.ts';
import type { Ground } from './ground.ts';
import { ANIMAL_CAPACITY, AnimalStore, EMPTY } from './store.ts';
import { FACING_RADIANS_PER_SECOND, GLANCE_FROM_METRES, GLANCE_PER_SECOND, turnRadiusOf, turnToward, Walker } from './walker.ts';

export interface Focus {
  x: number;
  y: number;
  radius: number;
}

export interface AnimalEnvironment {
  days?(): number;
  busyAt(species: MammalSpecies, x: number, y: number): number;
  comfortAt(species: MammalSpecies, x: number, y: number): number;
}

const MAMMAL_BASE = GROUP_BASE.mammal;

const VISIBLE_GAIN = 1;

const MANAGE_SECONDS = 1;

const TREE_SEARCH_TILES = 12;

const TREE_REACH_METRES = 2.2;

const TREE_STANDOFF_METRES = 1.3;

const TREE_WALK_PACE = 0.7;

const RETRY_SECONDS = 30;

const SPAWN_ATTEMPTS = 8;

const AWAKE_BUSY = 0.3;

const BUSY_REFRESH_SECONDS = 2;

const OFFSET_CHECK_SECONDS = 0.5;

const WALKS_RETAINED_SECONDS = 12;

const LEGS_KEPT = 24;

const FLEE_FACTOR = 1.6;

const FLEE_PACE = 2.4;

const FLEE_TRIES = 5;

const GROUP_SLOTS = 16;

const CLIMB_FIRST_SECONDS = 4;

const CLIMB_CANDIDATES = 6;

const IDLE_FIRST_SECONDS = 2;

const IDLE_GAP_SECONDS = 12;

const CALF = 0;

const JUVENILE = 1;

const ADULT = 2;

interface Group {
  id: number;
  species: number;
  life: number;
  walker: Walker;
  slots: number[];
  offsets: Vec2[];
  facing: Vec2[];
  glances: number[];
  stages: number[];
  den: Vec2;
  home: number;
  lag: number;
  roams: boolean;
  swims: boolean;
  idles: readonly IdleHabit[];
  idleState: number[];
  aim: (Vec2 | null)[];
  treeGoal: Vec2 | null;
  idleStart: number[];
  idleUntil: number[];
  nextIdle: number[];
  ability: Ability | null;
  habits: ClimbHabits | null;
  nextClimb: number;
  climb?: ClimbRun;
  nextBusy: number;
  hide?: { from: number; until: number };
  awake: boolean;
  nextOffsets: number;
  random: () => number;
}

const stateOfMode = (names: readonly string[], mode: string): number => {
  const own = names.indexOf(mode);
  if (own >= 0) return own;
  return mode === 'leap' ? Math.max(0, names.indexOf('climb')) : 0;
};

const centreOf = (patch: number, columns: number): { column: number; row: number } => ({ column: patch % columns, row: Math.floor(patch / columns) });

const MOVING_GAITS: readonly number[] = [Gait.Walk, Gait.Trot, Gait.Hop, Gait.Bound, Gait.Swim, Gait.Cruise, Gait.Porpoise];

const CONTINUOUS_GAITS: readonly number[] = [Gait.Cruise, Gait.Porpoise];

const lagOf = (social: number): number => (social === Social.Pack || social === Social.Pod ? 0.7 : social === Social.Family ? 0.9 : 0.35);

const spreadOf = (social: number): number => (social === Social.Herd || social === Social.Troop ? 1.4 : social === Social.Harem ? 1 : social === Social.Family ? 0.5 : 0.35);

export class Animals {
  readonly store = new AnimalStore();
  private readonly groups = new Map<number, Group>();
  private readonly retry = new Map<number, number>();
  private readonly free: number[] = [];
  private readonly ground: Ground;
  private forest: Forest | null = null;
  private clock = 0;
  private manage = MANAGE_SECONDS;
  private focus: Focus | null = null;

  constructor(
    private readonly world: World,
    private readonly fauna: Fauna,
    private readonly seed: number,
    private readonly environment: AnimalEnvironment,
  ) {
    this.ground = groundOf(world);
  }

  private days(): number {
    return this.environment.days?.() ?? this.clock / DAY_SECONDS;
  }

  setFocus(focus: Focus): void {
    this.focus = focus;
  }

  get groupCount(): number {
    return this.groups.size;
  }

  update(scaled: number, seconds: number): void {
    this.manage += seconds;
    if (this.focus && this.manage >= MANAGE_SECONDS) {
      this.manage = 0;
      this.populate(this.focus);
    }
    if (scaled <= 0) return;
    this.clock += scaled;
    for (const group of this.groups.values()) this.advance(group, scaled);
  }

  startle(point: Vec2): void {
    for (const group of this.groups.values()) {
      const species = MAMMALS[group.species]!;
      if (!group.roams || species.skit <= 0 || group.climb) continue;
      const here = group.walker.pose(this.clock).pos;
      const away = Math.atan2(here.y - point.y, here.x - point.x);
      if (Math.hypot(here.x - point.x, here.y - point.y) > species.skit) continue;
      if (group.habits && group.random() < (group.habits.escape ?? 0) && this.ascend(group, species, this.clock, FLEE_PACE)) {
        delete group.hide;
        continue;
      }
      const hole = group.home >= 0 ? this.world.homes.nearestBuilt(group.home, this.days(), here.x, here.y) : null;
      const den = hole ? { x: hole[0], y: hole[1] } : group.den;
      let reaction = behaviourOf(species.key)?.hooks.flee?.({ here, from: point, den, skit: species.skit, random: group.random });
      if (reaction?.target && group.home >= 0 && !hole) reaction = { target: null, distance: reaction.distance, pace: reaction.pace };
      const distance = reaction ? reaction.distance : species.skit * FLEE_FACTOR;
      const pace = reaction ? reaction.pace : FLEE_PACE;
      if (reaction?.target && group.walker.sendTo(reaction.target, this.clock, pace)) {
        if (reaction.hide) {
          const from = group.walker.endsAt(this.clock);
          group.hide = { from, until: from + reaction.hide };
          group.walker.holdUntil(group.hide.until);
        }
        continue;
      }
      delete group.hide;
      for (let attempt = 0; attempt < FLEE_TRIES; attempt += 1) {
        const angle = away + (attempt === 0 ? 0 : (group.random() - 0.5) * 2.2);
        const target = { x: here.x + Math.cos(angle) * distance, y: here.y + Math.sin(angle) * distance };
        if (group.walker.sendTo(target, this.clock, pace)) break;
      }
    }
  }

  private populate(focus: Focus): void {
    if (focus.radius <= 0) {
      for (const id of [...this.groups.keys()]) this.remove(id);
      this.trim();
      return;
    }
    const { grid } = this.world;
    const columns = Math.ceil(grid.columns / PATCH_TILES);
    const rows = Math.ceil(grid.rows / PATCH_TILES);
    const reach = focus.radius / (PATCH_TILES * grid.spacing);
    const centreColumn = (focus.x - grid.minX) / (PATCH_TILES * grid.spacing);
    const centreRow = (focus.y - grid.minY) / (PATCH_TILES * grid.spacing);
    const first = { column: Math.max(0, Math.floor(centreColumn - reach)), row: Math.max(0, Math.floor(centreRow - reach)) };
    const last = { column: Math.min(columns - 1, Math.ceil(centreColumn + reach)), row: Math.min(rows - 1, Math.ceil(centreRow + reach)) };
    const near: { patch: number; away: number }[] = [];
    for (let row = first.row; row <= last.row; row += 1) {
      for (let column = first.column; column <= last.column; column += 1) {
        near.push({ patch: row * columns + column, away: Math.hypot(column + 0.5 - centreColumn, row + 0.5 - centreRow) });
      }
    }
    near.sort((a, b) => a.away - b.away || a.patch - b.patch);

    const wanted = new Set<number>();
    const { stock } = this.fauna;
    for (const { patch } of near) {
      for (let species = 0; species < MAMMAL_COUNT; species += 1) {
        const base = (patch * LIFE_COUNT + MAMMAL_BASE + species) * STAGES;
        const calves = stock[base + Stage.Hatchling]!;
        const juveniles = stock[base + Stage.Juvenile]!;
        const adults = stock[base + Stage.Adult]!;
        const crowd = calves + juveniles + adults;
        if (crowd < 1e-4) continue;
        const kind = MAMMALS[species]!;
        if (!MIGRATED.has(kind.key)) continue;
        const groups = Math.min(GROUP_SLOTS, Math.max(1, kind.groups));
        const centre = { x: grid.minX + (centreOf(patch, columns).column + 0.5) * PATCH_TILES * grid.spacing, y: grid.minY + (centreOf(patch, columns).row + 0.5) * PATCH_TILES * grid.spacing };
        const expected = (VISIBLE_GAIN * crowd * kind.sight * this.environment.comfortAt(kind, centre.x, centre.y)) / (groups * 0.5 * (Math.max(1, kind.size) + 1));
        for (let g = 0; g < groups; g += 1) {
          const id = (patch * MAMMAL_COUNT + species) * GROUP_SLOTS + g;
          if (hash2(id, this.seed, 11) >= expected) continue;
          wanted.add(id);
          if (this.groups.has(id) || (this.retry.get(id) ?? 0) > this.clock) continue;
          const shares = crowd > 0 ? { calf: calves / crowd, juvenile: juveniles / crowd } : { calf: 0, juvenile: 0 };
          this.spawn(id, patch, species, columns, shares);
        }
      }
    }
    for (const id of [...this.groups.keys()]) if (!wanted.has(id)) this.remove(id);
    this.trim();
  }

  private take(): number {
    const reused = this.free.pop();
    if (reused !== undefined) return reused;
    if (this.store.n >= ANIMAL_CAPACITY) return -1;
    const slot = this.store.n;
    this.store.n += 1;
    return slot;
  }

  private spawn(id: number, patch: number, species: number, columns: number, shares: { calf: number; juvenile: number }): void {
    const kind = MAMMALS[species]!;
    const life = MAMMAL_BASE + species;
    const random = prng(Math.imul(id + 1, 0x9e3779b1) ^ this.seed);
    const { grid } = this.world;
    const column = patch % columns;
    const row = Math.floor(patch / columns);
    let spot: Vec2 | null = null;
    for (let attempt = 0; attempt < SPAWN_ATTEMPTS && !spot; attempt += 1) {
      const candidate = { x: grid.minX + (column + random()) * PATCH_TILES * grid.spacing, y: grid.minY + (row + random()) * PATCH_TILES * grid.spacing };
      if (this.ground.suitability(life, candidate) > 0) spot = candidate;
    }
    if (!spot) {
      this.retry.set(id, this.clock + RETRY_SECONDS);
      return;
    }
    const size = Math.max(1, kind.size);
    const count = Math.min(size, 1 + Math.floor(random() * size));
    const roams = MOVING_GAITS.includes(kind.gait);
    const walker = new Walker(
      spot,
      { speed: kind.speed, reach: kind.reach, rest: kind.rest, restless: CONTINUOUS_GAITS.includes(kind.gait), radius: turnRadiusOf(kind.length), ...(behaviourOf(kind.key)?.hooks.wander ? { wander: behaviourOf(kind.key)!.hooks.wander! } : {}) },
      this.ground.passable(life),
      random,
      this.clock,
      LEGS_KEPT,
      WALKS_RETAINED_SECONDS,
    );
    const dwelling = behaviourOf(kind.key)?.home;
    const homeId = dwelling ? this.world.homes.settle(dwelling.kind as HomeKind, species, spot.x, spot.y, count, this.days(), dwelling.days) : -1;
    const homeSpot = homeId >= 0 ? { x: this.world.homes.x[homeId]!, y: this.world.homes.y[homeId]! } : spot;
    const group: Group = {
      id,
      species,
      life,
      walker,
      slots: [],
      offsets: [],
      facing: [],
      glances: [],
      stages: [],
      den: homeSpot,
      home: homeId,
      lag: lagOf(kind.social),
      roams,
      swims: (kind.realm & (Realm.Fresh | Realm.Sea)) !== 0,
      idles: behaviourOf(kind.key)?.idle ?? [],
      idleState: [],
      aim: [],
      treeGoal: null,
      idleStart: [],
      idleUntil: [],
      nextIdle: [],
      ability: abilityOf(kind.key),
      habits: habitsOf(kind.key, behaviourOf(kind.key)?.climb),
      nextClimb: this.clock + CLIMB_FIRST_SECONDS + random() * CLIMB_FIRST_SECONDS,
      nextBusy: 0,
      awake: true,
      nextOffsets: 0,
      random,
    };
    const spread = (0.8 + 0.7 * Math.sqrt(count)) * (0.5 + kind.length) * spreadOf(kind.social);
    for (let member = 0; member < count; member += 1) {
      const slot = this.take();
      if (slot < 0) break;
      const draw = random();
      let stage = ADULT;
      if (member > 0) {
        if (kind.social === Social.Family) {
          const young = Math.min(1, 3 * (shares.calf + shares.juvenile) + 0.25);
          if (draw < young) stage = draw < (young * shares.calf) / Math.max(shares.calf + shares.juvenile, 1e-6) ? CALF : JUVENILE;
        } else if (draw < shares.calf) stage = CALF;
        else if (draw < shares.calf + shares.juvenile) stage = JUVENILE;
      }
      let offset = { x: 0, y: 0 };
      if (member > 0) {
        const angle = random() * Math.PI * 2;
        const reach = spread * Math.sqrt(random());
        const candidate = { x: spot.x + Math.cos(angle) * reach, y: spot.y + Math.sin(angle) * reach };
        if (this.ground.suitability(life, candidate) > 0) offset = { x: candidate.x - spot.x, y: candidate.y - spot.y };
      }
      group.slots.push(slot);
      group.idleState.push(-1);
      group.aim.push(null);
      group.idleStart.push(0);
      group.idleUntil.push(0);
      group.nextIdle.push(this.clock + IDLE_FIRST_SECONDS + random() * IDLE_GAP_SECONDS);
      group.offsets.push(offset);
      group.glances.push(0);
      group.facing.push({ x: Math.cos(random() * Math.PI * 2), y: Math.sin(random() * Math.PI * 2) });
      group.stages.push(stage);
      const { store } = this;
      store.species[slot] = species;
      store.stage[slot] = stage;
      store.member[slot] = member;
      store.key[slot] = hash2(id, member, this.seed);
      store.groupKey[slot] = hash2(id, 0, this.seed ^ 0x5bd1e995);
      store.denX[slot] = group.den.x;
      store.denY[slot] = group.den.y;
      store.posX[slot] = spot.x + offset.x;
      store.posY[slot] = spot.y + offset.y;
      store.dirX[slot] = group.facing[member]!.x;
      store.dirY[slot] = group.facing[member]!.y;
      store.travelled[slot] = 0;
      store.going[slot] = 0;
    }
    if (group.slots.length === 0) return;
    this.groups.set(id, group);
  }

  private remove(id: number): void {
    const group = this.groups.get(id);
    if (!group) return;
    for (const slot of group.slots) {
      this.store.species[slot] = EMPTY;
      this.free.push(slot);
    }
    this.groups.delete(id);
  }

  private trim(): void {
    const { store } = this;
    let n = store.n;
    while (n > 0 && store.species[n - 1] === EMPTY) n -= 1;
    if (n === store.n) return;
    store.n = n;
    const kept = this.free.filter((slot) => slot < n);
    this.free.length = 0;
    this.free.push(...kept);
  }

  private climbing(group: Group, kind: MammalSpecies, time: number): void {
    const { ability, habits } = group;
    if (!ability || !habits || group.climb || group.hide || time < group.nextClimb || group.walker.remaining(time) > 0) return;
    group.nextClimb = time + habits.gap[0] + group.random() * (habits.gap[1] - habits.gap[0]);
    if (!group.awake || group.random() >= habits.taste) return;
    this.ascend(group, kind, time, 1);
  }

  private ascend(group: Group, kind: MammalSpecies, time: number, pace: number): boolean {
    const { ability, habits } = group;
    if (!ability || !habits) return false;
    this.forest ??= new Forest(this.world, this.world.plants, this.seed);
    const { grid } = this.world;
    const here = group.walker.pose(time).pos;
    const index = grid.atPoint(here);
    if (index < 0) return false;
    const column = grid.columnOf(index);
    const row = grid.rowOf(index);
    const near: { tile: number; away: number }[] = [];
    const reachTiles = Math.round(habits.search);
    for (let dy = -reachTiles; dy <= reachTiles; dy += 1) {
      for (let dx = -reachTiles; dx <= reachTiles; dx += 1) {
        const tile = grid.at(column + dx, row + dy);
        if (tile >= 0 && this.forest.tree(tile)) near.push({ tile, away: dx * dx + dy * dy + group.random() * 20 });
      }
    }
    near.sort((a, b) => a.away - b.away);
    const reachable = this.ground.passable(group.life);
    for (const { tile } of near.slice(0, CLIMB_CANDIDATES)) {
      const base = grid.centre(tile);
      if (!reachable(here, base)) continue;
      const arrival = time + Math.hypot(base.x - here.x, base.y - here.y) / Math.max(0.15, kind.speed * pace) + 1;
      const run = planRun(this.forest, ability, habits, tile, kind.speed, arrival, group.random);
      if (!run || !group.walker.sendTo(base, time, pace)) continue;
      const delay = group.walker.endsAt(time) - run.start;
      run.start += delay;
      run.end += delay;
      for (const point of run.points) point.time += delay;
      group.climb = run;
      group.walker.holdUntil(run.end);
      return true;
    }
    return false;
  }

  private finishClimb(group: Group, time: number): void {
    const { climb } = group;
    if (!climb) return;
    if (time >= climb.end && !climb.relocated) {
      climb.relocated = true;
      group.walker.relocate(climb.base, time, climb.total);
    }
    if (time >= climb.end + group.lag * group.slots.length + 1) delete group.climb;
  }

  private treeNear(x: number, y: number): Vec2 | null {
    this.forest ??= new Forest(this.world, this.world.plants, this.seed);
    const { grid } = this.world;
    const here = grid.atPoint({ x, y });
    if (here < 0) return null;
    const centre = grid.centre(here);
    let best: Vec2 | null = null;
    let nearest = Infinity;
    for (let dy = -TREE_SEARCH_TILES; dy <= TREE_SEARCH_TILES; dy += 1) {
      for (let dx = -TREE_SEARCH_TILES; dx <= TREE_SEARCH_TILES; dx += 1) {
        const tile = grid.atPoint({ x: centre.x + dx, y: centre.y + dy });
        if (tile < 0 || !this.forest.tree(tile)) continue;
        const at = grid.centre(tile);
        const gap = Math.hypot(at.x - x, at.y - y);
        if (gap < nearest) {
          nearest = gap;
          best = at;
        }
      }
    }
    return best;
  }

  private idle(group: Group, member: number, x: number, y: number, time: number): number {
    if (group.idles.length === 0 || !group.awake) return -1;
    const names = statesOf(behaviourOf(MAMMALS[group.species]!.key));
    if (group.idleUntil[member]! > time) return group.idleState[member]!;
    group.idleState[member] = -1;
    group.aim[member] = null;
    if (time < group.nextIdle[member]!) return -1;
    const { grid } = this.world;
    const index = grid.atPoint({ x, y });
    const grassy = index >= 0 && this.world.plants.herb[index] !== 0;
    const tree = member === 0 ? group.treeGoal ?? this.treeNear(x, y) : null;
    const usable = group.idles.filter((habit) => (habit.needs !== 'grass' || grassy) && (habit.needs !== 'tree' || tree !== null) && (group.treeGoal === null || habit.needs === 'tree') && names.indexOf(habit.state) >= 0);
    const total = usable.reduce((sum, habit) => sum + habit.weight, 0);
    group.nextIdle[member] = time + IDLE_FIRST_SECONDS + group.random() * IDLE_GAP_SECONDS;
    if (usable.length === 0) return -1;
    let draw = group.random() * total;
    const habit = usable.find((one) => (draw -= one.weight) <= 0) ?? usable[usable.length - 1]!;
    if (habit.needs === 'tree' && tree) {
      const gap = Math.hypot(tree.x - x, tree.y - y);
      if (gap > TREE_REACH_METRES) {
        const stand = { x: tree.x + ((x - tree.x) / gap) * TREE_STANDOFF_METRES, y: tree.y + ((y - tree.y) / gap) * TREE_STANDOFF_METRES };
        group.treeGoal = group.walker.sendTo(stand, time, TREE_WALK_PACE) ? tree : null;
        if (group.treeGoal) group.nextIdle[member] = group.walker.endsAt(time) + 0.4;
        return -1;
      }
      group.aim[member] = { x: (tree.x - x) / Math.max(gap, 0.01), y: (tree.y - y) / Math.max(gap, 0.01) };
    }
    group.treeGoal = null;
    const seconds = habit.seconds[0] + group.random() * (habit.seconds[1] - habit.seconds[0]);
    group.idleStart[member] = time;
    group.idleUntil[member] = time + seconds;
    group.nextIdle[member] = time + seconds + IDLE_FIRST_SECONDS + group.random() * IDLE_GAP_SECONDS;
    group.idleState[member] = names.indexOf(habit.state);
    return group.idleState[member]!;
  }

  private advance(group: Group, scaled: number): void {
    const { store } = this;
    const kind = MAMMALS[group.species]!;
    const time = this.clock;
    if (group.roams) {
      if (time >= group.nextBusy) {
        group.nextBusy = time + BUSY_REFRESH_SECONDS;
        const here = group.walker.pose(time).pos;
        group.awake = this.environment.busyAt(kind, here.x, here.y) > AWAKE_BUSY;
      }
      if (!group.climb) group.walker.update(time, group.awake);
      this.climbing(group, kind, time);
    }
    if (group.hide && time >= group.hide.until) delete group.hide;
    this.finishClimb(group, time);
    const behaviour = behaviourOf(kind.key);
    const burrowing = group.hide !== undefined && time >= group.hide.from ? statesOf(behaviour).indexOf('burrow') : -1;
    const blocked = (point: Vec2, full: boolean): boolean => (!group.swims && this.ground.wet(point)) || (full && this.ground.suitability(group.life, point) <= 0);
    const checkOffsets = time >= group.nextOffsets;
    if (checkOffsets) group.nextOffsets = time + OFFSET_CHECK_SECONDS;
    for (let member = 0; member < group.slots.length; member += 1) {
      const slot = group.slots[member]!;
      const lagged = time - group.lag * member * (group.stages[member] === ADULT ? 1 : 0.5);
      const aloft = group.climb ? poseAt(group.climb, lagged) : null;
      const pose = aloft ? { pos: { x: aloft.x, y: aloft.y }, dir: { x: aloft.dirX, y: aloft.dirY }, going: aloft.moving, pace: 1 } : group.walker.pose(lagged);
      let offset = aloft ? { x: 0, y: 0 } : group.offsets[member]!;
      const x = pose.pos.x + offset.x;
      const y = pose.pos.y + offset.y;
      if (!aloft && member > 0 && (offset.x !== 0 || offset.y !== 0) && blocked({ x, y }, checkOffsets)) {
        const half = { x: offset.x * 0.5, y: offset.y * 0.5 };
        offset = blocked({ x: pose.pos.x + half.x, y: pose.pos.y + half.y }, true) ? { x: 0, y: 0 } : half;
        group.offsets[member] = offset;
      }
      const aim = group.idleUntil[member]! > time ? group.aim[member] ?? null : null;
      const facing = turnToward(group.facing[member]!, aim ?? pose.dir, FACING_RADIANS_PER_SECOND * scaled);
      group.facing[member] = facing;
      store.posX[slot] = pose.pos.x + offset.x;
      store.posY[slot] = pose.pos.y + offset.y;
      const wanted = kind.length >= GLANCE_FROM_METRES ? group.walker.glance(lagged) : 0;
      const glance = group.glances[member]! + (wanted - group.glances[member]!) * (1 - Math.exp(-GLANCE_PER_SECOND * scaled));
      group.glances[member] = glance;
      store.glance[slot] = glance;
      store.dirX[slot] = facing.x;
      store.dirY[slot] = facing.y;
      const resting = !aloft && !pose.going && burrowing < 0 && !group.climb;
      const idling = resting ? this.idle(group, member, pose.pos.x + offset.x, pose.pos.y + offset.y, time) : -1;
      if (!resting && group.idleUntil[member]! > time) group.idleUntil[member] = time;
      store.going[slot] = pose.going ? 1 : 0;
      store.posZ[slot] = aloft ? aloft.z : 0;
      store.pitch[slot] = aloft ? aloft.pitch : 0;
      store.state[slot] = aloft ? stateOfMode(statesOf(behaviour), aloft.mode) : burrowing >= 0 ? burrowing : pose.going ? stateIndexOf(behaviour, pose) : idling >= 0 ? idling : 0;
      store.since[slot] = burrowing >= 0 ? time - group.hide!.from : idling >= 0 ? time - group.idleStart[member]! : 0;
      store.left[slot] = burrowing >= 0 ? group.hide!.until - time : idling >= 0 ? group.idleUntil[member]! - time : 0;
      store.travelled[slot] = group.walker.distance(lagged) + (aloft ? aloft.travelled : 0);
    }
  }
}
