import type { ItemType } from '../people/items.ts';

export const PieceState = { Plain: 0, Smouldering: 1, Burning: 2, Ash: 3 } as const;

export type PieceState = (typeof PieceState)[keyof typeof PieceState];

export interface Piece {
  readonly id: number;
  kind: ItemType;
  state: PieceState;
  x: number;
  y: number;
  timer: number;
  chips: number;
  spent: boolean;
}
