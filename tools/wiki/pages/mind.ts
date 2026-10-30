import type { Places } from '../../../src/sim/mind/growth.ts';
import { BRAIN_RADIUS, GROWTH_STEP, ROOT_RADIUS, SPACING, grow } from '../../../src/sim/mind/growth.ts';
import { MIN_CURIOUS, WEARY_RECOVERY, WITHER_COST } from '../../../src/sim/mind/mind.ts';
import { GOALS, NEURONS, NEURON_COUNT, RECIPES, chainOf, isRoot, neuronIndex, neuronOf, parentsOf } from '../../../src/sim/mind/neurons.ts';
import { ITEM_NAMES } from '../../../src/sim/people/items.ts';
import { openingSpot } from '../../../src/sim/simulation.ts';
import { StageSim } from '../../../src/sim/stageSim.ts';
import { scatterStarterItems } from '../../../src/sim/people/starter.ts';
import { prng } from '../../../src/sim/rng.ts';
import { world } from '../context.ts';
import type { Page, PageLink } from '../page.ts';
import { callout, figure, flow, img, SERIES, table } from '../page.ts';
import { lineChart } from '../svg.ts';

export const LINK: PageLink = {
  slug: 'mind',
  title: 'The mind',
  summary: 'Discovery as a brain that grows: what people have met, the dark cells it hints at, the fibres the player attaches, and the recipes that come out.',
};

const FIBRES: readonly (readonly [number, string, string])[] = [
  [20, 'spark', 'flint'],
  [24, 'spark', 'stone'],
  [28, 'spark', 'flint'],
  [60, 'sharp', 'flint'],
  [64, 'sharp', 'stone'],
  [100, 'ember', 'branch'],
  [104, 'ember', 'stone'],
  [108, 'ember', 'spark'],
  [112, 'ember', 'kindling'],
  [180, 'flame', 'ember'],
  [184, 'flame', 'branch'],
];

const SECONDS = 520;

interface Run {
  times: number[];
  held: number[];
  log: string[];
  open: number[];
  weariness: number[];
}

function simulate(): Run {
  const w = world();
  const spot = openingSpot(w);
  const at = w.grid.atPoint(spot);
  const humans = [0, 1].map((person) => {
    const centre = w.grid.centre(at);
    return { at: { x: centre.x + person * 1.2, y: centre.y }, heading: person * Math.PI };
  });
  const sim = new StageSim(w, humans);
  scatterStarterItems(w, at, prng(w.seed ^ 0x57a7));
  const run: Run = { times: [], held: [], log: [], open: [], weariness: [] };
  const queue = [...FIBRES];
  let clock = 0;

  while (clock < SECONDS) {
    sim.advance(0.1);
    clock += 0.1;
    const next = queue[0];
    if (next && clock >= next[0]) {
      const cell = neuronIndex(next[1]);
      const parent = neuronIndex(next[2]);
      if (sim.mind.stepOf(cell) !== 0 && sim.mind.knows(parent) && sim.mind.mindful()) {
        queue.shift();
        const refused = sim.mind.attach(cell, parent);
        run.log.push(`${Math.round(clock)} s: ${next[2]} to ${next[1]}, ${refused ?? 'attached'}`);
      }
    }
    if (Math.round(clock * 10) % 50 === 0) {
      run.times.push(clock);
      let held = 0;
      for (let neuron = 0; neuron < NEURON_COUNT; neuron += 1) if (sim.mind.knows(neuron)) held += 1;
      run.held.push(held);
      run.open.push(sim.mind.open().length);
      run.weariness.push(sim.mind.weariness);
    }
  }
  return run;
}

const KIND = ['thing', 'happening'];

