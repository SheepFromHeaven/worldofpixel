import { BODY_TEMP_RECOVERED, BIRTH_CONTENT, FERTILE_UNTIL_SECONDS, BIRTH_TOGETHER_TILES, BIRTH_SECONDS, DEATH_TEMPERATURE, DYING_SECONDS, POPULATION } from './tuning.ts';
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
  people.ageSub[person] = people.ageSub[person]! + dt;
  const whole = Math.floor(people.ageSub[person]!);
  if (whole > 0) {
    people.age[person] = people.age[person]! + whole;
    people.ageSub[person] = people.ageSub[person]! - whole;
  }
  if (people.age[person]! >= people.lifespan[person]!) {
    people.die(person);
    return;
  }
  const worse = lethal(people, person);
  const next = people.dying[person]! + (worse ? dt : -dt * 0.5);
  people.dying[person] = Math.max(0, next);
  if (people.dying[person]! < DYING_SECONDS) return;
  people.die(person);
}

const content = (people: People, person: number): boolean =>
  people.hunger[person]! < BIRTH_CONTENT && people.thirst[person]! < BIRTH_CONTENT && people.bodyTemp[person]! >= BODY_TEMP_RECOVERED - 0.4;

const pairOf = (people: People): [number, number] | null => {
  const adults = livingOf(people).filter((person) => people.isAdult(person));
  for (const mother of adults) {
    if (!people.female[mother] || people.age[mother]! > FERTILE_UNTIL_SECONDS) continue;
    for (const father of adults) {
      if (people.female[father]) continue;
      const apart = Math.hypot(people.posX[mother]! - people.posX[father]!, people.posY[mother]! - people.posY[father]!);
      if (apart <= BIRTH_TOGETHER_TILES) return [mother, father];
    }
  }
  return null;
};

export function births(people: People, dt: number): void {
  if (people.count >= POPULATION) return;
  const pair = pairOf(people);
  const ready = pair !== null && (people.warmth[pair[0]]! > 0 || people.warmth[pair[1]]! > 0) && pair.every((person) => content(people, person));
  people.kin[0] = ready ? people.kin[0]! + dt : Math.max(0, people.kin[0]! - dt * 0.1);
  if (!pair || people.kin[0]! < BIRTH_SECONDS) return;
  people.kin[0] = 0;
  people.bear(pair[0]);
}
