import {
  INTAKE_TICKS,
  PUSH_TICKS,
  blockAt,
  blockSpace,
  createBlockState,
  designRadius,
  dockSpace,
  placeInBlock,
  recipeOf,
  takeFromBlock,
} from './blocks.ts';
import { cloneDesign } from './designs.ts';
import type { Vec2 } from './geometry.ts';
import { BlockKind, BuildingState, ITEM_TYPES, STEP } from './types.ts';
import type {
  Block,
  BlockState,
  Buffer,
  Building,
  BuildingId,
  CellId,
  Design,
  ItemType,
} from './types.ts';

export function createBuilding(
  id: BuildingId,
  design: Design,
  cellId: CellId,
  position: Vec2,
  yields: ItemType[],
): Building {
  const own = cloneDesign(design);
  return {
    id,
    designId: design.id,
    design: own,
    cellId,
    position,
    blocks: own.blocks.map((block) => createBlockState(block)),
    yields: [...yields],
    state: BuildingState.Idle,
    delivered: new Map(),
    producedTotal: 0,
  };
}

export function radiusOf(building: Building): number {
  return designRadius(building.design);
}

export function labelOf(building: Building): string {
  return building.design.label;
}

/** Walk the blocks with their live state, in the order the design declares them. */
export function blocksOf(building: Building): { block: Block; state: BlockState }[] {
  return building.design.blocks.map((block, index) => ({
    block,
    state: building.blocks[index] as BlockState,
  }));
}

/** A store is anything with a bin in it — the hearth, or a warehouse the player drew. */
export function isStore(building: Building): boolean {
  return building.design.blocks.some((block) => block.kind === BlockKind.Storage);
}

/**
 * What a carrier may bring here: the items its doors are cut for, and whatever its bins will
 * still take. A source is not a door — it is the ground opened — so nothing is ever hauled to
 * one, and a well never bids for water.
 */
export function acceptedItems(building: Building): ItemType[] {
  const items: ItemType[] = [];
  const add = (item: ItemType): void => {
    if (!items.includes(item)) items.push(item);
  };

  for (const { block, state } of blocksOf(building)) {
    if (block.kind === BlockKind.Input) add(block.item);
    if (block.kind !== BlockKind.Storage) continue;

    const stored = state.held;
    // An empty bin will take anything; a full one has already chosen what it holds.
    if (!stored || stored.amount === 0) for (const item of ITEM_TYPES) add(item);
    else if (stored.amount < stored.capacity) add(stored.item);
  }

  return items;
}

export function hopperSpace(building: Building, item: ItemType): number {
  let space = 0;
  for (const { block, state } of blocksOf(building)) space += dockSpace(block, state, item);
  return space;
}

export function depositHopper(building: Building, item: ItemType, amount: number): number {
  let left = amount;
  for (const { block, state } of blocksOf(building)) {
    if (left <= 0) break;
    if (dockSpace(block, state, item) <= 0) continue;
    const placed = placeInBlock(block, state, item, left);
    left -= placed;
    // A lifetime receipt of what has been handed in at this door, kept even after it is taken
    // out again — it is the only record of how much the town has ever moved.
    if (block.kind === BlockKind.Storage && placed > 0) keep(building, item, placed);
  }
  return amount - left;
}

export function supplies(building: Building, item: ItemType): boolean {
  return outputStock(building, item) + storedStock(building, item) > 0;
}

/** What is sitting in this building's bins. */
export function storedStock(building: Building, item: ItemType): number {
  let stock = 0;
  for (const { block, state } of blocksOf(building)) {
    if (block.kind !== BlockKind.Storage) continue;
    if (state.held?.item === item) stock += state.held.amount;
  }
  return stock;
}

export function outputStock(building: Building, item: ItemType): number {
  let stock = 0;
  for (const { block, state } of blocksOf(building)) {
    if (block.kind !== BlockKind.Output || block.item !== item) continue;
    stock += state.held?.amount ?? 0;
  }
  return stock;
}

/** How much of an item is already inside: waiting at a dock, or in a combine block's hopper. */
export function inputStock(building: Building, item: ItemType): number {
  let stock = 0;
  for (const { block, state } of blocksOf(building)) {
    if (block.kind === BlockKind.Input && block.item === item) stock += state.held?.amount ?? 0;
    stock += state.hoppers.get(item)?.amount ?? 0;
  }
  return stock;
}

/** How backed up this building is on an item — a full output buffer is relieved first. */
export function outputPressure(building: Building, item: ItemType): number {
  let best = 0;
  for (const { block, state } of blocksOf(building)) {
    if (block.kind !== BlockKind.Output || block.item !== item) continue;
    const held = state.held;
    if (held) best = Math.max(best, held.amount / Math.max(1, held.capacity));
  }
  return best;
}

/**
 * Take from the ways out: the crates at the door first, then the bins. Draining the door first
 * keeps a producer's output clear so it never backs up while its own store still has room.
 */
export function withdraw(building: Building, item: ItemType, amount: number): number {
  let left = amount;

  for (const { block, state } of blocksOf(building)) {
    if (left <= 0) break;
    if (block.kind !== BlockKind.Output || block.item !== item) continue;
    left -= takeFromBlock(state, left);
  }
  for (const { block, state } of blocksOf(building)) {
    if (left <= 0) break;
    if (block.kind !== BlockKind.Storage || state.held?.item !== item) continue;
    left -= takeFromBlock(state, left);
  }

  return amount - left;
}

/** How much of an item a full round of this building's work swallows — the batch to fill up to. */
export function demandFor(building: Building, item: ItemType): number {
  let demand = 0;
  for (const block of building.design.blocks) {
    for (const input of recipeOf(block)?.inputs ?? []) {
      if (input.item === item) demand += input.amount;
    }
  }
  return demand;
}

