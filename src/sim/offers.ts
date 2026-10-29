import type { TileIndex } from './grid.ts';
import type { People } from './people/people.ts';
import type { Command, GameMode } from './simulation.ts';
import type { World } from './world.ts';

export interface Offer {
  label: string;
  reason: string | null;
  command?: Command;
  group?: 'erect' | 'orders';
  earned?: boolean;
}

export interface OfferContext {
  readonly world: World;
  readonly people: People;
  readonly mode: GameMode;
  readonly depth: number;
  readonly plane: number;
  deepCaveAt(tile: TileIndex): boolean;
  knows(id: string): boolean;
  igniterNear(x: number, y: number): boolean;
}

export type Offers = (context: OfferContext, tile: TileIndex) => Offer[];

export const standable = ({ world }: OfferContext, tile: TileIndex): string | null => {
  const here = world.tile(tile);
  return here.passable ? null : (here.refusal ?? 'cannot stand here');
};
