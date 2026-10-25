import type { TileIndex } from '../grid.ts';
import type { World } from '../world.ts';
import type { FruitLayer } from './plants.ts';
import type { Species } from './species.ts';
import { stageName, stageOfPlant } from './growth.ts';

const kilocalories = (kcal: number): string => `${Math.round(kcal / 10) * 10} kcal`;

function layerText(world: World, tile: TileIndex, layer: FruitLayer, species: Species): string {
  const { plants } = world;
  const metres = plants.heightOf(tile, layer);
  const years = plants.ageYearsAt(tile, layer);
  const size = metres < 1 ? `${Math.round(metres * 100)} cm` : `${metres.toFixed(1)} m`;
  const age = years < 1 ? 'seedling' : `${Math.round(years)} yr`;
  const ripe = plants.fruitKcal(tile, layer);
  const fruit = ripe >= 10 && species.fruit ? `, ${kilocalories(ripe)} of ${species.fruit.name} ripe` : '';
  return `${species.name} (${stageName(stageOfPlant(species, metres))}, ${age}, ${size}${fruit})`;
}

export function describePlants(world: World, tile: TileIndex): string | null {
  const { plants } = world;
  const parts: string[] = [];
  const tall = plants.speciesAt(tile, 'canopy');
  if (tall) parts.push(tall.habit === 'snag' ? 'a dead tree' : layerText(world, tile, 'canopy', tall));
  const low = plants.speciesAt(tile, 'under');
  if (low) parts.push(layerText(world, tile, 'under', low));
  const ground = plants.speciesAt(tile, 'herb');
  if (ground) parts.push(ground.name);
  return parts.length > 0 ? parts.join(', with ') : null;
}
