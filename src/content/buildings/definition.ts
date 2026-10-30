export interface Shelter {
  readonly recovery: number;
  readonly loss: number;
  readonly reach: 'tile' | 'adjacent';
}

export interface Trap {
  readonly catches: string;
  readonly yields: readonly string[];
}

export interface Storage {
  readonly capacity: number;
  readonly mixed: boolean;
  readonly haul: boolean;
}

export interface Job {
  readonly station: string;
  readonly slots: number;
}

export interface Fuelled {
  readonly capacity: number;
  readonly burn: number;
  readonly start: number;
}

export interface Heat {
  readonly reach: number;
  readonly output: number;
}

export interface Light {
  readonly reach: number;
  readonly strength: number;
  readonly colour: readonly [number, number, number];
  readonly flicker: number;
  readonly windShare: number;
  readonly flame: 'none' | 'torch' | 'campfire';
  readonly lift: number;
}

export interface Emits {
  readonly look: 'fire' | 'post' | 'hand' | 'glow';
  readonly heat: Heat | null;
  readonly light: Light | null;
  readonly igniter: boolean;
  readonly when: 'always' | 'lit' | 'occupied';
}

export interface Footprint {
  readonly clears: boolean;
  readonly trees: boolean;
  readonly trodden: boolean;
}

export interface BuildingPart {
  readonly needs?: readonly (readonly [string, number])[];
  readonly solid?: boolean;
  readonly shelter?: Shelter;
  readonly emits?: Emits;
  readonly fuelled?: Fuelled;
  readonly placedBy?: string;
  readonly trap?: Trap;
  readonly unlock?: string;
  readonly storage?: Storage;
  readonly job?: Job;
  readonly footprint?: Footprint;
  readonly blurb?: string;
}

export interface BuildingDef {
  readonly key: string;
  readonly name: string;
  readonly sprite: string;
  readonly blurb: string;
  readonly needs: readonly (readonly [string, number])[];
  readonly solid: boolean;
  readonly shelter: Shelter | null;
  readonly emits: Emits | null;
  readonly fuelled: Fuelled | null;
  readonly placedBy: string | null;
  readonly trap: Trap | null;
  readonly unlock: string | null;
  readonly storage: Storage | null;
  readonly job: Job | null;
  readonly footprint: Footprint;
}

export const building = (key: string, name: string, sprite: string, ...parts: readonly BuildingPart[]): BuildingDef => {
  const merged: { -readonly [K in keyof BuildingPart]: BuildingPart[K] } = {};
  for (const part of parts) Object.assign(merged, part);
  return {
    key,
    name,
    sprite,
    blurb: merged.blurb ?? '',
    needs: merged.needs ?? [],
    solid: merged.solid ?? false,
    shelter: merged.shelter ?? null,
    emits: merged.emits ?? null,
    fuelled: merged.fuelled ?? null,
    placedBy: merged.placedBy ?? null,
    trap: merged.trap ?? null,
    unlock: merged.unlock ?? null,
    storage: merged.storage ?? null,
    job: merged.job ?? null,
    footprint: merged.footprint ?? { clears: true, trees: false, trodden: true },
  };
};

export const needs = (...items: readonly (readonly [string, number])[]): BuildingPart => ({ needs: items });
export const solid = (): BuildingPart => ({ solid: true });
export const shelter = (shelterOf: Shelter): BuildingPart => ({ shelter: shelterOf });
export const emits = ({ look, heat = null, light = null, igniter = false, when = 'always' }: { look: Emits['look']; heat?: Heat | null; light?: Light | null; igniter?: boolean; when?: Emits['when'] }): BuildingPart => ({ emits: { look, heat, light, igniter, when } });
export const fuelled = ({ capacity, burn, start }: Fuelled): BuildingPart => ({ fuelled: { capacity, burn, start } });
export const placedBy = (command: string): BuildingPart => ({ placedBy: command });
export const trap = (trapOf: Trap): BuildingPart => ({ trap: trapOf });
export const unlockedBy = (neuron: string): BuildingPart => ({ unlock: neuron });
export const storage = ({ capacity, mixed = false, haul = true }: { capacity: number; mixed?: boolean; haul?: boolean }): BuildingPart => ({ storage: { capacity, mixed, haul } });
export const job = ({ station, slots = 1 }: { station: string; slots?: number }): BuildingPart => ({ job: { station, slots } });
export const footprint = ({ clears = true, trees = false, trodden = true }: { clears?: boolean; trees?: boolean; trodden?: boolean } = {}): BuildingPart => ({ footprint: { clears, trees, trodden } });
export const blurb = (text: string): BuildingPart => ({ blurb: text });
