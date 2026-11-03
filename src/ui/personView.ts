import { ITEM_ART, ITEM_NAMES } from '../modules/items/api.ts';
import type { ItemType } from '../modules/items/api.ts';
import type { Thought } from '../modules/thoughts/api.ts';
import { HUNGER, NEED_WORST, PERSON_NAMES, THIRST, TIREDNESS, Urgency, needLevel, needWord } from '../modules/thoughts/api.ts';
import type { People } from '../modules/people/api.ts';
import { BODY_TEMP_COLD, BODY_TEMP_CRITICAL, BODY_TEMP_FLOOR, BODY_TEMP_NORMAL, EntityState, Task } from '../modules/people/api.ts';

const TIRED = 0.2;


export interface PersonView {
  index: number;
  name: string;
  doing: string;
  holding: string;
  heldArt: string | null;
  bodyTemp: number;
  warmth: number;
  stamina: number;
  hunger: number;
  thirst: number;
  tiredness: number;
  hungerWord: string;
  thirstWord: string;
  tirednessWord: string;
  hungerBad: boolean;
  thirstBad: boolean;
  tirednessBad: boolean;
  speed: number;
  conditions: readonly string[];
  thoughts: readonly { text: string; critical: boolean }[];
  column: number;
  row: number;
}

function describe(people: People, person: number): string {
  const item = ITEM_NAMES[people.taskItem[person]!] ?? 'something';
  switch (people.state[person]!) {
    case EntityState.Idle:
      return 'resting';
    case EntityState.Wander:
      return 'wandering';
    case EntityState.WalkingToItem:
      if (people.task[person] === Task.Pick) return people.hauling[person] === 1 ? `fetching ${item} for storage` : people.hauling[person] === 2 ? `fetching ${item} for the fire` : `going for ${item}`;
      if (people.task[person] === Task.Feed) return 'taking fuel to the fire';
      if (people.task[person] === Task.Roast) return 'taking food to the fire';
      if (people.task[person] === Task.Wonder) return 'going to try something';
      if (people.task[person] === Task.Light) return 'going to the fire';
      if (people.task[person] === Task.Drink) return 'going for a drink';
      if (people.task[person] === Task.Fish) return 'going to fish';
      if (people.task[person] === Task.Forage) return 'going to pick fruit';
      if (people.task[person] === Task.Scavenge) return 'looking around for materials';
      if (people.task[person] === Task.Plant) return 'taking the torch over';
      return people.task[person] === Task.Chop ? 'going to chop' : 'going to experiment';
    case EntityState.PickingUp:
      return 'picking up';
    case EntityState.Carrying:
      return 'carrying it over';
    case EntityState.ExperimentingKnapping:
      return 'experimenting';
    case EntityState.Huddling:
      return 'warming up';
    case EntityState.Roasting:
      return 'roasting food';
    case EntityState.Wondering:
      return 'trying a guess';
    case EntityState.Chopping:
      return 'chopping';
    case EntityState.Lighting:
      return 'lighting a torch';
    case EntityState.Planting:
      return 'setting a torch down';
    case EntityState.Feeding:
      return 'feeding the fire';
    case EntityState.Drinking:
      return 'drinking';
    case EntityState.Foraging:
      return people.task[person] === Task.Scavenge ? 'searching the ground' : 'picking fruit';
    case EntityState.Fishing:
      return 'fishing';
    case EntityState.Sleeping:
      return people.isLying(person) ? 'asleep' : 'going to lie down';
    default:
      return 'resting';
  }
}

export function personView(people: People, person: number, thoughts: readonly Thought[]): PersonView {
  const { grid } = people.world;
  const tile = people.tileOf(person);
  const heat = people.bodyTemp[person]!;
  const stamina = people.stamina[person]!;
  const held = people.heldItemType[person]! as ItemType;

  const conditions: string[] = [];
  if (heat < BODY_TEMP_CRITICAL) conditions.push('freezing');
  else if (heat < BODY_TEMP_COLD) conditions.push('cold');
  if (stamina < TIRED) conditions.push('worn out');
  const { hunger, thirst, tiredness } = { hunger: people.hunger[person]!, thirst: people.thirst[person]!, tiredness: people.tiredness[person]! };
  const hungerBad = needLevel(HUNGER, hunger) >= NEED_WORST - 1;
  const thirstBad = needLevel(THIRST, thirst) >= NEED_WORST - 1;
  const tirednessBad = needLevel(TIREDNESS, tiredness) >= NEED_WORST - 1;
  if (hungerBad) conditions.push('hungry');
  if (thirstBad) conditions.push('thirsty');
  if (tirednessBad) conditions.push('exhausted');

  return {
    index: person,
    name: PERSON_NAMES[person] ?? 'Someone',
    doing: describe(people, person),
    holding: held === 0 ? 'nothing' : (ITEM_NAMES[held] ?? 'something'),
    heldArt: held === 0 ? null : (ITEM_ART[held] ?? null),
    bodyTemp: heat,
    warmth: Math.min(1, Math.max(0, (heat - BODY_TEMP_FLOOR) / (BODY_TEMP_NORMAL - BODY_TEMP_FLOOR))),
    stamina,
    hunger,
    thirst,
    tiredness,
    hungerWord: needWord(HUNGER, hunger),
    thirstWord: needWord(THIRST, thirst),
    tirednessWord: needWord(TIREDNESS, tiredness),
    hungerBad,
    thirstBad,
    tirednessBad,
    speed: people.moveSpeed[person]!,
    conditions,
    thoughts: thoughts.map((thought) => ({ text: thought.text, critical: thought.urgency === Urgency.Critical })),
    column: grid.columnOf(tile),
    row: grid.rowOf(tile),
  };
}
