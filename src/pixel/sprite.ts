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
 * One piece of a drawing, and where it stands.
 *
 * A building is not one object. A hearth is a pit, a ring of stones round it and a fire standing
 * up out of the middle; a works is a floor with eleven separate stones on it. Each of those meets
 * the ground somewhere different, and on a map sorted by foot that is the only thing that decides
 * what a villager passing by is drawn over and what it is drawn under — so each is a clip of its
 * own, with the row its own foot is on. Drawn as one picture there is no honest answer: whatever
 * single foot it is given is wrong for every part of it but one.
 *
 * `foot` is the row the piece *stands* on, not the row it is drawn on — a flame rises above the
 * bed it burns in, and a stone's body is above the ground it sits on.
 */
export interface Piece {
  clip: string;
  foot: number;
}

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
  /**
   * The parts the map sorts separately, back to front. Omitted means the whole tile is one piece
   * standing at its middle, which is right for a thing that stands up — a villager, a stone.
   */
  pieces?: readonly Piece[];
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
