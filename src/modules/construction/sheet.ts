import type { TileIndex } from '../../sim/grid.ts';
import { GAME_EMITTERS } from '../index.ts';
import { CAMPFIRE, STANDING_TORCH, gather, igniterIn } from '../fire/api.ts';
import { BURN_PER_SECOND, FUEL_CAPACITY, FULL_FLAME_FUEL, LOW_FUEL, fireLevel, reachScale } from '../fire/api.ts';
import type { World } from '../../sim/world.ts';
import { Blueprint } from './api.ts';
import { buildableOf, buildableOfPlan, isBuildPlan } from '../../content/buildables.ts';
import { stationOf } from '../../content/stations/index.ts';
import { ITEM_ART, ITEM_NAMES } from '../items/api.ts';
import type { People } from '../people/api.ts';
import { PLAN_NEEDS } from './tuning.ts';
import { needsClearing } from './build.ts';
import type { StructureNeed, StructureView } from '../clientSlots.ts';
import { PERSON_NAMES } from '../thoughts/api.ts';

export type { StructureNeed, StructureView } from '../clientSlots.ts';

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

function stack(world: World, tile: TileIndex): StructureNeed[] {
  const counts = new Map<number, number>();
  for (const slot of world.items.at(tile)) {
    const kind = world.items.kind[slot]!;
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return [...counts].map(([kind, count]) => ({ icon: ITEM_ART[kind] ?? 'crate', name: ITEM_NAMES[kind] ?? 'item', count }));
}

function sleepersAt(world: World, people: People, tile: TileIndex): string {
  const names: string[] = [];
  for (let person = 0; person < people.count; person += 1) {
    if (!people.isLying(person)) continue;
    const here = world.grid.at(world.grid.column(people.posX[person]!), world.grid.row(people.posY[person]!));
    if (here === tile || (stationOf(world.structures.built[tile]!)?.shelter?.reach === 'adjacent' && people.shelterAt(here) === world.structures.built[tile] && Math.abs(world.grid.columnOf(here) - world.grid.columnOf(tile)) <= 1 && Math.abs(world.grid.rowOf(here) - world.grid.rowOf(tile)) <= 1)) names.push(PERSON_NAMES[person] ?? 'Someone');
  }
  return names.length > 0 ? names.join(' and ') : 'nobody';
}

function planView(world: World, people: People, tile: TileIndex): StructureView {
  const plan = world.structures.plan[tile]!;
  const relight = plan === Blueprint.Relight;
  const struck = relight || plan === Blueprint.Kindle;
  const centre = world.grid.centre(tile);
  const missing: string[] = [];
  const shortOf: StructureNeed[] = [];
  let laid = 0;
  let total = 0;

  for (const [kind, count] of PLAN_NEEDS[world.structures.plan[tile]!] ?? []) {
    const have = Math.min(count, world.items.tally(tile, kind));
    laid += have;
    total += count;
    const short = count - have;
    if (short === 0) continue;
    shortOf.push({ icon: ITEM_ART[kind] ?? 'crate', name: ITEM_NAMES[kind] ?? 'item', count: short });
  }
  const fire = !isBuildPlan(plan);
  if (!struck && fire) {
    total += 1;
    if (igniterIn(gather(GAME_EMITTERS, world, people), centre.x, centre.y)) laid += 1;
    else missing.push('a flame to light it');
  }

  let builder = 'nobody yet';
  for (let person = 0; person < people.count; person += 1) {
    if (people.buildTile[person] === tile) {
      builder = PERSON_NAMES[person] ?? 'Someone';
      break;
    }
  }

  const phase = !fire ? (needsClearing(people, tile) ? 'clearing the ground' : shortOf.length > 0 ? 'gathering materials' : 'building') : '';
  const share = laid / total;
  return {
    title: isBuildPlan(plan) ? `${buildableOfPlan(plan)!.name.toLowerCase()} site` : relight ? 'campfire relight' : plan === Blueprint.Kindle ? 'campfire to kindle' : 'campfire site',
    share,
    gauge: `${Math.round(share * 100)}%`,
    rows: [
      ['builder', builder],
      ['phase', phase],
      ['needs', missing.length > 0 ? missing.join('; ') : shortOf.length > 0 ? '' : !fire ? 'ready to build' : struck ? 'ready to strike' : 'ready to light'],
    ].filter(([word, value]) => (word !== 'needs' && word !== 'phase') || value !== '') as [string, string][],
    missing: shortOf,
  };
}

const glow = (fuel: number): string => (fuel < LOW_FUEL / 2 ? 'dying' : fuel < LOW_FUEL ? 'low' : fuel < FULL_FLAME_FUEL ? 'burning' : 'roaring');

export function structureAt(world: World, people: People, tile: TileIndex): StructureView | null {
  if (world.structures.isPlanned(tile)) return planView(world, people, world.structures.anchorOf(tile));

  if (world.structures.isFire(tile)) {
    const fuel = world.structures.fuelAt(tile);
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

  if (world.structures.isEmber(tile)) {
    return {
      title: 'burnt campfire',
      share: null,
      gauge: '',
      rows: [['state', 'burnt out, charred logs']],
    };
  }

  if (world.structures.isStorage(tile)) {
    const count = world.items.at(tile).length;
    return {
      title: 'storage',
      share: count / world.structures.capacityAt(tile),
      gauge: `${count} of ${world.structures.capacityAt(tile)}`,
      rows: [],
      stored: stack(world, tile),
    };
  }

  if (world.structures.isFloor(tile)) {
    const count = world.items.at(tile).length;
    return {
      title: 'knapping floor',
      share: count / world.structures.capacityAt(tile),
      gauge: `${count} of ${world.structures.capacityAt(tile)}`,
      rows: [],
      stored: stack(world, tile),
    };
  }

  const station = stationOf(world.structures.built[tile]!);
  if (station && !station.shelter) {
    return {
      title: station.name.toLowerCase(),
      share: null,
      gauge: '',
      rows: [],
      stored: stack(world, tile),
    };
  }

  if (station) {
    return {
      title: station.name.toLowerCase(),
      share: null,
      gauge: '',
      rows: [
        ['sleep', station.blurb],
        ['sleeping here', sleepersAt(world, people, tile)],
      ],
    };
  }

  const laid = buildableOf(world.structures.block[tile]!);
  if (laid) return { title: laid.name.toLowerCase(), share: null, gauge: '', rows: [['is', laid.blurb]] };

  if (world.structures.torch[tile] === 1) {
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
