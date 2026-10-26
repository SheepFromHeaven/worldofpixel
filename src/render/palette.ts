import type { Ramp, Rgba } from '../pixel/color.ts';
import { rgba } from '../pixel/color.ts';
import { BONE as BONE_RAMP, FIRE } from '../pixel/palette.ts';
import { Biome } from '../sim/types.ts';

function cssOf(color: Rgba): string {
  return `#${(color >>> 8).toString(16).padStart(6, '0')}`;
}

export const PAPER = '#f4f1ea';
export const PAPER_WARM = '#ece6d8';
export const PAPER_SHADE = '#e3dccb';
export const INK = '#3b352c';
export const INK_FAINT = '#a69c8a';
export const RED_PENCIL = '#c05140';

export const MARK_HALO = PAPER_WARM;

export const SELECTION = cssOf(BONE_RAMP[6]!);
export const SELECTION_SHADE = cssOf(BONE_RAMP[0]!);
export const ALERT = cssOf(FIRE[6]!);
export const ALERT_SHADE = cssOf(FIRE[1]!);

export const BIOME_COLORS: readonly string[] = [
  '#8aa65c',
  '#4f7f55',
  '#9a8a74',
  '#6f8f7a',
  '#a8b4bd',
  '#cfae6a',
  '#7d8186',
  '#c9c5b3',
  '#3a3437',
  '#e4e2da',
  '#b8643a',
  '#7aa6bd',
  '#6bb5c0',
  '#6bb5c0',
];

export const ROCK_COLORS: readonly string[] = [
  '#6b5238',
  '#9c6b4f',
  '#d8c28a',
  '#c79a62',
  '#5f6670',
  '#c8c2a8',
  '#ece8dc',
  '#f0d6d0',
  '#e4e0cc',
  '#1f1d1f',
  '#6e3b2c',
  '#b89a94',
  '#3a3d44',
  '#767077',
  '#b4a58c',
  '#15101c',
  '#4c5a62',
  '#6f7d6a',
  '#8a8a92',
  '#f2efe9',
  '#c9cfd2',
];

export const MINERAL_COLORS: readonly string[] = [
  '#000000',
  '#b8442c',
  '#3fb58a',
  '#c9ced4',
  '#6c7488',
  '#9aa3b4',
  '#e6e9ee',
  '#f5c542',
  '#e03a3a',
  '#d98a4c',
  '#25252d',
  '#f0e23a',
  '#f6f6ff',
  '#e8a020',
  '#dff3ff',
  '#9a5fd6',
  '#3da86a',
  '#a01c3a',
  '#5fd6a6',
  '#b8f0ff',
];

export const CAVE_COLORS = { void: '#0d0b10', rim: '#2b2630', water: '#28506e', waterRim: '#4f86a8', drip: '#e5dcc4' } as const;

export const CAVE_MOUTH = [rgba(0x07060a), rgba(0x0d0b10), rgba(0x181420), rgba(0x2b2630)] as const;

export const BIOME_RAMPS: readonly Ramp[] = [
  [rgba(0x4d612c), rgba(0x657e3d), rgba(0x7d9a4f), rgba(0x93ad6a), rgba(0xa8bb8a)],
  [rgba(0x213e24), rgba(0x325b37), rgba(0x45764a), rgba(0x59905e), rgba(0x72a478)],
  [rgba(0x5c5240), rgba(0x766954), rgba(0x8f8169), rgba(0xa29784), rgba(0xb5ad9f)],
  [rgba(0x3d5444), rgba(0x516d5a), rgba(0x668670), rgba(0x7f9b88), rgba(0x9aaea0)],
  [rgba(0x667d8e), rgba(0x8194a2), rgba(0x9caab4), rgba(0xb7c0c7), rgba(0xd1d7db)],
  [rgba(0xa27c2e), rgba(0xc1953d), rgba(0xc8a764), rgba(0xd1b989), rgba(0xdbccad)],
  [rgba(0x4a4d52), rgba(0x62666b), rgba(0x7b8086), rgba(0x969ba0), rgba(0xb1b5b8)],
  [rgba(0x8d897c), rgba(0xa7a392), rgba(0xbfbba8), rgba(0xd3d0bf), rgba(0xe6e4d6)],
  [rgba(0x1f1c1f), rgba(0x2f2b2e), rgba(0x433d3f), rgba(0x5a5152), rgba(0x74686a)],
  [rgba(0xc4c0bb), rgba(0xd4d2cd), rgba(0xe2e1db), rgba(0xeeede7), rgba(0xfaf9f3)],
  [rgba(0x7a3b26), rgba(0x9a4e30), rgba(0xb8643a), rgba(0xcf8452), rgba(0xe3a574)],
  [rgba(0x3f6e8a), rgba(0x5a8ba6), rgba(0x6b9ab4), rgba(0x7aa6bd), rgba(0x8bb5c9)],
  [rgba(0x3f8898), rgba(0x55a0ae), rgba(0x6bb5c0), rgba(0x81c7cf), rgba(0x9bd8dd)],
  [rgba(0x3f8898), rgba(0x55a0ae), rgba(0x6bb5c0), rgba(0x81c7cf), rgba(0x9bd8dd)],
];

export const biomeColor = (biome: Biome): string => BIOME_COLORS[biome] ?? PAPER;

