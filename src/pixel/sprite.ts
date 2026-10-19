import type { Grid } from './grid.ts';
import type { Light } from './light.ts';

/**
 * One named animation: how many frames it has, and how fast it runs.
 *
 * A sprite's frames are not one flat list, because a villager walking and a villager standing
 * still are not two points on the same cycle — they are different loops of different lengths
 * that the game picks between. Naming them is what lets the renderer ask for "idle" without
 * knowing where idle happens to sit in the strip.
 */
export interface Clip {
  name: string;
  frames: number;
  /**
   * Frames a second, when the clip is played off the clock. Omitted means the sprite's default.
   * A walk ignores this entirely — its frame comes from distance walked, so the feet keep up
   * with the figure however fast it is going.
   */
  fps?: number;
}

export const ONE_CLIP: readonly Clip[] = [{ name: 'default', frames: 1 }];

/**
 * One drawing: the size its cells are authored at, the lights it ships with, and how to draw any
 * frame of any of its clips under any lights at all.
 *
 * A sprite is a function rather than a picture, which is what lets the bake, the lab and the
 * game all ask it for different things without any of them holding a copy.
 */
export interface Sprite {
  name: string;
  cells: number;
  /** What the committed tile is lit by. */
  lights: readonly Light[];
  /** Omitted means a single still frame. */
  clips?: readonly Clip[];
  draw: (lights: readonly Light[], clip: string, frame: number) => Grid;
}

export const clipsOf = (sprite: Sprite): readonly Clip[] => sprite.clips ?? ONE_CLIP;

/** Where a clip's frames start in the baked strip, counted in frames. */
export function clipOffset(clips: readonly Clip[], name: string): number {
  let at = 0;
  for (const clip of clips) {
    if (clip.name === name) return at;
    at += clip.frames;
  }
  return 0;
}

export const totalFrames = (clips: readonly Clip[]): number =>
  clips.reduce((sum, clip) => sum + clip.frames, 0);
