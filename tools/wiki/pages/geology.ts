import { CAVE_COLORS, MINERAL_COLORS, ROCK_COLORS } from '../../../src/render/palette.ts';
import { Cave, CAVE_FROM, CAVE_NAMES } from '../../../src/sim/geology/caves.ts';
import { BOTTOM_METRES, COARSE, Geology, LEVEL_METRES, LEVELS, STEP_METRES } from '../../../src/sim/geology/geology.ts';
import type { Sample } from '../../../src/sim/geology/geology.ts';
import { FEATURES, FORM_NAMES, MINERALS, Mineral } from '../../../src/sim/geology/minerals.ts';
import { ROCKS, rockOf } from '../../../src/sim/geology/rocks.ts';
import { SEQUENCES } from '../../../src/sim/geology/sequences.ts';
import { Water } from '../../../src/sim/terrain/hydrology.ts';
import { world } from '../context.ts';
import type { Page, PageLink } from '../page.ts';
import { callout, figure, flow, grid, img, SERIES, table } from '../page.ts';
import type { Rgb } from '../raster.ts';
import { hex, renderMap } from '../raster.ts';
import { lineChart } from '../svg.ts';

const STEP = 4;

const SERIES_RGB: readonly Rgb[] = [
  hex('#7aa6bd'), hex('#d8c28a'), hex('#c79a62'), hex('#ece8dc'), hex('#4f7f55'), hex('#f0d6d0'),
  hex('#a8523a'), hex('#e4e0cc'), hex('#6e3b2c'), hex('#3a3d44'), hex('#6f7d6a'),
];

const swatch = (colour: string): string => `<span style="display:inline-block;width:12px;height:12px;background:${colour};border:1px solid #3b352c;vertical-align:-1px;margin-right:6px"></span>`;

const metres = (levels: number): string => `${levels * LEVEL_METRES} m`;

export const LINK: PageLink = {
  slug: 'geology',
  title: 'Geology',
  summary: 'Rocks, strata, minerals and caves under every tile, from the plates down.',
};

function geologyOf(): Geology {
  return new Geology(world());
}

function sliceMap(geology: Geology, level: number, name: string): string {
  const w = world();
  const { grid: tiles } = w;
  const sample: Sample = { rock: 0, mineral: 0, cave: 0, above: 0, life: 0 };
  return renderMap(name, {
    columns: tiles.columns,
    rows: tiles.rows,
    step: STEP,
    colourAt: (c, r) => {
      const i = tiles.at(c, r);
      if (w.field.water[i] === Water.Ocean) return hex('#c9d4d6');
      geology.sampleBelow(tiles.x(c), tiles.y(r), level * LEVEL_METRES, sample);
      if (sample.cave === Cave.Open || sample.cave === Cave.Dripstone) return hex(CAVE_COLORS.void);
      if (sample.cave === Cave.Flooded) return hex(CAVE_COLORS.water);
      if (sample.mineral !== Mineral.None) return hex(MINERAL_COLORS[sample.mineral]!);
      return hex(ROCK_COLORS[sample.rock]!);
    },
  });
}

function columnTable(geology: Geology, x: number, y: number): string {
  const column = geology.column(x, y);
  const rows: string[][] = [];
  let from = 0;
  let rock = -1;
  let minerals = new Set<string>();
  let caves = 0;
  const flush = (to: number): void => {
    if (rock < 0) return;
    rows.push([
      `${swatch(ROCK_COLORS[rock]!)}${rockOf(rock).name}`,
      `${metres(from)} to ${metres(to)}`,
      [...minerals].join(', ') || '-',
      caves > 0 ? `${caves} open` : '-',
    ]);
  };
  column.levels.forEach((cell, index) => {
    const level = index + 1;
    if (cell.rock !== rock) {
      flush(level - 1);
      rock = cell.rock;
      from = level - 1;
      minerals = new Set();
      caves = 0;
    }
    if (cell.mineral !== Mineral.None) minerals.add(MINERALS[cell.mineral]!.name);
    if (cell.cave !== Cave.Solid) caves += 1;
  });
  flush(LEVELS);
  return table(['Rock', 'Depth', 'Minerals met', 'Cave levels'], rows);
}

