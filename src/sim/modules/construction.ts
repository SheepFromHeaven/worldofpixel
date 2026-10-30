import { PEOPLE, STRUCTURES } from '../capabilities.ts';
import { system } from '../kernel/kernel.ts';
import type { Offer, Offers } from '../offers.ts';
import { standable } from '../offers.ts';
import { NOBODY } from '../people/people.ts';
import { BUILDINGS, buildingIdOf, buildingOf, buildingOfPlan, planOf } from '../../content/buildings/index.ts';
import { Blueprint, Building, Cover } from '../world.ts';
import { defineModule } from './module.ts';

const cancelLabel = (plan: number): string => (plan === Blueprint.Relight ? 'Cancel Relight' : buildingOfPlan(plan) ? `Cancel ${buildingOfPlan(plan)!.name} Plan` : 'Cancel Campfire Plan');

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
    return {
      commands: {
        planCampfire: ({ tile }: { tile: number }) => build(tile, structures.planCampfire(tile)),
        planKindle: ({ tile }: { tile: number }) => build(tile, structures.planKindle(tile)),
        planRelight: ({ tile }: { tile: number }) => build(tile, structures.planRelight(tile)),
        build: ({ tile, building }: { tile: number; building: string }) => {
          const id = buildingIdOf(building);
          if (buildingOf(id)!.placedBy !== null) return false;
          return buildingOf(id)!.needs.length === 0 ? structures.place(tile, id) : build(tile, structures.planBuilding(tile, planOf(id)));
        },
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
  const built = world.structures.built[tile]!;

  const standing = buildingOf(built);
  if (standing) out.push({ label: `Take Down ${standing.name}`, reason: null, command: { kind: 'demolish', tile } });
  const buildable = !world.structures.isPlanned(tile) && !world.structures.isFire(tile) && !world.structures.isEmber(tile) && built === Building.None;
  for (const def of BUILDINGS) {
    if (!buildable || def.placedBy !== null || (def.unlock !== null && !context.knows(def.unlock))) continue;
    const blocked = here.cover === Cover.Tree && !def.footprint.trees ? 'a tree is in the way' : standable(context, tile);
    out.push({ label: def.name, reason: blocked, command: { kind: 'build', tile, building: def.key }, group: 'erect', earned: def.unlock !== null });
  }

  const centre = world.grid.centre(tile);
  const unfree = world.structures.isFire(tile) || world.structures.isStorage(tile);
  if (world.structures.isPlanned(tile)) out.push({ label: cancelLabel(world.structures.plan[tile]!), reason: null, command: { kind: 'cancelPlan', tile } });
  else if (world.structures.isEmber(tile)) out.push({ label: 'Relight Campfire', reason: null, command: { kind: 'planRelight', tile } });
  else if (!unfree && context.igniterNear(centre.x, centre.y)) out.push({ label: 'Campfire', reason: here.passable ? (here.cover === Cover.Tree ? 'a tree is in the way' : null) : (here.refusal ?? 'cannot stand here'), command: { kind: 'planCampfire', tile }, group: 'erect' });
  else if (!unfree && context.knows('flame')) out.push({ label: 'Campfire', reason: here.passable ? (here.cover === Cover.Tree ? 'a tree is in the way' : null) : (here.refusal ?? 'cannot stand here'), command: { kind: 'planKindle', tile }, group: 'erect', earned: true });
  return out;
};

export const constructionModule = defineModule('construction', [constructionVerbs], { offers: [offers] });
