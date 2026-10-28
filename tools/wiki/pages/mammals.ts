import { mammalHabitatAt } from '../../../src/sim/fauna/habitat/mammalHabitat.ts';
import type { MammalHabitatSample } from '../../../src/sim/fauna/habitat/mammalHabitat.ts';
import { LIVES } from '../../../src/sim/fauna/life.ts';
import { trapezoid } from '../../../src/sim/plants/niche.ts';
import { abundance, activity, bodyTexels, Form, Gait, MAMMALS, Realm, sheltering, Trait } from '../../../src/sim/mammals/species.ts';
import type { MammalSpecies } from '../../../src/sim/mammals/species.ts';
import { world } from '../context.ts';
import { BIOME_RGB } from '../maps.ts';
import type { Page, PageLink } from '../page.ts';
import { callout, figure, flow, grid, img, table } from '../page.ts';
import type { Rgb } from '../raster.ts';
import { mix, renderMap } from '../raster.ts';
import { legend, lineChart, samples } from '../svg.ts';
import { clockText, compendium, lifeFacts } from '../compendium.ts';

const FORM_NAMES = ['four-legged', 'long-bodied', 'rodent-shaped', 'bat', 'whale', 'dolphin', 'seal', 'ape or monkey', 'hopper', 'sea cow'];
const GAIT_NAMES = ['walks', 'trots', 'hops', 'bounds', 'swims', 'cruises', 'porpoises', 'flies', 'burrows'];
const SOCIAL_NAMES = ['alone', 'family', 'herd', 'pack', 'colony', 'pod', 'troop', 'harem'];
const HORN_NAMES = ['', 'antlers', 'curled horns', 'straight horns', 'lyre horns', 'short horns', 'wide horns', 'rhino horn', 'tusks', 'knobs', 'palmate antlers'];
const TRAITS: readonly (readonly [number, string])[] = [
  [Trait.Ruff, 'mane or ruff'],
  [Trait.Mane, 'mane line'],
  [Trait.Hump, 'hump'],
  [Trait.Quills, 'quills'],
  [Trait.Armour, 'armour'],
  [Trait.Trunk, 'trunk'],
  [Trait.Pouch, 'pouch'],
  [Trait.Bushy, 'bushy tail'],
  [Trait.Snout, 'long snout'],
  [Trait.Flippers, 'flippers'],
  [Trait.Spout, 'blows'],
  [Trait.Breach, 'breaches'],
  [Trait.Bill, 'bill'],
  [Trait.Glide, 'glides'],
  [Trait.Climb, 'climbs'],
  [Trait.Burrow, 'burrows'],
  [Trait.Sentinel, 'sentinel'],
  [Trait.Back, 'carries young on its back'],
];

const rgb = (c: readonly number[]): string => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;

const range = (r: readonly number[], unit = ''): string => `${r[1]} to ${r[2]}${unit}`;

const metres = (value: number): string => (value >= 1 ? `${value.toFixed(1)} m` : `${Math.round(value * 100)} cm`);

const realmOf = (s: MammalSpecies): string =>
  [s.realm & Realm.Land ? 'land' : '', s.realm & Realm.Fresh ? 'fresh water' : '', s.realm & Realm.Sea ? 'sea' : ''].filter(Boolean).join(' + ');

const traitsOf = (s: MammalSpecies): string =>
  [...TRAITS.filter(([bit]) => (s.traits & bit) !== 0).map(([, name]) => name), ...(HORN_NAMES[s.horn] ? [HORN_NAMES[s.horn]!] : [])].join(', ') || 'none';

const groupOf = (s: MammalSpecies): string => (s.size > 1 ? `${SOCIAL_NAMES[s.social]!} of up to ${s.size}${s.groups > 1 ? `, ${s.groups} groups a cell` : ''}` : SOCIAL_NAMES[s.social]!);