function depthCharts(geology: Geology): string {
  const w = world();
  const sample: Sample = { rock: 0, mineral: 0, cave: 0, above: 0, life: 0 };
  const points: [number, number][] = [];
  for (let i = 0; points.length < 5000 && i < 40000; i += 1) {
    const x = (((Math.sin(i * 12.9898) * 43758.5453) % 1) + 1) % 1 * 2048;
    const y = (((Math.sin(i * 78.233) * 12345.6789) % 1) + 1) % 1 * 1408;
    if (w.field.height[w.grid.atPoint({ x, y })]! >= 0.43) points.push([x, y]);
  }
  const caves: [number, number][] = [];
  const ores: [number, number][] = [];
  const metals: [number, number][] = [];
  for (let level = 1; level <= LEVELS; level += 1) {
    let cave = 0;
    let ore = 0;
    let metal = 0;
    for (const [x, y] of points) {
      geology.sampleBelow(x, y, level * LEVEL_METRES, sample);
      if (sample.cave !== Cave.Solid) cave += 1;
      if (sample.mineral !== Mineral.None) ore += 1;
      if (sample.mineral !== Mineral.None && MINERALS[sample.mineral]!.class === 'metal') metal += 1;
    }
    caves.push([level * LEVEL_METRES, (100 * cave) / points.length]);
    ores.push([level * LEVEL_METRES, (100 * ore) / points.length]);
    metals.push([level * LEVEL_METRES, (100 * metal) / points.length]);
  }
  return lineChart({
    x: { label: 'metres below the ground', domain: [LEVEL_METRES, LEVELS * LEVEL_METRES] },
    y: { label: 'share of land tiles (%)', domain: [0, 8] },
    series: [
      { name: 'any mineral', colour: SERIES.gold, points: ores },
      { name: 'metal ore', colour: SERIES.red, points: metals },
      { name: 'cave', colour: SERIES.blue, points: caves },
    ],
    label: 'How much of each level is cave and ore',
    height: 280,
  });
}

