export const Rock = {
  Soil: 0,
  Clay: 1,
  Sand: 2,
  Sandstone: 3,
  Shale: 4,
  Limestone: 5,
  Chalk: 6,
  Salt: 7,
  Gypsum: 8,
  Coal: 9,
  Ironstone: 10,
  Granite: 11,
  Basalt: 12,
  Andesite: 13,
  Tuff: 14,
  Obsidian: 15,
  Slate: 16,
  Schist: 17,
  Gneiss: 18,
  Marble: 19,
  Quartzite: 20,
} as const;

export type Rock = (typeof Rock)[keyof typeof Rock];

export const ROCK_COUNT = 21;

export type RockGroup = 'loose' | 'sedimentary' | 'igneous' | 'metamorphic';

export interface RockKind {
  id: Rock;
  name: string;
  group: RockGroup;
  hardness: number;
  soluble: boolean;
  porous: boolean;
  made: string;
  uses: string;
}

const row = (
  id: Rock,
  name: string,
  group: RockGroup,
  hardness: number,
  soluble: boolean,
  porous: boolean,
  made: string,
  uses: string,
): RockKind => ({ id, name, group, hardness, soluble, porous, made, uses });

export const ROCKS: readonly RockKind[] = [
  row(Rock.Soil, 'topsoil', 'loose', 1, false, true, 'Weathered rock mixed with rotted plants. A metre or two on flat wet ground, none on a cliff.', 'Digs by hand. Farmland later.'),
  row(Rock.Clay, 'clay', 'loose', 1, false, false, 'The finest weathered grain, washed into marshes and river flats.', 'Pots, bricks, daub.'),
  row(Rock.Sand, 'sand', 'loose', 1, false, true, 'Quartz grains left where wind and water sort the rest away: deserts, beaches, old river beds.', 'Glass, mortar, casting moulds.'),
  row(Rock.Sandstone, 'sandstone', 'sedimentary', 3, false, true, 'Sand cemented under later layers. Porous, so it holds water.', 'Easy to quarry and carve; building stone.'),
  row(Rock.Shale, 'shale', 'sedimentary', 2, false, false, 'Mud pressed to thin plates. It splits along its bedding and seals the layers under it.', 'Weak roofs in a mine; the host of coal and iron.'),
  row(Rock.Limestone, 'limestone', 'sedimentary', 3, true, true, 'Shells and lime mud on a warm sea floor. Rain dissolves it, which is how caves start.', 'Building stone, burnt for lime and mortar.'),
  row(Rock.Chalk, 'chalk', 'sedimentary', 2, true, true, 'A soft white limestone of microscopic shells. Flint grows in it as nodules.', 'Soft to cut; the home of flint.'),
  row(Rock.Salt, 'rock salt', 'sedimentary', 2, true, false, 'What is left when a shallow sea dries in a hot basin.', 'Preserving food; the first trade good.'),
  row(Rock.Gypsum, 'gypsum', 'sedimentary', 2, true, false, 'Laid down with salt as the sea dries, before the salt itself.', 'Plaster, and a sign that salt lies below.'),
  row(Rock.Coal, 'coal seam', 'sedimentary', 2, false, false, 'Swamp forest buried and cooked. It lies as thin beds between shale and sandstone.', 'Fuel that outburns wood.'),
  row(Rock.Ironstone, 'ironstone', 'sedimentary', 5, false, false, 'Banded red and grey layers laid down in very old seas.', 'The richest bedded iron.'),
  row(Rock.Granite, 'granite', 'igneous', 6, false, false, 'Magma that cooled slowly underground, in great domes under mountain belts and island arcs.', 'Hard, durable stone; the host of tin, gems and many veins.'),
  row(Rock.Basalt, 'basalt', 'igneous', 6, false, false, 'Runny lava. The floor of every ocean, and flows in rifts and volcanic fields. Lava tubes run through it.', 'Hard, heavy stone; geodes form in its gas bubbles.'),
  row(Rock.Andesite, 'andesite', 'igneous', 5, false, false, 'Stickier lava from subduction volcanoes. It builds the steep cones.', 'Tough stone; copper and silver veins follow it.'),
  row(Rock.Tuff, 'tuff', 'igneous', 2, false, true, 'Volcanic ash pressed to rock.', 'Soft, light, easily carved.'),
  row(Rock.Obsidian, 'obsidian', 'igneous', 5, false, false, 'Lava that cooled too fast to grow crystals, so it is glass.', 'Cuts sharper than flint.'),
  row(Rock.Slate, 'slate', 'metamorphic', 3, false, false, 'Shale squeezed and baked until it splits in clean sheets.', 'Roofing, paving.'),
  row(Rock.Schist, 'schist', 'metamorphic', 4, false, false, 'Slate squeezed further, until its mica glitters. Garnet and jade grow in it.', 'Weak to split; rich in gems.'),
  row(Rock.Gneiss, 'gneiss', 'metamorphic', 6, false, false, 'Granite or schist banded by great heat. It is the old floor of the continents.', 'Hard, banded building stone.'),
  row(Rock.Marble, 'marble', 'metamorphic', 3, true, false, 'Limestone baked by a nearby granite.', 'Fine carving stone.'),
  row(Rock.Quartzite, 'quartzite', 'metamorphic', 7, false, false, 'Sandstone fused solid. Gold-bearing quartz veins cut it.', 'The hardest common stone; flakes like flint.'),
];

export const rockOf = (id: number): RockKind => ROCKS[id] ?? ROCKS[0]!;
