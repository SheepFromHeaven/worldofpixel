import type { IconName } from '../pixel/ui/metrics.ts';
import type { ItemType as Item } from '../sim/types.ts';
import type { Batch, QueueEntry, RigView, Standing } from './rigView.ts';

/**
 * What the area sheet draws, as plain data (`docs/methods.html` §3, the second view).
 *
 * The slot row as pictures, one ordered list of what is made here, one shared shelf, and five
 * pips for how far the area has been built round. No title and no name: what stands in it is
 * what identifies it. Kept apart from `game.ts` for the same reason `rigView.ts` is — the bench
 * has to stand it against nothing.
 */

export interface SlotView {
  /** What stands in it, or null for an empty patch of ground. */
  icon: IconName | null;
  /** Its name, for the tag a picture cannot carry. Null when empty. */
  label: string | null;
  /** A station with knobs, which opening the slot shows. A land work has none. */
  station: boolean;
  /** Working right now: a batch under way, or somebody on a shift. */
  busy: boolean;
  /** Every line it has is short of something, so it is standing still for want of goods. */
  blocked: boolean;
  /** Whether it can be taken out: the fire the town is founded round and a chimney cannot. */
  removable: boolean;
}

/** One line of the area's list: a method, and the station providing it, drawn beside it. */
export interface ListLine extends QueueEntry {
  slot: number;
  icon: IconName;
  /** The input the line is short of, when that is why it is not running. */
  short: Item | null;
}

/** Something that could stand in an empty slot, and whether this one can take it. */
export interface Choice {
  designId: string;
  icon: IconName;
  label: string;
  ok: boolean;
  reason: string;
}

/** The next stage the area could be built up to, what it costs, and how far it has got. */
export interface Raise {
  name: string;
  slots: number;
  cost: { item: Item; amount: number; have: number }[];
  ordered: boolean;
  /** How far the building is, 0 to 1, once the goods are all on the shelf. */
  progress: number;
}

export interface AreaView {
  buildingId: string;
  /** How far it has been built round: 0 a clearing, up to `stages - 1` a stone works. */
  stage: number;
  stages: number;
  slots: SlotView[];
  /** Slots the next stage would add, drawn struck through, with the stage that opens them. */
  locked: { stage: string }[];
  /** The slot whose panel is open under the row, if one is. */
  open: number | null;
  /** What is made here, in order: every station's lines in one list. */
  list: ListLine[];
  /** The land works standing here, each a shift drawn like a line of the list. */
  grounds: (Batch & { icon: IconName; slot: number })[];
  shelf: Standing;
  capacity: number;
  /** The open station's knobs. Only knobs live in the slot; the list is the area's. */
  panel: RigView | null;
  /** What could stand in the open slot, when it is empty. */
  choices: Choice[] | null;
  raise: Raise | null;
  /** The open slot's pool, with the exact chances, which the list only draws as ten pips. */
  odds: { item: Item; chance: number }[] | null;
  /** Said only while it means something: a site still being cleared. */
  state: string | null;
}

export interface AreaHand {
  open: (slot: number | null) => void;
  charge: (charge: number) => void;
  move: (methodId: string, slot: number, by: number) => void;
  place: (designId: string) => void;
  raise: () => void;
  remove: (slot: number) => void;
  close: () => void;
}
