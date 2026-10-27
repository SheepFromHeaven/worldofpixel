import { Rock } from './rocks.ts';

export interface Layer {
  rock: Rock;
  metres: number;
}

export interface Sequence {
  name: string;
  layers: readonly Layer[];
  total: number;
}

const make = (name: string, layers: readonly (readonly [Rock, number])[]): Sequence => {
  const rows = layers.map(([rock, metres]) => ({ rock, metres }));
  return { name, layers: rows, total: rows.reduce((sum, layer) => sum + layer.metres, 0) };
};

export const Series = {
  Ocean: 0,
  Shelf: 1,
  Platform: 2,
  Downs: 3,
  Coal: 4,
  Evaporite: 5,
  RedBeds: 6,
  Karst: 7,
  Iron: 8,
  Volcanic: 9,
  Belt: 10,
} as const;

export type Series = (typeof Series)[keyof typeof Series];

export const SEQUENCES: readonly Sequence[] = [
  make('ocean floor', [[Rock.Shale, 12], [Rock.Chalk, 8]]),
  make('thin shelf', [[Rock.Sandstone, 14], [Rock.Shale, 10]]),
  make('mixed platform', [[Rock.Sandstone, 20], [Rock.Shale, 14], [Rock.Limestone, 60], [Rock.Shale, 12], [Rock.Limestone, 30], [Rock.Sandstone, 20]]),
  make('chalk downs', [[Rock.Chalk, 70], [Rock.Limestone, 30], [Rock.Shale, 15], [Rock.Sandstone, 40]]),
  make('coal measures', [
    [Rock.Sandstone, 14], [Rock.Shale, 10], [Rock.Coal, 2], [Rock.Shale, 9], [Rock.Sandstone, 18], [Rock.Coal, 3],
    [Rock.Shale, 12], [Rock.Sandstone, 20], [Rock.Coal, 2.5], [Rock.Shale, 15], [Rock.Limestone, 25], [Rock.Sandstone, 30],
  ]),
  make('evaporite basin', [[Rock.Gypsum, 6], [Rock.Salt, 16], [Rock.Shale, 10], [Rock.Limestone, 24], [Rock.Sandstone, 30], [Rock.Shale, 18]]),
  make('red beds', [[Rock.Sandstone, 90], [Rock.Shale, 18], [Rock.Sandstone, 40]]),
  make('karst platform', [[Rock.Limestone, 140], [Rock.Shale, 15]]),
  make('banded iron shield', [[Rock.Shale, 8], [Rock.Ironstone, 14], [Rock.Quartzite, 20], [Rock.Shale, 12]]),
  make('volcanic pile', [
    [Rock.Tuff, 14], [Rock.Basalt, 26], [Rock.Tuff, 8], [Rock.Andesite, 40], [Rock.Tuff, 10], [Rock.Basalt, 30], [Rock.Obsidian, 3], [Rock.Andesite, 30],
  ]),
  make('metamorphic belt', [[Rock.Slate, 50], [Rock.Schist, 70], [Rock.Marble, 20], [Rock.Quartzite, 30], [Rock.Gneiss, 60]]),
];

export function layerAt(sequence: Sequence, depth: number, scale: number): Rock | null {
  let top = 0;
  for (const layer of sequence.layers) {
    top += layer.metres * scale;
    if (depth < top) return layer.rock;
  }
  return null;
}
