import type { BuildParams, CharResult, FuelId, GlowStep, RigId } from './models/heat.ts';
import { AMBIENT, RIGS, char, envelopeOf, fire, glowOf } from './models/heat.ts';
import type { Capability, Recipe, RecipeId, Stack } from './recipe.ts';
import { ChargedRecipe, FiredRecipe } from './recipe.ts';
import { ItemType } from './types.ts';

export type StationSpecId = RigId | 'clamp' | 'cordWalk' | 'weavingFrame' | 'daubPit';

export type HandStationId = 'cordWalk' | 'weavingFrame' | 'daubPit';

const HAND_STATIONS: readonly HandStationId[] = ['cordWalk', 'weavingFrame', 'daubPit'];

function isHandStation(spec: StationSpecId): spec is HandStationId {
  return (HAND_STATIONS as readonly StationSpecId[]).includes(spec);
}

export const CLAMP_BUILD = { wood: 5, billet: 0.45 };

export const CLAMP_VENTS = [0.12, 0.4, 0.75] as const;

export const WARM_WALL = 1.3;

export const CHANGEOVER_TICKS = 45;

const INERT: BuildParams = { vent: 1, flue: 0, wall: 1, chamber: 1, maxRate: 0 };

export type RefusalKind = 'unknown' | 'wrong-process' | 'envelope' | 'inputs' | 'full';

export interface Refusal {
  recipeId: RecipeId;
  kind: RefusalKind;
  why: string;
}

export interface Heat {
  T: number;
  glow: GlowStep;
  starved: boolean;
}

export interface StationState {
  spec: StationSpecId;
  running: { recipeId: RecipeId; progress: number } | null;
  last?: RecipeId;
  changeover: number;
  warm?: true;
}

export abstract class Station {
  readonly spec: StationSpecId;
  running: { recipeId: RecipeId; progress: number } | null = null;
  last?: RecipeId;
  changeover = 0;
  warm?: true;

  constructor(spec: StationSpecId) {
    this.spec = spec;
  }

  abstract readonly offers: readonly Capability[];
  abstract readonly crew: Readonly<{ min: number; max: number }>;

  get changeoverTicks(): number {
    return 0;
  }

  get build(): BuildParams {
    return { ...INERT };
  }

  ceiling(): number {
    return AMBIENT;
  }

  enclose(): void {}

  refuse(recipe: Recipe): { kind: RefusalKind; why: string } | null {
    if (recipe.needs !== undefined && !this.offers.includes(recipe.needs)) {
      return { kind: 'wrong-process', why: 'not a method for this kind of rig' };
    }
    return null;
  }

  accepts(recipe: Recipe): boolean {
    return this.refuse(recipe) === null;
  }

  cost(recipe: Recipe): readonly Stack[] {
    return recipe.inputs;
  }

  yields(recipe: Recipe): readonly Stack[] {
    return recipe.outputs;
  }

  duration(recipe: Recipe): number {
    return Math.max(1, recipe.ticks);
  }

  heat(_recipe: Recipe | undefined): Heat {
    return { T: AMBIENT, glow: glowOf(AMBIENT), starved: false };
  }

  spoiled(_recipe: Recipe): boolean {
    return false;
  }
}

export class HandStation extends Station {
  readonly offers: readonly Capability[] = [];
  readonly crew = { min: 1, max: 3 };
}

export class FireStation extends Station {
  readonly offers: readonly Capability[] = ['heat'];
  readonly crew = { min: 1, max: 2 };
  readonly rig: RigId;

  constructor(spec: RigId) {
    super(spec);
    this.rig = spec;
  }

  override get changeoverTicks(): number {
    return CHANGEOVER_TICKS;
  }

  override enclose(): void {
    this.warm = true;
  }

  override get build(): BuildParams {
    const build = RIGS[this.rig].build;
    return this.warm ? { ...build, wall: build.wall * WARM_WALL } : { ...build };
  }

  firing(recipe: FiredRecipe): { fuel: FuelId; damper: number; fuelRate: number } {
    return { fuel: recipe.fuel ?? 'wood', damper: recipe.damper ?? 1, fuelRate: recipe.rate };
  }

