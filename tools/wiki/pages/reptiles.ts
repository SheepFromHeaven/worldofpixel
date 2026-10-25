import { reptileHabitatAt } from '../../../src/sim/fauna/habitat/reptileHabitat.ts';
import type { ReptileHabitatSample } from '../../../src/sim/fauna/habitat/reptileHabitat.ts';
import { trapezoid } from '../../../src/sim/plants/niche.ts';
import { abundance, activity, bodyTexels, Form, REPTILE_CELL_TILES, REPTILE_SLOTS, REPTILES, Realm, sheltering, Trait } from '../../../src/sim/reptiles/species.ts';
import type { ReptileSpecies } from '../../../src/sim/reptiles/species.ts';
import { world } from '../context.ts';
import { BIOME_RGB } from '../maps.ts';
import type { Page, PageLink } from '../page.ts';
import { callout, figure, flow, grid, img, table } from '../page.ts';
import type { Rgb } from '../raster.ts';
import { mix, renderMap } from '../raster.ts';
import { legend, lineChart, samples } from '../svg.ts';
import { clockText, compendium, lifeFacts } from '../compendium.ts';
import { LIVES } from '../../../src/sim/fauna/life.ts';

const FORM_NAMES = ['snake', 'lizard', 'chameleon', 'turtle', 'crocodilian'];
const PATTERN_NAMES = ['plain', 'spots', 'stripe', 'bands', 'diamonds', 'zigzag', 'blotches', 'scutes', 'ridge'];
const TRAITS: readonly (readonly [number, string])[] = [
  [Trait.Hood, 'hood'],
  [Trait.Rattle, 'rattle'],
  [Trait.Tongue, 'forked tongue'],
  [Trait.BlueTongue, 'blue tongue'],
  [Trait.Crest, 'crest'],
  [Trait.Spikes, 'spines'],
  [Trait.Beard, 'beard'],
  [Trait.Camo, 'colour change'],
  [Trait.Sidewind, 'sidewinds'],
  [Trait.Plunge, 'bolts for water'],
  [Trait.Flippers, 'flippers'],
  [Trait.Dome, 'domed shell'],
];

const rgb = (c: readonly number[]): string => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;

const colourOf = (s: ReptileSpecies): string => rgb(s.colour);

const range = (r: readonly number[], unit = ''): string => `${r[1]} to ${r[2]}${unit}`;

const realmOf = (s: ReptileSpecies): string =>
  [s.realm & Realm.Land ? 'land' : '', s.realm & Realm.Fresh ? 'fresh water' : '', s.realm & Realm.Sea ? 'sea' : ''].filter(Boolean).join(' + ');

const traitsOf = (s: ReptileSpecies): string => TRAITS.filter(([bit]) => (s.traits & bit) !== 0).map(([, name]) => name).join(', ') || 'none';

function catalogue(): string {
  const rows = REPTILES.map((s) => [
    `<span style="display:inline-block;width:10px;height:10px;background:${colourOf(s)};border:1px solid #2a2a2a;margin-right:6px"></span>${s.name}`,
    `${FORM_NAMES[s.form]!}, ${PATTERN_NAMES[s.pattern]!}${s.canopy ? ', in the canopy' : ''}`,
    realmOf(s),
    `${s.length >= 1 ? s.length.toFixed(1) + ' m' : (s.length * 100).toFixed(0) + ' cm'} (${bodyTexels(s).toFixed(0)} texels)`,
    `${s.adults}`,
    s.likes.map((v) => v.toFixed(1)).join(' / ') + (s.bias !== 0 ? ` (+${s.bias})` : ''),
    range(s.temperature, ' C'),
    `${s.day} / ${s.night}${s.dusk > 0 ? ` (+${s.dusk} at dusk)` : ''}`,
    `${s.speed} m/s${s.skit > 0 ? `, flees ${s.skit} m` : ', stands its ground'}`,
    traitsOf(s),
  ]);
  return table(['Reptile', 'Form', 'Lives in', 'Length', 'Slots', 'Water / cover / warm / bank', 'Best temperature', 'Day / night', 'Pace', 'Traits'], rows);
}

