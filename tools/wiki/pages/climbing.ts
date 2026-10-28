import { abilityOf, CLIMBERS } from '../../../src/sim/climb/ability.ts';
import { Forest, tileOfRef } from '../../../src/sim/climb/forest.ts';
import { buildTree, capacityOf, radiusFor } from '../../../src/sim/climb/tree.ts';
import type { TreeGraph } from '../../../src/sim/climb/tree.ts';
import { SPECIES } from '../../../src/sim/plants/species.ts';
import { SEED, world } from '../context.ts';
import type { Page, PageLink } from '../page.ts';
import { callout, figure, flow, SERIES, table } from '../page.ts';
import { lineChart, samples } from '../svg.ts';

const WOODS = ['oak', 'pine', 'birch', 'willow', 'baobab'] as const;

const COLOURS = [SERIES.green, SERIES.blue, SERIES.gold, SERIES.red, SERIES.violet];

const species = (key: string) => SPECIES.find((one) => one.key === key)!;

const centimetres = (value: number): string => `${(value * 100).toFixed(1)} cm`;

function capacityChart(): string {
  const bear = abilityOf('blackbear')!;
  const chimp = abilityOf('chimpanzee')!;
  const raccoon = abilityOf('raccoon')!;
  return lineChart({
    width: 560,
    height: 300,
    x: { label: 'limb radius, cm', domain: [0, 15], ticks: [0, 3, 6, 9, 12, 15] },
    y: { label: 'kilograms it holds', domain: [0, 400], ticks: [0, 100, 200, 300, 400] },
    series: WOODS.map((key, i) => ({ name: key, colour: COLOURS[i]!, points: samples(0, 15, 60, (cm) => capacityOf(cm / 100, species(key).wood)) })),
    horizontals: [
      { at: bear.mass * bear.safety, label: 'black bear' },
      { at: chimp.mass * chimp.safety, label: 'chimpanzee' },
      { at: raccoon.mass * raccoon.safety, label: 'raccoon' },
    ],
    legend: true,
    label: 'What a limb holds by its radius, for five woods',
  });
}

function treeDrawing(tree: TreeGraph, mass: number, title: string): string {
  const scale = 11;
  const width = Math.round(tree.metres * scale * 1.5);
  const height = Math.round(tree.metres * scale + 24);
  const base = tree.nodes[0]!;
  const lines = tree.nodes
    .map((node) => {
      if (node.parent < 0) return '';
      const from = tree.nodes[node.parent]!;
      const holds = capacityOf(node.radius, tree.species.wood) >= mass;
      const x = (value: number): number => width / 2 + (value - base.x) * scale;
      const y = (value: number): number => height - 12 - value * scale;
      return `<line x1="${x(from.x).toFixed(1)}" y1="${y(from.z).toFixed(1)}" x2="${x(node.x).toFixed(1)}" y2="${y(node.z).toFixed(1)}" stroke="${holds ? SERIES.green : SERIES.red}" stroke-width="${Math.max(1, node.radius * scale * 2).toFixed(1)}" stroke-linecap="round"/>`;
    })
    .join('');
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" role="img" aria-label="${title}"><line x1="0" y1="${height - 12}" x2="${width}" y2="${height - 12}" stroke="currentColor" stroke-opacity="0.35"/>${lines}<text x="6" y="14" font-size="11" fill="currentColor">${title}</text></svg>`;
}

