import type { Camera, Viewport } from '../render/camera.ts';
import { ZOOM_RANGE, clampCamera, fitWorld, viewZoom, zoomAbout } from '../render/camera.ts';
import { SCALE } from '../render/screen.ts';
import { standingSpot } from '../render/townLayer.ts';
import { detailFor } from '../render/worldLayer.ts';
import { orderStage, workAt } from '../sim/area.ts';
import { recipeById } from '../sim/book.ts';
import {
  canBuild,
  canPlaceArea,
  canRaze,
  placeArea,
  placeBuilding,
  raze,
  razeSlot,
} from '../sim/construction.ts';
import { HEARTH_DESIGN_ID } from '../sim/designs.ts';
import { LogisticsEngine } from '../sim/engine.ts';
import type { Vec2 } from '../sim/geometry.ts';
import { lerp } from '../sim/geometry.ts';
import { landWorkById } from '../sim/landWorks.ts';
import { TICKS_PER_SECOND, linesFor, scanQueue } from '../sim/process.ts';
import { CHARGE_STEPS } from '../sim/recipe.ts';
import type { Rig } from '../sim/rig.ts';
import type { Detail } from '../sim/terrain/parcels.ts';
import { PARCEL, cellAt, parcelOf } from '../sim/terrain/parcels.ts';
import { WORLD_EXTENT, nearestWater } from '../sim/terrain/terrain.ts';
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
import type { GameWorld } from '../sim/world.ts';
import { settlementNear } from '../sim/world.ts';
import { canFound, foundSettlement, generateWorld } from '../sim/worldgen.ts';
import type { AreaView } from './areaView.ts';
import { DOCK_WIDTH } from './dock.ts';
import { rememberSeed, startingSeed } from './seed.ts';
import type { StripView } from './shellView.ts';
import { loadWorld, storeWorld } from './storage.ts';
import type { TownView } from './townView.ts';
import type { Progress } from './viewModels.ts';
import {
  areaViewOf,
  fireViewOf,
  progressOf,
  shownRecipe,
  standingIn,
  stripViewOf,
  townViewOf,
} from './viewModels.ts';

export { TICKS_PER_SECOND };

const MAX_CATCH_UP = 6;

const SAVE_EVERY_MS = 4000;

const TOWN_REACH = 120;

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
  area: AreaView | null;
  strip: StripView;
  statsOpen: boolean;
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
  hoverReason = '';
  hoverAction: HoverAction = 'none';
  openBuildingId: BuildingId | null = null;
  openSettlementId: string | null = null;
  statsOpen = false;

  private dirty = false;
  private lastSaveAt = 0;
  private previousPositions = new Map<CarrierId, Vec2>();
  private latestPositions = new Map<CarrierId, Vec2>();
  private lastTickAt = 0;
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

  get zoom(): number {
    return viewZoom(this.camera);
  }

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
    return detailFor(this.zoom / SCALE);
  }

  townAt(point: Vec2): Settlement | undefined {
    return settlementNear(this.world, point, TOWN_REACH);
  }

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

  openBuilding(): ReturnType<Game['buildingById']> {
    return this.openBuildingId ? this.buildingById(this.openBuildingId) : undefined;
  }

  designById(designId: DesignId): Design | undefined {
    return this.world.designLibrary.get(designId);
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

  openSlotIndex: number | null = null;

  openSlot(slot: number | null): void {
    this.openSlotIndex = slot === this.openSlotIndex ? null : slot;
    this.publish();
  }

  placeInOpenSlot(designId: DesignId): void {
    const area = this.openBuilding();
    const settlement = area ? this.settlementOfBuilding(area.id) : undefined;
    const design = this.world.designLibrary.get(designId) ?? landWorkById(designId)?.design;
    if (!area || !settlement || !design || this.openSlotIndex === null || this.openSlotIndex >= area.slots.length) return;
    if (area.slots[this.openSlotIndex]?.design) return;
    if (!canBuild(this.world, settlement, area.cellId, design).ok) return;
    placeBuilding(this.world, settlement, area.cellId, design);
    this.publish();
  }

  raiseOpenArea(): void {
    const area = this.openBuilding();
    if (area && orderStage(area)) this.publish();
  }

  setPool(slot: number, index: number): void {
    const area = this.openBuilding();
    const target = area?.slots[slot];
    const work = area ? workAt(area, slot) : undefined;
    if (!area || !target || !work || index < 0 || index >= (work.pools?.length ?? 1)) return;
    if (index === 0) delete target.pool;
    else target.pool = index;
    this.publish();
  }

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

  moveLine(recipeId: string, slot: number, by: number): void {
    const area = this.openBuilding();
    if (!area) return;
    const mine = area.queue.map((line, index) => ({ line, index })).filter((entry) => entry.line.slot === slot);
    const at = mine.findIndex((entry) => entry.line.recipeId === recipeId);
    const self = mine[at];
    const other = mine[at + by];
    if (!self || !other) return;
    area.queue[self.index] = other.line;
    area.queue[other.index] = self.line;
    this.publish();
  }

  setCharge(charge: number): void {
    const open = this.openStation();
    if (!open) return;
    const { area, slot, rig, settlement } = open;
    const running = shownRecipe(rig, scanQueue(rig, settlement.book, area, slot), linesFor(area, slot));
    const recipe = running ? recipeById(settlement.book, running) : undefined;
    if (!recipe) return;
    settlement.book.recipes.set(recipe.id, recipe.withCharge(Math.max(0, Math.min(CHARGE_STEPS.length - 1, charge))));
    this.publish();
  }

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

  tickFraction(now: number): number {
    const interval = 1000 / (TICKS_PER_SECOND * this.speed);
    return this.playing ? Math.min(1, Math.max(0, (now - this.lastTickAt) / interval)) : 1;
  }

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

function settlementZoom(): number {
  let zoom = ZOOM_RANGE.min;
  while (zoom < ZOOM_RANGE.max && detailFor(zoom / SCALE) !== 'fine') zoom *= 1.05;
  return zoom * 1.8;
}

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

function openWorld(seed: number): { world: GameWorld; engine: LogisticsEngine } {
  const saved = loadWorld(seed);
  const world = saved?.world ?? generateWorld(seed);
  const engine = new LogisticsEngine(world);
  if (saved) engine.tickCount = saved.tick;
  return { world, engine };
}
export { HEARTH_DESIGN_ID };

export { randomSeed,seedFrom } from './seed.ts';

export const game = new Game(startingSeed());

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => game.save());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') game.save();
  });
}
