export interface Fuel {
  readonly burn: number;
  readonly feeds: boolean;
}

export interface Food {
  readonly kcal: number;
  readonly poisonous: boolean;
  readonly cooksTo: string | null;
}

export interface Stackable {
  readonly size: number;
}

export interface Found {
  readonly cap: number;
  readonly on: Readonly<Record<string, number>>;
}

export interface ItemPart {
  readonly found?: Found;
  readonly fuel?: Fuel;
  readonly food?: Food;
  readonly stackable?: Stackable;
}

export interface ItemDef {
  readonly key: string;
  readonly name: string;
  readonly art: string;
  readonly fuel: Fuel | null;
  readonly food: Food | null;
  readonly stackable: Stackable | null;
  readonly found: Found | null;
}

export const item = (key: string, name: string, art: string, ...parts: readonly ItemPart[]): ItemDef => {
  const merged: { fuel?: Fuel; food?: Food; stackable?: Stackable; found?: Found } = {};
  for (const part of parts) Object.assign(merged, part);
  return { key, name, art, fuel: merged.fuel ?? null, food: merged.food ?? null, stackable: merged.stackable ?? null, found: merged.found ?? null };
};

export const fuel = (burn: number, { feeds = false }: { feeds?: boolean } = {}): ItemPart => ({ fuel: { burn, feeds } });

export const food = ({ kcal, poisonous = false, cooksTo = null }: { kcal: number; poisonous?: boolean; cooksTo?: string | null }): ItemPart => ({ food: { kcal, poisonous, cooksTo } });

export const stackable = ({ size = 32 }: { size?: number } = {}): ItemPart => ({ stackable: { size } });

export const found = (cap: number, on: Readonly<Record<string, number>>): ItemPart => ({ found: { cap, on } });
