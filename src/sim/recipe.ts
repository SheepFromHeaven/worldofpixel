import type { FuelId } from './models/heat.ts';
import type { ItemType as Item } from './types.ts';

export type RecipeId = string;

export type Capability = 'heat' | 'smoulder';

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

export const clampCharge = (charge: number): number =>
  Math.min(Math.max(0, Math.round(charge)), CHARGE_STEPS.length - 1);

export interface RecipeSpec {
  id: RecipeId;
  label: string;
  inputs: readonly Stack[];
  outputs: readonly Stack[];
  ticks: number;
}

export interface ChargedSpec extends RecipeSpec {
  charge?: number;
}

export interface FiredSpec extends ChargedSpec {
  damper?: number;
  fuel?: FuelId;
  needsHeat?: number;
}

export type CharredSpec = ChargedSpec;

export type SavedRecipe =
  | ({ kind: 'plain' } & RecipeSpec)
  | ({ kind: 'fired' } & FiredSpec)
  | ({ kind: 'charred' } & CharredSpec);

export class Recipe {
  readonly id: RecipeId;
  readonly label: string;
  readonly inputs: readonly Stack[];
  readonly outputs: readonly Stack[];
  readonly ticks: number;

  constructor(spec: RecipeSpec) {
    this.id = spec.id;
    this.label = spec.label;
    this.inputs = spec.inputs.map((input) => ({ ...input }));
    this.outputs = spec.outputs.map((output) => ({ ...output }));
    this.ticks = spec.ticks;
  }

  get needs(): Capability | undefined {
    return undefined;
  }

  toSpec(): RecipeSpec {
    return {
      id: this.id,
      label: this.label,
      inputs: this.inputs.map((input) => ({ ...input })),
      outputs: this.outputs.map((output) => ({ ...output })),
      ticks: this.ticks,
    };
  }

  save(): SavedRecipe {
    return { kind: 'plain', ...this.toSpec() };
  }

  trace(): string {
    return this.id;
  }

  with(changes: Partial<RecipeSpec>): Recipe {
    return new Recipe({ ...this.toSpec(), ...changes });
  }
}

export abstract class ChargedRecipe extends Recipe {
  readonly charge: number;

  constructor(spec: ChargedSpec) {
    super(spec);
    this.charge = clampCharge(spec.charge ?? CHARGE_STEADY);
  }

  get rate(): number {
    return CHARGE_STEPS[this.charge]?.rate ?? 1;
  }

  override toSpec(): ChargedSpec {
    return { ...super.toSpec(), charge: this.charge };
  }

  override trace(): string {
    return `${super.trace()}|${this.charge}`;
  }

  abstract override with(changes: Partial<ChargedSpec>): ChargedRecipe;

  withCharge(charge: number): ChargedRecipe {
    return this.with({ charge });
  }
}

export class FiredRecipe extends ChargedRecipe {
  readonly damper?: number;
  readonly fuel?: FuelId;
  readonly needsHeat?: number;

  constructor(spec: FiredSpec) {
    super(spec);
    if (spec.damper !== undefined) this.damper = spec.damper;
    if (spec.fuel !== undefined) this.fuel = spec.fuel;
    if (spec.needsHeat !== undefined) this.needsHeat = spec.needsHeat;
  }

  override get needs(): Capability {
    return 'heat';
  }

  override toSpec(): FiredSpec {
    return {
      ...super.toSpec(),
      ...(this.damper !== undefined ? { damper: this.damper } : {}),
      ...(this.fuel !== undefined ? { fuel: this.fuel } : {}),
      ...(this.needsHeat !== undefined ? { needsHeat: this.needsHeat } : {}),
    };
  }

  override save(): SavedRecipe {
    return { kind: 'fired', ...this.toSpec() };
  }

  override trace(): string {
    return `${super.trace()}/${this.damper ?? '-'}/${this.fuel ?? '-'}`;
  }

  override with(changes: Partial<FiredSpec>): FiredRecipe {
    return new FiredRecipe({ ...this.toSpec(), ...changes });
  }

  withDamper(damper: number): FiredRecipe {
    return this.with({ damper });
  }
}

export class CharredRecipe extends ChargedRecipe {
  override get needs(): Capability {
    return 'smoulder';
  }

  override save(): SavedRecipe {
    return { kind: 'charred', ...this.toSpec() };
  }

  override with(changes: Partial<CharredSpec>): CharredRecipe {
    return new CharredRecipe({ ...this.toSpec(), ...changes });
  }
}

export function recipeFrom(saved: SavedRecipe): Recipe {
  if (saved.kind === 'fired') return new FiredRecipe(saved);
  if (saved.kind === 'charred') return new CharredRecipe(saved);
  return new Recipe(saved);
}
