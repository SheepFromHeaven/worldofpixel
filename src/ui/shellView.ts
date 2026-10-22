import type { Tool } from './game.ts';

export interface StripView {
  seed: number;
  town: boolean;
  people: number;
  spare: number;
  trouble: string | null;
}

export interface ClockView {
  tick: number;
  playing: boolean;
  speed: number;
}

export interface BarView {
  tool: Tool;
  fine: boolean;
  towns: number;
  reason: string;
}
