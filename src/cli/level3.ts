import { capacityOf, isStoreArea } from '../sim/area.ts';
import { depositHopper, storedStock, withdraw } from '../sim/buildings.ts';
import { addBuilding } from '../sim/construction.ts';
import { LogisticsEngine } from '../sim/engine.ts';
import { totalHeld } from '../sim/stock.ts';
import { parcelOf } from '../sim/terrain/parcels.ts';
import type { Building, CellId, Design } from '../sim/types.ts';
import { ItemType } from '../sim/types.ts';
import { generateWorld } from '../sim/worldgen.ts';

import type { LevelResult, Logger } from './harness.ts';
import { MIDDLE, SEED, firstEvent, foundBesideWater, freeParcelsNear, harness, play } from './harness.ts';
import { header } from './render.ts';

export function runLevel3(log: Logger): LevelResult {
  log(header('LEVEL 3 — Mud and the town store: what is made ends up at the fire'));
  const run = harness();
  play(run, 20000, log, 2000);

  const hearth = run.settlement.buildings.get(run.settlement.hearthId);
  if (!hearth) throw new Error('a settlement with no hearth');

  const made = firstEvent(run.events, { kind: 'produced', item: ItemType.Mud });
  const stored = totalHeld(hearth);
  const stalled = run.events.filter((event) => event.kind === 'stalled');

  const still = generateWorld(SEED + 11);
  const quiet = foundBesideWater(still).settlement;
  const quietHearth = quiet.buildings.get(quiet.hearthId);

  const handedIn = quietHearth ? depositHopper(quietHearth, ItemType.Pot, 1) : 0;
  const handedBack = quietHearth ? withdraw(quietHearth, ItemType.Pot, 1) : 0;
  const keepsWhatArrives = handedIn === 1 && handedBack === 1;

  const warehouse: Design = { id: 'warehouse', label: 'Warehouse', capacity: 8, store: true };

  const sites = freeParcelsNear(still, quietHearth?.position ?? MIDDLE, 60);
  const put = (id: CellId): Building =>
    addBuilding(still, quiet, parcelOf(still.seed, id), warehouse);
  const first = put(sites[0] ?? '');
  const second = put(sites[1] ?? '');
  first.clearing = null;
  second.clearing = null;
  depositHopper(first, ItemType.Mud, 5);
  new LogisticsEngine(still).run(300);

  const hoarded = storedStock(first, ItemType.Mud);
  const leaked =
    storedStock(second, ItemType.Mud) + storedStock(quietHearth ?? first, ItemType.Mud);

  const checks: [string, boolean][] = [
    ['a bank gives up its mud', Boolean(made)],
    ['what nobody else wanted reaches the town store', stored > 0],
    ['no carrier stalled', stalled.length === 0],
    ['the fire holds what is brought it, and hands it back', keepsWhatArrives],
    ['the fire is the town store, eight of each thing to begin with', isStoreArea(hearth) && capacityOf(hearth) === 8],
    ['a store never feeds another store', hoarded === 5 && leaked === 0],
  ];

  for (const [label, ok] of checks) log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);

  return {
    id: 'level-3',
    title: 'Mud and the store',
    passed: failed.length === 0,
    detail:
      failed.length === 0
        ? `first mud on tick ${made?.tick}, ${stored} standing at the fire`
        : `${failed.length} failed: ${failed.map(([label]) => label).join(', ')}`,
  };
}
