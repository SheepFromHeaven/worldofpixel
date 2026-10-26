import { Rock } from './rocks.ts';

export const FEATURES = ['plutonic', 'volcanic', 'metamorphic', 'basin', 'arid', 'wet', 'hot', 'karst', 'craton', 'arc'] as const;

export type Feature = (typeof FEATURES)[number];

export const featureIndex = (feature: Feature): number => FEATURES.indexOf(feature);

export const Form = {
  Vein: 0,
  Bed: 1,
  Nodule: 2,
  Geode: 3,
  Pipe: 4,
  Crust: 5,
  Fumarole: 6,
  Guano: 7,
} as const;

export type Form = (typeof Form)[keyof typeof Form];

export const FORM_NAMES: readonly string[] = ['vein', 'bed', 'nodule', 'geode', 'pipe', 'crust', 'fumarole', 'guano'];

export const Mineral = {
  None: 0,
  Iron: 1,
  Copper: 2,
  Tin: 3,
  Lead: 4,
  Zinc: 5,
  Silver: 6,
  Gold: 7,
  Mercury: 8,
  Bauxite: 9,
  Flint: 10,
  Sulphur: 11,
  Saltpetre: 12,
  Amber: 13,
  Quartz: 14,
  Amethyst: 15,
  Jade: 16,
  Garnet: 17,
  Beryl: 18,
  Diamond: 19,
} as const;

export type Mineral = (typeof Mineral)[keyof typeof Mineral];

export const MINERAL_COUNT = 20;

export type Class = 'metal' | 'industrial' | 'gem';

export interface MineralKind {
  id: Mineral;
  name: string;
  class: Class;
  form: Form;
  hosts: readonly Rock[];
  likes: readonly (readonly [Feature, number])[];
  from: number;
  to: number;
  scale: number;
  share: number;
  mohs: number;
  placer: boolean;
  where: string;
  uses: string;
}

const make = (kind: Omit<MineralKind, 'placer'> & { placer?: boolean }): MineralKind => ({ placer: false, ...kind });

