import { LIFE_COUNT, LIVES, PATCH_TILES, STAGES, Stage } from '../src/sim/fauna/life.ts';
import { patchIndex } from '../src/sim/fauna/patches.ts';
import { ItemType } from '../src/sim/people/items.ts';
import { Simulation } from '../src/sim/simulation.ts';
import { Blueprint, Building } from '../src/sim/world.ts';

const sim = new Simulation(Number(process.env.SEED ?? 20250214), 'settle', null);
const { world, people, fauna } = sim;
sim.advance(0.05);
world.confinement = null;
const shoal = sim.fish.nearestFresh(people.posX[0]!, people.posY[0]!, 600);
if (shoal) {
  let spot = -1;
  for (let ring = 0; ring < 10 && spot < 0; ring += 1) {
    for (let dy = -ring; dy <= ring && spot < 0; dy += 1) for (let dx = -ring; dx <= ring && spot < 0; dx += 1) {
      const tile = world.grid.at(world.grid.column(shoal.x) + dx + 4, world.grid.row(shoal.y) + dy + 4);
      if (tile >= 0 && world.passable(tile) && world.coverOf(tile) !== 4) spot = tile;
    }
  }
  if (spot < 0) throw new Error('no spot by the shoal');
  const centre = world.grid.centre(spot);
  for (let person = 0; person < people.count; person += 1) {
    people.posX[person] = centre.x;
    people.posY[person] = centre.y;
    people.targetX[person] = centre.x;
    people.targetY[person] = centre.y;
  }
}
const at = people.tileOf(0);
const column = world.grid.columnOf(at);
const row = world.grid.rowOf(at);
const rabbit = LIVES.findIndex((life) => life.key === 'rabbit');
const adults = (tile: number): number => fauna.stock[(patchIndex(fauna.patches.columns, Math.floor(world.grid.columnOf(tile) / PATCH_TILES), Math.floor(world.grid.rowOf(tile) / PATCH_TILES)) * LIFE_COUNT + rabbit) * STAGES + Stage.Adult]!;
console.log('rabbit adults here', adults(at).toFixed(1), 'fish shoals', sim.fish.count);

let shore = -1;
let least = Infinity;
for (let dy = -40; dy <= 40; dy += 1) {
  for (let dx = -40; dx <= 40; dx += 1) {
    const tile = world.grid.at(column + dx, row + dy);
    if (tile < 0 || !world.drinkable(tile)) continue;
    if (dx * dx + dy * dy < least) {
      least = dx * dx + dy * dy;
      shore = tile;
    }
  }
}
console.log('nearest fresh water', shore < 0 ? 'none' : `${Math.sqrt(least).toFixed(0)} tiles`);

world.confinement = null;
world.designate(world.grid.at(column + 2, row + 3));
world.designate(world.grid.at(column + 3, row + 3));
for (let i = 0; i < 3; i += 1) {
  world.items.add(world.grid.at(column + 3 + i, row + 1), ItemType.Branch);
  world.items.add(world.grid.at(column + 3 + i, row + 2), ItemType.Cord);
}
const snare = world.grid.at(column - 3, row + 2);
console.log('plan snare', world.planBuilding(snare, Blueprint.Snare));
let bestPatch = 0;
for (let patch = 0; patch < fauna.patches.count; patch += 1) if (fauna.stock[(patch * LIFE_COUNT + rabbit) * STAGES + Stage.Adult]! > fauna.stock[(bestPatch * LIFE_COUNT + rabbit) * STAGES + Stage.Adult]!) bestPatch = patch;
const wild: number[] = [];
for (let dy = 0; dy < PATCH_TILES && wild.length < 4; dy += 3) {
  for (let dx = 0; dx < PATCH_TILES && wild.length < 4; dx += 3) {
    const tile = world.grid.at((bestPatch % fauna.patches.columns) * PATCH_TILES + dx, Math.floor(bestPatch / fauna.patches.columns) * PATCH_TILES + dy);
    if (world.passable(tile) && world.raise(tile, Building.Snare)) wild.push(tile);
  }
}
console.log('best patch rabbits', adults(wild[0] ?? 0).toFixed(2), 'wild snares', wild.length);
sim.apply({ kind: 'angle', on: true });
for (let tick = 0; tick < 3000; tick += 1) {
  people.hunger.fill(0);
  people.thirst.fill(0);
  people.tiredness.fill(0);
  sim.advance(0.1);
  if (tick % 500 === 499) {
    const stored = new Map<number, number>();
    for (const tile of world.storageTiles) for (const slot of world.items.at(tile)) stored.set(world.items.kind[slot]!, (stored.get(world.items.kind[slot]!) ?? 0) + 1);
    console.log(`${(tick + 1) / 10}s snare ${world.built[snare]} (${Building.Snare}) on snare ${world.items.at(snare).length} stored fish ${stored.get(ItemType.Fish) ?? 0} rabbit ${stored.get(ItemType.Rabbit) ?? 0} states ${[...people.state.slice(0, people.count)].join(',')} angling ${people.angling[0]} wild rabbits ${wild.filter((tile) => world.items.at(tile).length > 0).length}`);
  }
}
console.log('finished');
