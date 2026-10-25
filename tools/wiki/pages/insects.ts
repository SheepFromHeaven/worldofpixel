import { habitatAt } from '../../../src/render/insectHabitat.ts';
import type { HabitatSample } from '../../../src/render/insectHabitat.ts';
import { abundance, activity, INSECT_CELL_TILES, INSECT_SLOTS, INSECTS, WIND_SHELTER } from '../../../src/sim/insects/species.ts';
import type { InsectSpecies } from '../../../src/sim/insects/species.ts';
import { trapezoid } from '../../../src/sim/plants/niche.ts';
import { world } from '../context.ts';
import { BIOME_RGB } from '../maps.ts';
import type { Page, PageLink } from '../page.ts';
import { callout, figure, flow, grid, img, table } from '../page.ts';
import type { Rgb } from '../raster.ts';
import { mix, renderMap } from '../raster.ts';
import { legend, lineChart, samples } from '../svg.ts';

const PALETTE = ['#c9a23c', '#a8523a', '#d0703c', '#7a6a50', '#3f6b9a', '#4a4a4a', '#8ab83c', '#2a2a2a', '#2f6a4a', '#6aa84f', '#7a4a7a', '#5a7ac0'];

const colourOf = (index: number): string => PALETTE[index % PALETTE.length]!;

const range = (r: readonly number[], unit = ''): string => `${r[1]} to ${r[2]}${unit}`;

const MOTION_NAMES = ['hops between flowers', 'flutters', 'skims and pauses', 'swarms', 'drifts and blinks', 'walks a trail', 'crawls', 'hops', 'sits on a web', 'buzzes'];

function catalogue(): string {
  const rows = INSECTS.map((s) => [
    s.name,
    MOTION_NAMES[s.motion]!,
    `${(s.length * 100).toFixed(1)} cm`,
    String(s.slots),
    s.likes.map((v) => v.toFixed(1)).join(' / '),
    range(s.temperature, ' C'),
    `${s.day} / ${s.night}${s.dusk > 0 ? ` (+${s.dusk} at dusk)` : ''}`,
    `${s.wind} m/s`,
  ]);
  return table(['Insect', 'Moves', 'Length', 'Slots', 'Nectar / foliage / water / ground', 'Best temperature', 'Day / night', 'Wind limit'], rows);
}

function curves(pick: (s: InsectSpecies, x: number) => number, domain: [number, number], label: string, ticks?: number[]): string {
  return (
    lineChart({
      width: 560,
      height: 250,
      x: { label, domain, ...(ticks ? { ticks } : {}) },
      y: { label: 'factor', domain: [0, 1], ticks: [0, 0.5, 1] },
      series: INSECTS.map((s, i) => ({ name: s.name, colour: colourOf(i), points: samples(domain[0], domain[1], 160, (x) => pick(s, x)) })),
      legend: false,
      label,
    }) + legend(INSECTS.map((s, i) => ({ name: s.name, colour: colourOf(i) })))
  );
}

function channelMaps(): string {
  const w = world();
  const { grid: g } = w;
  const STEP = 4;
  const sample: HabitatSample = [0, 0, 0, 0];
  const cache = new Float32Array(Math.ceil(g.columns / STEP) * Math.ceil(g.rows / STEP) * 4);
  const columns = Math.ceil(g.columns / STEP);
  for (let r = 0; r < g.rows; r += STEP) {
    for (let c = 0; c < g.columns; c += STEP) {
      habitatAt(w, c, r, sample);
      const at = ((r / STEP) * columns + c / STEP) * 4;
      for (let k = 0; k < 4; k += 1) cache[at + k] = sample[k]!;
    }
  }
  const names = ['nectar', 'foliage', 'water', 'ground'];
  const tones: Rgb[] = [[200, 120, 60], [60, 130, 60], [50, 110, 170], [130, 100, 70]];
  const maps = names.map((name, k) =>
    renderMap(`insects-${name}.png`, {
      columns: g.columns,
      rows: g.rows,
      step: STEP,
      colourAt: (c, r) => mix([244, 241, 234], tones[k]!, Math.min(1, cache[((r / STEP) * columns + c / STEP) * 4 + k]!)),
    }),
  );
  return grid(
    figure(img(maps[0]!, 'Nectar'), '<b>Nectar.</b> Flower patches, strongest in meadow and thinning to nothing in desert and tundra. Shrubs that fruit add a little.'),
    figure(img(maps[1]!, 'Foliage'), '<b>Foliage.</b> Trees, bushes, scrub and grass.'),
  ) + grid(
    figure(img(maps[2]!, 'Water'), '<b>Water.</b> The water itself and the damp ground round it.'),
    figure(img(maps[3]!, 'Ground'), '<b>Ground.</b> Bare earth, rock, fallen logs and trodden paths.'),
  );
}

