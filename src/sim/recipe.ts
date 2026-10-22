import type { CharResult, FuelId } from './models/heat.ts';
import { char, fire } from './models/heat.ts';
import type { Rig } from './rig.ts';
import { CLAMP_BUILD, CLAMP_VENTS, heldBuild } from './rig.ts';
import type { ItemType as Item } from './types.ts';

export type RecipeId = string;

export type ProcessId = 'fire' | 'char' | 'hand';

export interface Stack {
  item: Item;
  amount: number;
}

export const CHARGE_STEPS = [
  { name: 'banked', rate: 0.5 },
  { name: 'steady', rate: 1.0 },
  { name: 'roaring', rate: 1.6 },
] as const;

export const CHARGE_LOW = 0;
export const CHARGE_STEADY = 1;
export const CHARGE_HIGH = 2;

export interface RunSettings {
  charge: number;
  damper?: number;
  fuel?: FuelId;
}

export interface RecipeSpec {
  id: RecipeId;
  label: string;
  process: ProcessId;
  inputs: readonly Stack[];
  outputs: readonly Stack[];
  run: RunSettings;
  ticks: number;
  needsHeat?: number;
}

const clampCharge = (charge: number, steps: number): number => Math.min(Math.max(0, charge), steps - 1);

export class Recipe {
  readonly id: RecipeId;
  readonly label: string;
  readonly process: ProcessId;
  readonly inputs: readonly Stack[];
  readonly outputs: readonly Stack[];
  readonly run: Readonly<RunSettings>;
  readonly ticks: number;
  readonly needsHeat?: number;

  constructor(spec: RecipeSpec) {
    this.id = spec.id;
    this.label = spec.label;
    this.process = spec.process;
    this.inputs = spec.inputs.map((input) => ({ ...input }));
    this.outputs = spec.outputs.map((output) => ({ ...output }));
    this.run = { ...spec.run };
    this.ticks = spec.ticks;
    if (spec.needsHeat !== undefined) this.needsHeat = spec.needsHeat;
  }

  with(changes: Partial<RecipeSpec>): Recipe {
    return new Recipe({ ...this, ...changes });
  }

  withCharge(charge: number): Recipe {
    return this.with({ run: { ...this.run, charge } });
  }

  firing(): { fuel: FuelId; damper: number; fuelRate: number } {
    const step = CHARGE_STEPS[clampCharge(this.run.charge, CHARGE_STEPS.length)];
    return {
      fuel: this.run.fuel ?? 'wood',
      damper: this.run.damper ?? 1,
      fuelRate: step ? step.rate : 1,
    };
  }

  pile(): CharResult {
    const step = clampCharge(this.run.charge, CLAMP_VENTS.length);
    return char({ ...CLAMP_BUILD, vent: CLAMP_VENTS[step] ?? CLAMP_VENTS[1] });
  }

  batchTicks(rig: Rig): number {
    if (rig.process === 'hand') return Math.max(1, this.ticks);
    if (rig.process === 'char') return Math.max(1, Math.round(this.pile().minutes * (this.ticks / 12)));
    const out = fire({ ...heldBuild(rig), ...this.firing() });
    return Math.max(1, Math.round(this.ticks / Math.max(0.05, out.burn)));
  }

  cost(rig: Rig): readonly Stack[] {
    if (rig.process !== 'fire') return this.inputs;
    const step = CHARGE_STEPS[clampCharge(this.run.charge, CHARGE_STEPS.length)];
    const rate = step ? step.rate : 1;
    return this.inputs.map((input) => ({
      item: input.item,
      amount: Math.max(1, Math.round(input.amount * rate)),
    }));
  }

  yield(rig: Rig): readonly Stack[] {
    if (rig.process !== 'char') return this.outputs;
    const pile = this.pile();
    const item: Item = pile.grade === 'brands' ? 'Brands' : 'Charcoal';
    return [{ item, amount: Math.max(1, Math.round(pile.charcoal)) }];
  }
}
