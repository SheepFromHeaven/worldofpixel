import { BODY_TEMP_RECOVERED, BIRTH_CONTENT, BIRTH_TOGETHER_TILES, BIRTH_SECONDS, DEATH_TEMPERATURE, DYING_SECONDS, POPULATION } from './tuning.ts';
import { EntityState } from './states.ts';
import type { People } from './people.ts';

export const isAlive = (people: People, person: number): boolean => person < people.count && people.state[person] !== EntityState.Dead;

export function livingOf(people: People): number[] {
  const living: number[] = [];
  for (let person = 0; person < people.count; person += 1) if (isAlive(people, person)) living.push(person);
  return living;
}

const lethal = (people: People, person: number): boolean =>
  people.bodyTemp[person]! <= DEATH_TEMPERATURE || people.hunger[person]! >= 1 || people.thirst[person]! >= 1;

export function mortality(people: People, person: number, dt: number): void {
  const worse = lethal(people, person);
  const next = people.dying[person]! + (worse ? dt : -dt * 0.5);
  people.dying[person] = Math.max(0, next);
  if (people.dying[person]! < DYING_SECONDS) return;
  people.die(person);
}

const content = (people: People, person: number): boolean =>
  people.hunger[person]! < BIRTH_CONTENT && people.thirst[person]! < BIRTH_CONTENT && people.bodyTemp[person]! >= BODY_TEMP_RECOVERED - 0.4;

export function births(people: People, dt: number): void {
  const living = livingOf(people);
  const first = living[0];
  const second = living[1];
  if (first === undefined || second === undefined || people.count >= POPULATION) return;
  const warmed = people.warmth[first]! > 0 || people.warmth[second]! > 0;
  const together = Math.hypot(people.posX[first]! - people.posX[second]!, people.posY[first]! - people.posY[second]!) <= BIRTH_TOGETHER_TILES;
  const ready = warmed && together && living.every((person) => content(people, person));
  people.kin[0] = ready ? people.kin[0]! + dt : Math.max(0, people.kin[0]! - dt * 0.1);
  if (people.kin[0]! < BIRTH_SECONDS) return;
  people.kin[0] = 0;
  people.bear(first);
}
