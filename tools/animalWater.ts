import { Animals } from '../src/sim/animals/animals.ts';
import { DEFAULT_TUNING, Fauna } from '../src/sim/fauna/fauna.ts';
import { PATCH_TILES } from '../src/sim/fauna/life.ts';
import { MAMMALS, Realm } from '../src/sim/mammals/species.ts';
import { Biome } from '../src/sim/types.ts';
import { World } from '../src/sim/world.ts';

const SEED = Number(process.env.SEED ?? 20250214);
const LAKES = Number(process.env.LAKES ?? 40);
const SWIMMERS = process.env.SWIMMERS === '1';

const world = World.generate(SEED);
const fauna = new Fauna(world, SEED, { ...DEFAULT_TUNING, maxStep: 0.25 });
const { columns, count } = fauna.patches;
const { grid } = world;
const celsius = new Float32Array(count);
for (let p = 0; p < count; p += 1) {
  const column = Math.min(grid.columns - 1, (p % columns) * PATCH_TILES + 8);
  const row = Math.min(grid.rows - 1, Math.floor(p / columns) * PATCH_TILES + 8);
  celsius[p] = world.field.temperature[row * grid.columns + column]!;
}
const weather = { celsius, snow: new Float32Array(count), cellOf: Int32Array.from({ length: count }, (_, i) => i) };
fauna.populate();
for (let i = 0; i < 6; i += 1) fauna.sweep(0.25, weather);

const wetAt = (x: number, y: number): boolean => {
  const index = grid.atPoint({ x, y });
  return index >= 0 && (world.river[index] === 1 || world.biome[index]! >= Biome.Ocean);
};

const spots: { x: number; y: number }[] = [];
for (let row = 40; row < grid.rows - 40; row += 24) {
  for (let column = 40; column < grid.columns - 40; column += 24) {
    const index = row * grid.columns + column;
    if (world.biome[index] === Biome.Lake || world.river[index] === 1) spots.push({ x: grid.minX + (column + 0.5) * grid.spacing, y: grid.minY + (row + 0.5) * grid.spacing });
  }
}

let samples = 0;
let inWater = 0;
const found = new Set<string>();
for (const spot of spots.slice(0, LAKES)) {
  const animals = new Animals(world, fauna, SEED, { busyAt: () => 1, comfortAt: () => 1 });
  animals.setFocus({ x: spot.x, y: spot.y, radius: 120 });
  for (let time = 0; time < 300; time += 0.5) {
    animals.update(0.5, 0.5);
    if (time % 1 !== 0) continue;
    const { store } = animals;
    for (let slot = 0; slot < store.n; slot += 1) {
      const id = store.species[slot]!;
      if (id < 0 || id >= MAMMALS.length) continue;
      const kind = MAMMALS[id]!;
      if (((kind.realm & (Realm.Fresh | Realm.Sea)) !== 0) !== SWIMMERS) continue;
      samples += 1;
      if (wetAt(store.posX[slot]!, store.posY[slot]!)) {
        inWater += 1;
        found.add(kind.key);
      }
    }
  }
}
console.log(`${inWater} of ${samples} ${SWIMMERS ? 'swimmer' : 'non-swimmer'} samples in water over ${Math.min(LAKES, spots.length)} lakes${found.size ? `: ${[...found].join(', ')}` : ''}`);
