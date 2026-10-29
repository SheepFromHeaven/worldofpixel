import { Simulation } from '../src/sim/simulation.ts';
import { neuronIndex } from '../src/sim/mind/neurons.ts';
import { ItemType } from '../src/sim/people/items.ts';

const sim = new Simulation(20250214, 'settle', null);
const { mind, people, world } = sim;
const log = (text: string): void => console.log(`[${sim.playTime.toFixed(0).padStart(5)}s] ${text}`);
const guesses: readonly (readonly [string, string])[] = [['flint', 'stone'], ['branch', 'fibre'], ['sharp', 'binding']];
let next = 0;
let ordered = false;
sim.advance(0.05);
for (let tick = 0; tick < 12000; tick += 1) {
  sim.advance(0.1);
  if (tick % 40 === 0 && next < guesses.length) {
    const [a, b] = guesses[next]!;
    const ia = neuronIndex(a);
    const ib = neuronIndex(b);
    if (mind.anyone(ia) && mind.anyone(ib)) {
      const refused = mind.wonder(ia, ib);
      log(`wonder ${a} + ${b}: ${refused ?? 'ok'}`);
      if (refused === null) next += 1;
    }
  }
  if (!ordered && mind.proven('tool')) {
    const tile = people.tileOf(0);
    const spot = world.grid.at(world.grid.columnOf(tile) + 2, world.grid.rowOf(tile));
    world.layFloor(spot);
    for (const kind of [ItemType.Flint, ItemType.Stone, ItemType.Branch, ItemType.PlantFibre]) world.items.add(world.grid.at(world.grid.columnOf(spot) + 3, world.grid.rowOf(spot) + 2), kind);
    log(`tool proven, floor laid: ${mind.order(neuronIndex('tool'), spot) ?? 'order ok'}`);
    ordered = true;
    const axe = (): number => world.items.at(spot).filter((slot) => world.items.kind[slot] === ItemType.HandAxe).length;
    for (let wait = 0; wait < 3000; wait += 1) {
      sim.advance(0.1);
      if (axe() > 0) {
        log(`hand axe made on the floor, fire ${people.knowledge.hasDiscoveredFire}, tools ${people.knowledge.hasDiscoveredFlintKnapping}`);
        break;
      }
    }
    break;
  }
  if (tick % 200 === 0) log(`${mind.hypotheses.map((h) => `${h.id}:${h.state}/${h.note}`).join(' ')}`);
}