function abundanceMaps(): string {
  const w = world();
  const { grid: g } = w;
  const STEP = 4;
  const sample: HabitatSample = [0, 0, 0, 0];
  const picks = ['honeybee', 'butterfly', 'midge', 'ant'].map((key) => INSECTS.find((s) => s.key === key)!);
  const columns = Math.ceil(g.columns / STEP);
  const values = picks.map(() => new Float32Array(columns * Math.ceil(g.rows / STEP)));
  for (let r = 0; r < g.rows; r += STEP) {
    for (let c = 0; c < g.columns; c += STEP) {
      const tile = r * g.columns + c;
      if (w.biome[tile]! >= 6) continue;
      habitatAt(w, c, r, sample);
      const celsius = w.field.temperature[tile]! + 4;
      picks.forEach((s, i) => {
        values[i]![(r / STEP) * columns + c / STEP] = abundance(s, sample, { celsius, year: 0.3, daylight: s.key === 'midge' ? 0.15 : 1, wind: 5, rain: 0 });
      });
    }
  }
  const maps = picks.map((s, i) =>
    renderMap(`insects-${s.key}.png`, {
      columns: g.columns,
      rows: g.rows,
      step: STEP,
      colourAt: (c, r) => {
        const tile = r * g.columns + c;
        const base: Rgb = BIOME_RGB[w.biome[tile]!] ?? [200, 200, 200];
        return mix(mix(base, [244, 241, 234], 0.55), [200, 60, 40], Math.min(1, values[i]![(r / STEP) * columns + c / STEP]! * 1.4));
      },
    }),
  );
  return grid(
    figure(img(maps[0]!, 'Honey bees'), '<b>Honey bees</b>, a warm midsummer noon. They follow the flower patches.'),
    figure(img(maps[1]!, 'Butterflies'), '<b>Butterflies</b>, the same moment. Flowers again, with more tolerance for shade and damp.'),
  ) + grid(
    figure(img(maps[2]!, 'Midges'), '<b>Midges</b> at dusk. Marsh, lakeshore and river banks, and almost nowhere else.'),
    figure(img(maps[3]!, 'Ants'), '<b>Ants</b> at noon. Bare, trodden and stony ground, where no one is looking.'),
  );
}

export const LINK: PageLink = {
  slug: 'insects',
  title: 'Insects',
  summary: 'Bees, butterflies, ants and the rest as a field of abundance, not a crowd of agents.',
};