function catalogue(): string {
  const rows = MAMMALS.map((s) => [
    `<span style="display:inline-block;width:10px;height:10px;background:${rgb(s.colour)};border:1px solid #2a2a2a;margin-right:6px"></span>${s.name}`,
    `${FORM_NAMES[s.form]!}, ${GAIT_NAMES[s.gait]!}`,
    realmOf(s),
    groupOf(s),
    `${metres(s.length)} (${bodyTexels(s).toFixed(0)} texels)`,
    `${s.slots}`,
    s.likes.map((v) => v.toFixed(1)).join(' / ') + (s.bias !== 0 ? ` (${s.bias > 0 ? '+' : ''}${s.bias})` : ''),
    range(s.temperature, ' C'),
    `${s.day} / ${s.night}${s.dusk > 0 ? ` (+${s.dusk} at dusk)` : ''}`,
    `${s.speed} m/s${s.skit > 0 ? `, runs from ${s.skit} m` : ''}`,
    traitsOf(s),
  ]);
  return table(['Mammal', 'Kind', 'Lives in', 'Lives', 'Length', 'Slots', 'Wood / forage / water / bank', 'Best temperature', 'Day / night', 'Pace', 'Traits'], rows);
}

function curves(pick: (s: MammalSpecies, x: number) => number, domain: [number, number], label: string, ticks?: number[], only?: (s: MammalSpecies) => boolean): string {
  const shown = MAMMALS.filter((s) => (only ? only(s) : true));
  return (
    lineChart({
      width: 560,
      height: 250,
      x: { label, domain, ...(ticks ? { ticks } : {}) },
      y: { label: 'factor', domain: [0, 1], ticks: [0, 0.5, 1] },
      series: shown.map((s) => ({ name: s.name, colour: rgb(s.colour), points: samples(domain[0], domain[1], 160, (x) => pick(s, x)) })),
      legend: false,
      label,
    }) + legend(shown.map((s) => ({ name: s.name, colour: rgb(s.colour) })))
  );
}

const STEP = 4;

