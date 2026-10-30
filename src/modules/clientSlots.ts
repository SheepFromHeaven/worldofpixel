import type { TileIndex } from '../sim/grid.ts';
import type { World } from '../sim/world.ts';
import type { Command } from '../sim/simulation.ts';
import type { People } from './people/api.ts';

export interface Ghost {
  sprite: string;
  x: number;
  y: number;
}

export interface Stamp {
  readonly time: number;
  readonly ghost: Ghost | undefined;
  seen(x: number, y: number): boolean;
  has(name: string): boolean;
  grown(name: string): boolean;
  place(name: string, x: number, y: number, flip?: boolean): boolean;
  flat(name: string, x: number, y: number): boolean;
}

export interface Drawable {
  readonly id: string;
  readonly order: number;
  draw(world: World, people: People, stamp: Stamp): void;
}

export interface StructureNeed {
  icon: string;
  name: string;
  count: number;
}

export interface StructureView {
  title: string;
  share: number | null;
  gauge: string;
  rows: readonly (readonly [string, string])[];
  missing?: readonly StructureNeed[];
  stored?: readonly StructureNeed[];
}

export interface SheetSource {
  readonly id: string;
  at(world: World, people: People, tile: TileIndex): StructureView | null;
}

const SHEETS = new Map<string, SheetSource>();

export const registerSheet = (source: SheetSource): void => {
  if (SHEETS.has(source.id)) throw new Error(`two sheets are called ${source.id}`);
  SHEETS.set(source.id, source);
};

export const sheetAt = (world: World, people: People, tile: TileIndex): StructureView | null => {
  for (const source of SHEETS.values()) {
    const view = source.at(world, people, tile);
    if (view) return view;
  }
  return null;
};

const DRAWABLES = new Map<string, Drawable>();

export const registerDrawable = (drawable: Drawable): void => {
  if (DRAWABLES.has(drawable.id)) throw new Error(`two drawables are called ${drawable.id}`);
  DRAWABLES.set(drawable.id, drawable);
};

export const drawablesInOrder = (): Drawable[] => [...DRAWABLES.values()].sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1));

export interface Mark {
  readonly tile: TileIndex;
  readonly reason: string | null;
}

export interface BrushNote {
  readonly text: string;
  readonly refused: boolean;
}

export interface Brush {
  turn(): void;
  marks(tile: TileIndex): Mark[];
  ghost(tile: TileIndex): Ghost | undefined;
  note(tile: TileIndex): BrushNote;
  apply(tile: TileIndex): boolean;
}

export interface BrushHost {
  readonly world: World;
  send(command: Command): void;
}

export interface BrushKind {
  readonly id: string;
  arm(host: BrushHost, args: Readonly<Record<string, unknown>>): Brush | null;
}

const BRUSHES = new Map<string, BrushKind>();

export const registerBrush = (kind: BrushKind): void => {
  if (BRUSHES.has(kind.id)) throw new Error(`two brushes are called ${kind.id}`);
  BRUSHES.set(kind.id, kind);
};

export const brushOf = (id: string): BrushKind | undefined => BRUSHES.get(id);
