import { blockAt, createBlockState } from './blocks.ts';
import { HEARTH_DESIGN_ID } from './designs.ts';
import { isLandWork } from './landWorks.ts';
import { BlockKind, BuildingState, DIRECTIONS, Direction, STEP } from './types.ts';
import type { Block, Building, Design } from './types.ts';

/**
 * Fitting out a works: changing the squares of a building that is standing on the map.
 *
 * The building is the machine. There is no blueprint behind it that this has to be reconciled
 * with — a design in the library is a *pattern*, a copy taken from something that already
 * worked, and editing one never reaches back into what is standing. That is the whole reason
 * this exists rather than `retool`: two sources of truth for one machine is the bug.
 *
 * `Building.blocks` runs parallel to `design.blocks`, square for square, so every change here
 * moves both at once. Go through these rather than touching either list: a state that has
 * drifted out of step with its design shows up as a square drawn in one place and ticking in
 * another.
 */

/**
 * What a change costs once the works is up and running.
 *
 * **Moving the furniture about is free.** Shifting a chute, turning one, marking out a bay,
 * standing a bin somewhere else — none of that is work anybody would stop for, and charging the
 * player a villager's walk and a shut-down for every one of them made laying out a floor feel
 * like commissioning a rebuild each time. Only **installing or pulling out a vessel** stops the
 * works: a millstone or a mixing tub is a thing that has to be set up, and while that is
 * happening the machine is not running.
 *
 * Even then nobody walks over. It is the *works* that is stopped, not the site that is unbuilt:
 * the bays go on being filled and emptied round it, which is both kinder and truer than the
 * first pass, where any change at all put the building back to being an unprepared plot waiting
 * for a villager with a spade.
 */
export const FIT_TICKS = 25;

export interface FitCheck {
  ok: boolean;
  /** Shown while the player is laying squares, so it has to read as a sentence. */
  reason: string;
}

/** Whether changing this building is still free: it is, until the day it opens. */
export const fittingFree = (building: Building): boolean => building.clearing !== null;

/**
 * Only a works is fitted out.
 *
 * The hearth is the town's fire and the land works are the ground opened — neither is a machine
 * anybody drew, and a `Source` block has no business appearing in something the player laid out
 * (`validateDesign` refuses one for the same reason). Both still *open*: looking inside a well
 * and seeing the shaft and the crate is worth having, and it is the same room, read-only.
 */
/** Is this square a vessel — a thing that has to be installed rather than merely set down? */
const isVessel = (block: Block): boolean => block.kind === BlockKind.Combine;

export function canFit(building: Building): FitCheck {
  if (building.designId === HEARTH_DESIGN_ID) {
    return { ok: false, reason: 'the fire is the town’s, not a machine to be fitted out' };
  }
  if (isLandWork(building.designId)) {
    return { ok: false, reason: `a ${building.design.label} is the ground opened — there is nothing to lay out in it` };
  }
  if (building.design.blocks.length === 0 && fittingFree(building)) {
    return { ok: true, reason: 'fitting out while the site is prepared — free' };
  }
  return fittingFree(building)
    ? { ok: true, reason: 'the works is not open yet — changes are free' }
    : { ok: true, reason: `moving things about is free · setting a vessel stops the works ${FIT_TICKS} ticks` };
}

/** Stop the works while a vessel is set up, unless it has not opened yet. */
function disturb(building: Building, block: Block | null): void {
  if (building.clearing || !block || !isVessel(block)) return;
  building.retooling = FIT_TICKS;
  building.state = BuildingState.Idle;
}

const turn = (facing: Direction): Direction =>
  DIRECTIONS[(DIRECTIONS.indexOf(facing) + 1) % DIRECTIONS.length] ?? Direction.East;

function offGrid(design: Design, x: number, y: number): boolean {
  return x < 0 || y < 0 || x >= design.width || y >= design.height;
}

/** The square at a place on the floor, with its live state, or nothing on bare floor. */
export function squareAt(building: Building, x: number, y: number): Block | null {
  const index = blockAt(building.design, x, y);
  return index < 0 ? null : (building.design.blocks[index] ?? null);
}

/** Lay a square, or replace whatever is on that spot. Whatever it was holding is lost. */
export function fitBlock(building: Building, block: Block): boolean {
  if (!canFit(building).ok || offGrid(building.design, block.x, block.y)) return false;

  const index = blockAt(building.design, block.x, block.y);
  const laid: Block = { ...block };
  if (index < 0) {
    building.design.blocks.push(laid);
    building.blocks.push(createBlockState(laid));
  } else {
    building.design.blocks.splice(index, 1, laid);
    building.blocks.splice(index, 1, createBlockState(laid));
  }
  faceTowards(building, laid);
  disturb(building, laid);
  return true;
}

/**
 * A square with nowhere to put what it is holding turns to face a square newly laid beside it.
 *
 * Laying a drop-off and then a chute under it left the two unconnected: the bay had been laid
 * before there was anything to hand to, so it pointed at bare ground, and the only sign of it
 * was the works doing nothing. A dead end is never a thing anybody wants on purpose, so the
 * neighbour joins up — and because it is only ever a square that was pointing at *nothing*, it
 * can never redirect a line the player has actually drawn.
 *
 * `DIRECTIONS` order breaks a tie, so two bays either side of one new chute both turn to it in
 * the same order on every machine.
 */
function faceTowards(building: Building, laid: Block): void {
  const design = building.design;
  const occupied = (x: number, y: number): boolean =>
    design.blocks.some((block) => block.x === x && block.y === y);

  for (const way of DIRECTIONS) {
    const step = STEP[way];
    const neighbour = design.blocks.find(
      (block) => block.x === laid.x + step.x && block.y === laid.y + step.y,
    );
    // Termini hand nothing on, and a bin facing open air is doing its job.
    if (!neighbour) continue;
    if (neighbour.kind === BlockKind.Output || neighbour.kind === BlockKind.Hearth) continue;
    if (neighbour.kind === BlockKind.Storage) continue;
    const out = STEP[neighbour.facing];
    if (occupied(neighbour.x + out.x, neighbour.y + out.y)) continue;

    const back = DIRECTIONS.find((other) => STEP[other].x === -step.x && STEP[other].y === -step.y);
    if (back) neighbour.facing = back;
  }
}

/** Turn what is on a square a quarter, so laying a corner is a click and a nudge. */
export function turnBlock(building: Building, x: number, y: number): boolean {
  if (!canFit(building).ok) return false;
  const index = blockAt(building.design, x, y);
  const block = building.design.blocks[index];
  if (!block) return false;
  block.facing = turn(block.facing);
  return true;
}

/** Take a square out. What was on it goes with it — there is nowhere to put it down. */
export function clearBlock(building: Building, x: number, y: number): boolean {
  if (!canFit(building).ok) return false;
  const index = blockAt(building.design, x, y);
  const going = building.design.blocks[index];
  if (index < 0 || !going) return false;
  building.design.blocks.splice(index, 1);
  building.blocks.splice(index, 1);
  disturb(building, going);
  return true;
}
