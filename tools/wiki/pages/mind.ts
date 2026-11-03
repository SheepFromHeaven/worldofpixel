import { MIN_CURIOUS, QUEUE_LIMIT, WEARY_RECOVERY, WITHER_COST } from '../../../src/modules/mind/api.ts';
import { NEURONS, NEURON_COUNT, RECIPES, chainOf, neuronIndex, neuronOf } from '../../../src/modules/mind/api.ts';
import { ITEM_NAMES } from '../../../src/modules/items/api.ts';
import { openingSpot } from '../../../src/sim/simulation.ts';
import { StageSim } from '../../../src/sim/stageSim.ts';
import { scatterStarterItems } from '../../../src/modules/people/api.ts';
import { prng } from '../../../src/sim/rng.ts';
import { world } from '../context.ts';
import type { Page, PageLink } from '../page.ts';
import { callout, figure, flow, img, SERIES, table } from '../page.ts';
import { lineChart } from '../svg.ts';

export const LINK: PageLink = {
  slug: 'mind',
  title: 'The mind',
  summary: 'Discovery as one idea in the middle of the mind: what people have met orbits it, the player picks neurons into it, and a whole idea is carried out.',
};

const FIBRES: readonly (readonly [number, string, string])[] = [
  [20, 'spark', 'flint'],
  [24, 'spark', 'berries'],
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
      if (!sim.mind.knows(cell) && sim.mind.knows(parent) && sim.mind.mindful()) {
        queue.shift();
        const refused = sim.mind.pick(parent);
        run.log.push(`${Math.round(clock)} s: ${next[2]} into the idea, ${refused ?? 'connected'}`);
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
  kindling: 'dry plant fibre, seen lying within 7 tiles, or held',
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

function runFigure(run: Run): string {
  return lineChart({
    x: { label: 'seconds', domain: [0, SECONDS], ticks: [0, 100, 200, 300, 400, 500] },
    y: { label: 'neurons known', domain: [0, NEURON_COUNT], ticks: [0, 2, 4, 6, 8, 10] },
    verticals: FIBRES.map(([at]) => ({ at })),
    series: [
      { name: 'neurons known', colour: SERIES.blue, points: run.times.map((time, at) => [time, run.held[at]!] as [number, number]) },
      { name: 'ideas being tried', colour: SERIES.green, points: run.times.map((time, at) => [time, run.open[at]!] as [number, number]) },
      { name: 'weariness x10', colour: SERIES.grey, points: run.times.map((time, at) => [time, run.weariness[at]! * 10] as [number, number]), dashed: true },
    ],
    label: 'Neurons the group knows over a scripted run',
  });
}

export function build(): Page {
  const run = simulate();
  return {
    ...LINK,
    lede: 'A discovery is the player\'s deduction, not the player\'s chores. The people carry what they have met as neurons, and in the middle of the mind sits one empty idea that beats. The player picks neurons into it one click at a time: a neuron that belongs to something still to be found floats in and connects, anything else withers and tires the mind. When the idea is whole, the most curious person goes and does it, and a fresh empty idea takes its place.',
    sections: [
      {
        id: 'neurons',
        title: 'Neurons are earned by living',
        html: `<p>A neuron is something the group has met. Seeing a flint lying within 7 tiles (<code>NOTICE_TILES</code>) or holding it lights <code>flint</code>, and nothing is in the mind that the world did not put there. There are <b>things</b> (flint, stone, dry fibre, branch, each tied to an <code>ItemType</code>) and <b>happenings</b> (spark, ember, flame and the rest, results that nobody can pick up). Knowledge belongs to the group (<code>Mind.known</code>, one byte per neuron): the first person to meet or work something out gets a <code>!</code> over their head, and from then on everyone has it. The player sees one brain and never has to ask who knows what.</p>${neuronTable()}${callout('<b>Adding a neuron</b> is a row in <code>NEURONS</code> and one 16 by 16 coin in <code>pixel/ui/neurons.ts</code>. Adding a recipe is a row in <code>RECIPES</code> with any number of <code>parents</code> (a parent may appear twice): the items it uses up and makes are data, and the chain of things it needs is worked out from the recipes below it (<code>chainOf</code>). Every recipe makes something that is used; a result that leads nowhere is noise and is not in the table.')}`,
      },
      {
        id: 'regions',
        title: 'Areas of the mind',
        html: `<p>The mind opens on a brain in profile (<code>BrainView</code>, <code>src/ui/mindBrain.ts</code>), cut into areas (<code>REGIONS</code>, <code>content/research/regions.ts</code>: survival, community, making, wonder, memory). An area is deliberately general, it says <i>where</i> to think and not <i>what</i> will be found, so it hints at no recipe. Every neuron belongs to one (<code>ResearchDef.region</code>, default <code>survival</code>, set with <code>inRegion</code> in a research file, <code>Neuron.region</code>). An area is dark until it is <b>open</b>: survival always is, any other once one of its neurons is known. Hovering names the area and counts what is known and what waits to be worked out, an open area with a recipe ripe in it pulses, and clicking an open one zooms into it: the brain scales up about that area and fades while the orbit fades in from small (<code>.se-mind-layer</code>). The orbit then holds only that area's neurons, plus the known parents of its ripe recipes so a combination may reach across areas; the <b>brain</b> button zooms back out and lets go of an unfinished idea. Search will be a field over the brain that lights the area and the neuron.</p>`,
      },
      {
        id: 'idea',
        title: 'One idea in the middle',
        html: `<p>There are no dark cells and no grown brain. The mind is one <b>idea</b> (<code>Mind.idea</code>, saved: the neurons <code>attached</code> to it and the ones <code>withered</code> on it), drawn as a beating cell in the middle of the panel with a socket for each neuron in it and one open socket for the next. Every known neuron <b>orbits</b> it on rings of about 44-pixel spacing (the first at 112 pixels, each next 46 further out, turning slowly the other way to the one inside), in alphabetical order of the label so that where a neuron sits says nothing about what it belongs to.</p><p>What can be found is <code>Mind.ripe</code>: every recipe whose result nobody knows, whose parents are all known and which nobody is already trying. A recipe with a parent nobody has met cannot be found yet, so a pick can never lock the idea onto something the player has no way to finish.</p>${recipeTable()}<p>The first success of <b>flame</b> is the fire milestone and sets <code>hasDiscoveredFire</code>, the first <b>stone tool</b> sets <code>hasDiscoveredFlintKnapping</code>, so the world opens through what the people worked out and not through a button. Proven, a chain becomes an order: <b>Kindle Campfire</b> plans a campfire (<code>Blueprint.Kindle</code>) and <b>Knap Hand Axe</b> is worked at a knapping floor, which only appears among the buildings once the stone tool is proven.</p>`,
      },
      {
        id: 'picking',
        title: 'Picking',
        html: `<p>A click on an orbiting neuron is a <b>pick</b> (command <code>pick</code>, <code>Mind.pick</code>). It fits when the neurons already in the idea plus this one are still part of some ripe recipe (a parent may count twice, so flint then flint is spark): a <b>copy</b> of the neuron floats in from its place on the orbit to a seat beside the idea and a fibre grows from it into the next socket, while the original stays where it is, so the same neuron can be picked twice (flint and flint, plant fibre and plant fibre). <b>Anything else withers</b>: the fibre grows, dies and falls away, the copy drifts back and fades into its original, which is dimmed and crossed off for this idea, and the group pays <code>WITHER_COST</code> ${WITHER_COST} of its curiosity. Weariness comes back at <code>WEARY_RECOVERY</code> ${WEARY_RECOVERY} a second times the group's comfort, and while nobody's curiosity is over ${MIN_CURIOUS} no pick is taken. A click on the idea itself lets go of it for free (<code>drop</code>). The crossed-off marks are cleared when the idea forms, is let go, or the group learns anything, since a new neuron can make an old one fit.</p>${flow([
          { title: 'Whole', text: 'The neurons in the idea are exactly one ripe recipe\'s parents. The last copy moves in like the others, the fibres pulse for half a second, then all the copies slide into the middle over a second, fading as they merge, and then the idea pops out as a bubble with a <b>?</b> in it that drifts out to a closer orbit (<code>BUBBLE_ORBIT</code> 86 pixels, inside the neurons) while a fresh empty idea beats in the middle. It cannot fail now: the guessing was the picking.' },
          { title: 'Who', text: 'Anyone free with no critical need and enough curiosity. The most curious takes it, and within about a second of the idea forming: once nothing it needs is missing (<code>Mind.ready</code>) an idle person stops waiting out their rest and a wanderer stops walking, and an idea held up for a missing item is looked at again every 6 seconds.' },
          { title: 'Fetch', text: 'The leaves of the chain are the needs: they carry each item, one at a time, to a work tile. No flint in reach and the idea waits, with the reason in the list.' },
          { title: 'Try', text: 'They kneel for 3.4 s, striking. What the chain uses up is removed and what it makes is laid down.' },
          { title: 'Learn', text: 'The group learns the result at once, the bubble bursts in a ring and the new neuron comes out of it onto the orbit, and the person who did it gets the <code>!</code>. Hovering a bubble says who is on it and what they need, and a click moves the camera to them.' },
        ])}`,
      },
      {
        id: 'review',
        title: 'Reviewing what is worked out',
        html: `<p>The <b>review</b> button in the panel's header swaps the idea for the whole of what the group has worked out (<code>ReviewTree</code>, <code>src/ui/MindReview.tsx</code>). It is a layered graph, left to right: things met in the world on the left, and every result one layer further right than the deepest of its parents, so <b>cooked</b> sits furthest out. A line runs from each parent to the result it makes, two lines when a parent counts twice (flint and flint make a spark), and an idea that is still being carried out is a <b>?</b> node with lines from its parents. Layers are ordered by repeated barycentre sweeps (<code>untangle</code>) to cut crossings, a layer is spread by <code>ROW_GAP_FAR</code> down to <code>ROW_GAP_NEAR</code> pixels and the graph pans by dragging or the wheel when it outgrows the canvas.</p><p>Only recipes whose parents the group knows are drawn, so a neuron that was merely seen (a hand axe, a burning branch) has no lines until it is worked out, and nothing that has not been found is shown. <b>Hovering a neuron</b> lights its lineage, every line that leads to it and from it and the partners those need, and dims the rest, and the hint under the canvas gives the recipe's name, its parents and its line of words.</p>${img('img/mind-review.png', 'The review of a mind that knows everything', 420)}`,
      },
      {
        id: 'shelter',
        title: 'Beds and huts',
        html: `<p>Proving <b>bed</b> adds <code>Bed</code> under <code>Erect</code> on the action wheel and proving <b>hut</b> adds <code>Hut</code>. Each is a plan like the campfire's: a builder carries the materials to the tile (a bed is 2 branches and 3 plant fibre, a hut 5 branches, 1 cord and 4 plant fibre) and the building rises when the last one is down. A bed is a tile a person can step on, a hut is a wall and is slept beside, and either can be taken down again.</p><p>A tired person (over 0.6) with a bed or hut within 40 tiles walks to the nearest one nobody else has taken, with or without a fire. Asleep, tiredness falls 1.5 times as fast on a bed and 2.2 times as fast beside a hut (on top of the 3 times of sleeping at all), and the body loses heat at 0.75 and 0.35 of the usual rate. Nothing lies about at the start: materials are foraged. An idle person walks to a tile within 14 of them, works there for 3 s and, by the cover of the tile, may leave something on the ground: flint or stone on boulders and bare ground, plant fibre on grass, scrub and bush, a branch on trees, bushes, scrub and fallen trunks, and now and then dry plant fibre (what used to be called kindling). Nothing more is left while 8 of that kind (3 of flint, stone or dry fibre) already lie about.</p>`,
      },
      {
        id: 'workshop',
        title: 'Queues and storage rules',
        html: `<p>A recipe that names a station (the stone tool names the <b>knapping floor</b>) is not on the action wheel. It is ordered from the floor's own sheet: select the floor and its <b>make</b> row lists every proven recipe of that station, a click adds one to the floor's <b>queue</b> (at most ${QUEUE_LIMIT}, <code>QUEUE_LIMIT</code>), and a click on a waiting order takes it off again. The queue is worked first in, first out: <code>Mind.claim</code> only offers the oldest waiting order of each floor, and only while fewer people work there than the station has places (<code>job.slots</code>), so a floor short of material holds its whole queue until the material turns up. A recipe without a station (cord, basket) is still ordered on the wheel, one at a time.</p><p>A storage's sheet has an <b>allowed</b> row with every kind of thing the group has met. A click refuses a kind or allows it again (<code>allowStorage</code>, kept per tile in <code>Structures.refused</code>, saved and sent to the screen with the structure lists): a refused kind is never carried in, and one already lying there is carried out again to a storage that takes it. A tile still holds one kind at a time, so the rules decide which kind that is.</p>`,
      },
      {
        id: 'game',
        title: 'Fish and rabbits',
        html: `<p>Proving <b>spear</b> (sharp edge + branch) adds <code>Go Fishing</code> / <code>Stop Fishing</code> under <code>Orders</code>, and proving <b>snare</b> (cord + branch) adds <code>Snare</code> under <code>Erect</code>. Both need an ordinary storage for the catch.</p><p>An angler walks to the nearest fresh shore, stands 12 s and casts three times; a cast takes one fish from the nearest shoal within 6 tiles (<code>Fish.take</code>, one fish off that shoal's headcount, so the pond really holds fewer) and the fish is carried to a storage. A snare is a building plan of 1 branch and 1 cord. Every 20 s each empty snare catches a rabbit with probability <code>1 - exp(-0.3 x adults)</code>, where adults is the rabbit stock of the 16 tile food-web patch it stands in, and that adult is taken out of the stock (<code>Snares</code>). The rabbit lies on the snare until someone hauls or eats it. Fish (190 kcal) and rabbit (280 kcal) are food like berries, and the <code>Roast Food</code> order roasts them as well as eggs and grubs (a roast is 320 kcal).</p>`,
      },
      {
        id: 'curiosity',
        title: 'Curiosity',
        html: `<p>Every person has a curiosity trait rolled from the seed (0.45 to 0.95), which only decides who takes a job. What counts is <code>curiosity x comfort x (1 - weariness)</code>, where comfort is 0 if they are hungry or thirsty over 0.8, tired over 0.85 or cold, and otherwise 0.25 plus 0.75 of how fed, watered and rested they are, and weariness is what wrong picks cost the group. A comfortable group researches and a group in trouble survives first, and guessing every neuron in turn is possible but slow. The mind is asked after drinking, eating, sleeping and feeding the fire, so curiosity never beats a need. A tryer who stops is released, and the idea waits <code>RETRY_SECONDS</code> 25 for the next most curious.</p>`,
      },
      {
        id: 'run',
        title: 'A scripted run',
        html: `${figure(runFigure(run), `<b>A scripted run on the opening ground.</b> Two people, a scatter of starter items standing in for what they would have foraged, and a player who picks ${FIBRES.length} neurons into the idea at the dotted lines, some of them wrong (${run.log.join('; ')}). Each wrong pick lifts the weariness, which the group's comfort wears down again.`, true)}`,
      },
      {
        id: 'screen',
        title: 'On the screen',
        html: `<p>A brain button beside the day dial counts the ideas being carried out, glows when a neuron is learned, and carries <b>a new idea is forming</b> beside it when something new becomes ripe that the player has not yet opened the mind on. It opens the mind: the idea beating in the middle, the known neurons as coins in dendrite-ringed cells orbiting it, each with its label under it, seated in the order they were learned (oldest innermost); a neuron learned since the panel was last closed is lighter, with a bigger halo and a pulsing ring, and the older ones are dimmer. Under it a list says who is doing what and clicking a line moves the camera there, and the proven recipes. In the world a person carrying an idea has a <code>?</code> over their head. The same panel is on the zoo's toolbar (the brain), which gives the placed humans a real <code>Mind</code>.</p>${img('img/mind-panel.png', 'The mind panel', 420)}`,
      },
    ],
    code: ['src/modules/mind/neurons.ts', 'src/modules/mind/mind.ts', 'src/modules/people/people.ts', 'src/ui/MindPanel.tsx', 'src/ui/mindArt.ts', 'src/pixel/ui/neurons.ts'],
  };
}
