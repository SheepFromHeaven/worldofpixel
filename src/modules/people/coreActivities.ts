import { NOWHERE } from '../../sim/grid.ts';
import { Cover } from '../../sim/world.ts';
import { FEEDS } from '../fire/api.ts';
import { ItemType } from '../items/api.ts';
import { pickedUpHooks, registerActivity } from './activities.ts';
import { carryToStorage, finishChop, finishPick, finishPlant, beginHaul } from './haul.ts';
import { beginAngle, beginDrink, beginEat, beginGather, beginScavenge, eatHeld, finishDrink, finishFish, finishForage, finishRoast, finishScavenge, fruitLayer, holdsRaw, sendToRoast, waterBeside } from './food.ts';
import { beginFeed, besideFire, finishFeed, finishLight, fireBeside, sendToFeed } from './fireside.ts';
import { beginSleep, wantsSleep } from './sleep.ts';
import { beginWonder, finishWonder, nextWonderStep } from './wonder.ts';
import { EntityState } from './states.ts';
import { CHOP_SECONDS, DRINK_MAX_SECONDS, FEED_SECONDS, FISH_SECONDS, FORAGE_HUNGER, FORAGE_IN_THE_DARK, FORAGE_SECONDS, HAUL_CHANCE, LIGHT_SECONDS, NIGHT_SLEEPY, PICK_SECONDS, PLANT_SECONDS, ROAST_SECONDS, SCAVENGE_CHANCE, SCAVENGE_SECONDS, STRIKE_INTERVAL, THIRSTY_ENOUGH, THIRSTY_IN_THE_DARK, TRIAL_SECONDS, Task } from './tuning.ts';

registerActivity({
  id: 'drink',
  rest: { priority: 10, choose: (people, person, { sheltering }) => people.thirst[person]! > (sheltering ? THIRSTY_IN_THE_DARK : THIRSTY_ENOUGH) && beginDrink(people, person) },
  arrives: {
    task: Task.Drink,
    begin: (people, person, tile) => {
      const found = waterBeside(people, tile);
      if (found === NOWHERE) return false;
      const water = people.world.grid.centre(found);
      people.heading[person] = Math.atan2(water.y - people.posY[person]!, water.x - people.posX[person]!);
      people.state[person] = EntityState.Drinking;
      people.timer[person] = DRINK_MAX_SECONDS;
      return true;
    },
  },
  finishes: { state: EntityState.Drinking, finish: (people, person) => (finishDrink(people, person), false) },
});

registerActivity({
  id: 'eat',
  rest: { priority: 20, choose: (people, person, { sheltering }) => people.hunger[person]! > (sheltering ? FORAGE_IN_THE_DARK : FORAGE_HUNGER) && beginEat(people, person) },
});

registerActivity({
  id: 'sleep',
  rest: {
    priority: 30,
    choose: (people, person) => {
      if (!wantsSleep(people, person)) return false;
      beginSleep(people, person);
      return true;
    },
  },
});

registerActivity({
  id: 'night sleep',
  rest: {
    priority: 110,
    choose: (people, person, { sheltering }) => {
      if (!(sheltering && people.tiredness[person]! > NIGHT_SLEEPY)) return false;
      beginSleep(people, person);
      return true;
    },
  },
});

registerActivity({
  id: 'feed',
  busy: [EntityState.Feeding],
  rest: { priority: 40, choose: (people, person) => beginFeed(people, person) },
  arrives: {
    task: Task.Feed,
    begin: (people, person, tile) => {
      if (!(FEEDS.includes(people.heldItemType[person]! as ItemType) && fireBeside(people, tile) !== NOWHERE)) return false;
      people.state[person] = EntityState.Feeding;
      people.timer[person] = FEED_SECONDS;
      return true;
    },
  },
  finishes: { state: EntityState.Feeding, finish: (people, person) => (finishFeed(people, person), false) },
});

registerActivity({
  id: 'gather',
  rest: { priority: 50, choose: (people, person, { sheltering }) => !sheltering && people.gathering[person] === 1 && beginGather(people, person) },
});

registerActivity({
  id: 'angle',
  rest: { priority: 60, choose: (people, person, { sheltering }) => !sheltering && people.angling[person] === 1 && beginAngle(people, person) },
  arrives: {
    task: Task.Fish,
    begin: (people, person, tile) => {
      const found = waterBeside(people, tile);
      if (found === NOWHERE) return false;
      const water = people.world.grid.centre(found);
      people.heading[person] = Math.atan2(water.y - people.posY[person]!, water.x - people.posX[person]!);
      people.state[person] = EntityState.Fishing;
      people.timer[person] = FISH_SECONDS;
      return true;
    },
  },
  finishes: { state: EntityState.Fishing, finish: (people, person) => (finishFish(people, person), people.task[person] !== Task.None) },
});

registerActivity({
  id: 'wonder',
  busy: [EntityState.Wondering],
  rest: { priority: 70, choose: (people, person, { sheltering }) => !sheltering && beginWonder(people, person) },
  arrives: {
    task: Task.Wonder,
    begin: (people, person) => {
      if (!nextWonderStep(people, person)) people.idle(person);
      return true;
    },
  },
  finishes: { state: EntityState.Wondering, finish: (people, person) => (finishWonder(people, person), false) },
});

