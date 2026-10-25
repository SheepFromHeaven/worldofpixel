import { hash2 } from '../../sim/rng.ts';
import { ItemType, stackStage } from '../../sim/people/items.ts';
import type { People } from '../../sim/people/people.ts';
import { EntityState, STRIKE_INTERVAL } from '../../sim/people/people.ts';
import { flameTier } from '../../sim/sources/fuel.ts';
import type { World } from '../../sim/world.ts';
import { TEXEL } from '../terrainPixels.ts';
import type { LitView } from './litLayer.ts';
import { flagsOf } from './litLayerConstants.ts';
import type { SpriteSheetEntry } from './propPlacementCache.ts';

const ITEM_NAMES: readonly string[] = ['', 'flint', 'stone', 'kindling', 'branch', 'axe', 'torch', 'branch'];

const PEOPLE_NAMES: readonly string[] = ['adam', 'eve'];

const KIND_SLOTS = 8;

const SHARED_TILE_OFFSETS: readonly (readonly [number, number])[] = [
  [-3, -3],
  [3, 3],
  [3, -3],
  [-3, 3],
];

const LYING_TORCH_HEAD = [3.1, 1.3] as const;

const HELD_TORCH_HEAD = [3.25, 1] as const;

const HAND_REACH_TEXELS: Record<string, number> = { stand: 4, walk2: 3, walk1: 3, walk0: 3, walkM1: 3, walkM2: 3, kneel: 7, reach: 8, lie: 2 };

const FLAME_BEAT = 6;

const SPARK_SECONDS = 0.25;

const SPARK_ANGLES = [0.3, 1.5, 2.6, 3.9, 5.2];

const BREATH_BELOW_CELSIUS = 8;

const BREATH_PERIOD_SECONDS = 3.2;

const BREATH_SECONDS = 1.2;

const BREATH_FRAMES = 3;

const BREATH_MOUTH_TEXELS = 3.5;

const BREATH_DRIFT_TEXELS = 5;

const BREATH_RISE_TEXELS = 3;

const SHIVER_BEAT = 8;

const COLD_SHIVER = 35.6;

const GAIT: readonly string[] = ['walk2', 'walk1', 'walk0', 'walkM1', 'walkM2', 'walkM1', 'walk0', 'walk1'];

const STRIDE_PER_FRAME = 0.11;

const RAISE_HELD_TEXELS = 2;

const PIXELS_OFFSCREEN_TILES = 2;

