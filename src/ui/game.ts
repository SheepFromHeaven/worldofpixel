import { CHARGE_STEPS, methodById } from '../sim/book.ts';
import type { StripView } from './shellView.ts';
import type { TownView } from './townView.ts';
import { TICKS_PER_SECOND, linesFor, scanQueue } from '../sim/process.ts';
import type { Rig } from '../sim/process.ts';
import { LogisticsEngine } from '../sim/engine.ts';
import { canBuild, canPlaceArea, canRaze, placeArea, placeBuilding, raze, razeSlot } from '../sim/construction.ts';
import { HEARTH_DESIGN_ID } from '../sim/designs.ts';
import { landWorkById } from '../sim/landWorks.ts';
import { orderStage, workAt } from '../sim/area.ts';
import { areaViewOf, fireViewOf, progressOf, shownMethod, standingIn, stripViewOf, townViewOf } from './viewModels.ts';
import type { Progress } from './viewModels.ts';
import type { AreaView } from './areaView.ts';
import { lerp } from '../sim/geometry.ts';
import type { Vec2 } from '../sim/geometry.ts';
import { PARCEL, cellAt, parcelOf } from '../sim/parcels.ts';
import type { Detail } from '../sim/parcels.ts';
import type {
  Building,
  BuildingId,
  CarrierId,
  CellId,
  Design,
  DesignId,
  ItemType as Item,
  Settlement,
} from '../sim/types.ts';
import { WORLD_EXTENT } from '../sim/terrain.ts';
import { nearestWater } from '../sim/terrain.ts';
import { settlementNear } from '../sim/world.ts';
import type { GameWorld } from '../sim/world.ts';
import { canFound, foundSettlement, generateWorld } from '../sim/worldgen.ts';
import { rememberSeed, startingSeed } from './seed.ts';
import { loadWorld, storeWorld } from './storage.ts';
import { ZOOM_RANGE, clampCamera, fitWorld, viewZoom, zoomAbout } from '../render/camera.ts';
import { DOCK_WIDTH } from './dock.ts';
import { standingSpot } from '../render/townLayer.ts';
import { SCALE } from '../render/screen.ts';
import type { Camera, Viewport } from '../render/camera.ts';
import { detailFor } from '../render/worldLayer.ts';

export { TICKS_PER_SECOND };

/** More than this many ticks owed after a stall — a backgrounded tab — is dropped, not replayed. */
const MAX_CATCH_UP = 6;

/**
 * How often the world is written to local storage while it is being played. Saving on every
 * publish would serialise the whole town several times a second; a few seconds of a tick count
 * is all that is ever lost, and leaving the page saves on the way out.
 */
const SAVE_EVERY_MS = 4000;

/** How far from a hearth the tools still count as working on that settlement. */
const TOWN_REACH = 120;

/** The hand tools: found a town, mark out a work area, or raze one. Nothing else is in hand. */
export type Tool = 'inspect' | 'found' | 'area' | 'raze';
export type HoverAction = 'none' | 'open' | 'found' | 'build' | 'raze';

export interface HudSnapshot {
  seed: number;
  tick: number;
  playing: boolean;
  speed: number;
  zoom: number;
  detail: Detail;
  settlementName: string | null;
  delivered: [Item, number][];
  carriers: { id: CarrierId; state: string; carrying: Item | null }[];
  openBuilding: BuildingId | null;
  openSettlement: string | null;
  tool: Tool;
  hoverReason: string;
  settlementCount: number;
  progress: Progress;
  /** The open area's sheet: its slot row, its list, its shelf, and the open slot's knobs. */
  area: AreaView | null;
  /** The strip's numbers, kept whether or not anything is open. */
  strip: StripView;
  /** Whether the town's own slab is open. */
  statsOpen: boolean;
  /** The town that slab is about: the one the player is looking at, if there is one. */
  town: TownView | null;
}

type Listener = () => void;

export class Game {
  world: GameWorld;
  engine: LogisticsEngine;

  camera: Camera = { centre: { x: 500, y: 350 }, zoom: 1 };
  playing = true;
  speed = 1;
  tool: Tool = 'inspect';

