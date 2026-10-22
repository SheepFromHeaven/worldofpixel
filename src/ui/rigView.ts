import type { RefusalKind } from '../sim/process.ts';
import type { ProcessId } from '../sim/recipe.ts';
import type { ItemType as Item } from '../sim/types.ts';

export type Standing = [Item, number][];

export interface Batch {
  uses: readonly { item: Item; amount: number }[];
  makes: readonly { item: Item; amount: number }[];
  seconds: number;
  progress: number;
  pool?: { item: Item; chance: number }[];
}

export interface QueueEntry extends Batch {
  id: string;
  label: string;
  running: boolean;
  refusal?: RefusalKind | null;
  why: string;
}

export interface FireView {
  process: ProcessId;
  charge: number;
  affordable: boolean[];
  changingOver: boolean;
}