/**
 * Every buffer worth showing over a building: what it is waiting on and what it has ready. Bins
 * are merged by item — a hearth has eight of them, and eight chips over a fire is a bar chart,
 * not a village.
 */
export function visibleBuffers(building: Building): Buffer[] {
  const buffers: Buffer[] = [];
  const bins = new Map<ItemType, Buffer>();

  for (const { block, state } of blocksOf(building)) {
    if (block.kind === BlockKind.Storage) {
      const stored = state.held;
      if (!stored) continue;
      const merged = bins.get(stored.item);
      if (merged) {
        merged.amount += stored.amount;
        merged.capacity += stored.capacity;
      } else {
        bins.set(stored.item, { ...stored });
      }
      continue;
    }
    if (block.kind === BlockKind.Input || block.kind === BlockKind.Output) {
      if (state.held) buffers.push(state.held);
    }
    for (const hopper of state.hoppers.values()) buffers.push(hopper);
  }

  return [...buffers, ...bins.values()];
}

function keep(building: Building, item: ItemType, amount: number): void {
  building.delivered.set(item, (building.delivered.get(item) ?? 0) + amount);
}

export interface ProcessOutcome {
  produced: ItemType[];
  /** What the hearth swallowed this tick. */
  delivered: { item: ItemType; amount: number }[];
}

/**
 * One tick inside a building. The interior is the machine now, not a readout of one: sources
 * open the ground, belts hand their load one square along, and combine blocks eat what reaches
 * their hoppers.
 *
 * A load that lands on a square rests there for `PUSH_TICKS` before it may move on. That one
 * rule is what makes a belt a belt: it gives the line a speed and a throughput, and it means a
 * run declared in flow order carries no faster than the same run declared backwards. Without it
 * the mover would walk a flow-ordered run end to end inside a single tick.
 */
export function processBuilding(building: Building, tick: number): ProcessOutcome {
  const outcome: ProcessOutcome = { produced: [], delivered: [] };
  const design = building.design;
  const parts = blocksOf(building);

  let working = false;
  let starved = false;
  let blocked = false;

  for (const { state } of parts) {
    if (state.cooldown > 0) state.cooldown -= 1;
  }

  parts.forEach(({ block }) => {
    if (block.kind !== BlockKind.Source) return;
    if (!building.yields.includes(block.item)) {
      // Opened on ground that does not hold it. `canBuild` refuses this, so it only happens to a
      // design edited after the fact — it stands there drawing nothing rather than inventing it.
      starved = true;
      return;
    }
    if (tick % INTAKE_TICKS !== 0) return;

    const step = STEP[block.facing];
    const onward = parts[blockAt(design, block.x + step.x, block.y + step.y)];
    if (!onward || blockSpace(onward.block, onward.state, block.item) <= 0) {
      blocked = true;
      return;
    }

    // Straight into the next square: a source keeps no stock, so there is nothing to fill up and
    // nothing to draw a number over out on the map.
    placeInBlock(onward.block, onward.state, block.item, 1);
    onward.state.cooldown = PUSH_TICKS;
    building.producedTotal += 1;
    outcome.produced.push(block.item);
    working = true;
  });

  for (const { block, state } of parts) {
    const recipe = recipeOf(block);
    const held = state.held;
    if (!recipe || !held) continue;

    if (state.progress === 0) {
      const ready = recipe.inputs.every(
        (input) => (state.hoppers.get(input.item)?.amount ?? 0) >= input.amount,
      );
      if (!ready) {
        starved = true;
        continue;
      }
      if (held.amount + recipe.outputAmount > held.capacity) {
        blocked = true;
        continue;
      }
      for (const input of recipe.inputs) {
        const hopper = state.hoppers.get(input.item);
        if (hopper) hopper.amount -= input.amount;
      }
    }

    state.progress += 1;
    working = true;

    if (state.progress >= recipe.ticks) {
      state.progress = 0;
      held.amount += recipe.outputAmount;
      building.producedTotal += recipe.outputAmount;
      outcome.produced.push(recipe.output);
    }
  }

  parts.forEach(({ block, state }) => {
    // A door and a bin are both termini: what reaches them waits for a carrier rather than
    // falling out of the building.
    if (block.kind === BlockKind.Output || block.kind === BlockKind.Hearth) return;
    if (state.cooldown > 0) return;
    const held = state.held;
    if (!held || held.amount <= 0) return;

    const step = STEP[block.facing];
    const target = blockAt(design, block.x + step.x, block.y + step.y);
    const onward = parts[target];
    if (!onward) {
      // A bin facing open air is doing its job. Anything else with nowhere to put its load is
      // backed up, which is a thing the player needs told.
      if (block.kind !== BlockKind.Storage) blocked = true;
      return;
    }
    if (blockSpace(onward.block, onward.state, held.item) <= 0) {
      if (block.kind !== BlockKind.Storage) blocked = true;
      return;
    }

    takeFromBlock(state, 1);
    if (held.amount === 0 && (block.kind === BlockKind.Transport || block.kind === BlockKind.Storage)) {
      state.held = null;
    }
    placeInBlock(onward.block, onward.state, held.item, 1);
    if (onward.block.kind === BlockKind.Storage) {
      outcome.delivered.push({ item: held.item, amount: 1 });
    }

    onward.state.cooldown = PUSH_TICKS;
    working = true;
  });

  building.state = working
    ? BuildingState.Working
    : blocked
      ? BuildingState.Blocked
      : starved
        ? BuildingState.Starved
        : BuildingState.Idle;

  return outcome;
}