export const PATH: Ramp = [
  rgba(0x5f4a2e),
  rgba(0x765c3a),
  rgba(0x8e7149),
  rgba(0xa68759),
  rgba(0xbb9d6d),
];

export const PATH_RAMPS: Record<'Meadow' | 'Forest' | 'Highland' | 'Marsh' | 'Tundra' | 'Desert' | 'Rock' | 'Karst' | 'Volcanic' | 'Salt' | 'Badlands', Ramp> = {
  Meadow: PATH,
  Forest: [rgba(0x3e2c1a), rgba(0x4f3922), rgba(0x63482c), rgba(0x775938), rgba(0x8a6a45)],
  Highland: [rgba(0x5e554a), rgba(0x726859), rgba(0x877c6b), rgba(0x9b917f), rgba(0xb0a795)],
  Marsh: [rgba(0x3f3a2a), rgba(0x4f4934), rgba(0x625a40), rgba(0x766d4e), rgba(0x8a805e)],
  Tundra: [rgba(0x6d6a62), rgba(0x817e75), rgba(0x96938a), rgba(0xaba89f), rgba(0xc0beb6)],
  Desert: [rgba(0xb59a6e), rgba(0xc4ab80), rgba(0xd1bb93), rgba(0xddc9a6), rgba(0xe7d7ba)],
  Rock: [rgba(0x6a6a68), rgba(0x7d7d79), rgba(0x908f8a), rgba(0xa3a29b), rgba(0xb6b5ad)],
  Karst: [rgba(0x9a9684), rgba(0xaca892), rgba(0xbebaa2), rgba(0xcfcbb3), rgba(0xe0dcc4)],
  Volcanic: [rgba(0x3a3436), rgba(0x4a4244), rgba(0x5b5254), rgba(0x6d6264), rgba(0x7f7374)],
  Salt: [rgba(0xd2cdc4), rgba(0xdcd8cf), rgba(0xe6e2da), rgba(0xefece5), rgba(0xf7f5ef)],
  Badlands: [rgba(0x8a5a40), rgba(0x9d6a4c), rgba(0xb07b58), rgba(0xc38d68), rgba(0xd6a07a)],
};

const channels = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

export function withAlpha(color: string, alpha: number): string {
  const [r, g, b] = channels(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const GLOW_LIGHT: Record<string, string> = {
  'faint red': cssOf(FIRE[1]!),
  'dull red': cssOf(FIRE[2]!),
  cherry: cssOf(FIRE[3]!),
  orange: cssOf(FIRE[4]!),
  yellow: cssOf(FIRE[6]!),
  white: cssOf(FIRE[7]!),
};

export const SMOKE_TINTS: Record<'white' | 'yellow' | 'blue', { color: string; strength: number }> = {
  white: { color: PAPER, strength: 0 },
  yellow: { color: cssOf(FIRE[6]!), strength: 0.55 },
  blue: { color: '#3a8aa8', strength: 0.4 },
};


const swatch = (hex: number): string => cssOf(rgba(hex));

export const FOLK_DOTS: readonly string[] = [swatch(0xc58a64), swatch(0xd29a74)];

export const RADIAL_PLATE = rgba(0x3b352c, 0xdc);
export const RADIAL_HOT = rgba(0xcdc2a0, 0xf2);
export const RADIAL_EDGE = rgba(0xf1ebd6, 0xff);
export const RADIAL_EDGE_DIM = rgba(0x8c8165, 0xff);
export const RADIAL_TEXT = swatch(0xf1ebd6);
export const RADIAL_TEXT_DIM = swatch(0xa69c8a);
export const RADIAL_TEXT_SHADE = swatch(0x2b261f);
export const RADIAL_HANDLE = swatch(0xfdf9ec);

export const DIAL = {
  day: rgba(0x8ec3e6),
  dayHigh: rgba(0xa9d6f0),
  night: rgba(0x232f5c),
  nightLow: rgba(0x1b2549),
  frame: rgba(0x3b352c),
  sun: rgba(0xf4c542),
  sunHot: rgba(0xfde68a),
  ray: rgba(0xf0a830),
  moon: rgba(0xece6cf),
  star: rgba(0xc9d4f0),
  rivet: rgba(0xe3dabb),
  pinLight: rgba(0xc9a066),
  pin: rgba(0x93683a),
  pinDark: rgba(0x5e4023),
  arrow: rgba(0xc05140),
  arrowEdge: rgba(0x3b352c),
};

export const CLOSE_UP = {
  spark: [swatch(0xfff0b4), swatch(0xf8d864), swatch(0xf0b23c), swatch(0xe08a28)],
  ember: [swatch(0x7a2c10), swatch(0xa84418), swatch(0xe08a28), swatch(0xf0b23c)],
  flame: [swatch(0xa84418), swatch(0xe08a28), swatch(0xf8d864), swatch(0xfff0b4)],
  smoke: [swatch(0x8e8a84), swatch(0xb3afa8), swatch(0xd6d2cb)],
  dust: [swatch(0x8a7c61), swatch(0xa2937a)],
  flake: swatch(0xd8dcef),
  hint: swatch(0xf1ebd6),
  hintDim: swatch(0xa69c8a),
  hintShade: swatch(0x2b261f),
  skin: [swatch(0x4a2e1e), swatch(0x6b4530), swatch(0x8a5a3c), swatch(0xa8724c), swatch(0xc08a5e)],
  ink: swatch(0x2b2519),
};
