import { defineModule } from '../sim/kernel/module.ts';
import type { Kind, Listing, SimModule, ZooGroup } from '../sim/kernel/module.ts';
import { MODULE_EXPORTS } from './manifest.generated.ts';

export { defineModule };
export type { Kind, Listing, SimModule, ZooGroup };

const isModule = (value: unknown): value is SimModule => typeof value === 'object' && value !== null && 'systems' in value && 'order' in value && 'id' in value;

const discovered = (): readonly SimModule[] => {
  const found = new Map<string, SimModule>();
  for (const exports of MODULE_EXPORTS) {
    for (const value of Object.values(exports)) {
      if (!isModule(value)) continue;
      const known = found.get(value.id);
      if (known && known !== value) throw new Error(`two modules are called ${value.id}`);
      found.set(value.id, value);
    }
  }
  return [...found.values()].sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1));
};

const ALL = discovered();

export const GAME_MODULES: readonly SimModule[] = ALL.filter((module) => !module.optional);

export const CORE_MODULES: readonly SimModule[] = GAME_MODULES.filter((module) => !module.heavy);

export const STAGE_MODULES: readonly SimModule[] = GAME_MODULES.filter((module) => module.stage);

export const GAME_EMITTERS = GAME_MODULES.flatMap((module) => module.emitters);

const named = (ids: readonly string[]): readonly SimModule[] => {
  const unknown = ids.filter((id) => !ALL.some((module) => module.id === id));
  if (unknown.length > 0) throw new Error(`unknown module ${unknown.join(', ')}: ${ALL.map((module) => module.id).join(', ')}`);
  return ALL.filter((module) => ids.includes(module.id));
};

export const moduleNamed = (id: string): SimModule => named([id])[0]!;

export const modulesWith = (extra: readonly string[]): readonly SimModule[] => {
  named(extra);
  return GAME_MODULES.filter((module) => !module.heavy || extra.includes(module.id));
};

const DISPLAY: readonly string[] = ['mammal', 'bird', 'reptile', 'amphibian', 'insect', 'human'];

export const kindsOf = (modules: readonly SimModule[]): readonly Kind[] => modules.flatMap((module) => (module.kind ? [module.kind] : [])).sort((a, b) => DISPLAY.indexOf(a.group) - DISPLAY.indexOf(b.group));

export const GAME_KINDS = kindsOf(GAME_MODULES);

export const GAME_GROUPS: ReadonlySet<string> = new Set(GAME_KINDS.map((kind) => kind.group));
