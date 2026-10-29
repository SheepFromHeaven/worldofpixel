import { ECO_DAYS, Fish } from '../../../src/sim/fish/fish.ts';
import type { FishSpecies } from '../../../src/sim/fish/species.ts';
import { activityOf, FISH } from '../../../src/sim/fish/species.ts';
import { trapezoid } from '../../../src/sim/plants/niche.ts';
import { AQUA_NAMES } from '../../../src/sim/aquatic.ts';
import { world } from '../context.ts';
import { BIOME_RGB } from '../maps.ts';
import type { Page, PageLink } from '../page.ts';
import { callout, figure, flow, img, table } from '../page.ts';
import type { Rgb } from '../raster.ts';
import { hex, mix, renderMap } from '../raster.ts';
import { legend, lineChart, samples } from '../svg.ts';
import { clockText, compendium, fishFacts } from '../compendium.ts';

const PALETTE = ['#6aa84f', '#c9a23c', '#8a5c9a', '#3f6b7a', '#a8523a', '#5a7ac0', '#d0703c', '#2f8a72', '#7a4a2a', '#c25a8a'];

const colourOf = (id: number): string => PALETTE[id % PALETTE.length]!;

const range = (r: readonly number[], unit = ''): string => `${r[1]} to ${r[2]}${unit}`;

function catalogue(): string {
  const rows = FISH.map((f) => [
    f.name,
    f.water,
    `${Math.round(f.length * 100)} cm, ${f.mass} kg`,
    String(f.school),
    range(f.temperature, ' C'),
    range(f.depth, ' m'),
    f.water === 'fresh' ? range(f.flow, ' m/s') : '-',
    Object.keys(f.cover).map((k) => AQUA_NAMES[Number(k)]).join(', ') || '-',
    f.prey.join(', ') || '-',
    `${f.speed} m/s`,
    `${f.day} / ${f.night} / ${f.dusk}`,
    `${Math.round(f.dart.chance * 100)}% of every ${f.dart.period} s, ${f.dart.lengths} body lengths in ${f.dart.seconds} s`,
  ]);
  return table(['Fish', 'Water', 'Size', 'Per shoal', 'Temperature', 'Depth', 'Current', 'Likes', 'Eats', 'Cruises', 'Active day / night / dusk', 'Darts'], rows);
}

function curves(pick: 'temperature' | 'depth' | 'flow', water: FishSpecies['water'], domain: [number, number], label: string): string {
  const list = FISH.filter((f) => f.water === water);
  return (
    lineChart({
      width: 560,
      height: 250,
      x: { label, domain },
      y: { label: 'fitness', domain: [0, 1], ticks: [0, 0.5, 1] },
      series: list.map((f) => ({
        name: f.name,
        colour: colourOf(FISH.indexOf(f)),
        points: samples(domain[0], domain[1], 160, (x) => trapezoid(f[pick], x)),
      })),
      legend: false,
      label: `${label} fitness of ${water} fish`,
    }) + legend(list.map((f) => ({ name: f.name, colour: colourOf(FISH.indexOf(f)) })))
  );
}

function hours(water: FishSpecies['water']): string {
  const list = FISH.filter((f) => f.water === water);
  const label = 'daylight at the shoal, 0 night to 1 noon';
  return (
    lineChart({
      width: 560,
      height: 250,
      x: { label, domain: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1] },
      y: { label: 'activity', domain: [0, 1], ticks: [0, 0.5, 1] },
      series: list.map((f) => ({
        name: f.name,
        colour: colourOf(FISH.indexOf(f)),
        points: samples(0, 1, 160, (x) => activityOf(f, x)),
      })),
      legend: false,
      label: `Activity of ${water} fish through the day`,
    }) + legend(list.map((f) => ({ name: f.name, colour: colourOf(FISH.indexOf(f)) })))
  );
}

function shoalMap(fish: Fish): { map: string; legend: string } {
  const w = world();
  const { grid } = w;
  const STEP = 3;
  const columns = Math.ceil(grid.columns / STEP);
  const winner = new Uint8Array(columns * Math.ceil(grid.rows / STEP));
  const biggest = new Float32Array(winner.length);
  const { shoals } = fish;
  for (let i = 0; i < shoals.n; i += 1) {
    const id = shoals.species[i]!;
    if (id === 0) continue;
    const cell = Math.floor(grid.row(shoals.posY[i]!) / STEP) * columns + Math.floor(grid.column(shoals.posX[i]!) / STEP);
    const weight = shoals.size[i]! * FISH[id - 1]!.mass;
    if (weight > biggest[cell]!) {
      biggest[cell] = weight;
      winner[cell] = id;
    }
  }
  const map = renderMap('fish-shoals.png', {
    columns: grid.columns,
    rows: grid.rows,
    step: STEP,
    colourAt: (c, r) => {
      const cell = Math.floor(r / STEP) * columns + Math.floor(c / STEP);
      let id = winner[cell]!;
      for (const d of [-1, 1, -columns, columns]) if (id === 0) id = winner[cell + d] ?? 0;
      if (id !== 0) return hex(colourOf(id - 1));
      const ground = BIOME_RGB[w.biome[grid.at(c, r)]!] ?? ([200, 200, 200] as Rgb);
      return mix(ground, [244, 241, 234], 0.15);
    },
  });
  return { map, legend: legend(FISH.map((f, i) => ({ name: f.name, colour: colourOf(i) }))) };
}

