export type PieceKind = 'tree' | 'bush' | 'boulder' | 'mark';

export type PieceTab = 'plants' | 'decals';

export interface Piece {
  key: string;
  title: string;
  kind: PieceKind;
  section: string;
  tab: PieceTab;
  staged: boolean;
  spacing: number;
  twins: readonly string[];
  variants: number;
  prefix: string;
}

export const STAGES: readonly string[] = ['sapling', 'young', 'low', 'mid', 'high'];

export const DEFAULT_STAGE = 'mid';

export const SECTIONS: readonly { section: string; title: string; tab: PieceTab }[] = [
  { section: 'trees', title: 'trees', tab: 'plants' },
  { section: 'bushes', title: 'bushes', tab: 'plants' },
  { section: 'ground', title: 'grass and ground plants', tab: 'plants' },
  { section: 'flowers', title: 'flowers', tab: 'plants' },
  { section: 'water', title: 'water plants', tab: 'plants' },
  { section: 'rocks', title: 'rocks and wood', tab: 'decals' },
  { section: 'litter', title: 'ferns, fungi and litter', tab: 'decals' },
];

const TREE_SPACING = 2;
const BUSH_SPACING = 1;
const BOULDER_SPACING = 1;
const MARK_SPACING = 0.3;

const THREE_VARIANTS: ReadonlySet<string> = new Set(['oak', 'pine', 'acacia', 'palm', 'snag']);

const trees = (names: readonly string[]): Piece[] =>
  names.map((name) => ({ key: `tree.${name}`, title: name, kind: 'tree', section: 'trees', tab: 'plants', staged: true, spacing: TREE_SPACING, twins: [], variants: THREE_VARIANTS.has(name) ? 3 : 2, prefix: `tree.${name}` }));

const staged = (kind: 'bush' | 'boulder', names: readonly string[], section: string, spacing: number): Piece[] =>
  names.map((name) => ({ key: `${kind}.${name}`, title: name, kind, section, tab: 'plants', staged: true, spacing, twins: [], variants: 2, prefix: `${kind}.${name}` }));

const marks = (section: string, tab: PieceTab, entries: readonly (readonly [string, string])[], twins: readonly string[] = []): Piece[] =>
  entries.map(([prefix, title]) => ({ key: prefix, title, kind: 'mark', section, tab, staged: false, spacing: MARK_SPACING, twins, variants: 3, prefix }));

export const PIECES: readonly Piece[] = [
  ...trees(['oak', 'birch', 'chestnut', 'apple', 'willow', 'olive', 'pine', 'snowpine', 'spruce', 'cypress', 'acacia', 'baobab', 'palm', 'kapok', 'jungle', 'fig', 'snag']),
  ...staged('bush', ['shrub', 'berry', 'thorn', 'maquis', 'heather', 'tundrashrub', 'juniper', 'grapevine', 'liana', 'treefern', 'banana', 'bamboo', 'cactus', 'fern'], 'bushes', BUSH_SPACING),
  ...marks('ground', 'plants', [
    ['meadow.tuft', 'meadow tuft'],
    ['meadow.clover', 'clover'],
    ['herb.savannagrass', 'savanna grass'],
    ['herb.steppegrass', 'steppe grass'],
    ['herb.tussock', 'tussock'],
    ['herb.dunegrass', 'dune grass'],
    ['herb.desertgrass', 'desert grass'],
    ['herb.junglefloor', 'jungle floor'],
    ['herb.woodland', 'woodland herbs'],
    ['herb.sedge', 'sedge'],
    ['marsh.sedge', 'marsh sedge'],
    ['highland.tussock', 'highland tussock'],
    ['highland.heather', 'highland heather'],
    ['desert.scrub', 'desert scrub'],
    ['desert.cactus', 'cactus'],
    ['desert.barrel', 'barrel cactus'],
  ]),
  ...marks('flowers', 'plants', [
    ['meadow.flowers.yellow', 'yellow flowers'],
    ['meadow.flowers.white', 'white flowers'],
    ['meadow.flowers.red', 'red flowers'],
    ['meadow.flowers.blue', 'blue flowers'],
    ['desert.flower', 'desert flowers'],
  ], ['bud', 'seed']),
  ...marks('water', 'plants', [
    ['aqua.reeds', 'reeds'],
    ['aqua.lily', 'water lily'],
    ['aqua.algae', 'algae'],
    ['aqua.seagrass', 'seagrass'],
    ['aqua.kelp', 'kelp'],
    ['aqua.weed', 'streaming weed'],
    ['marsh.reeds', 'marsh reeds'],
  ]),
  ...staged('boulder', ['1', '2', 'lichen', 'snow'], 'rocks', BOULDER_SPACING).map((piece) => ({ ...piece, tab: 'decals' as const, title: piece.title === '1' || piece.title === '2' ? `boulder ${piece.title}` : `${piece.title} boulder` })),
  ...marks('rocks', 'decals', [
    ['meadow.stone', 'meadow stones'],
    ['tundra.stone', 'tundra stones'],
    ['desert.stones', 'desert stones'],
    ['highland.rocks', 'highland rocks'],
    ['karst.shard', 'limestone shards'],
    ['volcanic.cinders', 'cinders'],
    ['salt.crystals', 'salt crystals'],
    ['path.pebbles', 'pebbles'],
    ['forest.log', 'log'],
    ['forest.stump', 'stump'],
    ['tundra.twig', 'twigs'],
    ['fallen.oak', 'fallen oak'],
    ['fallen.pine', 'fallen pine'],
    ['marsh.puddle', 'puddle'],
  ]),
  ...marks('litter', 'decals', [
    ['forest.fern', 'fern'],
    ['forest.mushrooms.red', 'red mushrooms'],
    ['forest.mushrooms.brown', 'brown mushrooms'],
    ['forest.leaves', 'leaf litter'],
    ['swamp.moss', 'swamp moss'],
    ['herb.moss', 'moss'],
    ['tundra.lichen', 'lichen'],
  ]),
];

export const spriteNames = (piece: Piece, variant: number, stage: string): string[] => {
  const v = variant % piece.variants;
  if (piece.staged) return [`${piece.prefix}.v${v}.${stage}`];
  return [`${piece.prefix}.v${v}`, ...piece.twins.map((twin) => `${piece.prefix}.${twin}.v${v}`)];
};