export function build(): Page {
  const slots = INSECT_SLOTS.length;
  return {
    ...LINK,
    lede: `Nothing here is simulated one insect at a time. A bee is not an entity: it is what the map says should be hovering at that flower, at that hour, in that weather, drawn when you look. Each place has four habitat numbers (nectar, foliage, water, ground), each species has a taste for them and a body clock, and the product is how many of it are about. ${INSECTS.length} species are in, and a new one is a row.`,
    code: ['src/sim/insects/species.ts', 'src/render/insectHabitat.ts', 'src/render/lit/insectPass.ts', 'src/render/lit/shaders/insects.vert'],
    sections: [
      {
        id: 'how',
        title: 'How it works without a simulation',
        html: `${flow([
          { title: 'Habitat', text: 'Four numbers per tile, built once from the world: nectar, foliage, water, ground. They are a texture.' },
          { title: 'Taste', text: 'Each species weighs the four. A bee wants nectar, an ant wants bare ground, a midge wants water.' },
          { title: 'Clock', text: 'Temperature, season, time of day, wind and rain each scale it from 0 to 1. The same sky the weather and the fish already use.' },
          { title: 'Slots', text: `The ground is cut into ${INSECT_CELL_TILES} m cells with ${slots} slots in each. A slot belongs to one species. It is awake when its fixed random number is below the abundance there.` },
          { title: 'Motion', text: 'Where an awake slot is, and which way it faces, is a function of the clock and the slot. There is no state to store.' },
        ])}
<p>This is the whole trick. Because a slot's identity is fixed by its cell and number, the same bee is at the same flower however you arrive, a swarm builds up as dusk falls instead of popping in, and nothing is saved, synchronised or stepped. The cost is the number of cells on screen, not the number of insects in the world, and nothing at all is drawn until strip zoom 30, where one metre is 30 pixels.</p>
${callout('<p><b>Density is a probability, never a count.</b> Abundance is 0 to 1 and a slot wakes when <code>key &lt; abundance</code>, fading in over a small margin so one drifting across the threshold at dusk does not blink. A cell with three honey bee slots and a flower meadow at noon has three bees. The same cell in a gale has none.</p>')}`,
      },
      {
        id: 'catalogue',
        title: 'The species',
        html: `<p>Every number is a taste or a limit, nothing is per insect. A species with five slots shows up as a file of ants, one with three as a small cloud. Length is documented but not drawn: an insect is one pixel.</p>${catalogue()}`,
      },
      {
        id: 'habitat',
        title: 'Habitat: four maps of the world',
        html: `<p>The habitat is computed from what is on the ground, by <code>habitatAt</code>, and uploaded as an RGBA texture the shader reads. It is built a band of sixteen rows a frame, nearest the camera first, so there is no hitch, and rebuilt slowly if the world changes.</p>${channelMaps()}`,
      },
      {
        id: 'clock',
        title: 'The clock: when each species is out',
        html: `${figure(curves((s, x) => activity(s, x), [0, 1], 'daylight, 0 night to 1 noon', [0, 0.25, 0.5, 0.75, 1]), '<b>Time of day.</b> Bees and dragonflies need the light, moths and fireflies the dark, midges the half-light at either end of the day, ants hardly care.', true)}
${figure(curves((s, x) => trapezoid(s.temperature, x), [-5, 42], 'air temperature, C'), '<b>Temperature.</b> Bumblebees fly in the cold, grasshoppers and dragonflies want heat, ants keep working in all but frost.', true)}
${figure(curves((s, x) => trapezoid(s.season, x), [0, 1], 'year, 0 is the first of March', [0, 0.25, 0.5, 0.75, 1]), '<b>Season.</b> A butterfly appears in spring and is gone by autumn, grasshoppers peak in late summer, fireflies only flash for a few weeks of midsummer. The southern half of the map uses its own half-year-shifted calendar.', true)}
<p>Wind and rain thin everything out. Each species has a <b>wind limit</b>: above 60% of it a species starts to leave and by the limit it is gone, measured at the ground as ${WIND_SHELTER * 100}% of the wind vector, because grass and trees shelter what lives in them. Rain sends most of them home (<code>rain</code> in the table is how much it matters, ants barely mind).</p>`,
      },
      {
        id: 'world',
        title: 'Where they are on this seed',
        html: `<p>Abundance for four species on this seed, from the same function the shader runs: midsummer, 4 degrees warmer than the annual mean, light wind, no rain.</p>${abundanceMaps()}`,
      },
      {
        id: 'motion',
        title: 'How each one moves',
        html: `<p>Every species has one of ten motions, a closed-form path in the slot's own time, so a bee at a flower now and a bee at the same flower one second later are linked by arithmetic, not by memory:</p>
<ul>
<li><b>Hover and hop</b> (bees): hold a point for a couple of seconds, then dart to the next one, a few metres off. </li>
<li><b>Flutter</b> (butterflies and moths): a slow looping path of two sines, heading read off its velocity, wings opening and closing at about 10 Hz.</li>
<li><b>Skim</b> (dragonflies): hold a station for several seconds, then dart several metres to the next.</li>
<li><b>Swarm</b> (midges): a shared centre per cell, each midge orbiting it at its own speed. They are a cloud because they share a centre.</li>
<li><b>Glow</b> (fireflies): a slow drift and a blink once or twice a second, with a soft halo.</li>
<li><b>Colony</b> (ants, termites): a black wiggling mass of 300 to 400 to a colony, each one drifting slowly and never stopping on a sum of three slow sines of its own speed and phase, with a stepped two pixel jitter, thickest at the mound and thinning out to about half a metre. The mound is a faint, dark, sparsely dithered disc (an ant hill is pine needles and dry leaves, so nearly black), one per cell where the habitat, temperature and season allow a colony, and the same cell always has the same one. Termites want bare, dry ground with no plants or water, which is the desert.</li>
<li><b>Skate</b> (water striders): hold a spot on the water for minutes, then glide a metre or two in about a second, five to ten times a game day, with a ring that spreads from where it stopped (the ring is drawn under the water plants, the strider over them). A click on water (it throws a ripple, with or without a tool) startles every strider within 1 m: each hops 1 to 2 m directly away (give or take 40 degrees) in 0.3 s, a moment apart, and its landing throws its own ring. The last 16 clicks are remembered and each jump is added to the strider's position on its usual schedule, so a second click moves it on from where the first left it, and the hops ease back over about two minutes.</li>
<li><b>Crawl, hop, buzz</b> (beetles, grasshoppers, flies): a long slow walk, a hop, a fly that loops in a small area. Fireflies are a pixel that blinks inside a dithered glow.</li>
</ul>
<p>An insect is a single chunky pixel in its species colour, snapped to the two pixel grid the rest of the world uses, so the way it moves is the whole of its look: a bee or dragonfly holds a station and then darts to the next, ants keep an even gap along their line, a firefly is a pixel that comes and goes. Ground insects (ants, termites, beetles and the mounds) are drawn under the plants, so a leaf covers them; flying ones are drawn over everything but the clouds.</p>`,
      },
      {
        id: 'next',
        title: 'What this is for',
        html: `<p>Because insects are a field, the sim can read the field without ever having had an insect. The fish already live on 50% insects and plankton when no prey is near (<code>FORAGE_FLOOR</code>). Pollination, a spider's catch, a frog's hunting ground, the reason a swarm sits over a still pond in July: each is a question of how much of one species is at a place and time, and <code>abundance</code> answers it for any tile without a single object to keep.</p>`,
      },
    ],
  };
}
