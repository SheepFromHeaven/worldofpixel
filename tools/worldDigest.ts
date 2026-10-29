import { createHash } from 'node:crypto';
import type { World } from '../src/sim/world.ts';

const hash = (value: string | ArrayBufferView): string => {
  const bytes = typeof value === 'string' ? Buffer.from(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return createHash('sha1').update(bytes).digest('hex').slice(0, 10);
};

export function worldDigest(world: World): Record<string, string> {
  const { plants } = world;
  const arrays: Record<string, ArrayBufferView> = {
    cover: world.cover,
    wear: world.trails.wear,
    storage: world.structures.storage,
    floor: world.structures.floor,
    fire: world.structures.fire,
    ember: world.structures.ember,
    torch: world.structures.torch,
    plan: world.structures.plan,
    built: world.structures.built,
    canopy: plants.canopy,
    canopyAge: plants.canopyAge,
    canopyHeight: plants.canopyHeight,
    under: plants.under,
    underAge: plants.underAge,
    underHeight: plants.underHeight,
    herb: plants.herb,
  };
  const out: Record<string, string> = Object.fromEntries(Object.entries(arrays).map(([name, array]) => [name, hash(array)]));
  out.lists = hash(JSON.stringify([world.structures.storageTiles, world.structures.floors, world.structures.fires, world.structures.embers, world.structures.plans, world.structures.torches, world.structures.buildings]));
  out.fuel = hash(JSON.stringify([...world.structures.fuel]));
  out.torchDepth = hash(JSON.stringify([...world.structures.torchDepth]));
  out.items = hash(JSON.stringify(world.items.state()));
  out.homes = hash(JSON.stringify(world.homes.state()));
  out.confinement = hash(JSON.stringify(world.movement.confinement));
  return out;
}
