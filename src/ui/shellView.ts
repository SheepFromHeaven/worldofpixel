import type { Tool } from './game.ts';

export interface StripView {
  seed: number;
  tiles: number;
  biome: string;
  standing: string;
}

export interface BarView {
  tool: Tool;
  reaches: boolean;
  reason: string;
}

export interface TileSheetView {
  column: number;
  row: number;
  biome: string;
  standing: string;
  elevation: number;
  wear: number;
  refusal: string | null;
}
