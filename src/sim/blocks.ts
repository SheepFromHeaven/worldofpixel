import { recipeById } from './recipes.ts';
import type { Recipe } from './recipes.ts';
import { BlockKind, ItemType } from './types.ts';
import type { Block, BlockState, Buffer, Design, Direction, ItemType as Item } from './types.ts';

export const INPUT_CAPACITY = 8;
export const OUTPUT_CAPACITY = 8;
export const STORAGE_CAPACITY = 8;
export const TRANSPORT_CAPACITY = 1;
export const HOPPER_CAPACITY = 4;
/** What a combine block holds of its own product before it has to hand it on. */
export const COMBINE_CAPACITY = 2;

/** Ticks a square rests after handing its load on — one belt square per two ticks. */
export const PUSH_TICKS = 2;
/** Ticks between an input block drawing another unit out of the ground it stands on. */
export const INTAKE_TICKS = 6;

export function blockCapacity(block: Block): number {
  switch (block.kind) {
    case BlockKind.Input:
      return INPUT_CAPACITY;
    case BlockKind.Output:
      return OUTPUT_CAPACITY;
    case BlockKind.Storage:
      return STORAGE_CAPACITY;
    case BlockKind.Transport:
      return TRANSPORT_CAPACITY;
    default:
      return 0;
  }
}

export function recipeOf(block: Block): Recipe | undefined {
  return block.kind === BlockKind.Combine ? recipeById(block.recipeId) : undefined;
}

export function createBlockState(block: Block): BlockState {
  const hoppers = new Map<Item, Buffer>();
  for (const input of recipeOf(block)?.inputs ?? []) {
    hoppers.set(input.item, { item: input.item, amount: 0, capacity: HOPPER_CAPACITY });
  }

  const recipe = recipeOf(block);
  const held: Buffer | null =
    block.kind === BlockKind.Input || block.kind === BlockKind.Output
      ? { item: block.item, amount: 0, capacity: blockCapacity(block) }
      : recipe
        ? { item: recipe.output, amount: 0, capacity: COMBINE_CAPACITY }
        : null;

  return {
    held,
    hoppers,
    progress: 0,
    cooldown: 0,
  };
}

/** How much of `item` the square will take from inside the building. */
export function blockSpace(block: Block, state: BlockState, item: Item): number {
  switch (block.kind) {
    // The ways in are the boundary, not stops on the line: nothing inside hands back to them.
    case BlockKind.Source:
    case BlockKind.Input:
      return 0;
    // The fire is the centre of the town, not a mouth. What nobody wants goes in the bins
    // around it and can be fetched back out; burning it would make the store a one-way hole.
    case BlockKind.Hearth:
      return 0;
    case BlockKind.Combine: {
      const hopper = state.hoppers.get(item);
      return hopper ? hopper.capacity - hopper.amount : 0;
    }
    case BlockKind.Output:
      return block.item === item ? OUTPUT_CAPACITY - (state.held?.amount ?? 0) : 0;
    case BlockKind.Storage: {
      // Untyped until something lands in it: the first load claims the bin until it empties.
      const stored = state.held;
      if (stored && stored.amount > 0 && stored.item !== item) return 0;
      return STORAGE_CAPACITY - (stored?.amount ?? 0);
    }
    case BlockKind.Transport: {
      // An empty belt takes anything: the item left on a drained buffer is a leftover label,
      // not cargo, and reading it as cargo wedges the line behind one delivered parcel.
      const held = state.held;
      if (held && held.amount > 0 && held.item !== item) return 0;
      return TRANSPORT_CAPACITY - (held?.amount ?? 0);
    }
  }
}

/** How much of `item` a carrier may drop here: the docks are the input blocks and the hearth. */
export function dockSpace(block: Block, state: BlockState, item: Item): number {
  if (block.kind === BlockKind.Storage) return blockSpace(block, state, item);
  if (block.kind !== BlockKind.Input || block.item !== item) return 0;
  return INPUT_CAPACITY - (state.held?.amount ?? 0);
}

/** What the design opens out of the ground, and what has to be carried to its door. */
export function designSources(design: Design): Item[] {
  const items: Item[] = [];
  for (const block of design.blocks) {
    if (block.kind === BlockKind.Source && !items.includes(block.item)) items.push(block.item);
  }
  return items;
}

