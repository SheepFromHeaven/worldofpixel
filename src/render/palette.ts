import { rgba } from '../pixel/color.ts';
import type { Ramp, Rgba } from '../pixel/color.ts';
import { BONE as BONE_RAMP, FIRE } from '../pixel/palette.ts';
import { Biome, ItemType } from '../sim/types.ts';

/** A packed sprite colour as a CSS string, for the few places a tile's palette is drawn with. */
function cssOf(color: Rgba): string {
  return `#${(color >>> 8).toString(16).padStart(6, '0')}`;
}

export const PAPER = '#f4f1ea';
export const PAPER_WARM = '#ece6d8';
export const PAPER_SHADE = '#e3dccb';
export const INK = '#3b352c';
export const INK_FAINT = '#a69c8a';
export const RED_PENCIL = '#c05140';

/**
 * The paper a town's name is written on, where the map itself has none.
 *
 * A name inked straight onto the ground is a dark line over dark green and cannot be read at the
 * distance the name is the only thing there is to read. So every glyph is laid once in this a
 * cell out in each direction and once in ink on top — the label brings the map's own paper with
 * it, which is what a name on a map has always sat on.
 */
export const MARK_HALO = PAPER_WARM;

/** The mark ringed round the selected area on the map: bone, the colour of a border stone, over a dark edge so it reads on any ground. */
export const SELECTION = cssOf(BONE_RAMP[6]!);
export const SELECTION_SHADE = cssOf(BONE_RAMP[0]!);

/** Coloured-pencil biome washes: chalky, low saturation, all readable against the parchment. */
export const BIOME_COLORS: Record<Biome, string> = {
  [Biome.Meadow]: '#8aa65c',
  [Biome.Forest]: '#4f7f55',
  [Biome.Highland]: '#9a8a74',
  [Biome.Marsh]: '#6f8f7a',
  [Biome.Tundra]: '#a8b4bd',
  [Biome.Desert]: '#cfae6a',
  [Biome.Ocean]: '#7aa6bd',
  [Biome.Lake]: '#6bb5c0',
  [Biome.River]: '#6bb5c0',
};

/**
 * The ground, as pixel ramps: darkest step first.
 *
 * A biome is a handful of chosen colours rather than a tint and an alpha, because that is what
 * makes ground read as ground at this scale — the mottle is steps of the ramp, not noise on a
 * single hue.
 *
 * **A land ramp spans about thirty-six points of lightness, and it has to.** They were half
 * that, which was plenty while the only thing moving a texel along the ramp was the mottle. The
 * sun needs room of its own: at five points to a step, a whole step of shading is a change the
 * eye does not read as light, so a hillside lit from the side came out the same colour as one
 * turned away from it. Two-thirds of the span is the light and the height; the mottle keeps
 * roughly the contrast it always had, because its share of the shade shrank as the span grew. These sit beside `BIOME_COLORS`, which the far tiers still wash with; the two have
 * to agree in weight or crossing into the parcel tier looks like the map changing its mind.
 */
export const BIOME_RAMPS: Record<Biome, Ramp> = {
  [Biome.Meadow]: [rgba(0x4d612c), rgba(0x657e3d), rgba(0x7d9a4f), rgba(0x93ad6a), rgba(0xa8bb8a)],
  [Biome.Forest]: [rgba(0x213e24), rgba(0x325b37), rgba(0x45764a), rgba(0x59905e), rgba(0x72a478)],
  [Biome.Highland]: [rgba(0x5c5240), rgba(0x766954), rgba(0x8f8169), rgba(0xa29784), rgba(0xb5ad9f)],
  [Biome.Marsh]: [rgba(0x3d5444), rgba(0x516d5a), rgba(0x668670), rgba(0x7f9b88), rgba(0x9aaea0)],
  [Biome.Tundra]: [rgba(0x667d8e), rgba(0x8194a2), rgba(0x9caab4), rgba(0xb7c0c7), rgba(0xd1d7db)],
  [Biome.Desert]: [rgba(0xa27c2e), rgba(0xc1953d), rgba(0xc8a764), rgba(0xd1b989), rgba(0xdbccad)],
  [Biome.Ocean]: [rgba(0x3f6e8a), rgba(0x5a8ba6), rgba(0x6b9ab4), rgba(0x7aa6bd), rgba(0x8bb5c9)],
  // Fresh water is greener and paler than the sea, and a river paler again: you can see the
  // bottom of it. Two ramps rather than one, because a lake and the stream feeding it meeting
  // in the same colour is the one place the eye cannot tell standing water from running.
  //
  // **Far enough from the sea's blue to be told apart at a glance.** These started a shade or
  // two off the ocean ramp and that is not enough, now that the difference decides something:
  // salt is water you cannot draw on and fresh is water you can, so a player who cannot see
  // which is which is left reading a refusal that looks like a bug. The fresh ramps carry more
  // green and sit higher.
  [Biome.Lake]: [rgba(0x3f8898), rgba(0x55a0ae), rgba(0x6bb5c0), rgba(0x81c7cf), rgba(0x9bd8dd)],
  // **The same ramp as a lake, and it has to stay the same.** Fresh water is fresh water: a
  // river is the shape the water takes on a slope, not a different substance, and a palette
  // that says otherwise draws a hard edge across the surface wherever a river meets the lake
  // or the sea it is running into. Two entries rather than one because the *biomes* are two —
  // the cursor says which you are standing on, and only one of them blocks a well.
  [Biome.River]: [rgba(0x3f8898), rgba(0x55a0ae), rgba(0x6bb5c0), rgba(0x81c7cf), rgba(0x9bd8dd)],
};