export function folkInstances(
  world: World,
  people: People,
  view: LitView,
  entryOf: (name: string) => SpriteSheetEntry | undefined,
): Float32Array {
  const out: number[] = [];

  const push = (entry: SpriteSheetEntry, x: number, y: number, flip: boolean, height = entry.height, rimmed = false): void => {
    const flags = flagsOf({ ...entry, rimmed, focus: true });
    out.push(x, y, entry.x, entry.y, entry.size, entry.foot.x, entry.foot.y, height, flip ? 1 : 0, 0, entry.sway, flags);
  };

  const halfWide = view.width / (2 * view.zoom) + PIXELS_OFFSCREEN_TILES;
  const halfTall = view.height / (2 * view.zoom) + PIXELS_OFFSCREEN_TILES;
  const seen = (x: number, y: number): boolean => Math.abs(x - view.centre.x) <= halfWide && Math.abs(y - view.centre.y) <= halfTall;

  const burning = (x: number, y: number, headX: number, headY: number, height: number): void => {
    const flame = entryOf(`torch.flame.${Math.floor(view.time * 5 + x * 1.7) % 4}`);
    if (flame) push(flame, x + headX * TEXEL, y + headY * TEXEL, false, height);
  };

  const { items, grid } = world;
  const piles = new Map<number, number>();
  const kindsOn = new Map<number, number>();
  for (let slot = 0; slot < items.used; slot += 1) {
    const kind = items.kind[slot]!;
    if (kind === ItemType.None) continue;
    const key = items.tile[slot]! * KIND_SLOTS + kind;
    const before = piles.get(key) ?? 0;
    piles.set(key, before + 1);
    if (before === 0) kindsOn.set(items.tile[slot]!, (kindsOn.get(items.tile[slot]!) ?? 0) + 1);
  }

  const placed = new Map<number, number>();
  for (const [key, count] of piles) {
    const tile = Math.floor(key / KIND_SLOTS);
    const kind = key % KIND_SLOTS;
    const at = grid.centre(tile);
    if (!seen(at.x, at.y)) continue;

    const entry = entryOf(`item.${ITEM_NAMES[kind]}.s${stackStage(count)}`);
    if (!entry) continue;
    const order = placed.get(tile) ?? 0;
    placed.set(tile, order + 1);
    const apart = (kindsOn.get(tile) ?? 1) > 1 ? SHARED_TILE_OFFSETS[order % SHARED_TILE_OFFSETS.length]! : ([0, 0] as const);
    const x = at.x + apart[0] * TEXEL;
    const y = at.y + apart[1] * TEXEL;
    const torch = (kind === ItemType.Torch || kind === ItemType.BurningBranch) && count === 1;
    push(entry, x, y, torch ? false : hash2(tile, kind, 9) > 0.5, entry.height, true);
    if (torch) burning(x, y, LYING_TORCH_HEAD[0], LYING_TORCH_HEAD[1], entry.height);
  }

  const plot = entryOf('marker.storage');
  if (plot) {
    for (const tile of world.storageTiles) {
      const at = grid.centre(tile);
      if (seen(at.x, at.y)) push(plot, at.x, at.y, false);
    }
  }

  const ring = entryOf('marker.floor');
  if (ring) {
    for (const tile of world.floors) {
      const at = grid.centre(tile);
      if (seen(at.x, at.y)) push(ring, at.x, at.y, false);
    }
  }

  const outline = entryOf('marker.plan');
  if (outline) {
    for (const tile of world.plans) {
      const at = grid.centre(tile);
      if (seen(at.x, at.y)) push(outline, at.x, at.y, false);
    }
  }

  const charred = entryOf('campfire.burnt');
  if (charred) {
    for (const tile of world.embers) {
      const at = grid.centre(tile);
      if (seen(at.x, at.y)) push(charred, at.x, at.y, false);
    }
  }

  const hearth = entryOf('campfire.base');
  if (hearth) {
    for (const tile of world.fires) {
      const at = grid.centre(tile);
      if (!seen(at.x, at.y)) continue;
      push(hearth, at.x, at.y, false);
      const flame = entryOf(`campfire.flame.${flameTier(world.fuelAt(tile))}.${Math.floor(view.time * FLAME_BEAT + tile * 1.7) % 4}`);
      if (flame) push(flame, at.x, at.y, false);
    }
  }

  const spark = entryOf('marker.spark');

  const puffs = Array.from({ length: BREATH_FRAMES }, (_, frame) => entryOf(`marker.breath.${frame}`));

  for (let person = 0; person < people.count; person += 1) {
    const state = people.state[person]!;
    const heading = people.heading[person]!;
    const across = Math.abs(Math.cos(heading)) >= Math.abs(Math.sin(heading));
    const west = across && Math.cos(heading) < 0;
    const facing = across ? 'e' : Math.sin(heading) > 0 ? 's' : 'n';
    const forwardX = across ? (west ? -1 : 1) : 0;
    const forwardY = across ? 0 : facing === 's' ? 1 : -1;

    const kneeling = state === EntityState.ExperimentingKnapping || state === EntityState.Chopping || state === EntityState.Drinking;
    const pose = people.isLying(person)
      ? 'lie'
      : kneeling
        ? 'kneel'
      : state === EntityState.PickingUp || state === EntityState.Lighting || state === EntityState.Planting || state === EntityState.Feeding || state === EntityState.Foraging
        ? 'reach'
        : people.moveSpeed[person]! > 0
          ? GAIT[Math.floor(people.stride[person]! / STRIDE_PER_FRAME) % GAIT.length]!
          : 'stand';

    const entry = entryOf(`person.${PEOPLE_NAMES[person]}.${pose}.${facing}`);
    if (!entry) continue;

    const shiver = people.bodyTemp[person]! < COLD_SHIVER ? (Math.floor(view.time * SHIVER_BEAT + person) % 2 === 0 ? 1 : -1) * TEXEL : 0;
    const x = people.posX[person]! + shiver;
    const y = people.posY[person]!;
    if (!seen(x, y)) continue;
    push(entry, x, y, west);

    const held = people.heldItemType[person]!;
    const carried = held === ItemType.None ? undefined : entryOf(`item.${ITEM_NAMES[held]}.held`);
    const reach = (HAND_REACH_TEXELS[pose] ?? 4) * TEXEL;
    if (carried) {
      push(carried, x + forwardX * reach, y + forwardY * reach, false, entry.height + RAISE_HELD_TEXELS);
      if (held === ItemType.Torch || held === ItemType.BurningBranch) burning(x + forwardX * reach, y + forwardY * reach, HELD_TORCH_HEAD[0], HELD_TORCH_HEAD[1], entry.height + RAISE_HELD_TEXELS);
    }

    if (people.air[person]! < BREATH_BELOW_CELSIUS) {
      const cycle = (view.time + person * 1.7) % BREATH_PERIOD_SECONDS;
      if (cycle < BREATH_SECONDS) {
        const along = cycle / BREATH_SECONDS;
        const bitter = people.air[person]! < 0 ? 1 : 0;
        const puff = puffs[Math.min(BREATH_FRAMES - 1, Math.floor(along * BREATH_FRAMES) + bitter)];
        if (puff) {
          const reachOut = (BREATH_MOUTH_TEXELS + along * BREATH_DRIFT_TEXELS) * TEXEL;
          push(
            puff,
            x + forwardX * reachOut,
            y + forwardY * reachOut - along * BREATH_RISE_TEXELS * TEXEL,
            false,
            entry.height + RAISE_HELD_TEXELS,
          );
        }
      }
    }

    if (kneeling && spark) {
      const since = STRIKE_INTERVAL - people.strikeClock[person]!;
      if (since >= 0 && since < SPARK_SECONDS) {
        const spread = ((since / SPARK_SECONDS) * 5 + 1) * TEXEL;
        for (const angle of SPARK_ANGLES) {
          push(
            spark,
            x + forwardX * reach + Math.cos(angle + person) * spread,
            y + forwardY * reach + Math.sin(angle + person) * spread,
            false,
            entry.height + RAISE_HELD_TEXELS,
          );
        }
      }
    }
  }

  return new Float32Array(out);
}
