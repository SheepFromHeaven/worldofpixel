import { GOALS, MAX_RING, NEURONS, NEURON_COUNT, Outcome, RECIPES, RING_RADII, SECTORS, chainOf, neuronIndex, neuronOf, polar, sectorAt } from '../../../src/sim/mind/neurons.ts';
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
  summary: 'Discovery as a tree of neurons: what people have met, the guesses they try, and the recipes that come out.',
};

const GUESSES: readonly (readonly [number, string, string])[] = [
  [20, 'flint', 'flint'],
  [60, 'flint', 'stone'],
  [100, 'spark', 'kindling'],
  [140, 'spark', 'branch'],
  [180, 'ember', 'branch'],
  [260, 'stone', 'stone'],
  [300, 'flint', 'branch'],
];

const SECONDS = 520;

interface Run {
  times: number[];
  holds: number[][];
  log: string[];
  open: number[];
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
  const run: Run = { times: [], holds: [[], []], log: [], open: [] };
  const queue = [...GUESSES];
  let clock = 0;

  while (clock < SECONDS) {
    sim.advance(0.1);
    clock += 0.1;
    const next = queue[0];
    if (next && clock >= next[0]) {
      const a = neuronIndex(next[1]);
      const b = neuronIndex(next[2]);
      if (sim.mind.anyone(a) && sim.mind.anyone(b)) {
        queue.shift();
        const refused = sim.mind.wonder(a, b);
        run.log.push(`${Math.round(clock)} s: ${next[1]} + ${next[2]} ${refused ?? 'asked'}`);
      }
    }
    if (Math.round(clock * 10) % 50 === 0) {
      run.times.push(clock);
      for (let person = 0; person < 2; person += 1) {
        let held = 0;
        for (let neuron = 0; neuron < NEURON_COUNT; neuron += 1) if (sim.mind.knows(person, neuron)) held += 1;
        run.holds[person]!.push(held);
      }
      run.open.push(sim.mind.open().length);
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
  dull: 'stone + stone (a lesser result)',
  ember: 'spark + kindling',
  smoke: 'spark + branch (a lesser result)',
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
    ['neuron', 'kind', 'how it is earned', 'sector, ring'],
    NEURONS.map((neuron) => [neuron.label, KIND[neuron.kind]!, EARNED[neuron.id] ?? '', `${sectorAt(neuron.angle).label}, ${neuron.ring}`]),
  );
}

function recipeTable(): string {
  const items = (kinds: readonly number[]): string => (kinds.length === 0 ? 'nothing' : kinds.map((kind) => ITEM_NAMES[kind] ?? 'item').join(', '));
  return table(
    ['pair', 'outcome', 'result', 'used up', 'made', 'carried out as'],
    RECIPES.map((recipe) => {
      const chain = chainOf(neuronIndex(recipe.a), neuronIndex(recipe.b), recipe);
      return [
        `${recipe.a} + ${recipe.b}`,
        recipe.outcome === Outcome.Success ? 'success' : 'lesser',
        neuronOf(neuronIndex(recipe.result)).label,
        items([...chain.spend].filter(([, count]) => count > 0).map(([kind]) => kind)),
        items(chain.make),
        recipe.order ? `order <b>${recipe.order}</b>` : recipe.result === 'flame' ? 'order <b>Kindle Campfire</b>' : recipe.outcome === Outcome.Success ? 'a step of a longer chain' : 'a hint',
      ];
    }),
  );
}

function treeFigure(): string {
  const size = 420;
  const centre = size / 2;
  const scale = 1.2;
  const spots = NEURONS.map((neuron) => {
    const at = polar(neuron.angle, neuron.ring);
    return { x: centre + at.x * scale, y: centre + at.y * scale, neuron };
  });
  const rings = RING_RADII.slice(1).map((radius) => `<circle cx="${centre}" cy="${centre}" r="${radius * scale}" fill="none" stroke="${SERIES.grey}" stroke-dasharray="2 5"/>`);
  const walls = SECTORS.map((sector) => {
    const end = polar(sector.from, MAX_RING);
    const middle = polar((sector.from + (((sector.to - sector.from + 360) % 360) / 2)) % 360, MAX_RING);
    return `<line x1="${centre}" y1="${centre}" x2="${centre + end.x * scale}" y2="${centre + end.y * scale}" stroke="${SERIES.grey}"/><text x="${centre + middle.x * scale * 1.12}" y="${centre + middle.y * scale * 1.12}" text-anchor="middle" class="tick">${sector.label}</text>`;
  });
  const edges = RECIPES.flatMap((recipe) =>
    [recipe.a, recipe.b].map((parent) => {
      const from = spots[neuronIndex(parent)]!;
      const to = spots[neuronIndex(recipe.result)]!;
      return `<path d="M${from.x} ${from.y} Q${(from.x + to.x) / 2 + 10} ${(from.y + to.y) / 2} ${to.x} ${to.y}" fill="none" stroke="${recipe.outcome === Outcome.Success ? SERIES.blue : SERIES.grey}" stroke-width="2" ${recipe.outcome === Outcome.Success ? '' : 'stroke-dasharray="5 4"'}/>`;
    }),
  );
  const nodes = spots.map(({ x, y, neuron }) => {
    const thing = neuron.kind === 0;
    return `<circle cx="${x}" cy="${y}" r="11" fill="${thing ? '#9ec5ee' : GOALS.includes(neuron.id) ? '#2f7bff' : '#6a86b4'}" stroke="#16408f" stroke-width="2"/><text x="${x}" y="${y + 24}" text-anchor="middle" class="tick">${neuron.label}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${size} ${size}" role="img" aria-label="The recipe graph">${rings.join('')}${walls.join('')}${edges.join('')}${nodes.join('')}</svg>`;
}

function runFigure(run: Run): string {
  return lineChart({
    x: { label: 'seconds', domain: [0, SECONDS], ticks: [0, 100, 200, 300, 400, 500] },
    y: { label: 'neurons held (solid)', domain: [0, NEURON_COUNT], ticks: [0, 2, 4, 6, 8, 10] },
    verticals: GUESSES.map(([at]) => ({ at })),
    series: [
      { name: 'Adam', colour: SERIES.blue, points: run.times.map((time, at) => [time, run.holds[0]![at]!] as [number, number]) },
      { name: 'Eve', colour: SERIES.red, points: run.times.map((time, at) => [time, run.holds[1]![at]!] as [number, number]), dashed: true },
      { name: 'guesses open', colour: SERIES.green, points: run.times.map((time, at) => [time, run.open[at]!] as [number, number]) },
    ],
    label: 'Neurons held by each person over a scripted run',
  });
}

export function build(): Page {
  const run = simulate();
  return {
    ...LINK,
    lede: 'A discovery is the player\'s guess, not the player\'s chores. The people carry what they have met in a tree of neurons, the player drags a link between two of them, and the most curious person who can fetch it goes and tries. What works becomes a recipe, and a recipe becomes an order on the radial menu.',
    sections: [
      {
        id: 'neurons',
        title: 'Neurons are earned by living',
        html: `<p>A neuron is something a person has met. Seeing a flint lying within 7 tiles (<code>NOTICE_TILES</code>) or holding it lights <code>flint</code> in that person, and nothing is in a mind that the world did not put there. There are <b>things</b> (flint, stone, kindling, branch, each tied to an <code>ItemType</code>) and <b>happenings</b> (spark, ember, flame and the rest, results that nobody can pick up). Knowledge lives in people (<code>Mind.known</code>, one byte per person and neuron: 0 unknown, 1 heard of, 2 knows) but the player sees one tree, where a neuron is as bright as the share of people who know it.</p>${neuronTable()}${callout('<b>Adding a neuron</b> is a row in <code>NEURONS</code> and one 16 by 16 coin in <code>pixel/ui/neurons.ts</code>. Adding a recipe is a row in <code>RECIPES</code>: the items it uses up and makes are data, and the chain of things it needs is worked out from the recipes below it (<code>chainOf</code>).')}`,
      },
      {
        id: 'recipes',
        title: 'The recipes',
        html: `<p>Fire is three small discoveries in a chain, each its own moment, and a pair that is not in the table leaves a withered dead end so nobody tries it twice. A dead end fades from the net over about a minute (<code>DEAD_SECONDS</code>) so the graph does not fill with them, but the pair stays tried. A lesser result (a dull spark from two stones, smoke from a spark on a green branch) turns the <code>?</code> into what actually happened and hints that the right pair is close.</p>${figure(treeFigure(), '<b>The recipe graph.</b> The mind is a circle that expands outward: things on the first ring, each step of a chain one ring further out, and the circle cut into sectors (fire and tools so far, construction and chemistry waiting). Every neuron has a fixed place, so it appears where it belongs once someone finds it. Blue lines are successes, dashed grey lines the lesser results, and the bright circle is a goal.', true)}${recipeTable()}<p>The first success of <b>flame</b> is the fire milestone and sets <code>hasDiscoveredFire</code>, the first <b>stone tool</b> (a sharp edge bound to a handle: three small discoveries, flint + stone, branch + plant fibre, then the two together) sets <code>hasDiscoveredFlintKnapping</code>, so the world opens through what the people worked out and not through a button. Proven, the chain becomes an order: <b>Kindle Campfire</b> plans a campfire (<code>Blueprint.Kindle</code>) that fetches 2 flint, 1 kindling and 4 branches and strikes the fire itself, and <b>Knap Hand Axe</b> is worked at a knapping floor, which only appears among the buildings once the stone tool is proven. The radial menu groups what can be built under <b>Erect</b>, a second level that replaces the first (storage, the campfire, the torch, and the knapping floor once it is unlocked), and it appears after the first fire.</p>`,
      },
      {
        id: 'guess',
        title: 'A link grows a ?',
        html: `<p>In the tree the player presses on a neuron, drags, and <b>holds</b>: the link grows for <code>HOLD_SECONDS</code> 0.9 and pulls back if the button is let go early, so a guess takes a moment of thought. A full link released over a neuron (or the same one, for flint + flint) sends <code>wonder</code> and a hypothesis is born: owned by the group, shown as a <code>?</code> and at the same time the work order. At most <code>MAX_OPEN</code> 3 are open at once. A <code>?</code> resolves exactly once, as a success, a lesser result or a scar, and is never tried again.</p>${flow([
          { title: 'Who', text: 'Everyone with no critical need and a curiosity over 0.12. The most curious takes it, not the nearest, and holders of both parents are preferred to people who must go and ask.' },
          { title: 'Talk', text: 'If they hold only one parent they walk to the most curious holder of the other, talk for 2.4 s, and now have it as <i>heard of</i>.' },
          { title: 'Fetch', text: 'The leaves of the chain are the needs: they carry each item, one at a time, to a work tile. No flint in reach and the guess waits, with the reason in the list.' },
          { title: 'Try', text: 'They kneel for 3.4 s, striking. What the chain uses up is removed, what it makes is laid down, and the pair is resolved.' },
          { title: 'See', text: 'Everyone within 6 tiles and in sight (after dark, in firelight) learns the result at once. Others only hear of it.' },
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
        html: `<p>Every person has a curiosity rolled from the seed (0.45 to 0.95). What counts is <code>curiosity x comfort</code>, where comfort is 0 if they are hungry or thirsty over 0.8, tired over 0.85 or cold, and otherwise 0.25 plus 0.75 of how fed, watered and rested they are. A comfortable group researches and a group in trouble survives first. The mind is asked after drinking, eating, sleeping and feeding the fire, so curiosity never beats a need. A tryer who stops dropping the guess is released, and the guess waits <code>RETRY_SECONDS</code> 25 for the next most curious.</p>`,
      },
      {
        id: 'spread',
        title: 'Showing beats telling',
        html: `<p>A neuron told is dim (<i>heard of</i>) and turns solid only when the person has done or seen it. People within 3 tiles also share neurons slowly on their own, 2.5 times faster beside a fire. Everyone who learns shows a small ring of pixels over their head.</p>${figure(runFigure(run), `<b>A scripted run on the opening ground.</b> Two people, the starter items, and a player who asks for ${GUESSES.length} guesses at the dotted lines (${run.log.join('; ')}). Both climb the tree, one after the other, because whoever watches learns.`, true)}`,
      },
      {
        id: 'screen',
        title: 'On the screen',
        html: `<p>A brain button beside the day dial counts the guesses being worked on and glows when a neuron is learned. It opens the tree: dithered branches whose pixels crawl while a guess is open and carry a bright pixel along a proven link, neurons as 16 by 16 coins that flicker when only some people know them, and a ring round the neurons held by the selected person. Under it a list says who is doing what (<code>flint + flint, Eve, fetching</code>) and clicking a line moves the camera there, and the proven recipes. In the world a person carrying a <code>?</code> has one over their head, drawn like the critical <code>!</code>. The same panel is on the zoo's toolbar (the brain), which gives the placed humans a real <code>Mind</code>.</p>${img('img/mind-panel.png', 'The mind panel', 420)}`,
      },
    ],
    code: ['src/sim/mind/neurons.ts', 'src/sim/mind/mind.ts', 'src/sim/people/people.ts', 'src/ui/MindPanel.tsx', 'src/ui/mindArt.ts', 'src/pixel/ui/neurons.ts'],
  };
}
