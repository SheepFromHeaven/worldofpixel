import { createGrid } from '../grid.ts';
import type { Grid } from '../grid.ts';
import { paint } from './art.ts';
import { PLATE_CELLS, PLATE_NAMES, PLATE_SLICE } from './metrics.ts';
import type { PlateName } from './metrics.ts';

/**
 * The board and the tiles laid on it, as twelve cells square: four of corner, four of stretched
 * edge, four of corner.
 *
 * **A tile is a solid with a lit edge, not a rectangle with a border.** Four cells of corner
 * rather than three because that is what a bevel costs — an ink line, a lit top face, the tile's
 * own face, and the shaded face falling away on the far side. Three cells can draw a rounded box
 * and nothing more, and a box is what all of these used to be.
 *
 * CSS stretches the middle row and the middle column and leaves the four corners alone, so the
 * four rows of each band have to be the same across their width — anything that varies there
 * comes out as a streak the length of the plate. The corners are where the shape lives, and the
 * bevel miters there the same way at every size because it is never stretched.
 *
 * Bone is written as the step of its ramp — `0` darkest, `6` lightest — so a row reads as the
 * height it is describing rather than as four letters that have to be looked up.
 */
const PLATES: Record<PlateName, readonly string[]> = {
  /**
   * The board: felt let into a rail of oiled timber, with an ink line where the cloth meets it.
   * Everything the building flow opens — the picker, the designer sheet, the blueprint — is
   * this, because a tile has to be laid down on something.
   */
  board: [
    'KKKKKKKKKKKK',
    'KTTTTTTTTTtK',
    'KTttttttttTK',
    'KTtKKKKKKttK',
    'KTtKVVVVKttK',
    'KTtKVVVVKttK',
    'KTtKVVVVKttK',
    'KTtKVVVVKttK',
    'KTtKKKKKKttK',
    'KTTTTTTTTTtK',
    'KTttttttttTK',
    'KKKKKKKKKKKK',
  ],

  /** A tile lying face up: lit along the top and the left, falling away on the other two. */
  tile: [
    'KKKKKKKKKKKK',
    'K6666666652K',
    'K6544444432K',
    'K6544444432K',
    'K6544444432K',
    'K6544444432K',
    'K6544444432K',
    'K6544444432K',
    'K6544444432K',
    'K6544444432K',
    'K3222222222K',
    'KKKKKKKKKKKK',
  ],

  /** The same tile with the light caught on it: the face a step up, the shadow a step back. */
  'tile-hover': [
    'KKKKKKKKKKKK',
    'K6666666653K',
    'K6555555543K',
    'K6555555543K',
    'K6555555543K',
    'K6555555543K',
    'K6555555543K',
    'K6555555543K',
    'K6555555543K',
    'K6555555543K',
    'K4333333333K',
    'KKKKKKKKKKKK',
  ],

  /**
   * A tile pushed forward out of the hand. The bevel turns over — the light is now on the near
   * edge and the far one is in shadow — and the face is the red the map is marked with, so what
   * is held and what it will draw are the same colour.
   */
  'tile-on': [
    'KKKKKKKKKKKK',
    'KRRRRRRRRRQK',
    'KRrrrrrrrrQK',
    'KRrrrrrrrrQK',
    'KRrrrrrrrrQK',
    'KRrrrrrrrrQK',
    'KRrrrrrrrrQK',
    'KRrrrrrrrrQK',
    'KRrrrrrrrrQK',
    'KRrrrrrrrrQK',
    'KQQQQQQQQQQK',
    'KKKKKKKKKKKK',
  ],

  /**
   * Face down: a tile that is on the board but out of play.
   *
   * Flat, with no lit edge at all — the bevel is what says a piece is standing proud and ready
   * to be picked up, so a piece that cannot be is the one thing here with no bevel. It keeps a
   * bone face rather than going back to felt, because a tile that reads as a hole in the board
   * is a tile the player stops looking at, and the reason it is out of play is written on it.
   */
  'tile-off': [
    'KKKKKKKKKKKK',
    'K2222222222K',
    'K2333333332K',
    'K2333333332K',
    'K2333333332K',
    'K2333333332K',
    'K2333333332K',
    'K2333333332K',
    'K2333333332K',
    'K2333333332K',
    'K2222222222K',
    'KKKKKKKKKKKK',
  ],

  /** Cut into the board rather than laid on it: the shadow falls inwards from the top left. */
  field: [
    'KKKKKKKKKKKK',
    'K1111111112K',
    'K1555555553K',
    'K1555555553K',
    'K1555555553K',
    'K1555555553K',
    'K1555555553K',
    'K1555555553K',
    'K1555555553K',
    'K1555555553K',
    'K3333333333K',
    'KKKKKKKKKKKK',
  ],

  /** Where a tile is not: a shallow square pressed into the felt, waiting for one. */
  slot: [
    'KKKKKKKKKKKK',
    'KvvvvvvvvvVK',
    'KvVVVVVVVVVK',
    'KvVVVVVVVVVK',
    'KvVVVVVVVVVK',
    'KvVVVVVVVVVK',
    'KvVVVVVVVVVK',
    'KvVVVVVVVVVK',
    'KvVVVVVVVVVK',
    'KvVVVVVVVVVK',
    'KVVVVVVVVVVK',
    'KKKKKKKKKKKK',
  ],
};

export function plateGrid(name: PlateName): Grid {
  const rows = PLATES[name];
  if (rows.length !== PLATE_CELLS) {
    throw new Error(`plate ${name}: ${rows.length} rows, expected ${PLATE_CELLS}`);
  }
  if (PLATE_CELLS !== PLATE_SLICE * 3) {
    throw new Error(`plate: ${PLATE_CELLS} cells is not three slices of ${PLATE_SLICE}`);
  }
  const grid = createGrid(PLATE_CELLS);
  paint(grid, 0, 0, rows, PLATE_CELLS);
  return grid;
}

export const plates = (): { name: PlateName; grid: Grid }[] =>
  PLATE_NAMES.map((name) => ({ name, grid: plateGrid(name) }));
