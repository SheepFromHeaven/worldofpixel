import { MARGIN_TILES, WORLD_TILES } from '../../sim/grid.ts';
import { BIOLOGIES } from '../lives.manifest.generated.ts';
import type { Group, Life } from './vocabulary.ts';

export * from './vocabulary.ts';

export const FAUNA_YEAR_DAYS = 1;

export const PATCH_TILES = 16;

export const PATCH_AREA = PATCH_TILES * PATCH_TILES;

export const FAUNA_COLUMNS = Math.ceil((WORLD_TILES.columns + 2 * MARGIN_TILES) / PATCH_TILES);

export const FAUNA_ROWS = Math.ceil((WORLD_TILES.rows + 2 * MARGIN_TILES) / PATCH_TILES);

export const LIVES: readonly Life[] = [...BIOLOGIES]
  .sort((a, b) => a.order - b.order)
  .flatMap((biology) => biology.rows())
  .map((row, index) => ({ gestates: false, ...row, index }));

export const LIFE_COUNT = LIVES.length;

export const FAUNA_ATLAS_ACROSS = 4;

export const FAUNA_ATLAS_DOWN = Math.ceil(LIFE_COUNT / FAUNA_ATLAS_ACROSS);

export const lifeOf = (key: string): Life => {
  const life = LIVES.find((candidate) => candidate.key === key);
  if (!life) throw new Error(`no species ${key}`);
  return life;
};

export const firstOf = (group: Group): number => LIVES.findIndex((life) => life.group === group);

export const countOf = (group: Group): number => LIVES.filter((life) => life.group === group).length;

export const GROUP_BASE: Record<Group, number> = { insect: firstOf('insect'), amphibian: firstOf('amphibian'), reptile: firstOf('reptile'), bird: firstOf('bird'), mammal: firstOf('mammal') };

export const NEED_EXPONENT = 0.67;

export const needOf = (mass: number, group: Group): number => (group === 'amphibian' ? 9 : group === 'insect' ? 4 : group === 'mammal' ? 6 : group === 'bird' ? 8 : 5) * mass ** NEED_EXPONENT;