  hoveredParcelId: CellId | null = null;
  hoveredBuildingId: BuildingId | null = null;
  /** Why the tool in hand cannot act on what the cursor is over, or empty. */
  hoverReason = '';
  hoverAction: HoverAction = 'none';
  openBuildingId: BuildingId | null = null;
  /** The settlement whose ledger is open, read from far off where the town is one mark. */
  openSettlementId: string | null = null;
  /** Whether the town's own slab is open — how its people spend a day, and what it holds. */
  statsOpen = false;

  private dirty = false;
  private lastSaveAt = 0;
  private previousPositions = new Map<CarrierId, Vec2>();
  private latestPositions = new Map<CarrierId, Vec2>();
  private lastTickAt = 0;
  /** Kept so a new map can be framed without waiting for the canvas to resize. */
  private viewport: Viewport | null = null;
  private listeners = new Set<Listener>();
  private snapshot: HudSnapshot;

  constructor(seed: number) {
    const opened = openWorld(seed);
    this.world = opened.world;
    this.engine = opened.engine;
    this.capturePositions();
    this.snapshot = this.buildSnapshot();
  }

  fit(viewport: Viewport): void {
    this.viewport = viewport;
    this.open();
    this.publish();
  }

  /**
   * Where a world opens: at the settlement rung, over the town if there is one and over ground
   * worth founding on if there is not, with the fire in hand. Never at the scale of a continent,
   * where there is nothing to do and nothing to read.
   */
  private open(): void {
    const viewport = this.viewport;
    if (!viewport) return;
    const first = this.world.settlements.values().next().value as Settlement | undefined;
    const hearth = first?.buildings.get(first.hearthId);
    const spot = hearth ? { ...hearth.position } : openingSpot(this.world);
    if (!spot) {
      this.camera = fitWorld(viewport);
      return;
    }
    this.camera = clampCamera({ centre: spot, zoom: settlementZoom() }, viewport);
    this.tool = first ? 'inspect' : 'found';
  }

  /**
   * Go to another map. The one being left is written down first, and the one arrived at is
   * whatever was last built on that seed — a seed is a world, not a fresh start, and asking for
   * one again is going back to it.
   */
  newWorld(seed: number): void {
    this.save();
    const opened = openWorld(seed);
    this.world = opened.world;
    this.engine = opened.engine;
    this.previousPositions = new Map();
    this.latestPositions = new Map();
    this.lastTickAt = 0;
    this.lastSaveAt = 0;
    this.tool = 'inspect';
    this.hoveredParcelId = null;
    this.hoveredBuildingId = null;
    this.hoverReason = '';
    this.hoverAction = 'none';
    this.openBuildingId = null;
    this.openSettlementId = null;
    rememberSeed(seed);
    this.open();
    this.publish();
  }

  /**
   * The scale the map is actually drawn at. Everything that converts between the screen and the
   * world reads this and never `camera.zoom`, which is free-running — see `viewZoom`.
   */
  get zoom(): number {
    return viewZoom(this.camera);
  }

  /** The camera as the map is drawn: the free-running one at the zoom it snaps to. */
  get view(): Camera {
    return { centre: this.camera.centre, zoom: this.zoom };
  }

  pan(dx: number, dy: number, viewport: Viewport): void {
    this.camera = clampCamera(
      {
        zoom: this.camera.zoom,
        centre: {
          x: this.camera.centre.x - dx / this.zoom,
          y: this.camera.centre.y - dy / this.zoom,
        },
      },
      viewport,
    );
  }

  zoomAt(screen: Vec2, viewport: Viewport, factor: number): void {
    this.camera = zoomAbout(this.camera, screen, viewport, factor);
    this.publish();
  }

  detail(): Detail {
    // Tiers are decided in buffer pixels, which is where the ground is actually rasterised.
    return detailFor(this.zoom / SCALE);
  }

  /** The settlement the tools act on: the one whose hearth is nearest what you are pointing at. */
  townAt(point: Vec2): Settlement | undefined {
    return settlementNear(this.world, point, TOWN_REACH);
  }