function reachTable(): string {
  const w = world();
  const forest = new Forest(w, w.plants, SEED);
  const { grid } = w;
  const stands: { tile: number; score: number }[] = [];
  for (let row = 20; row < grid.rows - 20; row += 24) {
    for (let column = 20; column < grid.columns - 20; column += 24) {
      const tile = grid.at(column, row);
      if (!forest.tree(tile)) continue;
      let found = 0;
      for (let dy = -6; dy <= 6; dy += 2) for (let dx = -6; dx <= 6; dx += 2) if (forest.tree(grid.at(column + dx, row + dy))) found += 1;
      stands.push({ tile, score: found });
    }
  }
  stands.sort((a, b) => b.score - a.score || a.tile - b.tile);
  const starts = stands.slice(0, 4).map((one) => one.tile);
  const rows = CLIMBERS.map((key) => {
    const ability = abilityOf(key)!;
    let trees = 0;
    let top = 0;
    let climbed = 0;
    const links: Record<string, number> = { limb: 0, touch: 0, jump: 0, glide: 0 };
    for (const tile of starts) {
      const reach = forest.reach(tile, ability, 1500);
      if (reach.cost.size === 0) continue;
      climbed += 1;
      trees += new Set([...reach.cost.keys()].map(tileOfRef)).size;
      let best = 0;
      for (const ref of reach.cost.keys()) best = Math.max(best, forest.node(ref)!.z / forest.tree(tileOfRef(ref))!.metres);
      top += best;
      for (const link of reach.links.values()) links[link] = (links[link] ?? 0) + 1;
    }
    const n = Math.max(1, climbed);
    const all = Object.values(links).reduce((a, b) => a + b, 0) || 1;
    const share = (link: string): string => `${Math.round(((links[link] ?? 0) / all) * 100)}%`;
    return [key, `${ability.mass < 1 ? ability.mass.toFixed(2) : ability.mass.toFixed(0)} kg`, `${climbed} of ${starts.length}`, (trees / n).toFixed(0), `${Math.round((top / n) * 100)}%`, share('limb'), share('touch'), share('jump'), share('glide')];
  });
  return table(['Animal', 'Mass', 'Can start', 'Trees reached', 'Highest', 'Limb', 'Touch', 'Jump', 'Glide'], rows);
}

export const LINK: PageLink = {
  slug: 'climbing',
  title: 'Climbing',
  summary: 'Trees as climbable graphs: how strong a limb is, what each animal can grip, step across, leap or glide, and where it can get to.',
};

