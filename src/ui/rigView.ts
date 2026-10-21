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
  /** In plain words, why this entry is being passed over. Empty when it is the one running. */
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
