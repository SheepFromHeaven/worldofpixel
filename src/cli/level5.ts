import type { Vec2 } from '../sim/geometry.ts';
import { pointInPolygon } from '../sim/geometry.ts';
import { landWorkById } from '../sim/landWorks.ts';
import { landYield } from '../sim/markers.ts';
import { PARCEL, cellsIn, parcelAt, parcelOf } from '../sim/parcels.ts';
import { terrainAt } from '../sim/terrain.ts';
import { Biome, ItemType } from '../sim/types.ts';
import { isWater } from '../sim/worldfield.ts';
import { generateWorld } from '../sim/worldgen.ts';

import type { LevelResult, Logger } from './harness.ts';
import { SEED, harness } from './harness.ts';
import { header } from './render.ts';

export function runLevel5(log: Logger): LevelResult {
  log(header('LEVEL 5 — The ground: one lattice, however you ask for it'));
  const fresh = generateWorld(SEED);
  const run = harness();

  const sweep = cellsIn(fresh.seed, PARCEL, { minX: 400, minY: 300, maxX: 520, maxY: 400 });
  const offsetSweep = new Map(
    cellsIn(fresh.seed, PARCEL, { minX: 455, minY: 355, maxX: 700, maxY: 560 }).map((parcel) => [
      parcel.id,
      parcel,
    ]),
  );

  const corners = (vertices: Vec2[]): string =>
    vertices
      .map((vertex) => `${vertex.x.toFixed(4)},${vertex.y.toFixed(4)}`)
      .sort()
      .join(' ');

  const sameAlone = sweep.every(
    (parcel) => corners(parcelOf(fresh.seed, parcel.id).vertices) === corners(parcel.vertices),
  );

  let compared = 0;
  const sameAcrossSweeps = sweep.every((parcel) => {
    const other = offsetSweep.get(parcel.id);
    if (!other) return true;
    compared += 1;
    return corners(other.vertices) === corners(parcel.vertices);
  });

  const holdsItsSite = sweep.every(
    (parcel) => parcel.vertices.length < 3 || pointInPolygon(parcel.site, parcel.vertices),
  );
  const pickedCorrectly = sweep.every((parcel) => parcelAt(fresh.seed, parcel.site).id === parcel.id);
  const symmetric = sweep.every((parcel) =>
    parcel.neighbors.every((other) => parcelOf(fresh.seed, other).neighbors.includes(parcel.id)),
  );
  const terrainAgrees = sweep.every((parcel) => {
    const field = terrainAt(fresh.seed, parcel.site);
    return Math.abs(field.elevation - parcel.environment.elevation) < 1e-9;
  });

  const yieldsAgree = sweep.every(
    (parcel) =>
      landYield(fresh, parcel.id).join(',') === landYield(generateWorld(SEED), parcel.id).join(','),
  );
  const wellOnWater = run.well.yields.includes(ItemType.Water);
  const earthEverywhere = sweep
    .filter((parcel) => !isWater(parcel.biome))
    .every((parcel) => landYield(fresh, parcel.id).includes(ItemType.Dirt));
  const waterIsSited = sweep.some((parcel) => !landYield(fresh, parcel.id).includes(ItemType.Water));
  const woodIsForest =
    sweep.some((parcel) => parcel.biome === Biome.Forest) &&
    sweep.some((parcel) => parcel.biome === Biome.Meadow) &&
    sweep.every(
      (parcel) =>
        landYield(fresh, parcel.id).includes(ItemType.Deadwood) ===
        (parcel.biome === Biome.Forest || parcel.biome === Biome.Meadow),
    );
  const nothingInTheSea = sweep
    .filter((parcel) => isWater(parcel.biome))
    .every((parcel) => landYield(fresh, parcel.id).length === 0);

  log(`  ${sweep.length} parcels swept, ${compared} of them re-checked from a second sweep`);

  const checks: [string, boolean][] = [
    ['a new world holds nothing but its seed and its library', fresh.settlements.size === 0],
    ['a parcel computed alone matches the sweep', sameAlone],
    ['a parcel is the same from any sweep', sameAcrossSweeps && compared > 0],
    ['every parcel contains its own site', holdsItsSite],
    ['a point lands in the parcel that owns it', pickedCorrectly],
    ['neighbours agree with each other', symmetric],
    ['parcels read the shared terrain field', terrainAgrees],
    ['what the ground yields is a function of the ground', yieldsAgree],
    ['a well on the water draws water', wellOnWater],
    ['earth is under every parcel of land', earthEverywhere],
    ['water is only where the water is', waterIsSited],
    ['deadwood lies in wood and meadow, and nowhere else', woodIsForest],
    ['the sea yields nothing', nothingInTheSea],
    [
      'every standing building keeps its own copy of its blueprint',
      [...run.settlement.buildings.values()].every(
        (building) =>
          building.slots.every(
            (slot) =>
              !slot.design ||
              slot.design !== (run.world.library.get(slot.design.id) ?? landWorkById(slot.design.id)?.design),
          ),
      ),
    ],
  ];

  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-5',
    title: 'The ground',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `${checks.length} checks over ${sweep.length} parcels`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}
