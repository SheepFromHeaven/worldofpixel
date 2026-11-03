import { STRUCTURES } from './api.ts';
import './activities.ts';
import { abandonPlan, sendToBuild, sendToRaze } from './build.ts';
import { PEOPLE } from '../people/api.ts';
import { system } from '../../sim/kernel/kernel.ts';
import type { Offer, Offers } from '../../sim/offers.ts';
import { NOBODY } from '../people/api.ts';
import { BUILDABLES, buildableIdOf, buildableOf, buildableOfPlan, planOf } from '../../content/buildables.ts';
import { stationOf } from '../../content/stations/index.ts'; 
import { Blueprint, Station } from './api.ts';
import { defineModule } from '../../sim/kernel/module.ts';

const cancelLabel = (plan: number): string => (plan === Blueprint.Relight ? 'Cancel Relight' : buildableOfPlan(plan) ? `Cancel ${buildableOfPlan(plan)!.name} Plan` : 'Cancel Campfire Plan');

export const constructionVerbs = system({
  id: 'construction',
  needs: { structures: STRUCTURES, people: PEOPLE },
  create: ({ structures, people }) => {
    const build = (tile: number, planned: boolean): boolean => {
      if (!planned) return false;
      const who = people.builderFor(tile);
      if (who !== NOBODY) sendToBuild(people, who, tile);
      return true;
    };
    const blueprint = ({ tile, station, turn = 0 }: { tile: number; station: string; turn?: number }): boolean => {
      const id = buildableIdOf(station);
      const def = buildableOf(id)!;
      if (def.placedBy !== null) return false;
      const anchor = structures.anchorOf(tile);
      return def.needs.length === 0 ? structures.place(anchor, id, turn) : build(anchor, structures.planStation(anchor, planOf(id), turn));
    };
    return {
      commands: {
        planCampfire: ({ tile }: { tile: number }) => build(tile, structures.planCampfire(tile)),
        planKindle: ({ tile }: { tile: number }) => build(tile, structures.planKindle(tile)),
        planRelight: ({ tile }: { tile: number }) => build(tile, structures.planRelight(tile)),
        blueprint,
        arm: (args: { tile: number; station: string; place?: string; turn?: number }, kernel) => (args.place ? kernel.run(args.place, args) : blueprint(args)),
        demolish: ({ tile }: { tile: number }) => {
          if (people.count === 0) return structures.demolish(tile);
          const who = people.builderFor(tile);
          return who !== NOBODY && sendToRaze(people, who, tile);
        },
        cancelPlan: ({ tile }: { tile: number }) => {
          const anchor = structures.anchorOf(tile);
          abandonPlan(people, anchor);
          return structures.unplan(anchor);
        },
      },
    };
  },
});

const offers: Offers = (context, tile) => {
  const { world } = context;
  const out: Offer[] = [];
  const built = world.structures.built[tile]!;

  const standing = stationOf(built);
  const idle = context.people.count > 0 && context.people.builderFor(tile) === NOBODY ? 'nobody is free' : null;
  if (standing) out.push({ label: `Take Down ${standing.name}`, reason: idle, command: { kind: 'demolish', tile } });
  const laid = buildableOf(world.structures.block[tile]!);
  if (!standing && laid) out.push({ label: `Take Down ${laid.name}`, reason: idle, command: { kind: 'demolish', tile } });
  const buildable = !world.structures.isPlanned(tile) && !world.structures.isFire(tile) && !world.structures.isEmber(tile) && built === Station.None;
  for (const def of BUILDABLES) {
    if (!buildable || def.placedBy !== null || (def.unlock !== null && !context.knows(def.unlock))) continue;
    out.push({ label: def.name, reason: null, command: { kind: 'arm', brush: 'structure', tile, station: def.key }, group: 'erect', earned: def.unlock !== null });
  }

  const centre = world.grid.centre(tile);
  const unfree = world.structures.isFire(tile) || world.structures.isStorage(tile);
  const campfire = BUILDABLES.find((def) => def.placedBy === 'planCampfire');
  const arm = (place: string): NonNullable<Offer['command']> => ({ kind: 'arm', brush: 'structure', tile, station: campfire!.key, place });
  if (world.structures.isPlanned(tile)) out.push({ label: cancelLabel(world.structures.plan[tile]!), reason: null, command: { kind: 'cancelPlan', tile } });
  else if (world.structures.isEmber(tile)) out.push({ label: 'Relight Campfire', reason: null, command: { kind: 'planRelight', tile } });
  else if (!unfree && context.igniterNear(centre.x, centre.y)) out.push({ label: 'Campfire', reason: null, command: arm('planCampfire'), group: 'erect', earned: true });
  else if (!unfree && context.knows('flame')) out.push({ label: 'Campfire', reason: null, command: arm('planKindle'), group: 'erect', earned: true });
  return out;
};

export const constructionModule = defineModule('construction', [constructionVerbs], { order: 90, stage: true, offers: [offers] });