  /** The town the ledger reads: the one the player opened by clicking its mark, and no other. */
  openSettlement(): Settlement | undefined {
    return this.openSettlementId ? this.world.settlements.get(this.openSettlementId) : undefined;
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): HudSnapshot => this.snapshot;

  setPlaying(playing: boolean): void {
    this.playing = playing;
    this.publish();
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    this.publish();
  }

  toggleStats(): void {
    this.statsOpen = !this.statsOpen;
    this.publish();
  }

  setTool(tool: Tool): void {
    if (tool !== 'inspect' && this.detail() !== 'fine') return;
    this.tool = tool;
    this.publish();
  }

  step(): void {
    this.runTick();
    this.publish();
  }

  parcelUnder(point: Vec2): CellId {
    return cellAt(this.world.seed, PARCEL, point);
  }

  /** What the tool in hand would do to this parcel, and the sentence explaining it. */
  toolCheck(parcelId: CellId | null, buildingId: BuildingId | null): { ok: boolean; reason: string } {
    if (!parcelId) return { ok: false, reason: '' };
    const settlement = this.townAt(parcelOf(this.world.seed, parcelId).site);

    if (this.tool === 'inspect') {
      return buildingId ? { ok: true, reason: 'open the blueprint' } : { ok: false, reason: '' };
    }
    if (this.tool === 'found') return canFound(this.world, parcelId);
    if (!settlement) return { ok: false, reason: 'no settlement within reach' };

    if (this.tool === 'raze') {
      if (buildingId) return canRaze(settlement, buildingId);
      return { ok: false, reason: 'nothing to raze' };
    }
    return canPlaceArea(this.world, settlement, parcelId);
  }

  /**
   * Neither this nor `build` puts the tool down — the click does, because only the click knows
   * whether the player was holding the chaining key. Dropping it here as well would take the
   * design out of a held hand on the first shed of a row.
   */
  found(parcelId: CellId): boolean {
    if (!canFound(this.world, parcelId).ok) return false;
    foundSettlement(this.world, parcelId);
    this.capturePositions();
    this.publish();
    return true;
  }

  build(parcelId: CellId): boolean {
    const settlement = this.townAt(parcelOf(this.world.seed, parcelId).site);
    if (!settlement || !canPlaceArea(this.world, settlement, parcelId).ok) return false;

    placeArea(this.world, settlement, parcelId);
    this.publish();
    return true;
  }

  /** The building that is open, if one is. */
  openBuilding(): ReturnType<Game['buildingById']> {
    return this.openBuildingId ? this.buildingById(this.openBuildingId) : undefined;
  }

  /* ---------- the library of patterns ---------- */

  designById(designId: DesignId): Design | undefined {
    return this.world.library.get(designId);
  }

  razeBuilding(buildingId: BuildingId): boolean {
    for (const settlement of this.world.settlements.values()) {
      if (!settlement.buildings.has(buildingId)) continue;
      if (!raze(settlement, buildingId)) return false;
      this.capturePositions();
      this.publish();
      return true;
    }
    return false;
  }

  /** The settlement under a point, when the town is drawn as one mark rather than as buildings. */
  settlementMarkAt(point: Vec2, reach: number): Settlement | undefined {
    return settlementNear(this.world, point, reach);
  }

  showSettlement(settlementId: string | null): void {
    this.openSettlementId = settlementId;
    this.publish();
  }

  showBuilding(buildingId: BuildingId): void {
    this.openBuildingId = buildingId;
    this.openSlotIndex = null;
    this.clearOfDock(buildingId);
    this.publish();
  }

