import type { IconName } from '../pixel/ui/metrics.ts';
import type { ItemType as Item } from '../sim/types.ts';
import type { Batch, QueueEntry, FireView, Standing } from './rigView.ts';

export interface SlotView {
  icon: IconName | null;
  label: string | null;
  station: boolean;
  busy: boolean;
  blocked: boolean;
  removable: boolean;
}

export interface ListLine extends QueueEntry {
  slot: number;
  icon: IconName;
  short: Item | null;
}

export interface Choice {
  designId: string;
  icon: IconName;
  label: string;
  ok: boolean;
  reason: string;
}

export interface Raise {
  name: string;
  slots: number;
  cost: { item: Item; amount: number; have: number }[];
  ordered: boolean;
  takes?: string;
  progress: number;
}

export interface AreaView {
  buildingId: string;
  stage: number;
  stages: number;
  slots: SlotView[];
  locked: { stage: string }[];
  open: number | null;
  list: ListLine[];
  grounds: (Batch & {
    icon: IconName;
    slot: number;
    recipe: number;
    recipes: { item: Item; chance: number }[][];
  })[];
  shelf: Standing;
  capacity: number;
  panel: FireView | null;
  choices: Choice[] | null;
  raise: Raise | null;
  state: string | null;
}

export interface AreaHand {
  open: (slot: number | null) => void;
  charge: (charge: number) => void;
  move: (methodId: string, slot: number, by: number) => void;
  place: (designId: string) => void;
  raise: () => void;
  recipe: (slot: number, index: number) => void;
  remove: (slot: number) => void;
  close: () => void;
}
