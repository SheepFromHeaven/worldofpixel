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

export interface Ground {
  readonly clears: boolean;
  readonly trees: boolean;
  readonly trodden: boolean;
}

export type Cell = readonly [number, number];

export interface Footprint {
  readonly cells: readonly Cell[];
  readonly rotates: boolean;
}

export interface StationPart {
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
  readonly ground?: Ground;
  readonly footprint?: Footprint;
  readonly fence?: string;
  readonly blurb?: string;
}

export type Layer = 'station' | 'block';

export interface StationDef {
  readonly layer: Layer;
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
  readonly ground: Ground;
  readonly footprint: Footprint;
  readonly fence: string | null;
}

const SINGLE: Footprint = { cells: [[0, 0]], rotates: false };

export const station = (key: string, name: string, sprite: string, ...parts: readonly StationPart[]): StationDef => {
  const merged: { -readonly [K in keyof StationPart]: StationPart[K] } = {};
  for (const part of parts) Object.assign(merged, part);
  return {
    layer: 'station',
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
    ground: merged.ground ?? { clears: true, trees: false, trodden: true },
    footprint: merged.footprint ?? SINGLE,
    fence: merged.fence ?? null,
  };
};

export const block = (key: string, name: string, sprite: string, ...parts: readonly StationPart[]): StationDef => ({ ...station(key, name, sprite, ...parts), layer: 'block' });

export const needs = (...items: readonly (readonly [string, number])[]): StationPart => ({ needs: items });
export const solid = (): StationPart => ({ solid: true });
export const shelter = (shelterOf: Shelter): StationPart => ({ shelter: shelterOf });
export const emits = ({ look, heat = null, light = null, igniter = false, when = 'always' }: { look: Emits['look']; heat?: Heat | null; light?: Light | null; igniter?: boolean; when?: Emits['when'] }): StationPart => ({ emits: { look, heat, light, igniter, when } });
export const fuelled = ({ capacity, burn, start }: Fuelled): StationPart => ({ fuelled: { capacity, burn, start } });
export const placedBy = (command: string): StationPart => ({ placedBy: command });
export const trap = (trapOf: Trap): StationPart => ({ trap: trapOf });
export const unlockedBy = (neuron: string): StationPart => ({ unlock: neuron });
export const storage = ({ capacity, mixed = false, haul = true }: { capacity: number; mixed?: boolean; haul?: boolean }): StationPart => ({ storage: { capacity, mixed, haul } });
export const job = ({ station, slots = 1 }: { station: string; slots?: number }): StationPart => ({ job: { station, slots } });
export const ground = ({ clears = true, trees = false, trodden = true }: { clears?: boolean; trees?: boolean; trodden?: boolean } = {}): StationPart => ({ ground: { clears, trees, trodden } });
export const footprint = (cells: readonly Cell[], { rotates = true }: { rotates?: boolean } = {}): StationPart => ({ footprint: { cells, rotates } });
export const fenced = (item: string): StationPart => ({ fence: item });
export const blurb = (text: string): StationPart => ({ blurb: text });

export const TURNS = 4;

export const turned = ([dx, dy]: Cell, turn: number): Cell => {
  let x = dx;
  let y = dy;
  for (let step = 0; step < turn; step += 1) [x, y] = [-y, x];
  return [x, y];
};
