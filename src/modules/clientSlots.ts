import type { TileIndex } from '../sim/grid.ts';
import type { World } from '../sim/world.ts';
import type { Command } from '../sim/simulation.ts';
import type { People } from './people/api.ts';
import type { MindView } from './mind/api.ts';

export interface Ghost {
  sprite: string;
  x: number;
  y: number;
}

export interface PlaceOptions {
  readonly height?: number;
  readonly rimmed?: boolean;
  readonly raise?: number;
}

export interface FlatOptions {
  readonly flip?: boolean;
  readonly height?: number;
}

export interface Stamp {
  readonly time: number;
  readonly ghost: Ghost | undefined;
  seen(x: number, y: number): boolean;
  has(name: string): boolean;
  grown(name: string): boolean;
  height(name: string): number | undefined;
  place(name: string, x: number, y: number, flip?: boolean, options?: PlaceOptions): boolean;
  flat(name: string, x: number, y: number, options?: FlatOptions): boolean;
  flame(x: number, y: number, headX: number, headY: number, height: number): void;
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
  capacity?: number;
  sections?: readonly SheetSection[];
}

export interface SheetButton {
  readonly key: string;
  readonly icon: string;
  readonly name: string;
  readonly on: boolean;
  readonly note?: string;
  readonly command: Command | null;
}

export interface SheetSection {
  readonly id: string;
  readonly title: string;
  readonly hint: string;
  readonly empty?: string;
  readonly slots?: number;
  readonly buttons: readonly SheetButton[];
}

export interface SheetContext {
  readonly world: World;
  readonly people: People;
  readonly mind: MindView | null;
}

export interface SheetSource {
  readonly id: string;
  at(world: World, people: People, tile: TileIndex): StructureView | null;
}

export interface SectionSource {
  readonly id: string;
  readonly order: number;
  at(context: SheetContext, tile: TileIndex): readonly SheetSection[];
}

const SHEETS = new Map<string, SheetSource>();

export const registerSheet = (source: SheetSource): void => {
  if (SHEETS.has(source.id)) throw new Error(`two sheets are called ${source.id}`);
  SHEETS.set(source.id, source);
};

const SECTIONS = new Map<string, SectionSource>();

export const registerSection = (source: SectionSource): void => {
  if (SECTIONS.has(source.id)) throw new Error(`two sheet sections are called ${source.id}`);
  SECTIONS.set(source.id, source);
};

export const sheetAt = (context: SheetContext, tile: TileIndex): StructureView | null => {
  for (const source of SHEETS.values()) {
    const view = source.at(context.world, context.people, tile);
    if (!view) continue;
    const sections = [...SECTIONS.values()].sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1)).flatMap((section) => section.at(context, tile));
    return sections.length > 0 ? { ...view, sections } : view;
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
