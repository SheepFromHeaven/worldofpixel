import type { Emission } from './sources/emission.ts';
import type { EmitterSource } from './sources/emitters.ts';
import type { Structures } from './layers/structures.ts';
import type { Trails } from './layers/trails.ts';
import type { GroundItems } from './people/groundItems.ts';
import type { Homes } from './homes/homes.ts';
import type { Achievements } from './achievements.ts';
import type { Animals } from './animals/animals.ts';
import type { Calendar } from './calendar.ts';
import type { Clock } from './clock.ts';
import type { Events } from './events.ts';
import type { Fauna, FaunaWeather } from './fauna/fauna.ts';
import type { Fish, FishEnvironment } from './fish/fish.ts';
import type { Vec2 } from './geometry.ts';
import { capability } from './kernel/kernel.ts';
import type { Carry, GameMode, SimEvent, SimState } from './simulation.ts';
import type { Mind } from './mind/mind.ts';
import type { People, PeopleEnvironment } from './people/people.ts';
import type { Snares } from './people/snares.ts';
import type { Sky } from './weather/sky.ts';
import type { World } from './world.ts';

export const SEED = capability<number>('seed');
export const MODE = capability<GameMode>('mode');
export const SAVED = capability<SimState | null>('saved');
export const CARRY = capability<Carry | null>('carry');
export const EVENTS = capability<Events<SimEvent>>('events');
export const CLOCK = capability<Clock>('clock');
export const ACHIEVEMENTS = capability<Achievements>('achievements');
export const TRIAL = capability<{ open: boolean }>('trial');
export const WORLD = capability<World>('world');
export const EMITTER_SOURCES = capability<readonly EmitterSource[]>('emitterSources');
export const EMISSION = capability<Emission>('emission');
export const STRUCTURES = capability<Structures>('structures');
export const TRAILS = capability<Trails>('trails');
export const ITEMS = capability<GroundItems>('items');
export const HOMES = capability<Homes>('homes');
export const CALENDAR = capability<Calendar>('calendar');
export const SKY = capability<Sky>('sky');
export const SPOT = capability<Vec2>('spot');
export const PEOPLE = capability<People>('people');
export const MIND = capability<Mind>('mind');
export interface Ambient {
  temperatureAt(tile: number): number;
  gloomAt(x: number, y: number): number;
}

export const AMBIENT = capability<Ambient>('ambient');
export const SURROUNDINGS = capability<PeopleEnvironment>('surroundings');

export const FAUNA = capability<Fauna>('fauna');
export const FAUNA_GROUPS = capability<ReadonlySet<string>>('faunaGroups');
export const FAUNA_CLIMATE = capability<FaunaWeather>('faunaClimate');
export const FISH = capability<Fish>('fish');
export const WATERS = capability<FishEnvironment>('waters');
export const SNARES = capability<Snares>('snares');
export const ANIMALS = capability<Animals>('animals');
