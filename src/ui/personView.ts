import { ITEM_NAMES } from '../sim/people/items.ts';
import type { ItemType } from '../sim/people/items.ts';
import type { Thought } from '../sim/people/thoughts.ts';
import { PERSON_NAMES, Urgency } from '../sim/people/thoughts.ts';
import type { People } from '../sim/people/people.ts';
import { BODY_TEMP_COLD, BODY_TEMP_CRITICAL, BODY_TEMP_FLOOR, BODY_TEMP_NORMAL, EntityState, Task } from '../sim/people/people.ts';

const TIRED = 0.2;

const BAD = 0.7;

const HUNGER_WORDS: readonly string[] = ['full', 'fed', 'peckish', 'hungry', 'starving'];

const THIRST_WORDS: readonly string[] = ['quenched', 'fine', 'dry', 'thirsty', 'parched'];

const TIREDNESS_WORDS: readonly string[] = ['rested', 'awake', 'weary', 'drowsy', 'exhausted'];

const level = (value: number, words: readonly string[]): string => words[Math.min(words.length - 1, Math.floor(value * words.length))] ?? '';

export interface PersonView {
  index: number;
  name: string;
  doing: string;
  holding: string;
  bodyTemp: number;
  warmth: number;
  stamina: number;
  hunger: number;
  thirst: number;
  tiredness: number;
  hungerWord: string;
  thirstWord: string;
  tirednessWord: string;
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
      if (people.task[person] === Task.Talk) return 'walking over to talk';
      if (people.task[person] === Task.Roast) return 'taking food to the fire';
      if (people.task[person] === Task.Wonder) return 'going to try something';
      if (people.task[person] === Task.Light) return 'going to the fire';
      if (people.task[person] === Task.Drink) return 'going for a drink';
      if (people.task[person] === Task.Fish) return 'going to fish';
      if (people.task[person] === Task.Forage) return 'going to pick fruit';
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
    case EntityState.Talking:
      return 'talking it over';
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
      return 'picking fruit';
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
  if (hunger > BAD) conditions.push('hungry');
  if (thirst > BAD) conditions.push('thirsty');
  if (tiredness > BAD) conditions.push('exhausted');

  return {
    index: person,
    name: PERSON_NAMES[person] ?? 'Someone',
    doing: describe(people, person),
    holding: held === 0 ? 'nothing' : (ITEM_NAMES[held] ?? 'something'),
    bodyTemp: heat,
    warmth: Math.min(1, Math.max(0, (heat - BODY_TEMP_FLOOR) / (BODY_TEMP_NORMAL - BODY_TEMP_FLOOR))),
    stamina,
    hunger,
    thirst,
    tiredness,
    hungerWord: level(hunger, HUNGER_WORDS),
    thirstWord: level(thirst, THIRST_WORDS),
    tirednessWord: level(tiredness, TIREDNESS_WORDS),
    speed: people.moveSpeed[person]!,
    conditions,
    thoughts: thoughts.map((thought) => ({ text: thought.text, critical: thought.urgency === Urgency.Critical })),
    column: grid.columnOf(tile),
    row: grid.rowOf(tile),
  };
}