function habitatSamples(): { cache: Float32Array; columns: number } {
  const w = world();
  const { grid: g } = w;
  const sample: MammalHabitatSample = [0, 0, 0, 0];
  const columns = Math.ceil(g.columns / STEP);
  const cache = new Float32Array(columns * Math.ceil(g.rows / STEP) * 4);
  for (let r = 0; r < g.rows; r += STEP) {
    for (let c = 0; c < g.columns; c += STEP) {
      mammalHabitatAt(w, c, r, sample);
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
  const names = ['wood', 'forage', 'water', 'bank'];
  const tones: Rgb[] = [[40, 110, 50], [190, 170, 70], [50, 120, 160], [150, 120, 60]];
  const maps = names.map((name, k) =>
    renderMap(`mammals-${name}.png`, {
      columns: g.columns,
      rows: g.rows,
      step: STEP,
      colourAt: (c, r) => mix([244, 241, 234], tones[k]!, Math.min(1, cache[((r / STEP) * columns + c / STEP) * 4 + k]!)),
    }),
  );
  return grid(
    figure(img(maps[0]!, 'Wood'), '<b>Wood.</b> Cover to shelter in: a tree is 1, a bush 0.75, scrub 0.5, a fallen trunk 0.7 and a boulder 0.55, and tiles near trees borrow half. On water this channel is <b>depth</b>, from 4 m to 60 m for the sea, which is where the whales are.'),
    figure(img(maps[1]!, 'Forage'), '<b>Forage.</b> Half from what stands on the tile and 0.7 from how well things grow there (<code>eco</code>), less trodden wear, so bare savanna that grows grass still feeds a herd. On water it is plants: seagrass and kelp for the sea cows, reeds and lilies for the rodents.'),
  ) + grid(
    figure(img(maps[2]!, 'Water'), '<b>Water.</b> Zero on land, 0.05 for the sea, 0.1 up to 1 for fresh water by stillness: the same convention as reptiles and birds.'),
    figure(img(maps[3]!, 'Bank'), '<b>Bank.</b> On land, water within three and six tiles: the drinking places, the beaver, otter, hippo and capybara. On water, land within the same reach: the seal haul-outs and the walrus beach.'),
  );
}

function abundanceMaps(): string {
  const w = world();
  const { grid: g } = w;
  const { cache, columns } = habitatSamples();
  const picks = ['zebra', 'reddeer', 'wolf', 'harbourseal', 'bluewhale', 'ibex'].map((key) => MAMMALS.find((s) => s.key === key)!);
  const maps = picks.map((s) =>
    renderMap(`mammals-${s.key}.png`, {
      columns: g.columns,
      rows: g.rows,
      step: STEP,
      colourAt: (c, r) => {
        const tile = r * g.columns + c;
        const base: Rgb = BIOME_RGB[w.biome[tile]!] ?? [200, 200, 200];
        const at = ((r / STEP) * columns + c / STEP) * 4;
        const habitat: MammalHabitatSample = [cache[at]!, cache[at + 1]!, cache[at + 2]!, cache[at + 3]!];
        const highland = w.biome[tile] === 2 ? 0.8 : 0;
        const value = abundance(s, habitat, { rough: highland, soil: 0.6 }, { celsius: w.field.temperature[tile]!, year: 0.4, daylight: 0.8, wet: 0, snow: 0 });
        return mix(mix(base, [244, 241, 234], 0.55), [200, 60, 40], Math.min(1, value * 1.5));
      },
    }),
  );
  return grid(
    figure(img(maps[0]!, 'Plains zebras'), '<b>Plains zebras</b>. Open ground that grows grass, warm to hot.'),
    figure(img(maps[1]!, 'Red deer'), '<b>Red deer</b>. Wood and forage together, anywhere that is not hot desert.'),
  ) + grid(
    figure(img(maps[2]!, 'Grey wolves'), '<b>Grey wolves</b>. Nearly everywhere cold to temperate; the food web decides where they actually are.'),
    figure(img(maps[3]!, 'Harbour seals'), '<b>Harbour seals</b>. Only where land and sea meet in cool to temperate water.'),
  ) + grid(
    figure(img(maps[4]!, 'Blue whales'), '<b>Blue whales</b>. Deep open sea only, and not the polar edge or the tropics.'),
    figure(img(maps[5]!, 'Alpine ibex'), '<b>Alpine ibex</b>. Highland rock in cool country, scored with the roughness of the ground that the map texture does not carry.'),
  );
}

function mammalCards(): string {
  return compendium(
    MAMMALS.map((s) => ({
      key: s.key,
      name: s.name,
      facts: [
        ['Kind', `${FORM_NAMES[s.form]!}, ${GAIT_NAMES[s.gait]!}; ${traitsOf(s)}`],
        ['Lives', `${groupOf(s)}, in ${realmOf(s)}`],
        ['Size', `${metres(s.length)} long, ${metres(s.height)} at the shoulder; drawn ${bodyTexels(s).toFixed(0)} texels long`],
        ['Out', `${clockText(s.day, s.night, s.dusk)}, ${range(s.temperature, ' C')}`],
        ['Pace', `${s.speed} m/s${s.skit > 0 ? `, runs from a click within ${s.skit} m` : ', ignores a click'}`],
        ...lifeFacts(LIVES.find((life) => life.key === s.key)!),
      ],
    })),
  );
}

export const LINK: PageLink = {
  slug: 'mammals',
  title: 'Mammals',
  summary: 'Moles to whales: herds, packs, prides, pods and families that breed, nurse, graze, hunt, dive, burrow and hibernate.',
};

export function build(): Page {
  const count = (form: Form[]): number => MAMMALS.filter((s) => form.includes(s.form as Form)).length;
  return {
    ...LINK,
    lede: `${MAMMALS.length} mammals complete the <a href="food-web.html">food web</a>: ${MAMMALS.filter((s) => s.realm === Realm.Sea || s.realm === Realm.Sea + Realm.Fresh).length} that live in the water (whales, dolphins, seals, manatees), ${MAMMALS.filter((s) => (s.traits & Trait.Burrow) !== 0 && s.gait === Gait.Burrow).length} that spend their lives underground and show only as a mound and a nose, bats, primates in the canopy, the predators and the grazers. They are populations like the birds, but they bear their young after a pregnancy, nurse them, and move in families, herds, packs and pods, so what the map shows is groups, with calves beside their mothers.`,
    code: ['src/sim/mammals/species.ts', 'src/sim/fauna/habitat/mammalHabitat.ts', 'src/sim/fauna/life.ts', 'src/render/lit/mammalPass.ts', 'src/render/lit/shaders/mammals.vert', 'src/render/lit/shaders/mammals.frag', 'tools/mammalPlates.js'],
    sections: [
      {
        id: 'compendium',
        title: 'The mammals',
        html: `<p>All ${MAMMALS.length} species, drawn by the same shader as on the map, standing on the left and moving on the right (${count([Form.Whale, Form.Dolphin, Form.Sirenian])} swimmers of the open water and ${count([Form.Bat])} bats among them), with how each lives and what the food web makes of it.</p>${mammalCards()}`,
      },
      {
        id: 'how',
        title: 'Reproduction, groups and what is drawn',
        html: `${flow([
          { title: 'Pregnancy', text: 'A mammal has no egg to leave, so the food web uses the egg stage as the womb: conception is limited by food and by the breeding season (the temperature range the species breeds in, so deer and bears calve in spring and summer), the unborn young cannot be eaten, and they are born after the real gestation (about 20 days for a mouse, 40 weeks for a deer, 22 months for an elephant) as newborns, which are the nursing stage. The monotremes, echidna and platypus, lay a real egg that can be eaten.' },
          { title: 'Nursing and growing', text: 'Newborns, juveniles and adults are stocks of their own. Newborns are the most hunted, weaned juveniles next, and an adult elephant or whale is almost safe. Litters are sized from the species: a mouse needs about seven young a litter to stay in balance, an elephant one every few years, and the numbers are worked out from lifespan, age at maturity and the share that survive to it.' },
          { title: 'Habitat', text: 'The same four numbers per tile as the birds: wood, forage, water and bank, but with other meanings on water (depth, plants, medium, shore). Two more, roughness and soil, are known only to the food web: ibex and pikas want rock, moles and marmots want diggable ground.' },
          { title: 'From counts to animals', text: `The food web keeps a count per patch. Around the camera (and the people) those counts are turned into real animals (<code>sim/animals/</code>): a patch has up to ${Math.max(...MAMMALS.map((s) => s.groups))} groups for a species, a group exists with the probability the patch's stock, the species' <code>sight</code> and the temperature and season trapezoids give it, and has a random size from one to the species' maximum (a herd of up to ${Math.max(...MAMMALS.map((s) => s.size))}). Calves and juveniles are in the share the food web keeps and in a family always follow their mother, so a herd with many calves means a recent birth season. Far from the camera nothing exists but the counts.` },
          { title: 'Where an animal is', text: 'Every animal has a position in the simulation, not in a shader. A group has a leader that walks on the CPU (<code>Walker</code>): when it is awake (the species\' own hours, from the daylight at its place) and its rest is over it picks a point up to 0.3 of its reach away, checks every half metre of the straight path against its own habitat so a land animal never crosses water and a whale never beaches, walks it at the species\' speed and rests. Cruising whales and dolphins never rest and turn gently. Followers walk the leader\'s path a moment later with a small offset. A click scares a group within its flight distance to a point farther away at 2.4 times its pace. The renderer only draws bodies at those positions and animates them from the distance walked, which is what lets people and predators find, follow and hunt a particular animal later.' },
        ])}
${callout('<p><b>A click is a scare.</b> Herds, packs and families flee together from a click inside their run distance (a gazelle at 26 m, a zebra at 24), the young beside the adults, and come back after about half a minute. Burrowers go underground and stay there.</p>')}`,
      },
      {
        id: 'catalogue',
        title: 'The species',
        html: `<p>The four tastes are, in order, <b>wood</b>, <b>forage</b>, <b>water</b> and <b>bank</b> (for the water species a second set, written in the code as <code>wet</code>, plays the same role over depth, plants, medium and shore). A body is drawn 3 texels plus 16 per metre of length: a mouse is 4 texels, an elephant 99, a blue whale 387.</p>${catalogue()}`,
      },
      {
        id: 'habitat',
        title: 'Habitat: four maps of the world',
        html: `<p>Built by <code>mammalHabitatAt</code> into an RGBA texture a band of sixteen rows a frame, by the same <code>HabitatTexture</code> as the reptiles and birds, with no smoothing.</p>${channelMaps()}`,
      },
      {
        id: 'clock',
        title: 'The clock: when each species is out',
        html: `${figure(curves((s, x) => trapezoid(s.temperature, x), [-60, 52], 'air temperature, C'), '<b>Temperature.</b> From the polar bear and the muskox to the camel and the fennec. A patch outside a species\' range empties as the food web kills what the cold or the heat reaches and the rest disperse.')}
${figure(curves((s, x) => activity(s, x), [0, 1], 'daylight, 0 night to 1 noon', [0, 0.25, 0.5, 0.75, 1]), '<b>Time of day.</b> Grazers and primates keep to the day, cats, hyenas and most small mammals to the night; deer, rabbits and foxes peak at dawn and dusk. A large animal that is not out lies down where it is; a small one is out of sight.')}
${figure(curves((s, x) => sheltering(s, x), [0, 0.5], 'wetness (rain or wet ground)', [0, 0.1, 0.2, 0.3, 0.4, 0.5], (s) => s.shy > 0.3), '<b>Rain.</b> Small shy mammals stay under cover when it rains; the big ones do not mind.')}
${figure(curves((s, x) => trapezoid(s.season, x), [0, 1], 'year, 0 is the first of March', [0, 0.25, 0.5, 0.75, 1], (s) => s.season[1] > 0.04), '<b>Hibernation.</b> Hedgehogs, hamsters, chipmunks, marmots, dormice, bats and bears are out only in the part of the year drawn here, and the stags carry antlers from spring to late autumn.')}`,
      },
      {
        id: 'world',
        title: 'Where they could live on this seed',
        html: `<p>Suitability times the climate for six species, from <code>abundance</code>, with nobody eating anybody. The animals actually kept are on the <a href="food-web.html">food web</a> page.</p>${abundanceMaps()}`,
      },
      {
        id: 'motion',
        title: 'How each mammal moves and looks',
        html: `<ul>
<li><b>Walks and trots</b> (grazers, cats, bears, elephants): moves a few metres at a time to a new spot inside its reach and stands, with the head lowered to graze; legs swing in a diagonal gait at a rate set by the distance covered, so they keep pace with the ground. A group follows its leader along the same path a moment later, so a pack trails in file and a herd is a loose crowd.</li>
<li><b>Hops and bounds</b> (rabbits, hares, kangaroos, jerboas; mice, squirrels, weasels): a hop is an arc, with the body lifted on the screen and the shadow left behind; the long-bodied ones undulate.</li>
<li><b>Swims</b> (beaver, otter, hippo, capybara, seals, sea otter): a swimmer is tinted and dithered where it is in the water, throws a wake ring, seals and polar bears also come ashore and lie on the bank.</li>
<li><b>Cruises and porpoises</b> (whales, dolphins, sea cows): follow a long smooth track at a steady pace, in lines or side by side for a pod. A whale blows now and then (a ring of spray at the blowhole) and is always drawn solid; dolphins leap in arcs and land in a splash ring; humpbacks and orcas breach. The body is a profile that tapers to a tail with swinging flukes, flippers and a dorsal fin.</li>
<li><b>Flies</b> (bats): erratic swarms at dusk, flapping wings, a shadow on the ground, over the canopy.</li>
<li><b>Burrows</b> (moles, mole-rats, gophers, marmots, prairie dogs, meerkats): a mound is always drawn where a group lives, and animals come out of it, go off a few metres and go back in. A mole is out for a few percent of the time. A sentinel stays by the mound upright and watches.</li>
<li><b>Climbs and glides</b> (squirrels, monkeys, apes, koalas, sloths, martens, leopards): drawn over the canopy; the gliding squirrels and sugar gliders spread a skin between their limbs.</li>
<li><b>Keeps away from hunters</b>: a prey animal that a nearby predator group could take (wolves, cats, hyenas, bears, wild dogs, orcas and the like) is pushed away so that it stays outside its own alarm distance, a herd with it, running with its head up while the hunter is close. The hunters do not chase back yet.</li>
<li><b>Carries young</b> (kangaroos and other marsupials, possums, anteaters, koalas, sloths): a small dot at the pouch or on the back when there are newborns in the patch.</li>
</ul>
<p>Every body is a distance field on the world's own texel grid, not a sprite. A four-legged body is a tapered torso, a neck that lengthens when grazing, a head, ears, four feet that swing with the stride, a tail that flicks, and the species' extras: antlers that branch, horns that curl, a rhino's nose horn, tusks, a trunk that sways, a mane or ruff, a camel's hump, quills, plates, stripes, spots, patches or a mask. Lit from the top-left in steps with an inked edge and a Bayer dither. Shadows fall under the props, never over water, and grow with height; bodies are sorted with the props by height, so a bush or a canopy covers a grazer behind it, and climbers and bats are held over everything. An awake animal is drawn at any zoom above 3, whatever its size.</p>`,
      },
    ],
  };
}
