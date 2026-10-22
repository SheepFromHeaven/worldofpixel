import type { BuildParams, RigId } from './models/heat.ts';
import type { ProcessId, RecipeId } from './recipe.ts';

export const CLAMP_BUILD = { wood: 5, billet: 0.45 };

export const CLAMP_VENTS = [0.12, 0.4, 0.75] as const;

export type RigSpecId = RigId | 'clamp' | 'cordWalk' | 'weavingFrame' | 'daubPit';

export type HandRigId = 'cordWalk' | 'weavingFrame' | 'daubPit';

const HAND_RIGS: readonly HandRigId[] = ['cordWalk', 'weavingFrame', 'daubPit'];

export function isHandRig(spec: RigSpecId): spec is HandRigId {
  return (HAND_RIGS as readonly RigSpecId[]).includes(spec);
}

export interface Rig {
  spec: RigSpecId;
  process: ProcessId;
  build: BuildParams;
  crew: { min: number; max: number };
  running: { recipeId: RecipeId; progress: number } | null;
  last?: RecipeId;
  changeover: number;
  warm?: true;
}

export const WARM_WALL = 1.3;

export function heldBuild(rig: Rig): BuildParams {
  return rig.warm ? { ...rig.build, wall: rig.build.wall * WARM_WALL } : rig.build;
}
