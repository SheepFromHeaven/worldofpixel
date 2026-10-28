import type { CalendarState } from '../calendar.ts';
import type { Vec2 } from '../geometry.ts';
import type { TileIndex } from '../grid.ts';
import type { ItemType } from '../people/items.ts';
import type { FaunaFrame } from '../fauna/pack.ts';
import type { AnimalFrame } from '../animals/store.ts';
import type { ShoalFrame } from '../fish/shoals.ts';
import type { PeopleFrame } from '../people/people.ts';
import type { Thought } from '../people/thoughts.ts';
import type { Command, GameMode, SimState } from '../simulation.ts';
import type { SkyFrame } from '../weather/skyView.ts';
import type { Ground, WorldDelta } from '../world.ts';

export interface Frame {
  tick: number;
  changed: boolean;
  calendar: CalendarState;
  speed: number;
  playTime: number;
  forced: number;
  trialOpen: boolean;
  achievements: string[];
  world: WorldDelta;
  people: PeopleFrame;
  fish: ShoalFrame | null;
  animals: AnimalFrame | null;
  fauna: FaunaFrame | null;
  sky: SkyFrame;
  thoughts: Thought[][] | null;
}

export interface Hello {
  seed: number;
  mode: GameMode;
  spot: Vec2;
  count: number;
  ground: Ground;
  frame: Frame;
}

export interface Start {
  seed: number;
  size: number;
  mode: GameMode;
  saved: SimState | null;
  carry: { calendar: CalendarState; speed: number; playTime: number } | null;
}

export type WireEvent =
  | { kind: 'achievement'; id: string }
  | { kind: 'trial'; person: number; tile: TileIndex; items: readonly ItemType[]; seed: number };

export type ToSim =
  | { kind: 'start'; start: Start }
  | { kind: 'command'; command: Command }
  | { kind: 'snapshot' };

export type FromSim =
  | { kind: 'hello'; hello: Hello }
  | { kind: 'frame'; frame: Frame }
  | { kind: 'event'; event: WireEvent }
  | { kind: 'snapshot'; state: SimState };
