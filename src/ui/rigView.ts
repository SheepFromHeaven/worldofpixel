import type { RefusalKind } from '../sim/process.ts';
import type { ItemType as Item } from '../sim/types.ts';

/**
 * What the rig panel draws, as plain data.
 *
 * Kept apart from `game.ts` on purpose: `game.ts` raises a world the moment it is imported, so
 * anything that reaches it cannot be stood on the HUD bench — and the slab is exactly the kind
 * of drawing that wants looking at without waiting several seconds for a world first.
 */

/**
 * One entry of a rig's queue.
 *
 * The stock and the mark together are the stop condition, which is kept as goods on a shelf
 * with a scratch where the player wants them to stop rather than as a number in a field: it is
 * how it would really be kept, and it puts the count in the same place as the stuff.
 */
export interface QueueEntry {
  id: string;
  label: string;
  /** What it makes, which is the thing drawn on the shelf. */
  item: Item | null;
  stock: number;
  target: number | null;
  running: boolean;
  /**
   * Why this entry is being passed over, as the book's own kind.
   *
   * The *kind* and not only the words, because the drawing is the message and the words are the
   * backup: an entry the rig cannot run is crossed through, and one whose shelf is already full
   * to the mark is not — it has done what it was asked, and a cross would call that a fault.
   * Null when it is the one running, or when nothing above it stopped it. Optional only so
   * that `game.ts` can be taught to fill it in separately — until it is, nothing is crossed,
   * which is the safe half of the mistake: a missing cross is the panel as it was, and a cross
   * on a method that has simply finished is a lie.
   */
  refusal?: RefusalKind | null;
  /** In plain words, why. Empty when it is the one running. */
  why: string;
}

export interface RigView {
  buildingId: string;
  /** Which banking is set, as an index into `CHARGE_STEPS`. The one knob the hearth has. */
  charge: number;
  /**
   * The fire is down and going back up between two methods. The strip sits back while it is,
   * because a setting you can change but that is not driving anything is a lie about the rig.
   */
  changingOver: boolean;
  queue: QueueEntry[];
}

/** What the panel may do to the town. Passed in, so the slab itself knows nothing of the game. */
export interface RigHand {
  charge: (charge: number) => void;
  stop: (methodId: string, target: number) => void;
  move: (methodId: string, by: number) => void;
}

/** A refusal the rig cannot work round, which is the one the entry is crossed through for. */
export function isStruck(entry: QueueEntry): boolean {
  return entry.refusal !== undefined && entry.refusal !== null && entry.refusal !== 'done';
}

/**
 * How long a shelf is, in boards.
 *
 * It lives here rather than beside the drawing because it is a limit on what the panel can
 * *say*, not a detail of how it says it: a board is exactly the width an item icon is baked at
 * and the slab is a fixed width, so seven is as many as there are. A method whose target is
 * further out than this cannot have its mark put where it belongs, which is a thing the book
 * and the panel have to agree about.
 */
export const SHELF_SLOTS = 7;

/**
 * Where the scratch goes, and whether the shelf is long enough to carry it.
 *
 * Clamped silently, which is what this did, a target of twelve drew a mark at seven: a readout
 * saying something the book does not mean, and the one state in the game nobody could see was
 * wrong. So the overflow comes back as a flag and the panel writes the number out instead.
 */
export function shelfMark(target: number | null): { slot: number; beyond: boolean } | null {
  if (target === null || target <= 0) return null;
  return { slot: Math.min(target, SHELF_SLOTS), beyond: target > SHELF_SLOTS };
}
