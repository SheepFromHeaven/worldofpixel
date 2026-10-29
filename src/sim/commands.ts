import type { TrialOutcome } from './discovery/trial.ts';
import type { People } from './people/people.ts';
import { NOBODY } from './people/people.ts';
import type { Command, GameMode } from './simulation.ts';
import type { World } from './world.ts';
import { Blueprint } from './world.ts';

export function commitTrial(world: World, people: People, person: number, outcome: TrialOutcome): void {
  const { items } = world;
  for (const slot of [...items.at(outcome.tile)]) items.remove(slot);
  for (const kind of outcome.kept) items.add(outcome.tile, kind);
  if (outcome.axe) people.knowledge.hasDiscoveredFlintKnapping = true;
  people.endTrial(person);
}

export function applyPeopleCommand(world: World, people: People, mode: GameMode, command: Command): boolean | null {
  switch (command.kind) {
    case 'lightTorch': {
      const who = people.lighterFor(command.tile);
      if (who !== NOBODY) people.sendToLight(who, command.tile);
      return true;
    }
    case 'planCampfire':
    case 'planKindle':
    case 'planRelight': {
      const planned = command.kind === 'planCampfire' ? world.planCampfire(command.tile) : command.kind === 'planKindle' ? world.planKindle(command.tile) : world.planRelight(command.tile);
      if (!planned) return false;
      const who = people.builderFor(command.tile);
      if (who !== NOBODY) people.sendToBuild(who, command.tile);
      return true;
    }
    case 'planBed':
    case 'planHut':
    case 'planSnare': {
      if (!world.planBuilding(command.tile, command.kind === 'planBed' ? Blueprint.Bed : command.kind === 'planHut' ? Blueprint.Hut : Blueprint.Snare)) return false;
      const who = people.builderFor(command.tile);
      if (who !== NOBODY) people.sendToBuild(who, command.tile);
      return true;
    }
    case 'demolish':
      world.demolish(command.tile);
      return true;
    case 'addFuel': {
      const who = people.feederFor(command.tile);
      if (who !== NOBODY) people.sendToFeed(who, command.tile);
      return true;
    }
    case 'cancelPlan':
      people.abandonPlan(command.tile);
      world.unplan(command.tile);
      return true;
    case 'plantTorch': {
      if (mode === 'discover') {
        world.plant(command.tile);
        return true;
      }
      const who = people.planterFor(command.tile);
      if (who !== NOBODY) people.sendToPlant(who, command.tile);
      return true;
    }
    case 'layFloor':
      world.layFloor(command.tile);
      return true;
    case 'clearFloor':
      world.unfloor(command.tile);
      return true;
    case 'designateStorage':
      world.designate(command.tile);
      return true;
    case 'clearStorage':
      world.release(command.tile);
      return true;
    case 'pickUp': {
      const who = people.pickerFor(command.tile);
      if (who !== NOBODY) people.sendToPick(who, command.tile, command.item);
      return true;
    }
    case 'bringHere': {
      const who = people.carrierFor(command.tile);
      if (who !== NOBODY) people.sendToBring(who, command.tile);
      return true;
    }
    case 'gather':
      people.setGathering(command.on);
      return true;
    case 'angle':
      people.setAngling(command.on);
      return true;
    case 'roast': {
      const who = people.roasterFor(command.tile);
      if (who !== NOBODY) people.sendToRoast(who, command.tile);
      return true;
    }
    case 'wonder':
      people.mind?.wonder(command.a, command.b);
      return true;
    case 'forget':
      people.mind?.cancel(command.id);
      return true;
    case 'order':
      people.mind?.order(command.result, command.tile);
      return true;
    case 'experiment': {
      const who = people.knapperFor(command.tile);
      if (who !== NOBODY) people.sendToKnap(who, command.tile);
      return true;
    }
    case 'chopWood': {
      const who = people.chopperFor(command.tile);
      if (who !== NOBODY) people.sendToChop(who, command.tile);
      return true;
    }
    default:
      return null;
  }
}
