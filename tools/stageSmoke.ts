import { stageWorld, TERRAINS } from '../src/zoo/stage.ts';
import { StageSim } from '../src/sim/stageSim.ts';
import { ItemType } from '../src/sim/people/items.ts';

const world = stageWorld(TERRAINS[0]!, 5);
const sim = new StageSim(world, [{ at: { x: 190, y: 190 }, heading: 0 }, { at: { x: 192, y: 190 }, heading: 1 }]);
const at = world.grid.at(194, 190);
sim.apply({ kind: 'build', tile: at, building: 'storage' });
world.items.add(world.grid.at(188, 192), ItemType.Branch);
sim.apply({ kind: 'pickUp', tile: world.grid.at(188, 192), item: ItemType.Branch });
for (let step = 0; step < 1200; step += 1) {
  sim.advance(0.1);
  if (step % 200 === 199) console.log(step + 1, 'state', [...sim.people.state.slice(0, 2)], 'at', sim.people.posX[0]!.toFixed(1), sim.people.posY[0]!.toFixed(1), 'held', sim.people.heldItemType[0]);
}
const slices = sim.offers;
console.log('systems', sim.kernel.order.join(' > '));
console.log('branch', ItemType.Branch, 'state', [...sim.people.state.slice(0, 2)], 'on ground', world.items.kindsAt(world.grid.at(188, 192)).length, 'in storage', world.items.kindsAt(at).length);
console.log('storage', world.structures.isStorage(at), 'held', sim.people.heldItemType[0], sim.people.heldItemType[1], 'offers context ok', typeof slices.igniterNear);
