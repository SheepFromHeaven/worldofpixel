import { blocksOf } from './buildings.ts';
import type { Vec2 } from './geometry.ts';
import { cornerNode } from './footpaths.ts';
import type { NodeId } from './footpaths.ts';
import { parcelOf } from './parcels.ts';
import { biomeAt } from './terrain.ts';
import { isWater } from './worldfield.ts';
import { BlockKind } from './types.ts';
import type { Block, Building, ItemType } from './types.ts';
import type { GameWorld } from './world.ts';

/**
 * Which way a bay faces, out in the world.
 *
 * The floor plan is a square grid and the ground is an irregular lattice, and they never have to
 * agree about shape — only about *direction*. A bay sits somewhere on the floor, so it
 * has a bearing from the middle of the floor; the parcel has half a dozen corners, each with a
 * bearing of its own; the bay is served from whichever corner lies nearest its bearing.
 *
 * That is the whole of the coupling between the inside and the outside, and it is why none of
 * this needs the parcels to be square — and why a bay may be laid anywhere, which a door in a
 * wall could not. A bay in the middle of the floor is served from whichever way it leans; dead
 * centre, it has no bearing at all and the carrier walks to the middle as it always did. It is also already in the footpath network: a parcel's
 * middle joins only to its own corners, so every walk to a building *already* ends at one of
 * them — the game simply used to throw away which. Aiming the last step at the door's corner
 * instead means a carrier walks round to the right side of the building, and since paths are
 * worn by walking (`footpaths.ts`), the track to the door appears because it was used.
 *
 * Derived on every call from the building and the lattice, like a claim: nothing is stored, so
 * nothing can disagree with the squares the player laid.
 */

/** How far apart two bearings are, never more than half a turn. */
function gap(a: number, b: number): number {
  const turn = Math.PI * 2;
  const raw = Math.abs(((a - b) % turn) + turn) % turn;
  return raw > Math.PI ? turn - raw : raw;
}

/**
 * The corner of the building's parcel a bay is served from, or null for a bay with no bearing at
 * all — one in the dead centre of the floor, which leans no way and is reached from the middle.
 */
export function zoneCornerOf(world: GameWorld, building: Building, block: Block): NodeId | null {
  const dx = block.x + 0.5 - building.design.width / 2;
  const dy = block.y + 0.5 - building.design.height / 2;
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return null;

  const vertices = parcelOf(world.seed, building.cellId).vertices;
  if (vertices.length < 3) return null;

  const site = parcelOf(world.seed, building.cellId).site;
  const want = Math.atan2(dy, dx);

  let best: Vec2 | null = null;
  let bestGap = Infinity;
  for (const vertex of vertices) {
    // A bay cannot be served across water: nobody can stand there, and the walking network makes that
    // corner impassable. The door takes the next-nearest corner instead, which is what a builder
    // would do with a shed on a bank.
    if (isWater(biomeAt(world.seed, vertex))) continue;
    const bearing = Math.atan2(vertex.y - site.y, vertex.x - site.x);
    const off = gap(bearing, want);
    // Strictly nearer, so a tie goes to the corner declared first and the walk is the same walk
    // on every machine and every run.
    if (off < bestGap) {
      bestGap = off;
      best = vertex;
    }
  }

  return best ? cornerNode(best) : null;
}

/**
 * The square a carrier deals with at a building, and so the side it walks round to: the bay it
 * drops a load on, or the one it collects from.
 *
 * Declaration order decides when a building has two that would serve, which is the same rule the
 * interior runs in — so the busiest door is the first one drawn, and moving it is a decision the
 * player can make.
 */
export function dockZone(
  building: Building,
  item: ItemType,
  role: 'give' | 'take',
): Block | null {
  let bin: Block | null = null;

  for (const { block, state } of blocksOf(building)) {
    if (role === 'give') {
      if (block.kind === BlockKind.Input && block.item === item) return block;
    } else if (block.kind === BlockKind.Output && (state.held?.item ?? item) === item) {
      return block;
    }

    if (block.kind !== BlockKind.Storage || bin) continue;
    // A bin serves either way, but only for what it holds — an empty one takes anything, and a
    // claimed one is the door for its own item and nothing else.
    const held = state.held;
    if (role === 'give' ? !held || held.amount === 0 || held.item === item : held?.item === item) {
      bin = block;
    }
  }

  return bin;
}

/** Where a carrier's walk to this building should end, or null to walk to the middle. */
export function approachTo(
  world: GameWorld,
  building: Building,
  item: ItemType,
  role: 'give' | 'take',
): NodeId | null {
  const block = dockZone(building, item, role);
  return block ? zoneCornerOf(world, building, block) : null;
}