  /**
   * If the selection falls under the docked rail, the camera moves and the rail does not: the
   * panel's place is the one thing nobody should have to learn twice.
   */
  private clearOfDock(buildingId: BuildingId): void {
    const viewport = this.viewport;
    const building = this.buildingById(buildingId);
    if (!viewport || !building) return;
    const zoom = this.zoom;
    const screenX = (building.position.x - this.camera.centre.x) * zoom + viewport.width / 2;
    const screenY = (building.position.y - this.camera.centre.y) * zoom + viewport.height / 2;
    const room = viewport.width - DOCK_WIDTH;
    const margin = 90;
    let dx = 0;
    if (screenX > room - margin) dx = room - margin - screenX;
    else if (screenX < margin) dx = margin - screenX;
    let dy = 0;
    if (screenY < margin) dy = margin - screenY;
    else if (screenY > viewport.height - margin) dy = viewport.height - margin - screenY;
    if (dx !== 0 || dy !== 0) this.pan(dx, dy, viewport);
  }

  /** The slot whose panel is open under the area's row; null puts it away. */
  openSlotIndex: number | null = null;

  openSlot(slot: number | null): void {
    this.openSlotIndex = slot === this.openSlotIndex ? null : slot;
    this.publish();
  }

  /** Put a design in the open slot of the open area, if the slot is empty and it fits. */
  placeInOpenSlot(designId: DesignId): void {
    const area = this.openBuilding();
    const settlement = area ? this.settlementOfBuilding(area.id) : undefined;
    const design = this.world.library.get(designId) ?? landWorkById(designId)?.design;
    if (!area || !settlement || !design || this.openSlotIndex === null || this.openSlotIndex >= area.slots.length) return;
    if (area.slots[this.openSlotIndex]?.design) return;
    if (!canBuild(this.world, settlement, area.cellId, design).ok) return;
    placeBuilding(this.world, settlement, area.cellId, design);
    this.publish();
  }

  /** Order the open area's next stage built round it. */
  raiseOpenArea(): void {
    const area = this.openBuilding();
    if (area && orderStage(area)) this.publish();
  }

  /** Set which recipe a land work in the open area runs. */
  setRecipe(slot: number, index: number): void {
    const area = this.openBuilding();
    const target = area?.slots[slot];
    const work = area ? workAt(area, slot) : undefined;
    if (!area || !target || !work || index < 0 || index >= (work.pools?.length ?? 1)) return;
    if (index === 0) delete target.recipe;
    else target.recipe = index;
    this.publish();
  }

  /** Take one station out of the open area. */
  removeFromOpenArea(slot: number): void {
    const area = this.openBuilding();
    const settlement = area ? this.settlementOfBuilding(area.id) : undefined;
    if (!area || !settlement) return;
    const gone = razeSlot(settlement, area.id, slot);
    if (!gone) return;
    if (!settlement.buildings.has(area.id)) this.openBuildingId = null;
    this.openSlotIndex = null;
    this.publish();
  }

  /** Move a line of the open area's list, among the lines of its own station. */
  moveLine(methodId: string, slot: number, by: number): void {
    const area = this.openBuilding();
    if (!area) return;
    const mine = area.queue.map((line, index) => ({ line, index })).filter((entry) => entry.line.slot === slot);
    const at = mine.findIndex((entry) => entry.line.methodId === methodId);
    const self = mine[at];
    const other = mine[at + by];
    if (!self || !other) return;
    area.queue[self.index] = other.line;
    area.queue[other.index] = self.line;
    this.publish();
  }

  /**
   * Bank the fire differently.
   *
   * It is one setting on one method, not a mode on the rig: the banking is *knowledge*, part of
   * the recipe written in the book, so changing it changes how this method is run everywhere it
   * is run. A rig is only the masonry it happens to be run on.
   */
  setCharge(charge: number): void {
    const open = this.openStation();
    if (!open) return;
    const { area, slot, rig, settlement } = open;
    const running = shownMethod(rig, scanQueue(rig, settlement.book, area, slot), linesFor(area, slot));
    const method = running ? methodById(settlement.book, running) : undefined;
    if (!method) return;
    method.run = { ...method.run, charge: Math.max(0, Math.min(CHARGE_STEPS.length - 1, charge)) };
    this.publish();
  }