/** Put units into a square, whatever it keeps them in. Returns how many went in. */
export function placeInBlock(block: Block, state: BlockState, item: Item, amount: number): number {
  if (block.kind === BlockKind.Hearth) return 0;

  if (block.kind === BlockKind.Combine) {
    const hopper = state.hoppers.get(item);
    if (!hopper) return 0;
    const taken = Math.min(amount, hopper.capacity - hopper.amount);
    hopper.amount += taken;
    return taken;
  }

  const capacity = blockCapacity(block);
  if (capacity === 0) return 0;
  if (state.held && state.held.amount > 0 && state.held.item !== item) return 0;

  const held: Buffer =
    state.held && state.held.amount > 0 ? state.held : { item, amount: 0, capacity };
  const taken = Math.min(amount, capacity - held.amount);
  held.amount += taken;
  state.held = held;
  return taken;
}

/** Take units off a square's load, clearing it when the last one goes. */
export function takeFromBlock(state: BlockState, amount: number): number {
  const held = state.held;
  if (!held) return 0;
  const taken = Math.min(amount, held.amount);
  held.amount -= taken;
  return taken;
}

export const DESIGN_SIZE = 5;

export function blockAt(design: Design, x: number, y: number): number {
  return design.blocks.findIndex((block) => block.x === x && block.y === y);
}

/** Bigger machines take up more of their parcel, within what a parcel can hold. */
export function designRadius(design: Design): number {
  return Math.min(1.35, 0.75 + design.blocks.length * 0.05);
}

export function designInputs(design: Design): Item[] {
  const items: Item[] = [];
  for (const block of design.blocks) {
    if (block.kind === BlockKind.Input && !items.includes(block.item)) items.push(block.item);
  }
  return items;
}

export function designOutputs(design: Design): Item[] {
  const items: Item[] = [];
  for (const block of design.blocks) {
    if (block.kind === BlockKind.Output && !items.includes(block.item)) items.push(block.item);
  }
  return items;
}

export function designStores(design: Design): number {
  return design.blocks.filter((block) => block.kind === BlockKind.Storage).length;
}

export function designRecipes(design: Design): Recipe[] {
  const recipes: Recipe[] = [];
  for (const block of design.blocks) {
    const recipe = recipeOf(block);
    if (recipe && !recipes.includes(recipe)) recipes.push(recipe);
  }
  return recipes;
}

export interface DesignCheck {
  ok: boolean;
  reason: string;
}

/**
 * A design has to be drawable on the grid and make some kind of sense as a machine. It does not
 * have to be *useful*: a shed of belts going nowhere is allowed, it just will not do anything.
 */
export function validateDesign(design: Design): DesignCheck {
  if (design.blocks.length === 0) return { ok: false, reason: 'nothing drawn yet' };

  const seen = new Set<string>();
  for (const block of design.blocks) {
    if (block.x < 0 || block.y < 0 || block.x >= design.width || block.y >= design.height) {
      return { ok: false, reason: 'a block sits off the grid' };
    }
    const key = `${block.x}:${block.y}`;
    if (seen.has(key)) return { ok: false, reason: 'two blocks on one square' };
    seen.add(key);
    if (block.kind === BlockKind.Combine && !recipeOf(block)) {
      return { ok: false, reason: 'a combine block has no recipe' };
    }
  }

  if (designSources(design).length + designInputs(design).length + designStores(design) === 0) {
    return { ok: false, reason: 'no way in — open the ground with a source, or add a door' };
  }
  return { ok: true, reason: describeDesign(design) };
}

export function describeDesign(design: Design): string {
  const recipes = designRecipes(design).map((recipe) => recipe.label);
  const made = recipes.length > 0 ? recipes.join(', ') : designOutputs(design).join(', ');
  const drawn = designSources(design);
  const carried = designInputs(design);

  const bins = designStores(design);
  const parts: string[] = [];
  if (drawn.length > 0) parts.push(`draws ${drawn.join(' + ')}`);
  if (carried.length > 0) parts.push(`takes ${carried.join(' + ')}`);
  if (made) parts.push(`makes ${made}`);
  if (bins > 0) parts.push(`stores ${bins * STORAGE_CAPACITY}`);
  return parts.join(' · ') || 'does nothing yet';
}

export const FACING_LABEL: Record<Direction, string> = {
  North: '↑',
  East: '→',
  South: '↓',
  West: '←',
};

export const BLOCK_ITEMS: readonly Item[] = [ItemType.Water, ItemType.Dirt, ItemType.Mud];
