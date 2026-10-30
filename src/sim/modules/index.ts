import { achievementsModule } from './achievements.ts';
import { amphibiansModule } from './amphibians.ts';
import { birdsModule } from './birds.ts';
import { insectsModule } from './insects.ts';
import { reptilesModule } from './reptiles.ts';
import { constructionModule } from './construction.ts';
import { clockModule, timeModule } from './clock.ts';
import { discoveryModule } from './discovery.ts';
import { faunaModule } from './fauna.ts';
import { fireModule } from './fire.ts';
import { fishModule } from './fish.ts';
import { floraModule } from './flora.ts';
import { itemsModule } from './items.ts';
import { knappingModule } from './knapping.ts';
import { labourModule } from './labour.ts';
import { lightModule } from './light.ts';
import { foodModule } from './food.ts';
import { mammalsModule } from './mammals.ts';
import type { Kind, SimModule } from './module.ts';
import { mindModule } from './mind.ts';
import { peopleModule } from './people.ts';
import { populationModule } from './population.ts';
import { snaresModule } from './snares.ts';
import { thoughtsModule } from './thoughts.ts';
import { trailsModule } from './trails.ts';
import { weatherModule } from './weather.ts';
import { worldModule } from './world.ts';

export { devModule } from './dev.ts';
export { defineModule } from './module.ts';
export type { Kind, Listing, SimModule, ZooGroup } from './module.ts';
export { THOUGHTS } from './thoughts.ts';

export const MODULES = {
  world: worldModule,
  clock: clockModule,
  fire: fireModule,
  light: lightModule,
  population: populationModule,
  people: peopleModule,
  mind: mindModule,
  items: itemsModule,
  construction: constructionModule,
  labour: labourModule,
  food: foodModule,
  snares: snaresModule,
  fish: fishModule,
  fauna: faunaModule,
  mammals: mammalsModule,
  birds: birdsModule,
  reptiles: reptilesModule,
  amphibians: amphibiansModule,
  insects: insectsModule,
  achievements: achievementsModule,
  thoughts: thoughtsModule,
  discovery: discoveryModule,
  knapping: knappingModule,
  time: timeModule,
  flora: floraModule,
  trails: trailsModule,
  weather: weatherModule,
} as const;

export const STAGE_MODULES = ['fire', 'light', 'people', 'mind', 'items', 'construction', 'labour', 'knapping', 'trails'] as const;

export const GAME_MODULES: readonly SimModule[] = Object.values(MODULES);

const HEAVY = ['snares', 'fish', 'fauna', 'mammals', 'birds', 'reptiles', 'amphibians', 'insects'];

export const CORE_MODULES: readonly SimModule[] = Object.entries(MODULES).filter(([id]) => !HEAVY.includes(id)).map(([, module]) => module);

export function modulesWith(extra: readonly string[]): readonly SimModule[] {
  const unknown = extra.filter((id) => !(id in MODULES));
  if (unknown.length > 0) throw new Error(`unknown module ${unknown.join(', ')}: ${Object.keys(MODULES).join(', ')}`);
  return Object.entries(MODULES).filter(([id]) => extra.includes(id) || !HEAVY.includes(id)).map(([, module]) => module);
}

export const GAME_EMITTERS = GAME_MODULES.flatMap((module) => module.emitters);

const DISPLAY: readonly string[] = ['mammal', 'bird', 'reptile', 'amphibian', 'insect', 'human'];

export const kindsOf = (modules: readonly SimModule[]): readonly Kind[] => modules.flatMap((module) => (module.kind ? [module.kind] : [])).sort((a, b) => DISPLAY.indexOf(a.group) - DISPLAY.indexOf(b.group));

export const GAME_KINDS = kindsOf(GAME_MODULES);

export const GAME_GROUPS: ReadonlySet<string> = new Set(GAME_KINDS.map((kind) => kind.group));

export const modulesNamed = (ids: readonly string[]): readonly SimModule[] => Object.entries(MODULES).filter(([id]) => ids.includes(id)).map(([, module]) => module);
