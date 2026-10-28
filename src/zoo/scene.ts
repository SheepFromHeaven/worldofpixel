import type { SceneryProp } from '../render/lit/scenery.ts';
import type { Vec2 } from '../sim/geometry.ts';
import { prng } from '../sim/rng.ts';
import type { Piece } from './pieces.ts';
import { spriteNames } from './pieces.ts';

const LIMIT = 6000;

const TEXEL = 1 / 16;

const JITTER = 0.3;

const WIND = 0.4;

export const ERASE_RADIUS = 0.6;

interface Placed {
  piece: Piece;
  stage: string;
  variant: number;
  flip: boolean;
  x: number;
  y: number;
}

const snap = (value: number): number => Math.round(value / TEXEL) * TEXEL;

export class Scene {
  private placed: Placed[] = [];
  private random = prng(20250214);
  private cache: SceneryProp[] | null = null;

  get count(): number {
    return this.placed.length;
  }

  props(): readonly SceneryProp[] {
    if (this.cache) return this.cache;
    this.cache = this.placed.flatMap((one) => spriteNames(one.piece, one.variant, one.stage).map((name) => ({ name, x: one.x, y: one.y, flip: one.flip, wind: WIND })));
    return this.cache;
  }

  place(piece: Piece, at: Vec2, stage: string, scatter: boolean): void {
    if (this.placed.length >= LIMIT) return;
    const reach = scatter ? piece.spacing * JITTER : 0;
    const x = snap(at.x + (this.random() - 0.5) * 2 * reach);
    const y = snap(at.y + (this.random() - 0.5) * 2 * reach);
    this.placed.push({ piece, stage, variant: Math.floor(this.random() * piece.variants), flip: this.random() < 0.5, x, y });
    this.cache = null;
  }

  erase(at: Vec2, radius = ERASE_RADIUS): number {
    const kept = this.placed.filter((one) => Math.hypot(one.x - at.x, one.y - at.y) > Math.max(radius, one.piece.spacing * 0.5));
    const removed = this.placed.length - kept.length;
    if (removed > 0) {
      this.placed = kept;
      this.cache = null;
    }
    return removed;
  }

  clear(): void {
    this.placed = [];
    this.cache = null;
  }
}
