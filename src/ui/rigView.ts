import type { ProcessId } from '../sim/book.ts';
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
 * What is standing in a building, in the order it arrived.
 *
 * A building holds a list now rather than a floor of crates, and the list is the only thing
 * left that says where the town's goods actually are — so every slab draws it, rig or no rig.
 * Insertion order is the simulation's, and it is kept: a shelf that reorders itself under the
 * hand is a shelf somebody has tidied, which nobody has.
 */
export type Standing = [Item, number][];

/**
 * A building with no rig in it, opened anyway: its name, how it stands, and what is lying in
 * it. A land work has no setting to choose and a works that holds no rig has none either, and
 * both are still worth looking into.
 */
/** One batch of anything: what it eats, what it makes, how long, and how far through it is. */
export interface Batch {
  uses: { item: Item; amount: number }[];
  makes: { item: Item; amount: number }[];
  seconds: number;
  progress: number;
  /**
   * What each unit of the batch may turn out to be, with its chance, when it is drawn from a
   * pool rather than fixed (the forage camp). `makes` then says only how many units there are.
   */
  pool?: { item: Item; chance: number }[];
}

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
  /**
   * The recipe as it stands at the banking this entry is set to: what one batch eats, what it
   * makes and how long it takes. Worked out by the same functions the rig runs on, so a hotter
   * fire changes the row on screen exactly as it changes the batch.
   */
  uses: { item: Item; amount: number }[];
  makes: { item: Item; amount: number }[];
  /** How long one batch takes, in seconds. */
  seconds: number;
  running: boolean;
  /** How far through its batch it is, 0 to 1. Zero unless it is the one running. */
  progress: number;
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
  /** What the building is called, which is what the popup is headed with. */
  label: string;
  /** How much of each thing it can hold, which is the figure written after every count. */
  capacity: number;
  /**
   * What is under this rig, which decides whether there is a knob at all and what it is a
   * picture of.
   *
   * The process itself and not a `hasKnob` flag, because the three answers are three different
   * drawings and a flag would fold two of them together at exactly the place they differ: a
   * fire's knob is how hard it is driven, a clamp's is how far its vents are open, and a hand
   * rig has none. Collapsed to a boolean, the clamp would have to borrow the fire's strip for
   * ever with nothing in the view model saying it was borrowing.
   */
  process: ProcessId;
  /** Which banking is set, as an index into `CHARGE_STEPS`. The one knob the hearth has. */
  charge: number;
  /**
   * Which bankings the building holds the fuel to pay for, one flag per `CHARGE_STEPS` entry. A
   * banking nobody can afford is shown, dim and dead, rather than hidden: the strip keeps its
   * three fires so the player can see what more wood would buy.
   */
  affordable: boolean[];
  /**
   * The fire is down and going back up between two methods. The strip sits back while it is,
   * because a setting you can change but that is not driving anything is a lie about the rig.
   */
  changingOver: boolean;
  queue: QueueEntry[];
  /**
   * Everything standing in the building, not only what the queue is about. A rig takes its
   * inputs out of the same pile the carriers leave them in, and a queue drawn without that
   * pile says what the rig wants and never what it has.
   */
  stock: Standing;
}
