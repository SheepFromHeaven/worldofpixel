import type { Layer } from './layer.ts';
import type { World } from '../world.ts';

export interface LayerContext {
  readonly world: World;
  column(layer: string, name: string): Uint8Array;
}

export interface LayerDef {
  readonly id: string;
  readonly order: number;
  create(context: LayerContext): { layer: Layer; exposed: Record<string, unknown> };
}

const DEFS = new Map<string, LayerDef>();

export const registerLayer = (def: LayerDef): void => {
  if (DEFS.has(def.id)) throw new Error(`two layers are called ${def.id}`);
  DEFS.set(def.id, def);
};

export const contributedLayers = (): readonly LayerDef[] => [...DEFS.values()].sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1));
