import type { TileIndex } from '../grid.ts';
import { ItemType } from '../people/items.ts';
import type { People } from '../people/people.ts';
import type { Random } from '../rng.ts';
import { hash2, prng } from '../rng.ts';
import type { World } from '../world.ts';
import type { Piece } from './piece.ts';
import { PieceState } from './piece.ts';
import { reactionBetween } from './reactions.ts';
import type { Verb } from './reactions.ts';

export type EffectKind = 'sparks' | 'spray' | 'dust' | 'chip' | 'smoke' | 'flare' | 'snuff' | 'thunk';

export interface Effect {
  kind: EffectKind;
  x: number;
  y: number;
  at: number;
  seed: number;
}

export const SMOULDER_SECONDS = 5;

export const EFFECT_SECONDS = 0.9;

const REACH: Record<number, number> = {
  [ItemType.Flint]: 0.11,
  [ItemType.Stone]: 0.13,
  [ItemType.DryKindling]: 0.15,
  [ItemType.Branch]: 0.18,
  [ItemType.HandAxe]: 0.17,
  [ItemType.Torch]: 0.18,
};

const MARGIN = 0.14;

const SPILL = 0.3;

export { PieceState };
export type { Piece };

export const reachOf = (piece: Piece): number => REACH[piece.kind] ?? 0.13;

export class Trial {
  readonly pieces: Piece[] = [];
  readonly effects: Effect[] = [];
  held: Piece | null = null;
  time = 0;

  private next = 0;
  private readonly random: Random;

  constructor(
    readonly tile: TileIndex,
    kinds: readonly ItemType[],
    seed: number,
  ) {
    this.random = prng(seed ^ tile);
    const columns = Math.max(1, Math.ceil(Math.sqrt(kinds.length)));
    const rows = Math.max(1, Math.ceil(kinds.length / columns));
    const cellWidth = (1 - MARGIN * 2) / columns;
    const cellHeight = (1 - MARGIN * 2) / rows;
    kinds.forEach((kind, order) => {
      const x = MARGIN + ((order % columns) + 0.5 + (hash2(tile, order, 71) - 0.5) * 0.5) * cellWidth;
      const y = MARGIN + (Math.floor(order / columns) + 0.5 + (hash2(order, tile, 83) - 0.5) * 0.5) * cellHeight;
      const burning = kind === ItemType.BurningBranch;
      const piece = this.make(burning ? ItemType.Branch : kind, x, y);
      if (burning) piece.state = PieceState.Burning;
      this.pieces.push(piece);
    });
  }

  get lying(): readonly Piece[] {
    return this.pieces.filter((piece) => !piece.spent && piece !== this.held);
  }

  pieceAt(x: number, y: number): Piece | null {
    let found: Piece | null = null;
    let least = Infinity;
    for (const piece of this.lying) {
      const away = Math.hypot(piece.x - x, piece.y - y);
      if (away <= reachOf(piece) && away < least) {
        least = away;
        found = piece;
      }
    }
    return found;
  }

  verbFor(target: Piece): Verb | null {
    return this.held ? reactionBetween(this.held, target).verb : null;
  }

  pick(piece: Piece): boolean {
    if (this.held || piece.spent || piece.state === PieceState.Ash) return false;
    this.held = piece;
    return true;
  }

  drop(x: number, y: number): void {
    const held = this.held;
    if (!held) return;
    held.x = Math.min(1 + SPILL, Math.max(-SPILL, x));
    held.y = Math.min(1 + SPILL, Math.max(-SPILL, y));
    this.held = null;
  }

  act(target: Piece): Verb | null {
    const held = this.held;
    if (!held || target.spent) return null;
    const reaction = reactionBetween(held, target);
    reaction.apply(this, held, target);
    return reaction.verb;
  }

  effect(kind: EffectKind, x: number, y: number): void {
    this.effects.push({ kind, x, y, at: this.time, seed: Math.floor(this.random() * 1e6) });
  }

  sparksOver(x: number, y: number, reach: number, chance: number): void {
    this.effect('sparks', x, y);
    for (const piece of this.lying) {
      if (piece.kind !== ItemType.DryKindling || piece.state !== PieceState.Plain) continue;
      if (Math.hypot(piece.x - x, piece.y - y) > reach) continue;
      if (this.random() < chance) this.smoulder(piece);
    }
  }

  smoulder(piece: Piece): void {
    piece.state = PieceState.Smouldering;
    piece.timer = SMOULDER_SECONDS;
    this.effect('smoke', piece.x, piece.y);
  }

  roll(): number {
    return this.random();
  }

  make(kind: ItemType, x: number, y: number): Piece {
    const piece: Piece = { id: this.next, kind, state: PieceState.Plain, x, y, timer: 0, chips: 0, spent: false };
    this.next += 1;
    return piece;
  }

  update(seconds: number): void {
    this.time += seconds;
    for (const piece of this.pieces) {
      if (piece.spent || piece.state !== PieceState.Smouldering) continue;
      piece.timer -= seconds;
      if (piece.timer <= 0) {
        piece.state = PieceState.Ash;
        this.effect('snuff', piece.x, piece.y);
      }
    }
    while (this.effects.length > 0 && this.time - this.effects[0]!.at > EFFECT_SECONDS) this.effects.shift();
  }

  commit(world: World, people: People): void {
    const { items } = world;
    for (const slot of [...items.at(this.tile)]) items.remove(slot);

    let axe = false;
    for (const piece of this.pieces) {
      if (piece.spent || piece.state === PieceState.Ash || piece.state === PieceState.Smouldering) continue;
      if (piece.kind === ItemType.HandAxe) axe = true;
      items.add(this.tile, piece.state === PieceState.Burning ? ItemType.BurningBranch : piece.kind);
    }
    if (axe) people.knowledge.hasDiscoveredFlintKnapping = true;
  }
}