export function build(): Page {
  const oak = buildTree(SEED, 1, 0, 0, species('oak'), 22);
  const bear = abilityOf('blackbear')!;
  const squirrel = abilityOf('squirrel')!;
  const abilityRows = CLIMBERS.map((key) => {
    const one = abilityOf(key)!;
    const thinnest = radiusFor(one.mass * one.safety, species('oak').wood);
    return [key, `${one.mass < 1 ? one.mass.toFixed(2) : one.mass.toFixed(0)} kg`, `${centimetres(one.gripMin)} to ${centimetres(one.gripMax)}`, `${one.touch} m`, one.jump > 0 ? `${one.jump} m` : '-', one.glide > 0 ? `${one.glide}:1 to ${one.glideMax} m` : '-', centimetres(thinnest)];
  });
  return {
    ...LINK,
    lede: 'Every canopy tree is a small graph of trunk and branch nodes, built the same way every time from its species, height and tile, with a load capacity on every limb. An animal has a mass and a few abilities (what trunk it can grip, how far it can touch across, whether it can jump or glide), and it may only use the limbs that hold it and the links its abilities allow. Nothing is stored: a tree\'s graph is rebuilt on demand and cached.',
    code: ['src/sim/climb/', 'tools/climbGraph.ts', 'src/sim/plants/species.ts'],
    sections: [
      {
        id: 'model',
        title: 'The model',
        html: `${flow([
          { title: 'Tree', text: 'A trunk of nodes every 1.5 m, thinning with height, and branches in the crown, each with a base, a middle and tips and a radius.' },
          { title: 'Strength', text: 'A limb holds <code>wood &times; 70000 &times; radius^2.5</code> kilograms. Wood is a strength factor per species.' },
          { title: 'Ability', text: 'Mass, the trunk radius it can grip, how far it touches across, how far it jumps, how it glides.' },
          { title: 'Links', text: 'Limb to limb in one tree. Between trees: touch where crowns meet, jump, or glide down a slope.' },
          { title: 'Route', text: 'A search from the foot of a tree over the nodes the animal may use, cheapest first.' },
        ])}
<p><b>A bear does not jump.</b> The black bear climbs a trunk and out along the thick limbs, and crosses to a neighbour only where two crowns actually touch. Squirrels and martens jump, flying squirrels glide, gibbons swing, the sloth only ever steps across.</p>
${callout('<p><b>Wired for the black bear.</b> The animals use this now (see In the sim below). Only the species that are shown in the game climb, which today is the black bear; the squirrels, monkeys and the rest will climb as they are migrated. The black bear has its poses: it stands up against the trunk (<code>rear</code>), climbs with its body upright and its limbs reaching up the trunk (<code>climb</code>), and sits on its perch (<code>perch</code>). The other climbers still keep their walking legs while they climb.</p>')}`,
      },
      {
        id: 'strength',
        title: 'How strong a limb is',
        html: `${figure(capacityChart(), '<b>Kilograms a limb holds by its radius.</b> The lines are woods, the guides are animals with a safety margin of 1.25. A 6 cm limb of oak holds about 80 kg. A black bear needs about 7.5 cm of oak, and more of anything softer. Willow and baobab hold much less than their size suggests.', true)}
<p>The strength scales with the 2.5th power of the radius, so a limb twice as thick holds almost six times as much. The wood factor is in the catalogue on the plants page: oak and mahogany 1.3, chestnut and olive 1.2, pine 0.9, birch 0.85, willow 0.55, baobab and kapok 0.5. A landing needs a margin too: an animal that jumps needs the limb it lands on to hold twice its weight (1.25 times for the slow ones).</p>`,
      },
      {
        id: 'tree',
        title: 'A tree as a graph',
        html: `${figure(`${treeDrawing(oak, bear.mass * bear.safety, 'oak, 22 m, black bear 110 kg')}${treeDrawing(oak, squirrel.mass * squirrel.safety, 'the same oak, squirrel 0.3 kg')}`, '<b>The same oak for two animals.</b> Green limbs hold the animal, red ones do not. The bear has the trunk and the thickest limbs, the squirrel has the whole crown to the twigs.', true)}
<p>The crown base, the crown width and the number of branches follow the species: broadleaves branch from about a third of their height and spread widest in the middle, conifers carry short branches from low on the trunk, palms have a trunk and nothing else. Positions come from a hash of the tile, so the same tree is the same tree on every run.</p>`,
      },
      {
        id: 'abilities',
        title: 'What each animal can do',
        html: `<p>Twelve species are trained so far. The last column is the thinnest oak limb the animal can stand on with its safety margin.</p>${table(['Animal', 'Mass', 'Grips trunks', 'Touches', 'Jumps', 'Glides', 'Thinnest oak limb'], abilityRows)}`,
      },
      {
        id: 'sim',
        title: 'In the sim',
        html: `<p>An idle animal of a climbing species, awake and within 14 tiles of a climbable tree, may plan a climb. The habits are parameters in the animal's behaviour file (<code>climber({ taste, gap, perch, arboreal })</code>, with defaults per species): <b>taste</b> is the chance an attempt becomes a climb (black bear 6%, squirrel 95%, gibbon and sloth always), <b>gap</b> the seconds between attempts, <b>perch</b> how long it stays, and <b>arboreal</b> the chance that after a perch it travels on to another spot in the canopy instead of coming down (black bear 5%, squirrel 85%, sloth and gibbon 95%), so squirrels and sloths mostly live in the trees and a bear only visits them. The plan is a timed route:</p>
${flow([
          { title: 'Walk', text: 'To the foot of the nearest tree it can reach on the ground.' },
          { title: 'Climb', text: 'Up the cheapest path through the limbs it can use, to a goal high in the crown (above 30% of the tree). Crossing to another tree is preferred where a link allows.' },
          { title: 'Perch', text: 'Stay a while, 8 to 40 seconds for a bear, up to two minutes for a sloth or a leopard.' },
          { title: 'Descend', text: 'Down the trunk of the tree it ended in if it can grip it, otherwise the way it came.' },
        ])}
<p>Followers (calves, herd members) walk the same route a moment behind the leader. Startling is ignored while up a tree. The animal has a height in metres, <code>posZ</code>, with the position: the renderer lifts the sprite by it, keeps the shadow on the ground and sorts it against the trees at <code>height &times; 0.3</code>, so it is hidden by a canopy only when it is under it. The states are <code>rear</code> (upright at the foot of the tree, before and after), <code>climb</code> (along a limb, tilted by how steep the limb is), <code>perch</code> and <code>leap</code> (a jump or a glide); they only exist for the species that climb. <code>tools/animalClimb.ts</code> runs the real world around dense stands and counts climbs, the highest point and the leaps: a black bear never leaps.</p>`,
      },
      {
        id: 'reach',
        title: 'Where they can get on this seed',
        html: `<p>The search starts at the foot of a tree in each of the four densest stands of this seed and runs at most 1500 steps. <b>Trees reached</b> is how many different trees the animal ends up on, <b>highest</b> is the highest point it reaches as a share of that tree. The last four columns are the share of the links it used.</p>${reachTable()}
<p>The black bear stays on its own tree and the single one it can touch, climbing to about three quarters of its height. A squirrel or a monkey crosses a stand through the crowns. The sloth gets just as far by only stepping, because in a dense wood the crowns touch.</p>`,
      },
    ],
  };
}
