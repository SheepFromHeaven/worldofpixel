import type { AnimalModel, Gait, GaitStates, Part } from '../model.ts';

export interface ModelPatch extends Partial<Omit<AnimalModel, 'parts' | 'gait' | 'states'>> {
  gait?: Partial<Gait>;
  states?: Record<string, Partial<Gait> | null>;
  parts?: Record<string, Part | null>;
  add?: readonly Part[];
}

const mergeStates = (base: GaitStates | undefined, patch: ModelPatch['states']): GaitStates | undefined => {
  if (!base && !patch) return undefined;
  const merged: GaitStates = { ...base };
  for (const [name, gait] of Object.entries(patch ?? {})) {
    if (gait === null) delete merged[name];
    else merged[name] = { ...merged[name], ...gait };
  }
  return merged;
};

export const extendModel = (base: AnimalModel, patch: ModelPatch): AnimalModel => {
  const { gait, states, parts, add, ...rest } = patch;
  const names = new Set(base.parts.map((part) => part.name).filter((name): name is string => name !== undefined));
  for (const name of Object.keys(parts ?? {})) if (!names.has(name)) throw new Error(`the archetype has no part called '${name}' to replace`);
  const replaced = base.parts.flatMap((part) => {
    const over = part.name === undefined ? undefined : parts?.[part.name];
    if (over === undefined) return [part];
    return over === null ? [] : [over];
  });
  const merged = mergeStates(base.states, states);
  return { ...base, ...rest, gait: { ...base.gait, ...gait }, ...(merged ? { states: merged } : {}), parts: [...replaced, ...(add ?? [])] };
};