  override refuse(recipe: Recipe): { kind: RefusalKind; why: string } | null {
    const wrong = super.refuse(recipe);
    if (wrong) return wrong;
    if (!(recipe instanceof FiredRecipe) || recipe.needsHeat === undefined) return null;
    const ceiling = this.ceiling();
    if (recipe.needsHeat <= ceiling) return null;
    return {
      kind: 'envelope',
      why: `needs ${glowOf(recipe.needsHeat).name}; this rig tops out at ${glowOf(ceiling).name}`,
    };
  }

  override ceiling(): number {
    return envelopeOf({ ...RIGS[this.rig], build: this.build }).T;
  }

  override cost(recipe: Recipe): readonly Stack[] {
    if (!(recipe instanceof ChargedRecipe)) return super.cost(recipe);
    return recipe.inputs.map((input) => ({
      item: input.item,
      amount: Math.max(1, Math.round(input.amount * recipe.rate)),
    }));
  }

  override duration(recipe: Recipe): number {
    if (!(recipe instanceof FiredRecipe)) return super.duration(recipe);
    const out = fire({ ...this.build, ...this.firing(recipe) });
    return Math.max(1, Math.round(recipe.ticks / Math.max(0.05, out.burn)));
  }

  override heat(recipe: Recipe | undefined): Heat {
    if (!(recipe instanceof FiredRecipe)) return super.heat(recipe);
    const out = fire({ ...this.build, ...this.firing(recipe) });
    return { T: out.T, glow: out.glow, starved: out.starved };
  }

  override spoiled(recipe: Recipe): boolean {
    if (!(recipe instanceof FiredRecipe) || recipe.needsHeat === undefined) return false;
    return this.heat(recipe).T < recipe.needsHeat;
  }
}

export class CharStation extends Station {
  readonly offers: readonly Capability[] = ['smoulder'];
  readonly crew = { min: 1, max: 3 };

  override get changeoverTicks(): number {
    return CHANGEOVER_TICKS;
  }

  pile(recipe: Recipe): CharResult {
    const charge = recipe instanceof ChargedRecipe ? recipe.charge : 1;
    const step = Math.min(Math.max(0, charge), CLAMP_VENTS.length - 1);
    return char({ ...CLAMP_BUILD, vent: CLAMP_VENTS[step] ?? CLAMP_VENTS[1] });
  }

  override ceiling(): number {
    const widest = CLAMP_VENTS[CLAMP_VENTS.length - 1] ?? CLAMP_VENTS[1];
    return char({ ...CLAMP_BUILD, vent: widest }).T;
  }

  override yields(recipe: Recipe): readonly Stack[] {
    const pile = this.pile(recipe);
    return [
      {
        item: pile.grade === 'brands' ? ItemType.Brands : ItemType.Charcoal,
        amount: Math.max(1, Math.round(pile.charcoal)),
      },
    ];
  }

  override duration(recipe: Recipe): number {
    return Math.max(1, Math.round(this.pile(recipe).minutes * (recipe.ticks / 12)));
  }

  override heat(recipe: Recipe | undefined): Heat {
    if (!recipe) return super.heat(recipe);
    const pile = this.pile(recipe);
    return { T: pile.T, glow: glowOf(pile.T), starved: pile.grade === 'brands' };
  }
}

export function createStation(spec: StationSpecId): Station {
  if (spec === 'clamp') return new CharStation(spec);
  if (isHandStation(spec)) return new HandStation(spec);
  return new FireStation(spec);
}

export function stationState(station: Station): StationState {
  return {
    spec: station.spec,
    running: station.running ? { ...station.running } : null,
    changeover: station.changeover,
    ...(station.last !== undefined ? { last: station.last } : {}),
    ...(station.warm ? { warm: station.warm } : {}),
  };
}

export function stationFrom(state: StationState): Station {
  const station = createStation(state.spec);
  station.running = state.running ? { ...state.running } : null;
  station.changeover = state.changeover;
  if (state.last !== undefined) station.last = state.last;
  if (state.warm) station.warm = state.warm;
  return station;
}

export function cloneStation(station: Station): Station {
  return stationFrom(stationState(station));
}