export function build(): Page {
  const w = world();
  const geology = geologyOf();
  const { grid: tiles } = w;

  const provinces = renderMap('geo-series.png', {
    columns: tiles.columns,
    rows: tiles.rows,
    step: STEP,
    colourAt: (c, r) => SERIES_RGB[geology.seriesAt(tiles.x(c), tiles.y(r))]!,
  });
  const slices = [2, 10, 30].map((level) => sliceMap(geology, level, `geo-slice-${level}.png`));
  const key = SEQUENCES.map((s, i) => `${swatch(`rgb(${SERIES_RGB[i]!.join(',')})`)}${s.name}`).join('<br>');

  const middle = { x: 1000, y: 700 };
  const rockRows = ROCKS.map((r) => [
    `${swatch(ROCK_COLORS[r.id]!)}${r.name}`,
    r.group,
    String(r.hardness),
    [r.soluble ? 'dissolves' : '', r.porous ? 'porous' : ''].filter(Boolean).join(', ') || '-',
    r.made,
    r.uses,
  ]);
  const mineralRows = MINERALS.slice(1).map((m) => [
    `${swatch(MINERAL_COLORS[m.id]!)}${m.name}`,
    m.class,
    FORM_NAMES[m.form]!,
    m.hosts.map((h) => rockOf(h).name).join(', '),
    m.likes.map(([f, weight]) => `${f} ${weight}`).join(', '),
    `${metres(Math.floor(m.from / LEVEL_METRES))} to ${m.to} m`,
    String(m.mohs),
    `${m.where} ${m.uses}`,
  ]);
  const sequenceRows = SEQUENCES.map((s, i) => [
    `${swatch(`rgb(${SERIES_RGB[i]!.join(',')})`)}${s.name}`,
    `${s.total} m`,
    s.layers.map((l) => `${rockOf(l.rock).name} ${l.metres}`).join(', '),
  ]);

  return {
    ...LINK,
    lede: `Under every tile is rock, and the rock is not noise: it is where the plates put it. A column is a soil, a sequence of beds laid on the sea floor and folded since, a basement, and between them granite domes, lava dikes, veins of metal, nodules of flint, and caves. Nothing underground is stored. It is a function of the tile, a depth and the seed, built on a ${COARSE} tile grid of provinces, so the whole underground costs about a megabyte and a second to read.`,
    code: ['src/sim/geology/geology.ts', 'src/sim/geology/rocks.ts', 'src/sim/geology/sequences.ts', 'src/sim/geology/minerals.ts', 'src/sim/geology/caves.ts', 'src/render/lit/strataTexture.ts', 'tools/strataPreview.ts'],
    sections: [
      {
        id: 'overview',
        title: 'From plates to ore',
        html: `${flow([
          { title: 'Province', text: `Per ${COARSE} tile cell: how much of ${FEATURES.join(', ')} the plates made there.` },
          { title: 'Sequence', text: 'Which pile of beds lies on the basement: shelf, platform, coal measures, evaporites, volcanic pile, metamorphic belt.' },
          { title: 'Fold and dip', text: 'Strata are bent by the mountain building and tilted, and the land surface cuts across them.' },
          { title: 'Rock at depth', text: 'Soil, then the beds, then the basement, with granite blobs, contact rock and lava dikes laid over.' },
          { title: 'Minerals and caves', text: 'Every mineral has a form and a set of host rocks and provinces. Caves are carved by tube and chamber noise in soluble or volcanic rock.' },
        ])}
<p>The view is a <b>horizontal cut</b>, a plane at one elevation, not a depth under each tile. It starts at the highest point of the world and moves down in steps of ${STEP_METRES} m to ${BOTTOM_METRES} m: first it cuts the mountain tops, and the window onto the rock widens as it falls, past the snow line, past the plains, below sea level. Tiles whose ground is lower than the plane are not rock, they are air (drawn as the terrain, dimmed) or, over a lake or the sea, water down to its surface, so nothing can float in the water: a mineral is only ever shown where the ground really is. Cave and ore are functions of absolute elevation and of the depth below the smoothed ground, so the same cave is the same cave from every cut. Hovering a tile in the cut names the rock, the mineral and how far it lies below the ground and above sea level. The control is at the left of the screen, and <code>.</code> and <code>,</code> lower and raise the cut by 8 m, the page keys by 100 m.</p>`,
      },
      {
        id: 'provinces',
        title: 'Provinces and sequences',
        html: `<p>A sequence is a stack of beds, youngest on top. Its total is scaled to the cover thickness of the province: thin on the cratons and mountain tops, hundreds of metres in the basins. The beds then lie in the ground at the depth the regional height says, so valleys cut into older beds than ridges, and the outcrop is the contour pattern you would expect.</p>
${figure(img(provinces, 'Which sequence lies under each tile'), `<b>Sequences by province.</b><br>${key}`, true)}
${table(['Sequence', 'Total', 'Beds, youngest first (metres)'], sequenceRows)}
${callout('<p>Where the sequence comes from, in order: oceanic plates take the sea floor; volcanic arcs and cones the volcanic pile; the root of a collision the metamorphic belt; low interiors far from a boundary a basin, which is a coal measure if wet, an evaporite basin or red beds if dry and a karst or chalk platform where a slow noise says the old sea was clear; old cratons the banded iron shield. The basement is gneiss under old continental crust, granite under young, basalt under the oceans.</p>')}`,
      },
      {
        id: 'rocks',
        title: 'Rocks',
        html: `${table(['Rock', 'Group', 'Hardness', 'Behaviour', 'How it is made', 'What it is for'], rockRows)}
<p>Granite is not a bed. A slow 3D blob of granite is laid over any sequence where the province is plutonic, with a thin skin of contact rock round it: limestone to marble, sandstone to quartzite, shale to slate. Basalt dikes cut the volcanic provinces as thin vertical sheets.</p>`,
      },
      {
        id: 'minerals',
        title: 'Minerals',
        html: `<p>A mineral is found only in its host rocks, only inside its depth window, and with a richness that is the sum of how much the province has of each feature the mineral likes. The <b>form</b> says how it sits in the rock: a <b>vein</b> is a thin curved sheet, a <b>bed</b> a flat lens, a <b>nodule</b> or <b>geode</b> a ball in a 3D grid, a <b>pipe</b> a vertical cylinder from a sparse grid on the old continental cores, a <b>crust</b> a patch near the surface, a <b>fumarole</b> a patch near volcanic vents, and <b>guano</b> a crust on the floor of dry caves. Gold also lies as flakes in the gravel of any river that crosses a gold province (<code>Geology.placer</code>).</p>
${table(['Mineral', 'Class', 'Form', 'Hosts', 'Likes', 'Depth', 'Mohs', 'Where, and what for'], mineralRows)}`,
      },
      {
        id: 'caves',
        title: 'Caves',
        html: `<p>Below ${metres(Math.ceil(CAVE_FROM / LEVEL_METRES))} under the ground a cell can be a ${CAVE_NAMES.slice(1, 4).join(', ')}. Caves are <b>networks</b>, so every passage leads somewhere. They lie in <b>levels</b>, as real caves do where a water table sat for a long age: every ${22} m of elevation (less in lava, more in hard rock) is a flat floor of passages, and a passage is the edge between two cells of a 2D cellular diagram drawn for that level, bent by noise and swelling and narrowing along its length. Each edge is open or shut by a hash of the two cells it separates, so the same passage is open from every cut, and the share kept sets how connected the system is: above about two thirds the whole level is one maze, below that it breaks into branching clusters with dead ends. Where three cells meet there is a chamber, and at some of those a shaft drops to the level below, so the levels are joined. <b>Limestone, chalk, marble, gypsum and salt</b> take the biggest, best connected networks, scaled by the karst of the province; <b>basalt and andesite</b> take sparse flat tubes, the lava tubes, scaled by the volcanism; sandstone and the hard rocks a few thin fissures. A network only exists inside its own rock, so a cave stops at the bed above or below. Soil, clay, sand, coal and rock salt are too soft to hold a roof.</p>
<p>The levels are not separate: they share one plan, so a gallery at one level lies over the gallery at the next, and a vertical <b>shaft</b> at a junction drops from the one to the other and ends in a chamber on both floors. In karst country the shafts also cut through the caprock above a limestone bed, as sinkholes do. In a test block of well developed karst one system held ${99}% of the open volume and ran the whole 120 m of the block.</p>
<p><b>Water.</b> A cave is flooded when it lies below the <b>water table</b>, and the table is not a guess: it is the sea at sea level, each lake at its own level and each river at its bed, relaxed inland a few centimetres in every metre and never closer to the surface than the ground allows (deeper in dry country). So a cave beside the sea stands full to sea level, a cave under a lake is full to the lake, and a cave high in the hills above any water is dry. It is the same answer from every cut, so the water level in a passage is continuous along it.</p>
<p><b>Life.</b> A dry cave is an ecosystem of its own. The first metres under a mouth are mossy where the ground is wet; deeper in humid ground there are fungus gardens that glow faintly; dry limestone and sandstone caves hold bat guano, which is where saltpetre is found; under dripstone the floor is flowstone. The view draws each as a pixel-art texture, as the surface is drawn: rock by its group, rubble and stalagmites on the floor, ripples on the water.</p>
${depthCharts(geology)}`,
      },
      {
        id: 'surface',
        title: 'The surface the rock makes',
        html: `<p>The top of the column is what the player walks on. The geology is built while the world field is still being made (<code>Geology</code> takes the field, the seed and the river raster, not a finished world), and <code>terrain/surface.ts</code> reads its provinces, its soil depth and the rock at the top of every ${COARSE} tile cell, blended smoothly to the tile, to rewrite the biome array: bare rock on steep thin ground, karst pavement where soluble rock outcrops in a karst province, black ash and lava round the cones, white salt flats in evaporite basins and red badlands where soft dry-land beds are cut by slopes. The climate's own classification stays in <code>field.climate</code>, because the soil depth depends on it. How each rule fires, and the map it makes, is on the <a href="world-generation.html">world generation</a> page.</p>
<p>The same pass gives every tile a <b>fertility</b>: soil depth, soil kind, what the bedrock weathers into and the surface biome. It scales the eco score and the growth of every plant, so what lives on a tile follows the rock under it. Basalt and ash soils are rich, granite, quartzite and limestone poor, and bare rock, lava and salt nearly lifeless.</p>
<p><b>Cave mouths</b> are on the surface too. A tile is a mouth where a cave network is open ${1.5} m under its ground (<code>render/caveMouths.ts</code>), and the ground painter draws a dark hollow with a lit lip on its top left, so a cave can be found from above before the cut is lowered into it.</p>`,
      },
      {
        id: 'slices',
        title: 'Slices through the world',
        html: `${grid(
          figure(img(slices[0]!, 'Level 2'), `<b>${metres(2)} under the ground.</b> Under the soil. Sand and clay have gone and the beds show as the contours of the land.`),
          figure(img(slices[1]!, 'Level 10'), `<b>${metres(10)} under the ground.</b> Veins, flint and amber show as coloured dots, caves as black and flooded caves as blue.`),
        )}
${figure(img(slices[2]!, 'Level 30'), `<b>${metres(30)} under the ground.</b> The cover is mostly gone and the basement shows: granite domes under the mountain belts, gneiss under the cratons, basalt under volcanic and oceanic ground.`, true)}
<h3>One column</h3>
<p>The ground at x ${middle.x}, y ${middle.y}, run by run:</p>
${columnTable(geology, middle.x, middle.y)}`,
      },
    ],
  };
}

