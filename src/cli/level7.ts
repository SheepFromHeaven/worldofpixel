import { inClaim } from '../sim/claims.ts';
import { canBuild } from '../sim/construction.ts';
import { route } from '../sim/footpaths.ts';
import { landYield } from '../sim/markers.ts';
import { FIELD } from '../sim/terrain/heightmap.ts';
import { RIVER_FLUX, Water } from '../sim/terrain/hydrology.ts';
import { PARCEL, cellsIn, parcelOf } from '../sim/terrain/parcels.ts';
import { riverRunsIn } from '../sim/terrain/terrain.ts';
import { buildField, fieldFor, isFresh, isWater } from '../sim/terrain/worldfield.ts';
import type { CellId } from '../sim/types.ts';
import { Biome, ItemType } from '../sim/types.ts';
import { canFound, generateWorld } from '../sim/worldgen.ts';

import type { LevelResult, Logger } from './harness.ts';
import { MIDDLE, SEED, foundBesideWater, raiseTheTown, workOf } from './harness.ts';
import { header } from './render.ts';

export function runLevel7(log: Logger): LevelResult {
  log(header('LEVEL 7 — Water: it runs downhill, and a well stands where it runs'));
  const world = generateWorld(SEED);
  const field = fieldFor(SEED);
  const { grid } = field;
  const around = cellsIn(world.seed, PARCEL, {
    minX: MIDDLE.x - 150,
    minY: MIDDLE.y - 150,
    maxX: MIDDLE.x + 150,
    maxY: MIDDLE.y + 150,
  });

  const heads = riverHeads(field);
  let climbed = 0;
  let stranded = 0;
  let intoLakes = 0;
  for (const head of heads) {
    let cell = head;
    let steps = 0;

    for (;;) {
      const next = field.into[cell]!;
      if (next < 0 || steps > grid.columns * 4) {
        stranded += 1;
        break;
      }
      if (field.surface[next]! > field.surface[cell]!) climbed += 1;
      if (field.water[next] !== Water.None) {
        if (field.water[next] === Water.Lake) intoLakes += 1;
        break;
      }
      cell = next;
      steps += 1;
    }
  }

  const { settlement, water, reeds } = foundBesideWater(world);
  raiseTheTown(world, settlement, water, reeds);
  const banks = around.filter(
    (parcel) => !isWater(parcel.biome) && landYield(world, parcel.id).includes(ItemType.Water),
  );
  const dryGround = around.filter(
    (parcel) => !isWater(parcel.biome) && !landYield(world, parcel.id).includes(ItemType.Water),
  );
  const well = workOf('well');
  const taken = new Set([...settlement.buildings.values()].map((building) => building.cellId));
  const claimed = (parcel: { id: CellId }): boolean => inClaim(world, settlement, parcel.id);
  const claimedBanks = banks.filter((parcel) => claimed(parcel) && !taken.has(parcel.id));
  const wellsGoOnBanks =
    claimedBanks.length > 0 && claimedBanks.every((parcel) => canBuild(world, settlement, parcel.id, well).ok);
  const wellsRefusedOnDry = dryGround
    .filter(claimed)
    .every((parcel) => !canBuild(world, settlement, parcel.id, well).ok);
  const banksOutsideRefusedForTheClaim = banks
    .filter((parcel) => !claimed(parcel))
    .every((parcel) => canBuild(world, settlement, parcel.id, well).reason.includes('claim'));
  const wellsAreSited = banks.length > 0 && dryGround.length > banks.length;

  const besideWater = around.filter(
    (parcel) =>
      !isWater(parcel.biome) &&
      parcel.neighbors.some((id) => isFresh(parcelOf(world.seed, id).biome)),
  );
  const shoresGiveWater = besideWater.every((parcel) =>
    landYield(world, parcel.id).includes(ItemType.Water),
  );
  const saltOnly = around.filter(
    (parcel) =>
      !isWater(parcel.biome) &&
      parcel.neighbors.some((id) => parcelOf(world.seed, id).biome === Biome.Ocean) &&
      !parcel.neighbors.some((id) => isFresh(parcelOf(world.seed, id).biome)) &&
      riverRunsIn(world.seed, {
        minX: parcel.site.x - PARCEL * 2,
        minY: parcel.site.y - PARCEL * 2,
        maxX: parcel.site.x + PARCEL * 2,
        maxY: parcel.site.y + PARCEL * 2,
      }).length === 0,
  );
  const seaGivesNothing = saltOnly.every(
    (parcel) => !landYield(world, parcel.id).includes(ItemType.Water),
  );

  const onTheWater = around.filter((parcel) => isWater(parcel.biome));
  const onRivers = around.filter((parcel) => parcel.biome === Biome.River);
  const riversBlock = onRivers.length > 0;
  const nothingFoundedInWater = onTheWater.every((parcel) => !canFound(world, parcel.id).ok);
  const hearthCell = settlement.buildings.get(settlement.hearthId)!.cellId;
  const noWalkInWater = onTheWater.every((parcel) => route(world, parcel.id, hearthCell) === null);
  const nothingBuiltInWater = onTheWater.every(
    (parcel) => !canBuild(world, settlement, parcel.id, workOf('digging')).ok,
  );

  const riversCarryWater = heads.every((cell) => field.flux[cell]! >= RIVER_FLUX);

  const again = buildField(SEED);
  let sameGround = again.biome.length === field.biome.length;
  for (let cell = 0; sameGround && cell < field.biome.length; cell += 1) {
    if (again.biome[cell] !== field.biome[cell] || again.water[cell] !== field.water[cell]) {
      sameGround = false;
    }
  }
  const sameRivers = again.rivers.segments.length === field.rivers.segments.length;

  let lakes = 0;
  let ocean = 0;
  for (let cell = 0; cell < field.water.length; cell += 1) {
    if (field.water[cell] === Water.Lake) lakes += 1;
    if (field.water[cell] === Water.Ocean) ocean += 1;
  }

  log(
    `  ${field.rivers.segments.length} runs of river from ${heads.length} heads, ` +
      `${intoLakes} of them into lakes; ${lakes} cells of lake, ${ocean} of sea; ` +
      `around the middle, ${onRivers.length} of ${around.length} parcels are river and ` +
      `${banks.length} are bank`,
  );

  const checks: [string, boolean][] = [
    ['the field is cut at half a parcel', Math.abs(FIELD * 2 - PARCEL) < 1e-9],
    ['every river reaches the sea or a lake', stranded === 0],
    ['no water runs uphill', climbed === 0],
    ['a world has rivers at all', field.rivers.segments.length > 200 && heads.length > 20],
    ['a world has lakes', lakes > 0],
    ['a river carries what it takes to be one', riversCarryWater],
    ['a tile the water runs through takes a well', wellsAreSited && wellsGoOnBanks],
    ['outside the claim a bank is refused for the claim, not the ground', banksOutsideRefusedForTheClaim],
    ['dry ground refuses one', wellsRefusedOnDry],
    ['a tile beside fresh water has water', besideWater.length > 0 && shoresGiveWater],
    ['a tile with only the sea beside it does not', saltOnly.length > 0 && seaGivesNothing],
    ['a river wide enough to stand in is water', riversBlock],
    ['no hearth is set in the water', nothingFoundedInWater],
    ['nobody walks out into the water', noWalkInWater],
    ['nothing is built in the water', nothingBuiltInWater],
    ['the same seed builds the same world', sameGround && sameRivers],
  ];

  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-7',
    title: 'Water',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `${field.rivers.segments.length} runs of river, ${banks.length} banks to put a well on, ${lakes} cells of lake`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}

function riverHeads(field: ReturnType<typeof fieldFor>): number[] {
  const { grid } = field;
  const fed = new Uint8Array(field.rivers.of.length);

  for (let cell = 0; cell < field.rivers.of.length; cell += 1) {
    if (field.rivers.of[cell] === 0) continue;
    const into = field.into[cell]!;
    if (into >= 0) fed[into] = 1;
  }

  const heads: number[] = [];
  for (let cell = 0; cell < field.rivers.of.length; cell += 1) {
    if (field.rivers.of[cell] !== 0 && fed[cell] !== 1) heads.push(cell);
  }

  void grid;
  return heads;
}
