import { Calendar, DAY_SECONDS } from '../calendar.ts';
import { CALENDAR, CARRY, CLOCK, SAVED } from '../capabilities.ts';
import { Clock } from '../clock.ts';
import { provide, system } from '../kernel/kernel.ts';
import type { Tick } from '../kernel/kernel.ts';
import { defineModule } from './module.ts';

const SKIP_STEP_SECONDS = 5;

const calendar = system({
  id: 'calendar',
  needs: { saved: SAVED, carry: CARRY },
  create: ({ saved, carry }) => {
    const days = new Calendar();
    const clock = new Clock(days);
    if (carry) {
      days.restore(carry.calendar);
      clock.carry(carry.speed, carry.playTime);
    }
    if (saved) {
      days.restore(saved.calendar);
      clock.speed = saved.speed;
      clock.playTime = saved.playTime;
    }
    return {
      provides: [provide(CALENDAR, days), provide(CLOCK, clock)],
      save: () => ({ calendar: days.state(), speed: clock.saved, playTime: clock.playTime }),
      commands: {
        setSpeed: ({ speed }: { speed: number }) => clock.set(speed),
        togglePause: () => clock.toggle(),
        cycleSpeed: () => clock.cycle(),
        setMinutes: ({ minutes }: { minutes: number }) => {
          days.setMinuteOfDay(minutes);
          clock.changed();
          return true;
        },
        setSeason: ({ phase }: { phase: number }) => {
          days.setSeasonPhase(phase);
          clock.changed();
          return true;
        },
        setMoon: ({ phase }: { phase: number }) => {
          days.setMoonPhase(phase);
          return true;
        },
        skip: ({ hours }: { hours: number }, kernel) => {
          if (clock.held || !(hours > 0)) return false;
          const speed = clock.speed;
          const tick: Tick = { seconds: 0, scaled: 0 };
          clock.speed = 1;
          for (let left = hours * (DAY_SECONDS / 24); left > 0; left -= SKIP_STEP_SECONDS) {
            tick.seconds = tick.scaled = Math.min(SKIP_STEP_SECONDS, left);
            kernel.update(tick);
          }
          clock.speed = speed;
          return true;
        },
      },
    };
  },
});

const time = system({
  id: 'time',
  needs: { clock: CLOCK },
  tags: ['nature'],
  create: ({ clock }) => ({
    update: ({ scaled }) => {
      if (scaled <= 0) return;
      clock.playTime += scaled;
      clock.calendar.advanceByDays(scaled / DAY_SECONDS);
    },
  }),
});

export const clockModule = defineModule('clock', [calendar]);
export const timeModule = defineModule('time', [time]);
