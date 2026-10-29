import { PEOPLE, STRUCTURES } from '../capabilities.ts';
import { system } from '../kernel/kernel.ts';
import type { Offer, Offers } from '../offers.ts';
import { standable } from '../offers.ts';
import { NOBODY } from '../people/people.ts';
import type { EmitterSource } from '../sources/emitters.ts';
import { HUT_IDS, HUT_WINDOW } from '../sources/emitters.ts';
import type { Structures } from '../layers/structures.ts';
import { Blueprint, Building, Cover } from '../world.ts';
import { defineModule } from './module.ts';

const BLUEPRINTS = { planBed: Blueprint.Bed, planHut: Blueprint.Hut, planSnare: Blueprint.Snare } as const;

const CANCEL_LABELS: Readonly<Record<number, string>> = {
  [Blueprint.Relight]: 'Cancel Relight',
  [Blueprint.Bed]: 'Cancel Bed Plan',
  [Blueprint.Hut]: 'Cancel Hut Plan',
  [Blueprint.Snare]: 'Cancel Snare Plan',
};

export const constructionVerbs = system({
  id: 'construction',
  needs: { structures: STRUCTURES, people: PEOPLE },
  create: ({ structures, people }) => {
    const build = (tile: number, planned: boolean): boolean => {
      if (!planned) return false;
      const who = people.builderFor(tile);
      if (who !== NOBODY) people.sendToBuild(who, tile);
      return true;
    };
    const building = (blueprint: Parameters<Structures['planBuilding']>[1]) => ({ tile }: { tile: number }) => build(tile, structures.planBuilding(tile, blueprint));
    return {
      commands: {
        planCampfire: ({ tile }: { tile: number }) => build(tile, structures.planCampfire(tile)),
        planKindle: ({ tile }: { tile: number }) => build(tile, structures.planKindle(tile)),
        planRelight: ({ tile }: { tile: number }) => build(tile, structures.planRelight(tile)),
        planBed: building(BLUEPRINTS.planBed),
        planHut: building(BLUEPRINTS.planHut),
        planSnare: building(BLUEPRINTS.planSnare),
        demolish: ({ tile }: { tile: number }) => (structures.demolish(tile), true),
        cancelPlan: ({ tile }: { tile: number }) => (people.abandonPlan(tile), structures.unplan(tile), true),
      },
    };
  },
});

const offers: Offers = (context, tile) => {
  const { world } = context;
  const here = world.tile(tile);
  const out: Offer[] = [];
  const blocked = here.cover === Cover.Tree ? 'a tree is in the way' : standable(context, tile);
  const freeGround = !world.structures.isStorage(tile) && !world.structures.isFloor(tile);
  const built = world.structures.built[tile]!;

  if (built !== Building.None) out.push({ label: built === Building.Hut ? 'Take Down Hut' : built === Building.Snare ? 'Take Down Snare' : 'Take Down Bed', reason: null, command: { kind: 'demolish', tile } });
  const buildable = freeGround && !world.structures.isPlanned(tile) && !world.structures.isFire(tile) && !world.structures.isEmber(tile) && built === Building.None;
  for (const [label, kind, knowledge] of [['Bed', 'planBed', 'bed'], ['Snare', 'planSnare', 'snare'], ['Hut', 'planHut', 'hut']] as const) {
    if (buildable && context.knows(knowledge)) out.push({ label, reason: blocked, command: { kind, tile }, group: 'erect', earned: true });
  }

  const centre = world.grid.centre(tile);
  const unfree = world.structures.isFire(tile) || world.structures.isStorage(tile);
  if (world.structures.isPlanned(tile)) out.push({ label: CANCEL_LABELS[world.structures.plan[tile]!] ?? 'Cancel Campfire Plan', reason: null, command: { kind: 'cancelPlan', tile } });
  else if (world.structures.isEmber(tile)) out.push({ label: 'Relight Campfire', reason: null, command: { kind: 'planRelight', tile } });
  else if (!unfree && context.igniterNear(centre.x, centre.y)) out.push({ label: 'Campfire', reason: here.passable ? (here.cover === Cover.Tree ? 'a tree is in the way' : null) : (here.refusal ?? 'cannot stand here'), command: { kind: 'planCampfire', tile }, group: 'erect' });
  else if (!unfree && context.knows('flame')) out.push({ label: 'Campfire', reason: here.passable ? (here.cover === Cover.Tree ? 'a tree is in the way' : null) : (here.refusal ?? 'cannot stand here'), command: { kind: 'planKindle', tile }, group: 'erect', earned: true });
  return out;
};

const OCCUPIED_WITHIN_TILES = 3;

const windows: EmitterSource = (world, people, out) => {
  const { grid, structures } = world;
  for (const tile of structures.buildings) {
    if (structures.built[tile] !== Building.Hut) continue;
    const at = grid.centre(tile);
    let occupied = false;
    for (let person = 0; person < people.count && !occupied; person += 1) {
      occupied = people.isLying(person) && Math.hypot(people.posX[person]! - at.x, people.posY[person]! - at.y) <= OCCUPIED_WITHIN_TILES;
    }
    if (occupied) out.push({ id: HUT_IDS + tile, kind: HUT_WINDOW, x: at.x, y: at.y, level: 1 });
  }
};

export const constructionModule = defineModule('construction', [constructionVerbs], { offers: [offers], emitters: [windows] });