  /** The station standing in the open slot, if one does. */
  private openStation(): { area: Building; slot: number; rig: Rig; settlement: Settlement } | null {
    const area = this.openBuilding();
    const settlement = area ? this.settlementOfBuilding(area.id) : undefined;
    const slot = this.openSlotIndex;
    const rig = slot === null ? undefined : area?.slots[slot]?.rig;
    return area && settlement && slot !== null && rig ? { area, slot, rig, settlement } : null;
  }

  private settlementOfBuilding(buildingId: BuildingId): Settlement | undefined {
    for (const settlement of this.world.settlements.values()) {
      if (settlement.buildings.has(buildingId)) return settlement;
    }
    return undefined;
  }

  /**
   * The town the stats slab is about.
   *
   * The one whose ledger is open if the player opened one from far off, otherwise the one the
   * camera is over, otherwise the only town there is. Falling back to the first in insertion
   * order rather than to nothing: a player who has founded once and zoomed out past their own
   * claim is still asking about that town, and an empty slab would read as the panel being
   * broken.
   */
  private statsTown(): Settlement | undefined {
    return (
      this.openSettlement() ??
      this.townAt(this.camera.centre) ??
      this.world.settlements.values().next().value
    );
  }

  hideBuilding(): void {
    this.openBuildingId = null;
    this.publish();
  }

  buildingById(buildingId: BuildingId) {
    for (const settlement of this.world.settlements.values()) {
      const building = settlement.buildings.get(buildingId);
      if (building) return building;
    }
    return undefined;
  }

  /** Run whatever ticks are owed by the wall clock. Returns true if anything moved. */
  advance(now: number): boolean {
    this.autosave(now);
    if (!this.playing) {
      this.lastTickAt = now;
      return false;
    }
    const interval = 1000 / (TICKS_PER_SECOND * this.speed);
    if (this.lastTickAt === 0) this.lastTickAt = now;

    let ran = 0;
    while (now - this.lastTickAt >= interval && ran < MAX_CATCH_UP) {
      this.runTick();
      this.lastTickAt += interval;
      ran += 1;
    }
    if (now - this.lastTickAt > interval * MAX_CATCH_UP) this.lastTickAt = now;
    if (ran > 0) this.publish();
    return ran > 0;
  }

  /** How far into the current tick the wall clock is — the renderer's only view of the clock. */
  tickFraction(now: number): number {
    const interval = 1000 / (TICKS_PER_SECOND * this.speed);
    return this.playing ? Math.min(1, Math.max(0, (now - this.lastTickAt) / interval)) : 1;
  }

  /**
   * Carrier positions smoothed across the gap between ticks. The simulation moves a carrier a
   * whole stride at a time; drawing it there directly would make the figures hop.
   */
  carrierPositions(now: number): Map<CarrierId, Vec2> {
    const fraction = this.tickFraction(now);
    const positions = new Map<CarrierId, Vec2>();

    for (const [id, latest] of this.latestPositions) {
      const previous = this.previousPositions.get(id) ?? latest;
      positions.set(id, lerp(previous, latest, fraction));
    }

    return positions;
  }

  private runTick(): void {
    this.engine.tick();
    this.capturePositions();
  }

  private capturePositions(): void {
    this.previousPositions = this.latestPositions;
    const latest = new Map<CarrierId, Vec2>();
    for (const settlement of this.world.settlements.values()) {
      for (const carrier of settlement.carriers.values()) {
        latest.set(carrier.id, standingSpot(carrier, settlement));
      }
    }
    this.latestPositions = latest;
  }

  /** Write the world down, whatever the clock says — leaving the page, or changing maps. */
  save(): void {
    storeWorld(this.world, this.engine.tickCount);
    this.dirty = false;
  }

  private autosave(now: number): void {
    if (!this.dirty) return;
    if (this.lastSaveAt === 0) this.lastSaveAt = now;
    if (now - this.lastSaveAt < SAVE_EVERY_MS) return;
    this.lastSaveAt = now;
    this.save();
  }

