import type { TileIndex } from '../grid.ts';
import { CAMPFIRE, STANDING_TORCH, igniterNear } from '../sources/emitters.ts';
import { BURN_PER_SECOND, FUEL_CAPACITY, FULL_FLAME_FUEL, LOW_FUEL, fireLevel, reachScale } from '../sources/fuel.ts';
import type { World } from '../world.ts';
import { Blueprint, Building, FLOOR_CAPACITY, STORAGE_CAPACITY } from '../world.ts';
import { ITEM_NAMES } from './items.ts';
import type { People } from './people.ts';
import { PLAN_NEEDS } from './people.ts';
import { PERSON_NAMES } from './thoughts.ts';

export interface StructureView {
  title: string;
  share: number | null;
  gauge: string;
  rows: readonly (readonly [string, string])[];
}

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

function contents(world: World, tile: TileIndex): string {
  const counts = new Map<number, number>();
  for (const slot of world.items.at(tile)) {
    const kind = world.items.kind[slot]!;
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  if (counts.size === 0) return 'nothing';
  return [...counts].map(([kind, count]) => `${count} ${ITEM_NAMES[kind] ?? 'item'}`).join(', ');
}

function sleepersAt(world: World, people: People, tile: TileIndex): string {
  const names: string[] = [];
  for (let person = 0; person < people.count; person += 1) {
    if (!people.isLying(person)) continue;
    const here = world.grid.at(world.grid.column(people.posX[person]!), world.grid.row(people.posY[person]!));
    if (here === tile || (world.built[tile] === Building.Hut && people.shelterAt(here) === Building.Hut && Math.abs(world.grid.columnOf(here) - world.grid.columnOf(tile)) <= 1 && Math.abs(world.grid.rowOf(here) - world.grid.rowOf(tile)) <= 1)) names.push(PERSON_NAMES[person] ?? 'Someone');
  }
  return names.length > 0 ? names.join(' and ') : 'nobody';
}

function planView(world: World, people: People, tile: TileIndex): StructureView {
  const plan = world.plan[tile];
  const relight = plan === Blueprint.Relight;
  const struck = relight || plan === Blueprint.Kindle;
  const centre = world.grid.centre(tile);
  const missing: string[] = [];
  let laid = 0;
  let total = 0;

  for (const [kind, count] of PLAN_NEEDS[world.plan[tile]!] ?? []) {
    const have = Math.min(count, world.items.tally(tile, kind));
    laid += have;
    total += count;
    const short = count - have;
    if (short === 0) continue;
    const loose = people.available(kind, tile) - world.items.tally(tile, kind);
    const name = ITEM_NAMES[kind] ?? 'item';
    missing.push(`${short} more ${name}${loose < short ? `, ${Math.max(0, loose)} loose in reach` : ''}`);
  }
  const fire = plan !== Blueprint.Bed && plan !== Blueprint.Hut && plan !== Blueprint.Snare;
  if (!struck && fire) {
    total += 1;
    if (!igniterNear(world, people, centre.x, centre.y)) missing.push('a flame to light it');
  }

  let builder = 'nobody yet';
  for (let person = 0; person < people.count; person += 1) {
    if (people.buildTile[person] === tile) {
      builder = PERSON_NAMES[person] ?? 'Someone';
      break;
    }
  }

  const share = laid / total;
  return {
    title: plan === Blueprint.Snare ? 'snare site' : plan === Blueprint.Bed ? 'bed site' : plan === Blueprint.Hut ? 'hut site' : relight ? 'campfire relight' : plan === Blueprint.Kindle ? 'campfire to kindle' : 'campfire site',
    share,
    gauge: `${Math.round(share * 100)}%`,
    rows: [
      ['builder', builder],
      ['needs', missing.length > 0 ? missing.join('; ') : !fire ? 'ready to build' : struck ? 'ready to strike' : 'ready to light'],
    ],
  };
}

const glow = (fuel: number): string => (fuel < LOW_FUEL / 2 ? 'dying' : fuel < LOW_FUEL ? 'low' : fuel < FULL_FLAME_FUEL ? 'burning' : 'roaring');

export function structureAt(world: World, people: People, tile: TileIndex): StructureView | null {
  if (world.isPlanned(tile)) return planView(world, people, tile);

  if (world.isFire(tile)) {
    const fuel = world.fuelAt(tile);
    const scale = reachScale(fireLevel(fuel));
    return {
      title: 'campfire',
      share: fuel / FUEL_CAPACITY,
      gauge: glow(fuel),
      rows: [
        ['burns for', `about ${plural(Math.max(1, Math.round(fuel / BURN_PER_SECOND / 60)), 'hour')}`],
        ['warms', plural(Math.round((CAMPFIRE.heat?.reach ?? 0) * scale), 'tile')],
        ['lights', plural(Math.round((CAMPFIRE.light?.reach ?? 0) * scale), 'tile')],
      ],
    };
  }

  if (world.isEmber(tile)) {
    return {
      title: 'burnt campfire',
      share: null,
      gauge: '',
      rows: [['state', 'burnt out, charred logs']],
    };
  }

  if (world.isStorage(tile)) {
    const count = world.items.at(tile).length;
    return {
      title: 'storage',
      share: count / STORAGE_CAPACITY,
      gauge: `${count} of ${STORAGE_CAPACITY}`,
      rows: [['holds', contents(world, tile)]],
    };
  }

  if (world.isFloor(tile)) {
    const count = world.items.at(tile).length;
    return {
      title: 'knapping floor',
      share: count / FLOOR_CAPACITY,
      gauge: `${count} of ${FLOOR_CAPACITY}`,
      rows: [['lying', contents(world, tile)]],
    };
  }

  if (world.built[tile] === Building.Snare) {
    return {
      title: 'snare',
      share: null,
      gauge: '',
      rows: [['holds', contents(world, tile)]],
    };
  }

  if (world.built[tile] === Building.Bed || world.built[tile] === Building.Hut) {
    const hut = world.built[tile] === Building.Hut;
    return {
      title: hut ? 'hut' : 'bed',
      share: null,
      gauge: '',
      rows: [
        ['sleep', hut ? 'rests twice as fast, and keeps the cold off' : 'rests half as fast again, off the ground'],
        ['sleeping here', sleepersAt(world, people, tile)],
      ],
    };
  }

  if (world.torch[tile] === 1) {
    return {
      title: 'standing torch',
      share: null,
      gauge: '',
      rows: [
        ['warms', plural(STANDING_TORCH.heat?.reach ?? 0, 'tile')],
        ['lights', plural(STANDING_TORCH.light?.reach ?? 0, 'tile')],
      ],
    };
  }

  return null;
}
