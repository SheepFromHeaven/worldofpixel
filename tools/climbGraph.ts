import { writeFileSync } from 'node:fs';
import { abilityOf, CLIMBERS } from '../src/sim/climb/ability.ts';
import { Forest, indexOfRef, tileOfRef } from '../src/sim/climb/forest.ts';
import { World } from '../src/sim/world.ts';

const SEED = Number(process.env.SEED ?? 20250214);
const SAMPLES = Number(process.env.SAMPLES ?? 12);
const OUT = process.env.OUT ?? '';

const world = World.generate(SEED);
const forest = new Forest(world, world.plants, SEED);
const { grid } = world;

const density = (column: number, row: number): number => {
  let found = 0;
  for (let dy = -6; dy <= 6; dy += 2) for (let dx = -6; dx <= 6; dx += 2) if (forest.tree(grid.at(column + dx, row + dy))) found += 1;
  return found;
};

const stands: { tile: number; score: number }[] = [];
for (let row = 20; row < grid.rows - 20; row += 16) {
  for (let column = 20; column < grid.columns - 20; column += 16) {
    const tile = grid.at(column, row);
    if (forest.tree(tile)) stands.push({ tile, score: density(column, row) });
  }
}
stands.sort((a, b) => b.score - a.score || a.tile - b.tile);
const starts = stands.slice(0, SAMPLES).map((one) => one.tile);
console.log(`${stands.length} stands, using the ${starts.length} densest; species: ${[...new Set(starts.map((tile) => forest.tree(tile)!.species.key))].join(', ')}`);

const rows: string[] = [];
for (const key of CLIMBERS) {
  const ability = abilityOf(key)!;
  let nodes = 0;
  let trees = 0;
  let reachedTop = 0;
  const links: Record<string, number> = { limb: 0, touch: 0, jump: 0, glide: 0 };
  let climbed = 0;
  for (const tile of starts) {
    const reach = forest.reach(tile, ability);
    if (reach.cost.size === 0) continue;
    climbed += 1;
    nodes += reach.cost.size;
    trees += new Set([...reach.cost.keys()].map(tileOfRef)).size;
    let top = 0;
    for (const ref of reach.cost.keys()) top = Math.max(top, forest.node(ref)!.z / forest.tree(tileOfRef(ref))!.metres);
    reachedTop += top;
    for (const link of reach.links.values()) links[link] = (links[link] ?? 0) + 1;
  }
  const n = Math.max(1, climbed);
  rows.push(`${key.padEnd(15)} ${String(ability.mass.toFixed(1)).padStart(6)} kg  climbs ${climbed}/${starts.length}  nodes ${(nodes / n).toFixed(0).padStart(5)}  trees ${(trees / n).toFixed(1).padStart(5)}  top ${(reachedTop / n).toFixed(2)}  limb ${links.limb} touch ${links.touch} jump ${links.jump} glide ${links.glide}`);
}
console.log(rows.join('\n'));

if (OUT) {
  const tile = starts[0]!;
  const tree = forest.tree(tile)!;
  const ability = abilityOf(process.env.WHO ?? 'blackbear')!;
  const reach = forest.reach(tile, ability);
  const trees = [...new Set([...reach.cost.keys()].map(tileOfRef))].map((one) => forest.tree(one)!);
  writeFileSync(OUT, JSON.stringify({ tile, species: tree.species.key, metres: tree.metres, ability, trees: trees.map((one) => ({ tile: one.tile, species: one.species.key, metres: one.metres, wood: one.species.wood, nodes: one.nodes })), reached: [...reach.cost.keys()].map((ref) => [tileOfRef(ref), indexOfRef(ref), reach.links.get(ref) ?? 'start']) }));
}
