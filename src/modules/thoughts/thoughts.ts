import type { People } from '../people/api.ts';
import { BODY_TEMP_COLD, BODY_TEMP_CRITICAL, EntityState, HUDDLE_RANGE } from '../people/api.ts';
import { ItemType } from '../items/api.ts';

export const PERSON_NAMES: readonly string[] = ['Adam', 'Eve', 'Sam', 'Robin', 'Alex', 'Kit', 'Sky', 'Wren'];

export const Urgency = { Passing: 0, Concern: 1, Critical: 2 } as const;

export type Urgency = (typeof Urgency)[keyof typeof Urgency];

export interface Thought {
  id: string;
  text: string;
  urgency: Urgency;
}

export interface ThoughtSurroundings {
  rain: number;
  snow: number;
  gloom: number;
  dimming: boolean;
}

export interface Need {
  edges: readonly number[];
  words: readonly string[];
}

export const HUNGER: Need = { edges: [0.08, 0.21, 0.5, 0.75], words: ['full', 'fed', 'peckish', 'hungry', 'starving'] };

export const THIRST: Need = { edges: [0.06, 0.17, 0.4, 0.6], words: ['quenched', 'fine', 'dry', 'thirsty', 'parched'] };

export const TIREDNESS: Need = { edges: [0.2, 0.45, 0.7, 0.9], words: ['rested', 'awake', 'weary', 'drowsy', 'exhausted'] };

export const NEED_WORST = 4;

export function needLevel(need: Need, value: number): number {
  let level = 0;
  while (level < need.edges.length && value > need.edges[level]!) level += 1;
  return level;
}

export function needWord(need: Need, value: number): string {
  return need.words[needLevel(need, value)] ?? '';
}

const WINDED = 0.2;
const PRECIPITATING = 0.2;
const DARK = 0.6;
const NIGHT = 0.85;
const FIRE_COMFORT_TILES = 4;
const LONELY_TILES = 30;

function nearestFire(people: People, person: number): number {
  const { world } = people;
  let least = Infinity;
  for (const tile of world.structures.fires) {
    const at = world.grid.centre(tile);
    least = Math.min(least, Math.hypot(at.x - people.posX[person]!, at.y - people.posY[person]!));
  }
  return least;
}

function nearestOther(people: People, person: number): { index: number; away: number } {
  let index = -1;
  let away = Infinity;
  for (let other = 0; other < people.count; other += 1) {
    if (other === person || people.state[other] === EntityState.Dead) continue;
    const here = Math.hypot(people.posX[other]! - people.posX[person]!, people.posY[other]! - people.posY[person]!);
    if (here < away) {
      away = here;
      index = other;
    }
  }
  return { index, away };
}

export function thoughtsFor(people: People, person: number, around: ThoughtSurroundings): Thought[] {
  const found: Thought[] = [];
  const think = (id: string, text: string, urgency: Urgency): void => {
    found.push({ id, text, urgency });
  };

  const heat = people.bodyTemp[person]!;
  const hunger = people.hunger[person]!;
  const thirst = people.thirst[person]!;
  const tiredness = people.tiredness[person]!;
  const held = people.heldItemType[person]!;
  const cold = heat < BODY_TEMP_COLD;
  const fire = nearestFire(people, person);
  const torch = held === ItemType.Torch || held === ItemType.BurningBranch;

  if (heat < BODY_TEMP_CRITICAL) think('freezing', 'I am freezing', Urgency.Critical);
  else if (cold) think('cold', 'I am cold', Urgency.Concern);

  const hungry = needLevel(HUNGER, hunger);
  if (hungry === NEED_WORST) think('starving', 'I need food', Urgency.Critical);
  else if (hungry === 3) think('hungry', 'I am hungry', Urgency.Concern);
  else if (hungry === 2) think('peckish', 'I am getting hungry', Urgency.Passing);

  const thirsty = needLevel(THIRST, thirst);
  if (thirsty === NEED_WORST) think('parched', 'I need water', Urgency.Critical);
  else if (thirsty === 3) think('thirsty', 'I am thirsty', Urgency.Concern);
  else if (thirsty === 2) think('dry', 'I could use a drink', Urgency.Passing);

  const tired = needLevel(TIREDNESS, tiredness);
  if (tired === NEED_WORST) think('exhausted', 'I cannot go on much longer', Urgency.Critical);
  else if (tired === 3) think('drowsy', 'I am so tired', Urgency.Concern);
  else if (tired === 2) think('weary', 'I am getting tired', Urgency.Passing);

  if (people.stamina[person]! < WINDED) think('winded', 'I need to catch my breath', Urgency.Concern);

  if (cold && people.world.structures.fires.length === 0 && !torch) think('wish-fire', 'I wish there was a fire to warm me', Urgency.Concern);
  if (around.rain > PRECIPITATING) think('rain', cold ? 'the rain is making it worse' : 'it is raining', cold ? Urgency.Concern : Urgency.Passing);
  if (around.snow > PRECIPITATING) think('snow', 'it is snowing', Urgency.Passing);

  if (fire <= FIRE_COMFORT_TILES) think('fire', cold ? 'the fire is helping' : 'the fire is lovely', Urgency.Passing);
  if (around.gloom > DARK && fire > FIRE_COMFORT_TILES && !torch) {
    if (around.gloom > NIGHT) think('dark', 'it is dark', Urgency.Passing);
    else if (around.dimming) think('dusk', 'it is getting dark', Urgency.Passing);
    else think('dawn', 'it is getting light', Urgency.Passing);
  }
  if (torch) think('torch', 'this torch lights the way', Urgency.Passing);

  const other = nearestOther(people, person);
  if (other.index >= 0) {
    const name = PERSON_NAMES[other.index] ?? 'the other one';
    if (other.away <= HUDDLE_RANGE) think('together', 'it is good not to be alone', Urgency.Passing);
    else if (other.away > LONELY_TILES) think('apart', `where is ${name}?`, Urgency.Passing);
  }

  if (people.state[person] === EntityState.Drinking) think('drinking', 'the water is cool and sweet', Urgency.Passing);
  if (people.state[person] === EntityState.Fishing) think('fishing', 'still, and patient', Urgency.Passing);
  if (people.state[person] === EntityState.Foraging) think('foraging', 'ripe and sweet, at last', Urgency.Passing);
  if (people.isLying(person)) think('asleep', 'zzz', Urgency.Passing);

  if (found.length === 0) think('content', 'all is well', Urgency.Passing);

  return found.sort((a, b) => b.urgency - a.urgency);
}

export function isCritical(thoughts: readonly Thought[]): boolean {
  return thoughts.some((thought) => thought.urgency === Urgency.Critical);
}
