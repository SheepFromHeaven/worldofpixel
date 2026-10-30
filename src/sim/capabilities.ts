import type { Calendar } from './calendar.ts';
import type { Clock } from './clock.ts';
import type { Events } from './events.ts';
import type { Vec2 } from './geometry.ts';
import { capability } from './kernel/kernel.ts';
import type { Carry, GameMode, SimEvent, SimState } from './simulation.ts';
import type { World } from './world.ts';

export const SEED = capability<number>('seed');
export const MODE = capability<GameMode>('mode');
export const SAVED = capability<SimState | null>('saved');
export const CARRY = capability<Carry | null>('carry');
export const EVENTS = capability<Events<SimEvent>>('events');
export const CLOCK = capability<Clock>('clock');
export const TRIAL = capability<{ open: boolean }>('trial');
export const WORLD = capability<World>('world');
export const CALENDAR = capability<Calendar>('calendar');
export const SPOT = capability<Vec2>('spot');
export interface Ambient {
  temperatureAt(tile: number): number;
  gloomAt(x: number, y: number): number;
}

export const AMBIENT = capability<Ambient>('ambient');