function curves(pick: (s: ReptileSpecies, x: number) => number, domain: [number, number], label: string, ticks?: number[], only?: (s: ReptileSpecies) => boolean): string {
  const shown = REPTILES.filter((s) => (only ? only(s) : true));
  return (
    lineChart({
      width: 560,
      height: 250,
      x: { label, domain, ...(ticks ? { ticks } : {}) },
      y: { label: 'factor', domain: [0, 1], ticks: [0, 0.5, 1] },
      series: shown.map((s) => ({ name: s.name, colour: colourOf(s), points: samples(domain[0], domain[1], 160, (x) => pick(s, x)) })),
      legend: false,
      label,
    }) + legend(shown.map((s) => ({ name: s.name, colour: colourOf(s) })))
  );
}

const STEP = 4;

function habitatSamples(): { cache: Float32Array; columns: number } {
  const w = world();
  const { grid: g } = w;
  const sample: ReptileHabitatSample = [0, 0, 0, 0];
  const columns = Math.ceil(g.columns / STEP);
  const cache = new Float32Array(columns * Math.ceil(g.rows / STEP) * 4);
  for (let r = 0; r < g.rows; r += STEP) {
    for (let c = 0; c < g.columns; c += STEP) {
      reptileHabitatAt(w, c, r, sample);
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
  const names = ['water', 'cover', 'warm', 'bank'];
  const tones: Rgb[] = [[50, 120, 160], [60, 130, 60], [200, 140, 50], [150, 120, 60]];
  const maps = names.map((name, k) =>
    renderMap(`reptiles-${name}.png`, {
      columns: g.columns,
      rows: g.rows,
      step: STEP,
      colourAt: (c, r) => mix([244, 241, 234], tones[k]!, Math.min(1, cache[((r / STEP) * columns + c / STEP) * 4 + k]!)),
    }),
  );
  return grid(
    figure(img(maps[0]!, 'Water'), '<b>Water.</b> Zero on land. Fresh water carries its stillness (0.1 and up, a calm shallow lake near 1), the sea a fixed 0.05, which is how the shader tells the three media apart.'),
    figure(img(maps[1]!, 'Cover'), '<b>Cover.</b> On land what a reptile can slip under: boulders and logs most, then trees, bushes, scrub, grass. On water the plants that hide it: reeds, lilies, weed, seagrass, kelp.'),
  ) + grid(
    figure(img(maps[2]!, 'Warm'), '<b>Warm.</b> On land open ground to bask on: bare soil and rock, less so under grass or trees, less again where it is damp. In water the shallows, which warm first.'),
    figure(img(maps[3]!, 'Bank'), '<b>Bank.</b> The margin: on land, fresh water within three and six tiles, or the sea at 0.8 of that; in water, how close the land is.'),
  );
}

function abundanceMaps(): string {
  const w = world();
  const { grid: g } = w;
  const { cache, columns } = habitatSamples();
  const picks = ['rattlesnake', 'anaconda', 'komodo', 'seaturtle', 'nilecroc', 'tortoise'].map((key) => REPTILES.find((s) => s.key === key)!);
  const maps = picks.map((s) =>
    renderMap(`reptiles-${s.key}.png`, {
      columns: g.columns,
      rows: g.rows,
      step: STEP,
      colourAt: (c, r) => {
        const tile = r * g.columns + c;
        const base: Rgb = BIOME_RGB[w.biome[tile]!] ?? [200, 200, 200];
        const at = ((r / STEP) * columns + c / STEP) * 4;
        const habitat: ReptileHabitatSample = [cache[at]!, cache[at + 1]!, cache[at + 2]!, cache[at + 3]!];
        const value = abundance(s, habitat, { celsius: w.field.temperature[tile]!, year: 0.4, daylight: 0.8, wet: 0, snow: 0 });
        return mix(mix(base, [244, 241, 234], 0.55), [200, 60, 40], Math.min(1, value * 3));
      },
    }),
  );
  return grid(
    figure(img(maps[0]!, 'Rattlesnakes'), '<b>Rattlesnakes</b>, a summer day. Hot open ground with some rock to hide under; none in the cold or the wet.'),
    figure(img(maps[1]!, 'Anacondas'), '<b>Anacondas</b>, a summer day. Still tropical water and its banks only.'),
  ) + grid(
    figure(img(maps[2]!, 'Komodo dragons'), '<b>Komodo dragons</b>. Hot, open and dry, with a little bank, and rare even there.'),
    figure(img(maps[3]!, 'Sea turtles'), '<b>Green sea turtles</b>. Warm sea over seagrass and shallows, and no land or lake at all.'),
  ) + grid(
    figure(img(maps[4]!, 'Nile crocodiles'), '<b>Nile crocodiles</b>. Warm lakes and rivers, and the land beside them to bask on.'),
    figure(img(maps[5]!, 'Giant tortoises'), '<b>Giant tortoises</b>. Warm dry open ground in the tropics.'),
  );
}

function reptileCards(): string {
  return compendium(
    REPTILES.map((s) => ({
      key: s.key,
      name: s.name,
      facts: [
        ['Kind', `${FORM_NAMES[s.form]!}, ${PATTERN_NAMES[s.pattern]!}${s.canopy ? ', in the canopy' : ''}; ${traitsOf(s)}`],
        ['Lives in', realmOf(s)],
        ['Size', `${metres(s.length)}, drawn at ${bodyTexels(s).toFixed(0)} texels`],
        ['Out', `${clockText(s.day, s.night, s.dusk)}, ${range(s.temperature, ' C')}`],
        ['Pace', `${s.speed} m/s${s.skit > 0 ? `, flees from a click within ${s.skit} m` : ', stands its ground'}`],
        ...lifeFacts(LIVES.find((life) => life.key === s.key)!),
      ],
    })),
  );
}

const metres = (value: number): string => (value >= 1 ? `${value.toFixed(1)} m` : `${Math.round(value * 100)} cm`);

export const LINK: PageLink = {
  slug: 'reptiles',
  title: 'Reptiles',
  summary: 'Snakes, lizards, chameleons, turtles and crocodilians as a field: ectotherms that bask, bolt for water and slither.',
};

export function build(): Page {
  const fraction = (form: number): number => REPTILES.filter((s) => s.form === form).length;
  return {
    ...LINK,
    lede: `Reptiles are the first animals here big enough to be a shape rather than a speck: a green anaconda is five metres, eighty texels, a sea turtle a metre across, a saltwater crocodile five and a half. They are populations of the <a href="food-web.html">food web</a>, not a map of habitat: every patch holds eggs, hatchlings, juveniles and adults of each species, they eat insects, frogs, fish, each other and (for tortoises, iguanas and sea turtles) plants, and a huge lizard is rare because it needs a great deal of food and ground. This page is what a species is like, how a body is drawn and how it behaves when you are near it. ${REPTILES.length} species are in (${fraction(Form.Snake)} snakes and legless lizards, ${fraction(Form.Lizard)} lizards, ${fraction(Form.Chameleon)} chameleons, ${fraction(Form.Turtle)} turtles and tortoises, ${fraction(Form.Crocodilian)} crocodilians: an alligator, the Nile, saltwater and gharial crocodiles and a caiman) and a new one is a row here and a line of biology in <code>sim/fauna/life.ts</code>.`,
    code: ['src/sim/reptiles/species.ts', 'src/sim/fauna/habitat/reptileHabitat.ts', 'src/sim/fauna/life.ts', 'src/render/lit/reptilePass.ts', 'src/render/lit/shaders/reptiles.vert', 'src/render/lit/shaders/reptiles.frag'],
    sections: [
      {
        id: 'compendium',
        title: 'The reptiles',
        html: `<p>All ${REPTILES.length} species, drawn by the same shader as on the map, mid-stride, with how each lives and what the food web makes of it. The alligator, the Nile, saltwater and gharial crocodiles and the caiman are at the end.</p>${reptileCards()}`,
      },
      {
        id: 'how',
        title: 'Habitat, the food web, and what is drawn',
        html: `${flow([
          { title: 'Habitat', text: 'Four numbers per tile: water, cover, warm, bank. Land, fresh water and the sea each fill them differently, so one table of tastes serves all three media.' },
          { title: 'Realm', text: 'A species may live on land, in fresh water, in the sea, or any mix. A patch is suitable for it by how much of its realm and taste the patch has, and a hop or crawl to a spot on the wrong medium falls back to home.' },
          { title: 'Population', text: 'The food web keeps the eggs, hatchlings, juveniles and adults of each species in each patch: how many, how well fed, how many young are coming. Big hunters are few because they need so much; the numbers settle on their own. See the food web page.' },
          { title: 'Slots', text: `The ground is cut into ${REPTILE_CELL_TILES} m cells with ${REPTILE_SLOTS} slots in each, the species' slot counts laid end to end (one for the big ones, three for the small). A slot wakes when its fixed random number is under the density the patch holds, spread over the places the species likes and scaled by the hour, the cold, the rain and snow.` },
          { title: 'Size', text: 'Each awake slot is a hatchling at a fifth of adult length, a juvenile at half or an adult, in the proportion the patch holds them. Turtles and crocodilians that have eggs in the patch also show a nest on the bank: a dark mound of vegetation for a crocodile, a scrape of sand for a turtle, with pale eggs.' },
          { title: 'Motion', text: 'Where an awake animal is, which way it faces, how its body is bent and what its legs are doing are functions of the clock and the slot. Nothing about one animal is stored.' },
        ])}
${callout('<p><b>A click is not a hunt.</b> What a click does (below) is only seen: the animal runs and comes back. The food web has no individual animals, so a reptile that flees is not one that has been eaten or fed; the patch holds the count.</p>')}`,
      },
      {
        id: 'catalogue',
        title: 'The species',
        html: `<p>The four tastes are, in order, <b>water</b> (the quality of the water tile it is in), <b>cover</b>, <b>warm</b> (open ground to bask on, or shallows) and <b>bank</b>. A body is drawn at 3 texels plus 16 per metre of length, so it is almost life size: a 5 m python is 83 texels, a 13 cm gecko five. How common each is, is not a number here: it is what the food web finds.</p>${catalogue()}`,
      },
      {
        id: 'habitat',
        title: 'Habitat: four maps of the world',
        html: `<p>Built by <code>reptileHabitatAt</code> into an RGBA texture, a band of sixteen rows a frame nearest the camera first, by the same <code>HabitatTexture</code> as the insects and amphibians, with no smoothing. A water tile carries its quality in the first channel, which is all the shader needs to know the medium: zero is land, up to 0.1 is sea, above is fresh water.</p>${channelMaps()}`,
      },
      {
        id: 'clock',
        title: 'The clock: when each species is out',
        html: `${figure(curves((s, x) => trapezoid(s.temperature, x), [-5, 46], 'air temperature, C'), '<b>Temperature.</b> Reptiles are ectotherms: they are not out until it is warm, and not at all when it is very hot. Below its range an animal is under the ground (the food web feeds and breeds it less there, and a hard enough cold kills it), and in the range the pace is the species pace times a warmth factor (a cold snake moves at 35% speed and rests three times longer).', true)}
${figure(curves((s, x) => activity(s, x), [0, 1], 'daylight, 0 night to 1 noon', [0, 0.25, 0.5, 0.75, 1]), '<b>Time of day.</b> Lizards and tortoises bask by day; pythons, geckos and sidewinders come out in the dark; crocodiles and caimans are active by day and by night; anacondas keep to dusk and night.', true)}
${figure(curves((s, x) => trapezoid(s.season, x), [0, 1], 'year, 0 is the first of March', [0, 0.25, 0.5, 0.75, 1], (s) => s.season[1] > 0.02), '<b>Season.</b> Temperate species emerge in spring and go under in autumn; the tropical ones, not shown, are out all year. The southern half of the map uses its own half-year-shifted calendar.', true)}
${figure(curves((s, x) => sheltering(s, x), [0, 0.5], 'wetness (rain or wet ground)', [0, 0.1, 0.2, 0.3, 0.4, 0.5], (s) => s.shy > 0.2), '<b>Rain.</b> The desert species go under in rain; water snakes, turtles, crocodiles and the sea species do not care.', true)}
<p>Snow cover over 10% sends everything under, melting away by 40%.</p>`,
      },
      {
        id: 'world',
        title: 'Where they could live on this seed',
        html: `<p>Suitability times the climate for six species on this seed, from <code>abundance</code>, with nobody eating anybody: the ground a species can use. The animals actually kept there, and how few big hunters that is, are on the <a href="food-web.html">food web</a> page.</p>${abundanceMaps()}`,
      },
      {
        id: 'motion',
        title: 'How each form moves and looks',
        html: `<ul>
<li><b>Snakes</b> are a chain of 22 capsules whose heading follows a sine wave along the body, and the wave is fixed in the ground while the head moves through it, so the body follows its own track (the phase is the distance travelled). At rest the body relaxes into an S or, for the big boas, a coil, chosen by the animal's own number. Widths taper over the last third. A snake flicks a forked tongue, a cobra spreads its hood and shows pale marks when it stops and rears, a rattlesnake shakes a tail of three pale beads, a sidewinder travels at an angle to its body, and a slow worm is blunt-tailed. Patterns are read along the body: stripe, bands (coral snakes get the red, black, yellow, black ring order), diamonds, zigzag, blotches.</li>
<li><b>Lizards</b> have a head, torso and a tapered tail that swings, four legs in a diagonal gait whose stride matches the ground covered, and a wobble down the spine. Traits add a crest (iguanas, basilisks), a spiny beard (bearded dragon), spines at the outline (thorny devil), a forked flick (komodo, monitors) or a broad blue one (the blue-tongued skink).</li>
<li><b>Chameleons</b> sit in the canopy layer, over the plants, with a casque, eyes on turrets, a tail rolled into a spiral and a slow rocking walk. They drift between their two colours over a few minutes and blend toward the ground colour under them by reading the painted ground buffer.</li>
<li><b>Turtles</b> have a shell with scutes (a Voronoi of plates with seams, some plates picking up the accent colour, a rim band), a head that stretches out as it moves, and legs. Tortoises are domed with stumpy legs, pond turtles flatter and webbed, and the sea turtle is heart-shaped with flippers that beat as it swims.</li>
<li><b>Crocodilians</b> are long, with a tapered snout, raised eyes, a pale osteoderm ridge down the back and a tail that sways side to side. In water the legs are tucked and the body is drawn half through the surface.</li>
<li><b>In water</b>: an animal whose home is on water is dithered 40% transparent and tinted dark except its head, eyes and, for crocodiles, its back; a turtle's shell stays whole. A swimming animal sheds ripple rings behind it.</li>
<li><b>Startled</b>: a click throws a ripple (<code>LitLayer.throwRipple</code>) and every reptile inside its flee distance runs, a moment apart, at 3.5 times its pace to a point on the far side. Species that bolt for water (iguanas, basilisks, monitors, turtles, crocodilians) look for a wet spot among nine directions and make for it, and land with a ring. Giant tortoises and snapping turtles stand their ground. The last 16 clicks are remembered and the displacement eases back over a couple of minutes.</li>
<li><b>Shadows</b>: any animal over 5 texels long on land casts a small offset shadow, drawn first, never over water.</li>
</ul>
<p>Every animal is a distance field rasterised on the world's own texel grid, not a sprite, facing one of 32 headings, lit from the top-left in steps with an inked edge, and faded in and out through the Bayer dither. Ground animals are drawn under the plants and the chameleon and tree boa over them. Nothing is drawn below strip zoom 14.</p>`,
      },
    ],
  };
}