registerActivity({
  id: 'scavenge',
  busy: [EntityState.Foraging],
  rest: { priority: 90, choose: (people, person, { sheltering }) => !sheltering && people.random() < SCAVENGE_CHANCE && beginScavenge(people, person) },
  arrives: {
    task: Task.Scavenge,
    begin: (people, person) => {
      people.state[person] = EntityState.Foraging;
      people.timer[person] = SCAVENGE_SECONDS;
      return true;
    },
  },
  finishes: { state: EntityState.Foraging, when: (people, person) => people.task[person] === Task.Scavenge, finish: (people, person) => (finishScavenge(people, person), false) },
});

registerActivity({
  id: 'forage',
  arrives: {
    task: Task.Forage,
    begin: (people, person, tile) => {
      if (fruitLayer(people, tile) === null) return false;
      people.state[person] = EntityState.Foraging;
      people.timer[person] = FORAGE_SECONDS;
      return true;
    },
  },
  finishes: {
    state: EntityState.Foraging,
    finish: (people, person) => {
      finishForage(people, person);
      return people.hauling[person] === 5 && people.heldItemType[person] === ItemType.Berries && carryToStorage(people, person);
    },
  },
});

registerActivity({
  id: 'haul',
  rest: { priority: 100, choose: (people, person, { sheltering }) => !sheltering && people.random() < HAUL_CHANCE && beginHaul(people, person) },
});

registerActivity({
  id: 'pick',
  busy: [EntityState.PickingUp],
  arrives: {
    task: Task.Pick,
    begin: (people, person, tile) => {
      if (people.world.items.find(tile, people.taskItem[person] as ItemType) < 0) return false;
      people.state[person] = EntityState.PickingUp;
      people.timer[person] = PICK_SECONDS;
      return true;
    },
  },
  finishes: {
    state: EntityState.PickingUp,
    finish: (people, person) => {
      finishPick(people, person);
      if (people.hauling[person] === 1 && carryToStorage(people, person)) return true;
      if (people.hauling[person] === 2 && sendToFeed(people, person)) return true;
      if (people.hauling[person] === 3) eatHeld(people, person);
      if (people.hauling[person] === 4 && people.roastFire[person] !== NOWHERE && sendToRoast(people, person, people.roastFire[person]!)) return true;
      for (const hook of pickedUpHooks()) if (hook.run(people, person)) return true;
      return people.wonderTile[person] !== NOWHERE && nextWonderStep(people, person);
    },
  },
});

registerActivity({
  id: 'knap',
  busy: [EntityState.ExperimentingKnapping],
  arrives: {
    task: Task.Knap,
    begin: (people, person, tile) => {
      people.state[person] = EntityState.ExperimentingKnapping;
      people.timer[person] = TRIAL_SECONDS;
      people.strikeClock[person] = STRIKE_INTERVAL;
      if (people.world.structures.floorSpace(tile) > 0) people.dropHeld(person);
      people.emit('trial', person, tile);
      return true;
    },
  },
  finishes: { state: EntityState.ExperimentingKnapping, finish: () => true },
});

registerActivity({
  id: 'chop',
  busy: [EntityState.Chopping],
  arrives: {
    task: Task.Chop,
    begin: (people, person, tile) => {
      if (!(people.heldItemType[person] === ItemType.HandAxe && people.world.coverOf(tile) === Cover.Tree)) return false;
      people.state[person] = EntityState.Chopping;
      people.timer[person] = CHOP_SECONDS;
      people.strikeClock[person] = STRIKE_INTERVAL;
      return true;
    },
  },
  finishes: { state: EntityState.Chopping, finish: (people, person) => (finishChop(people, person), false) },
});

registerActivity({
  id: 'light',
  busy: [EntityState.Lighting],
  arrives: {
    task: Task.Light,
    begin: (people, person, tile) => {
      if (!(people.heldItemType[person] === ItemType.Branch && besideFire(people, tile))) return false;
      people.state[person] = EntityState.Lighting;
      people.timer[person] = LIGHT_SECONDS;
      return true;
    },
  },
  finishes: { state: EntityState.Lighting, finish: (people, person) => (finishLight(people, person), false) },
});

registerActivity({
  id: 'plant',
  busy: [EntityState.Planting],
  arrives: {
    task: Task.Plant,
    begin: (people, person, tile) => {
      if (!(people.heldItemType[person] === ItemType.Torch && people.world.structures.plantable(tile))) return false;
      people.state[person] = EntityState.Planting;
      people.timer[person] = PLANT_SECONDS;
      return true;
    },
  },
  finishes: { state: EntityState.Planting, finish: (people, person) => (finishPlant(people, person), false) },
});

registerActivity({
  id: 'roast',
  busy: [EntityState.Roasting],
  arrives: {
    task: Task.Roast,
    begin: (people, person, tile) => {
      if (!(holdsRaw(people, person) && fireBeside(people, tile) !== NOWHERE)) return false;
      people.state[person] = EntityState.Roasting;
      people.timer[person] = ROAST_SECONDS;
      return true;
    },
  },
  finishes: { state: EntityState.Roasting, finish: (people, person) => (finishRoast(people, person), people.task[person] !== Task.None) },
});
