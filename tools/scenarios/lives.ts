import { DAY_SECONDS } from '../../src/sim/calendar.ts';
import { ADULT_SECONDS, FIRST_AGE_SECONDS, livingOf } from '../../src/modules/people/api.ts';
import { Run } from './harness.ts';
import type { Scenario } from './harness.ts';

const YEAR = 32 * DAY_SECONDS;

const tend = (run: Run): (() => void) => () => {
  for (let person = 0; person < run.people.count; person += 1) {
    run.people.thirst[person] = 0;
    run.people.hunger[person] = 0;
  }
};

const live = (run: Run, seconds: number, stop: () => boolean = () => false): void => {
  const keep = tend(run);
  for (let spent = 0; spent < seconds && !stop(); spent += 1) {
    keep();
    run.advance(1);
  }
};

export const kin: Scenario = {
  name: 'kin',
  summary: 'two of one sex have no children and a pair of both do, beside a light',
  start: () => Run.stage({ humans: [[0, 0], [1, 0]], torches: [[2, 0]], celsius: 20 }),
  run(run) {
    const { people } = run;
    people.female[1] = 0;
    live(run, DAY_SECONDS * 2, () => people.count > 2);
    run.expect('two men have no children', people.count === 2, `${people.count} people`);
    people.female[1] = 1;
    live(run, DAY_SECONDS * 2, () => people.count > 2);
    run.expect('a child is born', people.count > 2, `${(run.seconds / DAY_SECONDS).toFixed(1)} days`);
    run.expect('the child has a sex', people.female[2]! <= 1);
    run.expect('the child is new born', people.age[2]! < DAY_SECONDS, `${people.age[2]}s old`);
  },
};

export const ages: Scenario = {
  name: 'ages',
  summary: 'a child is grown in five days and a person lives fifty to sixty years',
  start: () => Run.stage({ humans: [[0, 0], [1, 0]], torches: [[2, 0]], celsius: 20 }),
  run(run) {
    const { people } = run;
    people.bear(0);
    run.expect('the child is not grown', !people.isAdult(2) && people.stature(2) === 0);
    live(run, 2.5 * DAY_SECONDS);
    run.expect('half grown after two and a half days', Math.abs(people.stature(2) - 0.5) < 0.05, people.stature(2).toFixed(2));
    live(run, 2.6 * DAY_SECONDS);
    run.expect('grown after five days', people.isAdult(2) && people.stature(2) === 1, people.stature(2).toFixed(2));
    for (const person of [0, 1, 2]) {
      const years = people.lifespan[person]! / YEAR;
      run.expect(`life span of ${person} is fifty to sixty years`, years >= 50 && years <= 60, `${years.toFixed(1)} years`);
    }
    run.expect('the first two start as adults', people.age[0]! >= FIRST_AGE_SECONDS && FIRST_AGE_SECONDS > ADULT_SECONDS);
    people.age[0] = people.lifespan[0]! - 1;
    run.advance(2);
    run.expect('old age ends a life', livingOf(people).length < people.count && !livingOf(people).includes(0));
  },
};
