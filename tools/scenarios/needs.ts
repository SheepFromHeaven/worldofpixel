import { DAY_SECONDS } from '../../src/sim/calendar.ts';
import { EntityState, HOUR_SECONDS, livingOf } from '../../src/modules/people/api.ts';
import { Run } from './harness.ts';
import type { Scenario } from './harness.ts';

const dead = (run: Run, person: number): boolean => run.people.state[person] === EntityState.Dead;

export const thirst: Scenario = {
  name: 'thirst',
  summary: 'without water a person is thirsty after 4 hours and dead within a day and a half',
  start: () => Run.stage({ humans: [[0, 0]], celsius: 20 }),
  run(run) {
    const { people } = run;
    people.thirst[0] = 0;
    people.hunger[0] = 0;
    run.until('thirsty', () => people.thirst[0]! > 0.17, DAY_SECONDS, () => (people.hunger[0] = 0));
    run.expect('after about four hours', run.seconds > 3 * HOUR_SECONDS && run.seconds < 6 * HOUR_SECONDS, `${(run.seconds / HOUR_SECONDS).toFixed(1)}h`);
    run.until('dead', () => dead(run, 0), DAY_SECONDS * 2, () => (people.hunger[0] = 0));
    run.expect('within a day and a half', run.seconds > 20 * HOUR_SECONDS && run.seconds < 36 * HOUR_SECONDS, `${(run.seconds / HOUR_SECONDS).toFixed(1)}h`);
  },
};

export const hunger: Scenario = {
  name: 'hunger',
  summary: 'without food a person is hungry after ten hours and dead after two days',
  start: () => Run.stage({ humans: [[0, 0]], celsius: 20 }),
  run(run) {
    const { people } = run;
    people.hunger[0] = 0;
    const drink = (): void => {
      people.thirst[0] = 0;
    };
    run.until('hungry', () => people.hunger[0]! > 0.2, DAY_SECONDS, drink);
    run.expect('after about ten hours', run.seconds > 7 * HOUR_SECONDS && run.seconds < 11 * HOUR_SECONDS, `${(run.seconds / HOUR_SECONDS).toFixed(1)}h`);
    run.until('dead', () => dead(run, 0), DAY_SECONDS * 4, drink);
    run.expect('after about two days', run.seconds > 40 * HOUR_SECONDS && run.seconds < 60 * HOUR_SECONDS, `${(run.seconds / HOUR_SECONDS).toFixed(1)}h`);
  },
};

export const cold: Scenario = {
  name: 'cold',
  summary: 'two people in a hard frost with no fire are both dead within a day',
  start: () => Run.stage({ humans: [[0, 0], [1, 0]], celsius: -10 }),
  run(run) {
    const { people } = run;
    const keep = (): void => {
      for (let person = 0; person < 2; person += 1) {
        people.thirst[person] = 0;
        people.hunger[person] = 0;
      }
    };
    run.until('both are dead', () => livingOf(people).length === 0, DAY_SECONDS, keep);
  },
};

export const sleep: Scenario = {
  name: 'sleep',
  summary: 'beside a light a person sleeps six to eight hours a day, in more than one stretch',
  start: () => Run.stage({ humans: [[0, 0]], torches: [[2, 0]], celsius: 20 }),
  run(run) {
    const { people } = run;
    let asleep = 0;
    let bouts = 0;
    let was = false;
    const days = 3;
    for (let tick = 0; tick < days * DAY_SECONDS * 2; tick += 1) {
      people.thirst[0] = 0;
      people.hunger[0] = 0;
      run.advance(0.5);
      const now = people.state[0] === EntityState.Sleeping;
      if (now) asleep += 0.5;
      if (now && !was) bouts += 1;
      was = now;
    }
    const hours = asleep / HOUR_SECONDS / days;
    run.expect('six to eight hours a day', hours >= 5.5 && hours <= 8.5, `${hours.toFixed(1)}h a day`);
    run.expect('slept in more than one stretch', bouts > days, `${bouts} bouts in ${days} days`);
  },
};

export const frost: Scenario = {
  name: 'frost',
  summary: 'a first winter without a fire kills both people through the cold',
  run(run) {
    const { people } = run;
    run.apply({ kind: 'setSeason', phase: 0.9 });
    const keep = (): void => {
      for (let person = 0; person < people.count; person += 1) {
        people.thirst[person] = 0;
        people.hunger[person] = 0;
      }
    };
    run.until('both are dead', () => livingOf(people).length === 0, DAY_SECONDS * 3, keep);
    run.expect('it was cold', people.air[0]! < 10, `${people.air[0]!.toFixed(1)} C`);
  },
};