function populationOverTime(fish: Fish, days: number): string {
  const env = { temperatureAt: (tile: number) => world().field.temperature[tile]!, daylightAt: () => 1 };
  const start = fish.totals();
  const series = FISH.map((f, i) => ({ name: f.name, colour: colourOf(i), points: [[0, 100]] as [number, number][] }));
  const ticks = Math.round(days / ECO_DAYS);
  for (let tick = 1; tick <= ticks; tick += 1) {
    fish.update(0, ECO_DAYS, env);
    if (tick % 10 === 0) {
      const now = fish.totals();
      series.forEach((s, i) => s.points.push([tick * ECO_DAYS, start[i]! > 0 ? (100 * now[i]!) / start[i]! : 0]));
    }
  }
  return (
    lineChart({
      width: 560,
      height: 280,
      x: { label: 'game days', domain: [0, days] },
      y: { label: '% of starting fish', domain: [0, 200], ticks: [0, 50, 100, 150, 200] },
      series,
      legend: false,
      label: 'Fish population of each species over game days',
    }) + legend(series.map((s) => ({ name: s.name, colour: s.colour })))
  );
}

function fishCards(): string {
  return compendium(FISH.map((f) => ({ key: f.key, name: f.name, facts: [['Active', clockText(f.day, f.night, f.dusk)], ...fishFacts(f)] })));
}

export const LINK: PageLink = {
  slug: 'fish',
  title: 'Fish',
  summary: 'Shoals in rivers, lakes and the sea: what they need, where they swim, what they eat, and how they are drawn.',
};