export const MINERALS: readonly MineralKind[] = [
  make({
    id: Mineral.None, name: 'none', class: 'industrial', form: Form.Vein, hosts: [], likes: [], from: 0, to: 0, scale: 1, share: 0, mohs: 0,
    where: '', uses: '',
  }),
  make({
    id: Mineral.Iron, name: 'iron ore', class: 'metal', form: Form.Bed, hosts: [Rock.Ironstone, Rock.Shale, Rock.Sandstone, Rock.Gneiss],
    likes: [['basin', 0.4], ['wet', 0.3], ['craton', 0.3]], from: 2, to: 4000, scale: 5, share: 0.1, mohs: 5.5,
    where: 'Lenses in banded ironstone and in the shale and sandstone beside it, and magnetite in old gneiss.',
    uses: 'Smelted into iron, the first hard tool metal.',
  }),
  make({
    id: Mineral.Copper, name: 'copper', class: 'metal', form: Form.Vein, hosts: [Rock.Andesite, Rock.Granite, Rock.Basalt, Rock.Sandstone, Rock.Schist],
    likes: [['volcanic', 0.5], ['plutonic', 0.5], ['arc', 0.4]], from: 2, to: 4000, scale: 34, share: 0.022, mohs: 3,
    where: 'Hot-water veins round volcanic arcs and granite domes. Green stains show on the surface.',
    uses: 'Soft and easy to work: the first metal. Alloyed with tin it is bronze.',
  }),
  make({
    id: Mineral.Tin, name: 'tin', class: 'metal', form: Form.Vein, hosts: [Rock.Granite, Rock.Schist, Rock.Gneiss],
    likes: [['plutonic', 0.9]], from: 3, to: 4000, scale: 30, share: 0.013, mohs: 2,
    where: 'In and beside granite domes only, and rare. Where it is found it is found in a few places.',
    uses: 'Mixed with copper to make bronze, which is why it is traded for so far.',
  }),
  make({
    id: Mineral.Lead, name: 'lead', class: 'metal', form: Form.Vein, hosts: [Rock.Limestone, Rock.Marble, Rock.Shale],
    likes: [['karst', 0.7], ['plutonic', 0.3]], from: 3, to: 4000, scale: 32, share: 0.016, mohs: 2.5,
    where: 'Veins in limestone, where hot brine once ran through the caves.',
    uses: 'Heavy and soft; pipes and weights. Poisonous.',
  }),
  make({
    id: Mineral.Zinc, name: 'zinc', class: 'metal', form: Form.Vein, hosts: [Rock.Limestone, Rock.Marble, Rock.Shale],
    likes: [['karst', 0.6], ['plutonic', 0.2]], from: 3, to: 4000, scale: 28, share: 0.014, mohs: 4,
    where: 'With lead, in limestone.',
    uses: 'Alloyed with copper it makes brass.',
  }),
  make({
    id: Mineral.Silver, name: 'silver', class: 'metal', form: Form.Vein, hosts: [Rock.Andesite, Rock.Granite, Rock.Limestone, Rock.Quartzite],
    likes: [['volcanic', 0.5], ['plutonic', 0.4], ['arc', 0.3]], from: 8, to: 4000, scale: 26, share: 0.008, mohs: 2.7,
    where: 'Thin veins deep in arcs and granite domes, often with lead.',
    uses: 'Coin, ornament.',
  }),
  make({
    id: Mineral.Gold, name: 'gold', class: 'metal', form: Form.Vein, hosts: [Rock.Quartzite, Rock.Granite, Rock.Schist, Rock.Slate, Rock.Gneiss],
    likes: [['metamorphic', 0.7], ['plutonic', 0.3], ['arc', 0.3]], from: 3, to: 4000, scale: 24, share: 0.0065, mohs: 2.5, placer: true,
    where: 'Thin quartz veins in mountain belts. Rivers that cross them carry flakes into the gravel of their beds.',
    uses: 'Never tarnishes, so it is the first thing people prize.',
  }),
  make({
    id: Mineral.Mercury, name: 'cinnabar', class: 'metal', form: Form.Vein, hosts: [Rock.Andesite, Rock.Tuff, Rock.Basalt, Rock.Limestone],
    likes: [['volcanic', 0.8]], from: 3, to: 4000, scale: 26, share: 0.01, mohs: 2.5,
    where: 'Red crusts where hot springs reached the surface.',
    uses: 'Red pigment; the liquid metal is a deadly poison.',
  }),
  make({
    id: Mineral.Bauxite, name: 'bauxite', class: 'metal', form: Form.Crust, hosts: [Rock.Clay, Rock.Soil, Rock.Sandstone, Rock.Basalt],
    likes: [['wet', 0.6], ['hot', 0.6]], from: 0, to: 15, scale: 60, share: 0.1, mohs: 2,
    where: 'A crust where tropical rain has leached everything else out of old rock.',
    uses: 'Aluminium, which nobody can smelt yet.',
  }),
  make({
    id: Mineral.Flint, name: 'flint', class: 'industrial', form: Form.Nodule, hosts: [Rock.Chalk, Rock.Limestone],
    likes: [['karst', 0.5], ['basin', 0.5]], from: 1, to: 4000, scale: 3.2, share: 0.3, mohs: 7,
    where: 'Dark nodules strung along the bedding of chalk, and weathered out onto the ground above.',
    uses: 'Knapped into the first tools; strikes sparks against flint or iron.',
  }),
  make({
    id: Mineral.Sulphur, name: 'sulphur', class: 'industrial', form: Form.Fumarole, hosts: [Rock.Tuff, Rock.Andesite, Rock.Basalt, Rock.Limestone],
    likes: [['volcanic', 1]], from: 0, to: 60, scale: 20, share: 0.3, mohs: 2,
    where: 'Yellow crusts round volcanic vents and hot springs.',
    uses: 'Burns; the start of black powder, and of matches.',
  }),
  make({
    id: Mineral.Saltpetre, name: 'saltpetre', class: 'industrial', form: Form.Guano, hosts: [Rock.Limestone, Rock.Chalk, Rock.Marble, Rock.Sandstone],
    likes: [['arid', 0.8]], from: 3, to: 4000, scale: 6, share: 0.35, mohs: 2,
    where: 'White crust on the floor of dry caves, where bats have roosted for ages.',
    uses: 'Preserves meat; the second part of black powder.',
  }),
  make({
    id: Mineral.Amber, name: 'amber', class: 'gem', form: Form.Nodule, hosts: [Rock.Shale, Rock.Sandstone, Rock.Coal],
    likes: [['wet', 0.5], ['basin', 0.4]], from: 2, to: 4000, scale: 4, share: 0.06, mohs: 2.5,
    where: 'Beads in coal measures and the mud under them: tree resin buried with the swamp.',
    uses: 'Warm to hold and burns with a smell; a gem and a charm.',
  }),
  make({
    id: Mineral.Quartz, name: 'rock crystal', class: 'gem', form: Form.Vein, hosts: [Rock.Granite, Rock.Sandstone, Rock.Quartzite, Rock.Gneiss, Rock.Schist],
    likes: [['plutonic', 0.4], ['metamorphic', 0.4]], from: 2, to: 4000, scale: 20, share: 0.012, mohs: 7,
    where: 'Clear crystals lining cracks in hard rock.',
    uses: 'Clear, hard, and flakes like flint.',
  }),
  make({
    id: Mineral.Amethyst, name: 'amethyst', class: 'gem', form: Form.Geode, hosts: [Rock.Basalt, Rock.Andesite],
    likes: [['volcanic', 0.8]], from: 3, to: 4000, scale: 11, share: 0.14, mohs: 7,
    where: 'Purple crystal inside hollow stones, where gas bubbles in cooling lava filled with water.',
    uses: 'A gem.',
  }),
  make({
    id: Mineral.Jade, name: 'jade', class: 'gem', form: Form.Nodule, hosts: [Rock.Schist, Rock.Gneiss],
    likes: [['metamorphic', 0.8], ['arc', 0.5]], from: 5, to: 4000, scale: 7, share: 0.12, mohs: 6.5,
    where: 'Green lenses in schist, in the squeezed rock along a subduction.',
    uses: 'Too tough to knap, so it is ground. Prized.',
  }),
  make({
    id: Mineral.Garnet, name: 'garnet', class: 'gem', form: Form.Nodule, hosts: [Rock.Schist, Rock.Gneiss, Rock.Marble],
    likes: [['metamorphic', 0.9]], from: 2, to: 4000, scale: 2.6, share: 0.35, mohs: 7,
    where: 'Dark red grains that grow in rock as it is squeezed and baked.',
    uses: 'A gem and a grit for grinding.',
  }),
  make({
    id: Mineral.Beryl, name: 'beryl', class: 'gem', form: Form.Nodule, hosts: [Rock.Granite],
    likes: [['plutonic', 0.8], ['craton', 0.3]], from: 8, to: 4000, scale: 9, share: 0.07, mohs: 7.8,
    where: 'Green and blue crystals in the last coarse pockets of a granite dome.',
    uses: 'A gem; the green kind is emerald.',
  }),
  make({
    id: Mineral.Diamond, name: 'diamond', class: 'gem', form: Form.Pipe, hosts: [Rock.Gneiss, Rock.Granite, Rock.Sandstone, Rock.Shale, Rock.Limestone, Rock.Quartzite],
    likes: [['craton', 1]], from: 30, to: 4000, scale: 300, share: 0.012, mohs: 10,
    where: 'In narrow pipes of volcanic rock that blew up from the deep mantle through the oldest continental cores.',
    uses: 'The hardest thing there is.',
  }),
];

export const mineralOf = (id: number): MineralKind => MINERALS[id] ?? MINERALS[0]!;

export const MINERALS_BY_HOST: readonly (readonly MineralKind[])[] = (() => {
  const table: MineralKind[][] = Array.from({ length: 24 }, () => []);
  for (const mineral of MINERALS) {
    for (const host of mineral.hosts) table[host]!.push(mineral);
  }
  return table;
})();