const EARNED: Record<string, string> = {
  flint: 'seen lying within 7 tiles, or held',
  stone: 'seen lying within 7 tiles, or held',
  kindling: 'seen lying within 7 tiles, or held',
  branch: 'seen lying within 7 tiles, or held',
  spark: 'flint + flint',
  ember: 'spark + kindling',
  flame: 'ember + branch, or a burning branch seen',
  sharp: 'flint + stone',
  fibre: 'seen lying within 7 tiles, or held',
  binding: 'branch + plant fibre',
  tool: 'sharp edge + binding, or a hand axe seen',
  berries: 'seen lying within 7 tiles, or held',
  grubs: 'seen lying within 7 tiles, or held',
  egg: 'seen lying within 7 tiles, or held',
  cord: 'plant fibre + plant fibre',
  basket: 'cord + plant fibre',
  cooked: 'flame + egg',
  frame: 'branch + branch',
  bed: 'frame + plant fibre',
  shelter: 'frame + cord',
  hut: 'shelter + plant fibre',
  fish: 'seen lying within 7 tiles, or held',
  rabbit: 'seen lying within 7 tiles, or held',
  spear: 'sharp edge + branch',
  snare: 'cord + branch',
};

function neuronTable(): string {
  return table(
    ['neuron', 'kind', 'how it is earned'],
    NEURONS.map((neuron) => [neuron.label, KIND[neuron.kind]!, EARNED[neuron.id] ?? '']),
  );
}

function recipeTable(): string {
  const items = (kinds: readonly number[]): string => (kinds.length === 0 ? 'nothing' : kinds.map((kind) => ITEM_NAMES[kind] ?? 'item').join(', '));
  return table(
    ['parents', 'result', 'used up', 'made', 'carried out as'],
    RECIPES.map((recipe) => {
      const chain = chainOf(recipe.parents.map(neuronIndex), recipe);
      return [
        recipe.parents.join(' + '),
        neuronOf(neuronIndex(recipe.result)).label,
        items([...chain.spend].filter(([, count]) => count > 0).map(([kind]) => kind)),
        items(chain.make),
        recipe.order ? `order <b>${recipe.order}</b>` : recipe.result === 'flame' ? 'order <b>Kindle Campfire</b>' : 'a step of a longer chain',
      ];
    }),
  );
}

function grownBrain(seed: number): Places {
  const places: Places = new Map();
  const known = new Set<number>();
  const has = (neuron: number): boolean => known.has(neuron);
  const wanted = (neuron: number): boolean => has(neuron) || (!isRoot(neuron) && parentsOf(neuron).some(has));
  for (let neuron = 0; neuron < NEURON_COUNT; neuron += 1) {
    known.add(neuron);
    grow(places, wanted, seed);
  }
  return places;
}

