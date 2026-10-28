import { amphibianHabitatAt } from '../../../src/sim/fauna/habitat/amphibianHabitat.ts';
import type { AmphibianHabitatSample } from '../../../src/sim/fauna/habitat/amphibianHabitat.ts';
import { abundance, activity, AMPHIBIAN_CELL_TILES, AMPHIBIAN_SLOTS, AMPHIBIANS, bodyTexels, dampness, Gait } from '../../../src/sim/amphibians/species.ts';
import type { AmphibianSpecies } from '../../../src/sim/amphibians/species.ts';
import { trapezoid } from '../../../src/sim/plants/niche.ts';
import { world } from '../context.ts';
import { BIOME_RGB } from '../maps.ts';
import type { Page, PageLink } from '../page.ts';
import { callout, figure, flow, grid, img, table } from '../page.ts';
import type { Rgb } from '../raster.ts';
import { mix, renderMap } from '../raster.ts';
import { legend, lineChart, samples } from '../svg.ts';
import { clockText, compendium, lifeFacts } from '../compendium.ts';
import { LIVES } from '../../../src/sim/fauna/life.ts';

const PALETTE = ['#8a7a3c', '#7a5a3a', '#4f9a2c', '#4fc23c', '#2a2a2a', '#c08a3c', '#9a7a4a', '#2f5ae0', '#b8864a', '#d0b070'];

const colourOf = (index: number): string => PALETTE[index % PALETTE.length]!;

const FORM_NAMES = ['frog', 'toad', 'salamander'];
const CLUTCH_NAMES = ['none seen', 'jelly clump', 'double string'];

const range = (r: readonly number[], unit = ''): string => `${r[1]} to ${r[2]}${unit}`;

function catalogue(): string {
  const rows = AMPHIBIANS.map((s) => [
    s.name,
    `${FORM_NAMES[s.form]!}, ${s.gait === Gait.Hop ? 'hops' : 'walks'}${s.canopy ? ', on leaves' : ''}`,
    `${(s.length * 100).toFixed(1)} cm (${bodyTexels(s).toFixed(1)} texels)`,
    `${s.adults}${s.young > 0 ? ` + ${s.young}` : ''}`,
    s.likes.map((v) => v.toFixed(1)).join(' / ') + (s.bias !== 0 ? ` (+${s.bias})` : ''),
    range(s.temperature, ' C'),
    `${s.day} / ${s.night}${s.dusk > 0 ? ` (+${s.dusk} at dusk)` : ''}`,
    s.wet.toFixed(1),
    s.young > 0 ? CLUTCH_NAMES[s.clutch]! : 'carried or hidden',
  ]);
  return table(['Amphibian', 'Form', 'Length', 'Slots (adult + young)', 'Pond / shelter / damp / bank', 'Best temperature', 'Day / night', 'Needs wet', 'Spawn'], rows);
}

function curves(pick: (s: AmphibianSpecies, x: number) => number, domain: [number, number], label: string, ticks?: number[], only?: (s: AmphibianSpecies) => boolean): string {
  const shown = AMPHIBIANS.map((s, i) => ({ s, i })).filter(({ s }) => (only ? only(s) : true));
  return (
    lineChart({
      width: 560,
      height: 250,
      x: { label, domain, ...(ticks ? { ticks } : {}) },
      y: { label: 'factor', domain: [0, 1], ticks: [0, 0.5, 1] },
      series: shown.map(({ s, i }) => ({ name: s.name, colour: colourOf(i), points: samples(domain[0], domain[1], 160, (x) => pick(s, x)) })),
      legend: false,
      label,
    }) + legend(shown.map(({ s, i }) => ({ name: s.name, colour: colourOf(i) })))
  );
}

const STEP = 4;

function habitatSamples(): { cache: Float32Array; columns: number } {
  const w = world();
  const { grid: g } = w;
  const sample: AmphibianHabitatSample = [0, 0, 0, 0];
  const columns = Math.ceil(g.columns / STEP);
  const cache = new Float32Array(columns * Math.ceil(g.rows / STEP) * 4);
  for (let r = 0; r < g.rows; r += STEP) {
    for (let c = 0; c < g.columns; c += STEP) {
      amphibianHabitatAt(w, c, r, sample);
      const at = ((r / STEP) * columns + c / STEP) * 4;
      for (let k = 0; k < 4; k += 1) cache[at + k] = sample[k]!;
    }
  }
  return { cache, columns };
}