  publish(): void {
    this.dirty = true;
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) listener();
  }

  private buildSnapshot(): HudSnapshot {
    const settlement = this.openSettlement();
    const hearth = settlement?.buildings.get(settlement.hearthId);
    const building = this.openBuilding();
    const owner = building ? this.settlementOfBuilding(building.id) : undefined;
    const station = this.openStation();

    return {
      seed: this.world.seed,
      tick: this.engine.tickCount,
      playing: this.playing,
      speed: this.speed,
      zoom: this.zoom,
      detail: this.detail(),
      settlementName: settlement?.name ?? null,
      delivered: hearth ? standingIn(hearth) : [],
      carriers: settlement
        ? [...settlement.carriers.values()].map((carrier) => ({
            id: carrier.id,
            state: carrier.state,
            carrying: carrier.carryingItem,
          }))
        : [],
      openBuilding: this.openBuildingId,
      openSettlement: this.openSettlementId,
      tool: this.tool,
      hoverReason: this.hoverReason,
      settlementCount: this.world.settlements.size,
      progress: progressOf(this.world, settlement),
      area:
        building && owner
          ? areaViewOf(
              this.world,
              building,
              owner,
              this.openSlotIndex,
              station && station.rig.process !== 'hand' ? fireViewOf(station.area, station.slot, station.rig, station.settlement) : null,
            )
          : null,
      strip: stripViewOf(this.world, this.statsTown(), this.engine.tickCount),
      statsOpen: this.statsOpen,
      town: this.statsOpen && this.statsTown() ? townViewOf(this.statsTown()!) : null,
    };
  }
}

/**
 * A zoom comfortably inside the rung where the ground is resolved into parcels, found by looking
 * rather than by writing the threshold down a second time.
 */
function settlementZoom(): number {
  let zoom = ZOOM_RANGE.min;
  while (zoom < ZOOM_RANGE.max && detailFor(zoom / SCALE) !== 'fine') zoom *= 1.05;
  return zoom * 1.8;
}

/**
 * Ground worth founding on: dry, free, a few parcels from fresh water, found by walking outward
 * from the middle of the map. The first answer that fits, so the same seed opens in the same place.
 */
function openingSpot(world: GameWorld): Vec2 | null {
  const middle = { x: WORLD_EXTENT.width / 2, y: WORLD_EXTENT.height / 2 };
  let fallback: Vec2 | null = null;
  for (let ring = 0; ring < 60; ring += 1) {
    const steps = Math.max(1, ring * 6);
    for (let step = 0; step < steps; step += 1) {
      const angle = (step / steps) * Math.PI * 2;
      const point = {
        x: middle.x + Math.cos(angle) * ring * PARCEL * 1.5,
        y: middle.y + Math.sin(angle) * ring * PARCEL * 1.5,
      };
      const id = cellAt(world.seed, PARCEL, point);
      if (!canFound(world, id).ok) continue;
      const site = parcelOf(world.seed, id).site;
      fallback ??= site;
      const water = nearestWater(world.seed, site);
      const gap = water ? Math.hypot(water.x - site.x, water.y - site.y) : Infinity;
      if (gap > PARCEL * 1.5 && gap < PARCEL * 5) return site;
    }
  }
  return fallback;
}

/**
 * The world for a seed: what was last played on it, or a fresh one rolled from it. The engine
 * comes back on the tick it was left on, since the tick count is the town's age and the ledger
 * shows it.
 */
function openWorld(seed: number): { world: GameWorld; engine: LogisticsEngine } {
  const saved = loadWorld(seed);
  const world = saved?.world ?? generateWorld(seed);
  const engine = new LogisticsEngine(world);
  if (saved) engine.tickCount = saved.tick;
  return { world, engine };
}
export { HEARTH_DESIGN_ID };

export { randomSeed, seedFrom } from './seed.ts';

/**
 * Built the moment this module is imported, which is why `main.tsx` does not import it until the
 * world is already in the memo — see `worldLoader.ts`.
 */
export const game = new Game(startingSeed());

// Whatever the autosave has not got to yet. `pagehide` is the one that fires on a reload and on
// a tab being closed; `visibilitychange` catches a phone being put down, where neither may.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => game.save());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') game.save();
  });
}
