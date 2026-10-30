import { EMISSION } from '../src/modules/light/api.ts';
import { CORE_MODULES, defineModule } from '../src/modules/index.ts';
import { Simulation } from '../src/sim/simulation.ts';
import { EmitterKind } from '../src/modules/fire/api.ts';
import { HeatSource } from '../src/modules/fire/sources/heatSource.ts';
import { LightSource } from '../src/modules/fire/api.ts';

const ENGINE = new EmitterKind('glow', new HeatSource(5, 2), new LightSource(4, 1, [1, 0.8, 0.5], { flicker: 0.1, windShare: 0, flame: 'none', lift: 0 }));
const engines = defineModule('engines', [], { emitters: [(world, _people, out) => out.push({ id: 900_001, kind: ENGINE, x: world.grid.centre(world.grid.at(10, 10)).x, y: world.grid.centre(world.grid.at(10, 10)).y, level: 1 })] });

const sim = new Simulation(7, 'settle', null, null, [...CORE_MODULES, engines]);
const emission = sim.kernel.get(EMISSION);
const at = sim.world.grid.centre(sim.world.grid.at(10, 10));
console.log('emitters', emission.all().length, 'warmth beside the engine', emission.warmthAt(at.x + 1, at.y).toFixed(2), 'far away', emission.warmthAt(at.x + 40, at.y).toFixed(2), 'lit spot', emission.lightSpotNear(at.x + 1, at.y) !== null);