function treeFigure(seed: number): string {
  const size = 440;
  const centre = size / 2;
  const scale = (size / 2 - 30) / BRAIN_RADIUS;
  const places = grownBrain(seed);
  const spot = (index: number): { x: number; y: number } => {
    const place = places.get(index) ?? { x: 0, y: 0 };
    return { x: centre + place.x * scale, y: centre + place.y * scale };
  };
  const edges = RECIPES.map((recipe) => {
    const to = spot(neuronIndex(recipe.result));
    const parents = recipe.parents.map((parent) => spot(neuronIndex(parent)));
    const joint = { x: to.x + (parents.reduce((sum, at) => sum + at.x, 0) / parents.length - to.x) * 0.4, y: to.y + (parents.reduce((sum, at) => sum + at.y, 0) / parents.length - to.y) * 0.4 };
    const legs = parents.map((from, leg) => `<path d="M${from.x} ${from.y} Q${(from.x + joint.x) / 2 + (leg === 0 ? -8 : 8)} ${(from.y + joint.y) / 2} ${joint.x} ${joint.y}" fill="none" stroke="${SERIES.blue}" stroke-width="1.5"/>`);
    return `${legs.join('')}<line x1="${joint.x}" y1="${joint.y}" x2="${to.x}" y2="${to.y}" stroke="${SERIES.blue}" stroke-width="2.5"/><circle cx="${joint.x}" cy="${joint.y}" r="3" fill="${SERIES.blue}"/>`;
  });
  const nodes = NEURONS.map((neuron, index) => {
    const { x, y } = spot(index);
    const thing = isRoot(index);
    return `<circle cx="${x}" cy="${y}" r="10" fill="${thing ? '#9ec5ee' : GOALS.includes(neuron.id) ? '#2f7bff' : '#6a86b4'}" stroke="#16408f" stroke-width="2"/><text x="${x}" y="${y + 22}" text-anchor="middle" class="tick">${neuron.label}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${size} ${size}" role="img" aria-label="A grown brain"><circle cx="${centre}" cy="${centre}" r="8" fill="#16408f"/>${edges.join('')}${nodes.join('')}</svg>`;
}

function runFigure(run: Run): string {
  return lineChart({
    x: { label: 'seconds', domain: [0, SECONDS], ticks: [0, 100, 200, 300, 400, 500] },
    y: { label: 'neurons known', domain: [0, NEURON_COUNT], ticks: [0, 2, 4, 6, 8, 10] },
    verticals: FIBRES.map(([at]) => ({ at })),
    series: [
      { name: 'neurons known', colour: SERIES.blue, points: run.times.map((time, at) => [time, run.held[at]!] as [number, number]) },
      { name: 'cells being tried', colour: SERIES.green, points: run.times.map((time, at) => [time, run.open[at]!] as [number, number]) },
      { name: 'weariness x10', colour: SERIES.grey, points: run.times.map((time, at) => [time, run.weariness[at]! * 10] as [number, number]), dashed: true },
    ],
    label: 'Neurons the group knows over a scripted run',
  });
}

export function build(): Page {
  const run = simulate();
  const seed = world().seed;
  return {
    ...LINK,
    lede: 'A discovery is the player\'s deduction, not the player\'s chores. The people carry what they have met as neurons in one brain. Round what is known sit dark cells, things that could be found, with no name and no fibres. The player focuses a cell and attaches known neurons to it one fibre at a time: a real parent sticks, anything else withers and tires the mind. When the last socket fills, the most curious person goes and does it.',
    sections: [
      {
        id: 'neurons',
        title: 'Neurons are earned by living',
        html: `<p>A neuron is something the group has met. Seeing a flint lying within 7 tiles (<code>NOTICE_TILES</code>) or holding it lights <code>flint</code>, and nothing is in the mind that the world did not put there. There are <b>things</b> (flint, stone, kindling, branch, each tied to an <code>ItemType</code>) and <b>happenings</b> (spark, ember, flame and the rest, results that nobody can pick up). Knowledge belongs to the group (<code>Mind.known</code>, one byte per neuron): the first person to meet or work something out gets a <code>!</code> over their head, and from then on everyone has it. The player sees one brain and never has to ask who knows what.</p>${neuronTable()}${callout('<b>Adding a neuron</b> is a row in <code>NEURONS</code> and one 16 by 16 coin in <code>pixel/ui/neurons.ts</code>. Adding a recipe is a row in <code>RECIPES</code> with any number of <code>parents</code> (a parent may appear twice): the items it uses up and makes are data, and the chain of things it needs is worked out from the recipes below it (<code>chainOf</code>). Every recipe makes something that is used; a result that leads nowhere is noise and is not in the table.')}`,
      },
      {
        id: 'grown',
        title: 'The brain grows',
        html: `<p>A neuron has no place until it needs one, and then it keeps it (<code>sim/mind/growth.ts</code>, <code>Mind.places</code>, saved). A root, a thing met in the world, takes a place ${ROOT_RADIUS} pixels from the core in the widest free gap between the roots already there. Every other neuron takes its place when it first shows as a dark cell: ${GROWTH_STEP} pixels further out than the middle of its known parents, with a little jitter from the world's seed, then turned round the core and pushed outward until nothing is closer than ${SPACING} pixels, never more than ${BRAIN_RADIUS} out. There are no rings and no sectors, so two games on one seed grow different brains, and a fibre that crosses from one field into another is part of the picture.</p>${figure(treeFigure(seed), '<b>A brain grown in the order of the table</b>, every neuron known. Each recipe is one join: a fibre from each parent to a synapse set back from the result, and one axon into it. Pale circles are things, dark the happenings, bright blue a goal. <code>/research</code> grows the same brain in the game\'s own pixels from any order of discovery, step by step.', true)}${recipeTable()}<p>The first success of <b>flame</b> is the fire milestone and sets <code>hasDiscoveredFire</code>, the first <b>stone tool</b> sets <code>hasDiscoveredFlintKnapping</code>, so the world opens through what the people worked out and not through a button. Proven, a chain becomes an order: <b>Kindle Campfire</b> plans a campfire (<code>Blueprint.Kindle</code>) and <b>Knap Hand Axe</b> is worked at a knapping floor, which only appears among the buildings once the stone tool is proven.</p>`,
      },
      {
        id: 'cells',
        title: 'Dark cells',
        html: `<p>A recipe whose result nobody knows sits in the brain as a <b>dark cell</b> once someone knows at least one of its parents (<code>stepOf</code>): a <b>glimmer</b> with one parent known, a <b>shape</b> with more, and a slow <b>heartbeat</b> once every parent is known by someone. Round its body are empty sockets, one for each parent, which give the count and nothing about which. A cell never shows a name, an icon or its fibres, and hovering a neuron never lights it. When a cell first beats the brain button says <b>a new idea is forming</b>, and a click opens the brain focused on it.</p>`,
      },
      {
        id: 'fibres',
        title: 'Working on a cell',
        html: `<p>A click on a cell focuses it: the brain dims, and the known neurons that could still feed it stay lit, while those that already withered on it are crossed off. The player drags from a known neuron to the cell, a fibre growing behind the pointer, and lets go on it (<code>attach</code>). A real parent fills a socket and stays (<code>Cell.attached</code>, saved). <b>Anything else withers on the spot</b> (<code>Cell.withered</code>), and costs the group <code>WITHER_COST</code> ${WITHER_COST} of its curiosity. Weariness comes back at <code>WEARY_RECOVERY</code> ${WEARY_RECOVERY} a second times the group's comfort, and while nobody's curiosity is over ${MIN_CURIOUS} no fibre can be drawn and nobody tries anything.</p>${flow([
          { title: 'Whole', text: 'The last socket fills and the cell becomes work for the group. It cannot fail now: the guessing was the attaching.' },
          { title: 'Who', text: 'Anyone free with no critical need and enough curiosity. The most curious takes it.' },
          { title: 'Fetch', text: 'The leaves of the chain are the needs: they carry each item, one at a time, to a work tile. No flint in reach and the cell waits, with the reason in the list.' },
          { title: 'Try', text: 'They kneel for 3.4 s, striking. What the chain uses up is removed, what it makes is laid down, and the cell lights up.' },
          { title: 'Learn', text: 'The group learns the result at once, and the person who did it gets the <code>!</code>.' },
        ])}`,
      },
      {
        id: 'shelter',
        title: 'Beds and huts',
        html: `<p>Proving <b>bed</b> adds <code>Bed</code> under <code>Erect</code> on the action wheel and proving <b>hut</b> adds <code>Hut</code>. Each is a plan like the campfire's: a builder carries the materials to the tile (a bed is 2 branches and 3 plant fibre, a hut 5 branches, 1 cord and 4 plant fibre) and the building rises when the last one is down. A bed is a tile a person can step on, a hut is a wall and is slept beside, and either can be taken down again.</p><p>A tired person (over 0.6) with a bed or hut within 40 tiles walks to the nearest one nobody else has taken, with or without a fire. Asleep, tiredness falls 1.5 times as fast on a bed and 2.2 times as fast beside a hut (on top of the 3 times of sleeping at all), and the body loses heat at 0.75 and 0.35 of the usual rate. Branches and fibre are no longer only the starter scatter: every 18 s, while fewer than 10 of one lie about, one appears beside a tree or fallen trunk (branch) or beside grass, bush or scrub (fibre) within reach of a person.</p>`,
      },
      {
        id: 'game',
        title: 'Fish and rabbits',
        html: `<p>Proving <b>spear</b> (sharp edge + branch) adds <code>Go Fishing</code> / <code>Stop Fishing</code> under <code>Orders</code>, and proving <b>snare</b> (cord + branch) adds <code>Snare</code> under <code>Erect</code>. Both need an ordinary storage for the catch.</p><p>An angler walks to the nearest fresh shore, stands 12 s and casts three times; a cast takes one fish from the nearest shoal within 6 tiles (<code>Fish.take</code>, one fish off that shoal's headcount, so the pond really holds fewer) and the fish is carried to a storage. A snare is a building plan of 1 branch and 1 cord. Every 20 s each empty snare catches a rabbit with probability <code>1 - exp(-0.3 x adults)</code>, where adults is the rabbit stock of the 16 tile food-web patch it stands in, and that adult is taken out of the stock (<code>Snares</code>). The rabbit lies on the snare until someone hauls or eats it. Fish (190 kcal) and rabbit (280 kcal) are food like berries, and the <code>Roast Food</code> order roasts them as well as eggs and grubs (a roast is 320 kcal).</p>`,
      },
      {
        id: 'curiosity',
        title: 'Curiosity',
        html: `<p>Every person has a curiosity trait rolled from the seed (0.45 to 0.95), which only decides who takes a job. What counts is <code>curiosity x comfort x (1 - weariness)</code>, where comfort is 0 if they are hungry or thirsty over 0.8, tired over 0.85 or cold, and otherwise 0.25 plus 0.75 of how fed, watered and rested they are, and weariness is what withered fibres cost the group. A comfortable group researches and a group in trouble survives first, and guessing every neuron in turn is possible but slow. The mind is asked after drinking, eating, sleeping and feeding the fire, so curiosity never beats a need. A tryer who stops is released, and the cell waits <code>RETRY_SECONDS</code> 25 for the next most curious.</p>`,
      },
      {
        id: 'run',
        title: 'A scripted run',
        html: `${figure(runFigure(run), `<b>A scripted run on the opening ground.</b> Two people, the starter items, and a player who attaches ${FIBRES.length} fibres at the dotted lines, some of them wrong (${run.log.join('; ')}). Each wrong fibre lifts the weariness, which the group's comfort wears down again.`, true)}`,
      },
      {
        id: 'screen',
        title: 'On the screen',
        html: `<p>A brain button beside the day dial counts the ideas being carried out, glows when a neuron is learned, and carries <b>a new idea is forming</b> beside it when a cell starts to beat. It opens the brain: neurons as coins in dendrite-ringed cells, joins whose pulses run toward their sources, dark cells with their sockets, and Hovering a neuron lights its lineage and dims the rest to 0.16. Under it a list says who is doing what and clicking a line moves the camera there, and the proven recipes. In the world a person carrying an idea has a <code>?</code> over their head. The same panel is on the zoo's toolbar (the brain), which gives the placed humans a real <code>Mind</code>.</p>${img('img/mind-panel.png', 'The mind panel', 420)}`,
      },
    ],
    code: ['src/sim/mind/neurons.ts', 'src/sim/mind/growth.ts', 'src/sim/mind/mind.ts', 'src/sim/people/people.ts', 'src/ui/MindPanel.tsx', 'src/ui/mindArt.ts', 'src/pixel/ui/neurons.ts'],
  };
}