export function build(): Page {
  const fish = new Fish(world(), 20250214);
  const env = { temperatureAt: (tile: number) => world().field.temperature[tile]!, daylightAt: () => 1 };
  fish.populate(env);
  const { map, legend: key } = shoalMap(fish);
  const overTime = populationOverTime(fish, 20);

  return {
    ...LINK,
    lede: `Fish are not placed one at a time. The unit is the <b>shoal</b>: a position, a heading, a species and a headcount. A world holds a few thousand of them, each one swims where its species can live, eats what it can catch, grows toward what the water can feed and splits when it gets too big. ${FISH.length} species live in rivers, lakes and the sea. On screen each shoal is drawn as a handful of dark shadows moving under the surface.`,
    code: ['src/sim/fish/', 'src/render/lit/fishPass.ts', 'src/render/lit/fishInstances.ts', 'src/render/lit/shaders/fish.vert'],
    sections: [
      {
        id: 'compendium',
        title: 'The fish',
        html: `<p>The ten fish of the rivers, lakes and seas, with where each can live, what it eats and what eats it. On the map each is a handful of dark shadows under the water; the pictures here are the fish seen from above.</p>${fishCards()}`,
      },
      {
        id: 'how',
        title: 'How a shoal lives',
        html: `${flow([
          { title: 'Water', text: 'Every water tile knows its depth, its distance from land, its current and the water plants beside it (<code>World.depth</code>, <code>shore</code>, <code>flow</code>, <code>aqua</code>).' },
          { title: 'Fitness', text: 'A species scores a tile from 0 to 1: temperature, depth, current and shore distance multiply, plants it likes raise it.' },
          { title: 'Swim', text: 'Every second or so a shoal looks at nine directions a few tiles ahead and eases round toward the best one at under half a radian a second, over a spread of about plus or minus one radian, so a shoal swims in long gentle arcs rather than turning on the spot. It never enters a tile it cannot live in. How fast it swims depends on the local time: each species has an activity by day, by night and a bonus at dusk and dawn (<code>activityOf</code>, never below 0.1), minnows and perch rest at night while carp, cod, flatfish and herring are most active in the dark and pike and trout peak at dusk, and a resting shoal drifts slowly, darts less, weaves less and its shadow is fainter.' },
          { title: 'Eat', text: 'A predator takes a share of the prey shoals within 14 tiles. A shoal that cannot find food grows slower, and starves below a threshold.' },
          { title: 'Grow', text: 'Logistic growth toward a carrying capacity of <code>school size &times; fitness</code> of the tile it sits on. Over 1.7 times a full school it splits in two.' },
          { title: 'Drawn', text: 'Seen from above, a shoal is a few dark fish shapes under the surface, or a dithered patch when you are far out.' },
          { title: 'Shapes and behaviour', text: 'Each species is a model on the animal system (<code>src/animals/&lt;fish&gt;/</code>, the <code>fish</code> group, one archetype <code>archetypes/fish.ts</code> patched by body width, tail span and fork and fin size): a head, a body that ripples, a peduncle and a tail fin that beat, and pectoral fins, seen straight from above (<code>view: \'above\'</code>) and drawn as a shadow, so a pike is long and narrow, a carp stocky, a flatfish a wide disc, a tuna a fast fork-tailed torpedo and a herring a slim forked one. The shadow is faint and pixel-sized: it is drawn on the texel grid, soft over about two texels, so from a couple of metres away it reads as a shape swimming rather than a fish with fins; far out it is still the dithered patch. Behaviour is three numbers a species: the tail beat in hertz, how much of the time it hangs still (<code>still</code>: a pike lies in wait, a flatfish lies on the bottom, a tuna never stops) and how tightly it keeps its school (<code>tight</code>: herring and mackerel pack close, tuna and pike spread out), on top of the darts, the activity by hour and the speed it already had.' },
        ])}
<p><b>Data.</b> A shoal is a row of typed arrays (<code>Shoals</code>: position, heading, species, headcount, depth) so the worker can send the whole fleet to the page cheaply. The page interpolates between updates. Fish are saved nowhere yet, so they are regenerated from the seed when a game loads.</p>
${callout('<p><b>Rare things stay rare.</b> Each species has a <code>common</code> weight and a start only places a shoal where fitness &times; commonness beats a roll. Tuna and pike are a hundredth as many as herring and minnow, because a predator that outweighs its prey eats them out of the water. A few strays also arrive from nowhere every ecology step (<code>recolonise</code>) so a species that dies out in one lake can come back.</p>')}`,
      },
      {
        id: 'catalogue',
        title: 'The species',
        html: `<p>Ranges are the plateau of the niche (fitness 1). Fish are not drawn at their real size: a shadow is 1.3 times the fish, and never under 16 cm, so a minnow still reads at the zoom where you can see the bottom.</p>${catalogue()}`,
      },
      {
        id: 'niche',
        title: 'Where each species can live',
        html: `${figure(curves('temperature', 'fresh', [-2, 34], 'water temperature, C'), '<b>Fresh water, temperature.</b> Trout need cold, carp and pike warm. A river that warms in summer pushes trout out.', true)}
${figure(curves('temperature', 'salt', [-4, 34], 'water temperature, C'), '<b>Sea, temperature.</b> Cod hold the cold coasts, tuna the warm open sea, herring the cool middle.', true)}
${figure(curves('depth', 'salt', [0, 26], 'depth, m'), '<b>Sea, depth.</b> Flatfish live on the shallow shelf, herring and mackerel in the upper water, cod and tuna deeper. The shelf is only 26 m deep at most, because the water model caps it.', true)}
${figure(curves('flow', 'fresh', [0, 2.4], 'current, m/s'), '<b>Rivers, current.</b> Trout want moving water, carp and pike want it still. Minnow tolerate both, which is why they are everywhere.', true)}
<p>Water temperature is 70% the tile's annual mean and 30% the air at the moment, so a hard winter or a hot summer moves the fish. Shore distance matters to open-water species: tuna stay at least a few tiles off the coast.</p>`,
      },
      {
        id: 'hours',
        title: 'When each species is active',
        html: `${figure(hours('fresh'), '<b>Fresh water, through the day.</b> Minnow and perch work the daylight and rest at night. Carp feed more as it darkens, and pike and trout rise at dawn and dusk, when the line dips and lifts again.', true)}
${figure(hours('salt'), '<b>Sea, through the day.</b> Mackerel and tuna are day hunters. Herring, cod and flatfish are most active in the dark, rising to feed or hunting the bottom.', true)}
<p>Activity (<code>activityOf</code>) is the species' <code>night</code> value blended into its <code>day</code> value by the local daylight, plus <code>dusk</code> &times; 4 &times; daylight &times; (1 &minus; daylight), which peaks in the half-light, and never falls below 0.1. The daylight is that of the shoal's own place on the map (the same per-place light the insects and people use), refreshed each time it re-aims. It scales how far a shoal drifts, and, when drawn, how often its fish dart, how wide they weave and how strong their shadow is, so a resting shoal hangs almost still and faint while a night feeder is lively in the dark.</p>`,
      },
      {
        id: 'world',
        title: 'Where the shoals are on this seed',
        html: `${figure(img(map, 'The biggest shoal in each 3 by 3 tile cell'), '<b>Shoals on the map.</b> Each dot is the heaviest shoal in a patch of 9 tiles, coloured by species. Rivers and lakes are too small to see at this scale; zoom into any water in the game.', true)}${key}`,
      },
      {
        id: 'ecology',
        title: 'Predators, prey and growth',
        html: `${figure(overTime, '<b>Twenty game days of ecology</b>, with shoals held roughly where they start. Each line is a species as a share of its starting number. A line that falls and flattens has found what its water can carry.', true)}
<p>A predator is hungry in proportion to its mass and eats at most 8% of any one prey shoal per step, so a shoal is cropped, never wiped out in a step. What it cannot catch it makes up from insects and plankton down to half its need (<code>FORAGE_FLOOR</code>), so the pyramid of a few big fish over a lot of small ones holds. Below 40% fed a predator starves.</p>
<p>An <b>ecology step</b> runs every ${ECO_DAYS} game days, about a minute and a quarter at 1x. Swimming runs every frame.</p>`,
      },
      {
        id: 'young',
        title: 'Eggs, fry, and the rest of the web',
        html: `<p>A shoal also carries <b>eggs</b> and <b>fry</b>. When the water is in the species' spawning range the shoal lays eggs, in proportion to the growth it would have had, with enough over to cover what is lost on the way (about a fifth of eggs become adults when nothing special eats them). Eggs hatch in a fraction of a generation, fry grow up over a longer one and then join the adults, and fry are a small prey (a twentieth of an adult's mass) that the hunting fish take along with the shoal. Nothing in a shoal that has no eggs left can be replaced, so a shoal overfished in one step recovers on a slower clock than before.</p>
<p>Fish are now part of the same <a href="food-web.html">food web</a> as the insects, amphibians and reptiles. Perch, trout and minnows take tadpoles, frog spawn and insect larvae from the water of their patch, carp take larvae and spawn (never more than a quarter of what is there in a step, so a pond is never emptied), and a lizard, snake, turtle or crocodile that eats fish takes a share of the shoals of its patch. The visible shoals are a sample of the fish in the water around them, so what a reptile eats is scaled up by 25 from what a shoal then loses. A shoal's food shortage can be the lack of insects, and insects are fewer where the frogs are many.</p>`,
      },
      {
        id: 'draw',
        title: 'How they are drawn',
        html: `<p><b>Fish glide and dart.</b> A shoal drifts at <code>GLIDE</code> (0.45) of the species' cruise speed, so most of the time fish hang in the water. On top of that each fish has its own darts: in every <code>period</code> a fish rolls <code>chance</code> to bolt in a random direction for several body lengths in a fraction of a second, then eases back toward the shoal over a few seconds, and its tail beats harder while it does. A minnow darts every few seconds, a carp rarely and lazily, a pike mostly lies still and a tuna makes long runs. Everything is a function of the clock, so the page needs no per-fish state, and heading is the direction a fish is actually going.</p>
<p>The fish pass (<code>FishPass</code>) runs after the water pass and before the grade pass, so night darkens the shadows with everything else. The CPU turns every shoal in view into one to fourteen fish (<code>fishInstances</code>): each fish weaving on its own phase around the shoal's centre and turned along its own direction of travel, so a shoal that turns never swings sideways. Far out (strip zoom under 4.5) a shoal is one dithered blob instead. The fish shape is a signed distance in the fragment shader, a long, slim fish seen from above (a tapered body about a fifth as wide as it is long, a narrow wrist and a forked tail fin) whose whole body undulates with a travelling wave (stronger toward the tail and with speed) and which bends into a turn (each fish faces along its path over the half second either side of now, and its body is drawn as an arc whose curvature is how far that path turns divided by the distance it covers while turning, so a fish bows round a corner, head and tail both swinging to the inside, instead of spinning rigidly on the spot), so there is no sprite sheet; its edge is not drawn hard but fades over a few hundredths of a body width through the Bayer dither (density 0.8 at the core, 0 a little outside the outline), so the shadow reads as something seen through water.</p>
<p>A fish is only drawn on pixels the ground painter coloured as water, so a shoal near a shore never puts a shadow on the bank. Deep water fades the shadow (to 20% at 20 m), the day fades it (30% at night), and ice over a frozen lake hides it.</p>`,
      },
    ],
  };
}