function channelMaps(): string {
  const w = world();
  const { grid: g } = w;
  const { cache, columns } = habitatSamples();
  const names = ['pond', 'shelter', 'damp', 'bank'];
  const tones: Rgb[] = [[50, 120, 160], [60, 130, 60], [90, 120, 150], [150, 120, 60]];
  const maps = names.map((name, k) =>
    renderMap(`amphibians-${name}.png`, {
      columns: g.columns,
      rows: g.rows,
      step: STEP,
      colourAt: (c, r) => mix([244, 241, 234], tones[k]!, Math.min(1, cache[((r / STEP) * columns + c / STEP) * 4 + k]!)),
    }),
  );
  return grid(
    figure(img(maps[0]!, 'Pond'), '<b>Pond.</b> Fresh, still, shallow, planted water: lake shelves, slow reaches and their reeds and lilies. Open sea, deep water and fast rivers score nothing.'),
    figure(img(maps[1]!, 'Shelter'), '<b>Shelter.</b> What a frog can hide under: fallen logs and boulders most, then trees, bushes, scrub and grass. Trodden ground loses it.'),
  ) + grid(
    figure(img(maps[2]!, 'Damp'), '<b>Damp.</b> The same water table the plants read, decaying away from fresh water.'),
    figure(img(maps[3]!, 'Bank'), '<b>Bank.</b> Fresh water within three and six tiles in any direction: the margin a frog will not stray far from.'),
  );
}

function abundanceMaps(): string {
  const w = world();
  const { grid: g } = w;
  const { cache, columns } = habitatSamples();
  const picks = ['frog', 'treefrog', 'firesalamander', 'marinetoad'].map((key) => AMPHIBIANS.find((s) => s.key === key)!);
  const times: Record<string, { year: number; daylight: number; warm: number }> = {
    frog: { year: 0.1, daylight: 0.1, warm: 0 },
    treefrog: { year: 0.3, daylight: 0, warm: 4 },
    firesalamander: { year: 0.3, daylight: 0, warm: 0 },
    marinetoad: { year: 0.4, daylight: 0, warm: 0 },
  };
  const maps = picks.map((s) => {
    const when = times[s.key]!;
    return renderMap(`amphibians-${s.key}.png`, {
      columns: g.columns,
      rows: g.rows,
      step: STEP,
      colourAt: (c, r) => {
        const tile = r * g.columns + c;
        const base: Rgb = BIOME_RGB[w.biome[tile]!] ?? [200, 200, 200];
        const at = ((r / STEP) * columns + c / STEP) * 4;
        const habitat: AmphibianHabitatSample = [cache[at]!, cache[at + 1]!, cache[at + 2]!, cache[at + 3]!];
        const value = abundance(s, habitat, { celsius: w.field.temperature[tile]! + when.warm, year: when.year, daylight: when.daylight, wet: 0.3, snow: 0 });
        return mix(mix(base, [244, 241, 234], 0.55), [200, 60, 40], Math.min(1, value * 1.6));
      },
    });
  });
  return grid(
    figure(img(maps[0]!, 'Common frogs'), '<b>Common frogs</b>, early spring after dark, damp. Pond margins in the temperate belt, and nowhere hot or frozen.'),
    figure(img(maps[1]!, 'Tree frogs'), '<b>Tree frogs</b>, a warm early-summer night. Forest and scrub, wherever the shelter is leaves.'),
  ) + grid(
    figure(img(maps[2]!, 'Fire salamanders'), '<b>Fire salamanders</b> on a wet summer night. Cool, damp woods only.'),
    figure(img(maps[3]!, 'Marine toads'), '<b>Marine toads</b> at night. The tropics, in every kind of cover.'),
  );
}

function amphibianCards(): string {
  return compendium(
    AMPHIBIANS.map((s) => ({
      key: s.key,
      name: s.name,
      facts: [
        ['Kind', `${FORM_NAMES[s.form]!}, ${s.gait === Gait.Hop ? 'hops' : 'walks'}${s.canopy ? ', lives on leaves' : ''}`],
        ['Size', `${(s.length * 100).toFixed(1)} cm, drawn at ${bodyTexels(s).toFixed(1)} texels`],
        ['Out', `${clockText(s.day, s.night, s.dusk)}, ${range(s.temperature, ' C')}, ${s.wet >= 0.6 ? 'only when it is wet' : s.wet >= 0.3 ? 'prefers wet weather' : 'hardly minds dry weather'}`],
        ['Spawn', s.young > 0 ? `${CLUTCH_NAMES[s.clutch]}, in water of ${range(s.water)}` : 'none seen: the young are carried or hidden'],
        ...lifeFacts(LIVES.find((life) => life.key === s.key)!),
      ],
    })),
  );
}

