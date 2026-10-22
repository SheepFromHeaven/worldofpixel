import type { Grid } from './grid.ts';
import type { Light } from './light.ts';

export interface Clip {
  name: string;
  frames: number;
  fps?: number;
}

export const ONE_CLIP: readonly Clip[] = [{ name: 'default', frames: 1 }];

export interface Piece {
  clip: string;
  foot: number;
}

export interface Sprite {
  name: string;
  cells: number;
  lights: readonly Light[];
  clips?: readonly Clip[];
  pieces?: readonly Piece[];
  draw: (lights: readonly Light[], clip: string, frame: number) => Grid;
}

export const clipsOf = (sprite: Sprite): readonly Clip[] => sprite.clips ?? ONE_CLIP;

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