/**
 * Trodden earth. Read as a ramp like a biome, because that is what a path is here: not a line
 * drawn over the ground but a strip of the ground that happens to be bare.
 */
export const PATH: Ramp = [
  rgba(0x5f4a2e),
  rgba(0x765c3a),
  rgba(0x8e7149),
  rgba(0xa68759),
  rgba(0xbb9d6d),
];

/**
 * Trodden earth over each kind of ground: the dirt is whatever the ground is, worn bare. Through a
 * forest it is dark leaf-mould, across sand a paler sand, over highland grey grit, in a marsh black
 * mud — so a path that runs from meadow into forest darkens as it goes, and a town's lots are the
 * colour of the ground they were dug out of. `PATH` is the meadow's.
 */
export const PATH_RAMPS: Record<'Meadow' | 'Forest' | 'Highland' | 'Marsh' | 'Tundra' | 'Desert', Ramp> = {
  Meadow: PATH,
  Forest: [rgba(0x3e2c1a), rgba(0x4f3922), rgba(0x63482c), rgba(0x775938), rgba(0x8a6a45)],
  Highland: [rgba(0x5e554a), rgba(0x726859), rgba(0x877c6b), rgba(0x9b917f), rgba(0xb0a795)],
  Marsh: [rgba(0x3f3a2a), rgba(0x4f4934), rgba(0x625a40), rgba(0x766d4e), rgba(0x8a805e)],
  Tundra: [rgba(0x6d6a62), rgba(0x817e75), rgba(0x96938a), rgba(0xaba89f), rgba(0xc0beb6)],
  Desert: [rgba(0xb59a6e), rgba(0xc4ab80), rgba(0xd1bb93), rgba(0xddc9a6), rgba(0xe7d7ba)],
};

export const ITEM_COLORS: Record<ItemType, string> = {
  [ItemType.Water]: '#3a8aa8',
  [ItemType.Dirt]: '#8a6a44',
  [ItemType.Mud]: '#6b5436',
  // Greyer and drier than a cut log: it has been lying out.
  [ItemType.Deadwood]: '#8a7450',
  [ItemType.Wood]: '#7a5a32',
  // The town's one accent, which is what a coal is: `EMBER[2]` is `RED_PENCIL` itself.
  [ItemType.Embers]: RED_PENCIL,
  // Woven withies daubed over: the colour of the mud it is sealed with, a shade off the mud itself.
  [ItemType.Vessel]: '#9a7b4e',
  [ItemType.Clay]: '#8d8275',
  [ItemType.Pot]: '#a8703f',
  [ItemType.Charcoal]: '#2e2a28',
  // Half-burnt: the colour of wood with the char only part way through it.
  [ItemType.Brands]: '#4a3b2c',
  // Retted and combed, and nothing has been done to it yet: the palest thing the town carries.
  [ItemType.Fibre]: '#c2ad7d',
  // The same stuff laid up tight. Darker than the fibre it came from, because twisting it is.
  [ItemType.Cord]: '#9c8457',
  // Open withies, a shade lighter than the vessel it becomes once the daub goes on.
  [ItemType.Basket]: '#bf9a5b',
  // Mud with straw through it: greyer than the mud and never as smooth.
  [ItemType.Daub]: '#7d6f52',
  [ItemType.Berries]: '#8a2f4a',
  [ItemType.Stone]: '#8c8a84',
  [ItemType.Brick]: '#a4513a',
  [ItemType.Mortar]: '#d8d2c2',
};




const channels = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];


/**
 * A palette colour at an alpha, for the one kind of mark on the map that is light rather than
 * ink. Everything else is laid down opaque and sorted; a glow is added to what is already there.
 */
export function withAlpha(color: string, alpha: number): string {
  const [r, g, b] = channels(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * What a chamber at each step of the glow throws on the ground round it — the names are
 * `models/heat.ts`'s `GLOW`, and black is absent because a cold rig throws nothing.
 *
 * Steps of `FIRE` rather than colours chosen here: the fire in the hearth's tile and the light
 * off a kiln beside it are the same substance, and a second set of oranges on one map is two
 * kinds of fire.
 */
export const GLOW_LIGHT: Record<string, string> = {
  'faint red': cssOf(FIRE[1]!),
  'dull red': cssOf(FIRE[2]!),
  cherry: cssOf(FIRE[3]!),
  orange: cssOf(FIRE[4]!),
  yellow: cssOf(FIRE[6]!),
  white: cssOf(FIRE[7]!),
};

/**
 * What a clamp's smoke is tinted with, which is the whole of its readout: white while the wood
 * is still steaming, yellow while it is charring, blue once the volatiles are gone and it is
 * done. The tile's plume is drawn grey-white, so white is no tint at all and the other two are
 * mixed into it at a strength that leaves it reading as smoke rather than as paint.
 */
export const SMOKE_TINTS: Record<'white' | 'yellow' | 'blue', { color: string; strength: number }> = {
  white: { color: PAPER, strength: 0 },
  yellow: { color: cssOf(FIRE[6]!), strength: 0.55 },
  blue: { color: ITEM_COLORS[ItemType.Water], strength: 0.4 },
};