export const LINK: PageLink = {
  slug: 'amphibians',
  title: 'Amphibians',
  summary: 'Frogs, toads, newts and salamanders as a field with a life cycle: spawn, tadpoles, adults.',
};

export function build(): Page {
  const slots = AMPHIBIAN_SLOTS;
  return {
    ...LINK,
    lede: `Amphibians live a double life, so the world keeps them in two places. Adults are on the land near fresh water and come out for damp, night and warmth; eggs and tadpoles are in the calm water of the patch. Where they are and how many is the <a href="food-web.html">food web</a>: each patch holds eggs, tadpoles, froglets and adults of every species, they eat the insects and are eaten by snakes, lizards, turtles, crocodilians and fish, and breed in proportion to how well they eat. This page is how those numbers are drawn and what a species likes. ${AMPHIBIANS.length} species are in, and a new one is a row here and a line of biology in <code>sim/fauna/life.ts</code>.`,
    code: ['src/sim/amphibians/species.ts', 'src/sim/fauna/habitat/amphibianHabitat.ts', 'src/render/lit/amphibianPass.ts', 'src/render/lit/shaders/amphibians.vert', 'src/render/lit/shaders/amphibians.frag'],
    sections: [
      {
        id: 'compendium',
        title: 'The amphibians',
        html: `<p>The eleven species, drawn by the same shader as on the map (a frog sitting, a salamander walking), with how each lives and what the food web makes of it.</p>${amphibianCards()}`,
      },
      {
        id: 'how',
        title: 'Habitat, the food web, and what is drawn',
        html: `${flow([
          { title: 'Habitat', text: 'Four numbers per tile, built from the world: pond, shelter, damp, bank. A texture, read with no smoothing, so a tile is either water or land. Averaged over a patch it says how suitable the patch is, and for the water-bound stages an exact count of the calm pond tiles says how much room eggs and tadpoles have.' },
          { title: 'Population', text: 'The food web keeps eggs, tadpoles, froglets and adults of every species in every patch, and moves them with feeding, breeding, growth, hunger, predators and the weather. See the food web page.' },
          { title: 'Slots', text: `The ground is cut into ${AMPHIBIAN_CELL_TILES} m cells with ${slots} slots in each. Some are adults, some are young (spawn or tadpoles). A slot wakes when its fixed random number is below the density the patch holds, spread over the places the species likes and scaled by the hour, the weather and the season: an animal underground, in the cold or in the rain is not seen.` },
          { title: 'Size', text: 'A froglet is drawn at half size and an adult at full size, picked slot by slot in the proportion the patch holds them, so a pond shows tadpoles, froglets and frogs together and a population that has just bred has more small ones.' },
          { title: 'Motion', text: 'Where an awake slot is and which way it faces is a function of the clock and the slot. Nothing about one animal is stored; the stored thing is the count in the patch.' },
        ])}
${callout('<p><b>What a click does.</b> A click on water still scares every hopper within a couple of metres, and nothing of it is kept in the sim: the animal returns over a couple of minutes. What the animals eat and are eaten by is all in the patch.</p>')}`,
      },
      {
        id: 'catalogue',
        title: 'The species',
        html: `<p>The first four numbers are tastes, the rest are limits. <b>Needs wet</b> is how much the animal waits for rain or damp ground: a salamander is almost never seen dry, a pool frog hardly cares, and a spadefoot toad (<b>1.0</b>) appears only when it is wet. A body is drawn at 3.2 texels plus 30 texels per metre of length, so even a 2.5 cm dart frog is a readable four texels, which is the same exaggeration the items and fish make.</p>${catalogue()}`,
      },
      {
        id: 'habitat',
        title: 'Habitat: four maps of the world',
        html: `<p>Built by <code>amphibianHabitatAt</code> into an RGBA texture, a band of sixteen rows a frame nearest the camera first, the same way as the insect habitat (both use <code>HabitatTexture</code>). A water tile carries only its pond quality, with a tiny floor so the shader can tell water of any kind from land; the ocean carries only the floor, which no amphibian likes.</p>${channelMaps()}`,
      },
      {
        id: 'clock',
        title: 'The clock: when each species is out',
        html: `${figure(curves((s, x) => activity(s, x), [0, 1], 'daylight, 0 night to 1 noon', [0, 0.25, 0.5, 0.75, 1]), '<b>Time of day.</b> Toads, salamanders, tree frogs and spadefoots come out in the dark, pool frogs and dart frogs bask in the day, common frogs like dusk.', true)}
${figure(curves((s, x) => trapezoid(s.temperature, x), [-5, 42], 'air temperature, C'), '<b>Temperature.</b> Wood frogs work near freezing, dart frogs and marine toads need real heat. Outside its range a species is hibernating and not drawn at all.', true)}
${figure(curves((s, x) => trapezoid(s.season, x), [0, 1], 'year, 0 is the first of March', [0, 0.25, 0.5, 0.75, 1]), '<b>Season.</b> Temperate species wake in spring and go under in autumn; tropical ones are out all year. The southern half of the map uses its own half-year-shifted calendar.', true)}
${figure(curves((s, x) => dampness(s, x), [0, 0.5], 'wetness (rain or wet ground)', [0, 0.1, 0.2, 0.3, 0.4, 0.5]), '<b>Wet.</b> Rain, or ground still wet from it, brings every species out, and some are nothing without it.', true)}
<p>Snow cover over 10% sends everything under, melting away by 40%.</p>`,
      },
      {
        id: 'breeding',
        title: 'Spawn, tadpoles, froglets, frogs',
        html: `<p>Seven species leave spawn you can see. It is the egg stock of the patch, so it appears in the water where adults of the patch are fed well enough to breed, in the weeks the water is warm enough for that species (<code>water</code> in the table is the temperature range), and it is eaten by newts, by fish (perch, minnows, carp take spawn) and by anything that eats eggs. It hatches with warmth into tadpoles, the hatchling stock: two dark texels and a flicking tail, four to a group, drifting and darting, eaten by fish, dragonfly larvae and snakes, and fed on the algae of the pond, so a pond with no plants raises few. They grow at the pace they feed into froglets, drawn half size on the bank, and then into adults.</p>
<p>Frog spawn is a clump of pale jelly texels with dark nuclei, toad spawn a double wavy string, both drawn only on pixels the painter coloured as water. Frogs and toads that are breeding also <b>call</b> after dark: a male sits still and a pale throat sac swells four times a second in bursts.</p>`,
      },
      {
        id: 'world',
        title: 'Where they could live on this seed',
        html: `<p>Suitability times the climate for four species on this seed, from <code>abundance</code>, without anyone eating anyone: the ground a species can use. The animals actually kept there are on the <a href="food-web.html">food web</a> page, and are always fewer where predators are.</p>${abundanceMaps()}`,
      },
      {
        id: 'motion',
        title: 'How each one moves and looks',
        html: `<ul>
<li><b>Hop</b> (frogs, tree frogs, dart frogs, spadefoots): sit for several seconds (a tree frog for half a minute), then one hop of up to about two metres in 0.38 s. In the air the body is lifted up the screen, the legs stretch out behind it and a small shadow stays on the ground. Hops are between spots near home, and a spot on the wrong medium (water for a land frog, land for a floating one) is replaced by home, so a frog never hops into a lake by itself.</li>
<li><b>Walk</b> (toads, salamanders, newts, the axolotl): a slow pause and walk at about 0.2 m/s, the legs swinging in pairs, and for a salamander a wave running down the body and tail.</li>
<li><b>Afloat</b>: a species that likes the pond (pool frog, newt, and the axolotl, which never leaves it and carries its gills for life as three red stalks a side) can have its home on the water, where it floats with the legs trailing and glides rather than hops.</li>
<li><b>Startled</b>: a click on water throws a ripple, and every frog within 2 m hops 0.9 to 1.8 m away, a moment apart, a tenth of a second at most, and lands with a ring where that is water. The last 16 clicks are remembered, as for the water striders, and the displacement eases back over a couple of minutes.</li>
</ul>
<p>An adult is a distance field rasterised at the world's own texel grid, not a sprite: a body ellipse and a head, two eyes, hind legs folded or stretched, front legs, and a tail for a salamander, built from <code>creature</code> in <code>amphibians.frag</code>. It faces one of sixteen headings, is lit in five steps from the top-left like everything else, and gets a darker edge texel. Skin is a base colour with an accent scattered by a hash of the texel: single dots for spotted, larger blotches, or a pale stripe down the back. Frogs and toads are sorted with the props by the height of their hop, so a plant covers them; tree frogs are held at canopy height, over the props, and have no shadow. Nothing is drawn below strip zoom 24.</p>`,
      },
    ],
  };
}
