import { CHARGE_STEADY, CHARGE_STEPS, emptyBook, methodById } from '../sim/book.ts';
import type { MethodId } from '../sim/book.ts';
import type { HoldingView, QueueEntry, RigView } from './rigView.ts';
import { scanQueue } from '../sim/process.ts';
import type { Rig, Scan } from '../sim/process.ts';
import { budgetOf } from '../sim/needs.ts';
import type { Budget } from '../sim/needs.ts';
import { designInputs, designSources } from '../sim/blocks.ts';
import { labelOf, storedStock, visibleBuffers } from '../sim/buildings.ts';
import { LogisticsEngine } from '../sim/engine.ts';
import { buildableDesigns, canBuild, canRaze, placeBuilding, raze } from '../sim/construction.ts';
import { HEARTH_DESIGN, HEARTH_DESIGN_ID } from '../sim/designs.ts';
import { landWorkById } from '../sim/landWorks.ts';
import type { LandWork } from '../sim/landWorks.ts';
import { WORKS_DESIGN, WORKS_DESIGN_ID, isWorks } from '../sim/works.ts';
import { lerp } from '../sim/geometry.ts';
import type { Vec2 } from '../sim/geometry.ts';
import { PARCEL, cellAt, parcelOf } from '../sim/parcels.ts';
import type { Detail } from '../sim/parcels.ts';
import { landYield } from '../sim/markers.ts';
import { BlockKind, ITEM_TYPES, ItemType } from '../sim/types.ts';
import type {
  BuildingId,
  CarrierId,
  CellId,
  Design,
  DesignId,
  ItemType as Item,
  Settlement,
} from '../sim/types.ts';
import { hashString } from '../sim/rng.ts';
import { landFraction } from '../sim/terrain.ts';
import { nearestWater } from '../sim/terrain.ts';
import { settlementNear } from '../sim/world.ts';
import type { GameWorld } from '../sim/world.ts';
import { canFound, foundSettlement, generateWorld } from '../sim/worldgen.ts';
import { rememberSeed, startingSeed } from './seed.ts';
import { loadWorld, storeWorld } from './storage.ts';
import { clampCamera, fitWorld, viewZoom, zoomAbout } from '../render/camera.ts';
import { standingSpot } from '../render/townLayer.ts';
import { SCALE } from '../render/screen.ts';
import type { Camera, Viewport } from '../render/camera.ts';
import { detailFor } from '../render/worldLayer.ts';

export const TICKS_PER_SECOND = 10;
export const SPEEDS = [0.5, 1, 2, 4] as const;

/** More than this many ticks owed after a stall — a backgrounded tab — is dropped, not replayed. */
const MAX_CATCH_UP = 6;

/** A rolled map must have at least this much of its extent out of the water. */
const MIN_LAND = 0.15;

/**
 * How often the world is written to local storage while it is being played. Saving on every
 * publish would serialise the whole town several times a second; a few seconds of a tick count
 * is all that is ever lost, and leaving the page saves on the way out.
 */
const SAVE_EVERY_MS = 4000;

/** How far from a hearth the tools still count as working on that settlement. */
const TOWN_REACH = 120;

/** A town with nobody in it, for the readout before one is founded. */
const EMPTY_TOWN: Settlement = {
  id: '',
  name: '',
  hearthId: '',
  buildings: new Map(),
  carriers: new Map(),
  book: emptyBook(),
  revision: 0,
};

/** The hand tools, or `place:<designId>` — a library design or a land work, taken in hand. */
export type Tool = 'inspect' | 'hearth' | 'raze' | `place:${DesignId}`;
export type HoverAction = 'none' | 'open' | 'found' | 'build' | 'raze';

export const placeTool = (designId: DesignId): Tool => `place:${designId}`;

export function designIdOfTool(tool: Tool): DesignId | null {
  return tool.startsWith('place:') ? tool.slice('place:'.length) : null;
}

/** One of a design's ways in, and whether this parcel can serve it. */
export interface GhostInput {
  item: Item;
  /** `ground` is a source block — it only works over its own deposit; `carried` is a door. */
  from: 'ground' | 'carried';
  ok: boolean;
}

/** Where the settlement has got to, so the ledger can say what the next move is. */
export interface Progress {
  buildings: number;
  drawsWater: boolean;
  combines: boolean;
  kept: number;
  /** Which way the nearest fresh water lies from the fire, while nothing is drawing it yet. */
  water: string | null;
  /**
   * The score: the share of the town's whole day that is not survival, and the hours that
   * comes to (`needs.ts`). The chapter opens near a fifth and is about getting it past two
   * thirds — one readout, always on, because it is the thing the player is really playing
   * against.
   */
  surplus: Budget;
}

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
  hovered: string | null;
  openBuilding: BuildingId | null;
  openSettlement: string | null;
  tool: Tool;
  designs: Design[];
  settlementCount: number;
  progress: Progress;
  /** The rig on the floor of whatever building is open, if it is one. */
  rig: RigView | null;
  /** What an open building with no rig has standing in it. */
  holding: HoldingView | null;
}

type Listener = () => void;

/**
 * The method the rig's strip is about: the one running, or — when nothing is — the one the scan
 * would take next.
 *
 * One definition, used by the drawing and by the hand both, because on this panel they are the
 * same thing: the strip circles a banking and clicking another fire sets it. Written out twice
 * it was written differently — the readout fell through to the scan and the hand fell through to
 * the head of the queue — and those part company exactly where the queue falls through, which is
 * the opening state of every game. Nothing on screen moved and a method nobody was looking at
 * was retuned.
 */
function stripMethod(rig: Rig, scan: Scan): MethodId | null {
  return rig.running?.methodId ?? scan.method?.id ?? null;
}

export class Game {
  world: GameWorld;
  engine: LogisticsEngine;

  camera: Camera = { centre: { x: 500, y: 350 }, zoom: 1 };
  playing = true;
  speed = 1;
  tool: Tool = 'inspect';

  hoveredParcelId: CellId | null = null;
  hoveredBuildingId: BuildingId | null = null;
  hoveredLabel: string | null = null;
  hoverAction: HoverAction = 'none';
  openBuildingId: BuildingId | null = null;
  /** The settlement whose ledger is open, read from far off where the town is one mark. */
  openSettlementId: string | null = null;

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
    this.camera = fitWorld(viewport);
    this.publish();
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
    this.hoveredLabel = null;
    this.hoverAction = 'none';
    this.openBuildingId = null;
    this.openSettlementId = null;
    rememberSeed(seed);
    if (this.viewport) this.camera = fitWorld(this.viewport);
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

  setTool(tool: Tool): void {
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
    if (this.tool === 'hearth') return canFound(this.world, parcelId);
    if (!settlement) return { ok: false, reason: 'no settlement within reach' };

    if (this.tool === 'raze') {
      if (buildingId) return canRaze(settlement, buildingId);
      return { ok: false, reason: 'nothing to raze' };
    }
    const design = this.heldDesign();
    if (!design) return { ok: false, reason: 'nothing in hand' };
    return canBuild(this.world, settlement, parcelId, design);
  }

  /**
   * Which of the design's inputs this parcel would fill by itself. Drawn as icons under the
   * ghost rather than written out: siting is the whole decision, and a sentence under the
   * cursor is read once and then never again.
   */
  ghostInputs(): GhostInput[] {
    const design = this.tool === 'hearth' ? undefined : this.heldDesign();
    if (!design || !this.hoveredParcelId) return [];
    const ground = landYield(this.world, this.hoveredParcelId);

    return [
      ...designSources(design).map((item) => ({
        item,
        from: 'ground' as const,
        ok: ground.includes(item),
      })),
      ...designInputs(design).map((item) => ({ item, from: 'carried' as const, ok: true })),
    ];
  }

  /** The design the build tool is holding, if it is holding one. */
  heldDesign(): Design | undefined {
    const designId = designIdOfTool(this.tool);
    if (designId === null) return undefined;
    if (isWorks(designId)) return WORKS_DESIGN;
    return this.world.library.get(designId) ?? landWorkById(designId)?.design;
  }

  heldLandWork(): LandWork | undefined {
    const designId = designIdOfTool(this.tool);
    return designId === null ? undefined : landWorkById(designId);
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
    const design = this.heldDesign();
    if (!design) return false;
    const settlement = this.townAt(parcelOf(this.world.seed, parcelId).site);
    if (!settlement || !canBuild(this.world, settlement, parcelId, design).ok) return false;

    placeBuilding(this.world, settlement, parcelId, design);
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
      if (!raze(this.world, settlement, buildingId)) return false;
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
    const open = this.openBuilding();
    const rig = open?.rig;
    if (!open || !rig) return;
    const settlement = this.settlementOfBuilding(open.id);
    if (!settlement) return;
    const running = stripMethod(rig, scanQueue(rig, settlement.book, open));
    const method = running ? methodById(settlement.book, running) : undefined;
    if (!method) return;
    method.run = { ...method.run, charge: Math.max(0, Math.min(CHARGE_STEPS.length - 1, charge)) };
    this.publish();
  }

  /** Move the scratch on the shelf: make this until there are *this many*. */
  setStop(methodId: string, target: number): void {
    const open = this.openBuilding();
    const settlement = open ? this.settlementOfBuilding(open.id) : undefined;
    const method = settlement ? methodById(settlement.book, methodId) : undefined;
    if (!method?.until) return;
    method.until = { ...method.until, target: Math.max(0, target) };
    this.publish();
  }

  /** Shuffle the queue. The scan is in declaration order, so this is the whole of the policy. */
  moveInQueue(methodId: string, by: number): void {
    const rig = this.openBuilding()?.rig;
    if (!rig) return;
    const from = rig.queue.indexOf(methodId);
    const to = from + by;
    if (from < 0 || to < 0 || to >= rig.queue.length) return;
    rig.queue.splice(from, 1);
    rig.queue.splice(to, 0, methodId);
    this.publish();
  }

  private settlementOfBuilding(buildingId: BuildingId): Settlement | undefined {
    for (const settlement of this.world.settlements.values()) {
      if (settlement.buildings.has(buildingId)) return settlement;
    }
    return undefined;
  }

  private rigView(): RigView | null {
    const open = this.openBuilding();
    const rig = open?.rig;
    if (!open || !rig) return null;
    const settlement = this.settlementOfBuilding(open.id);
    if (!settlement) return null;

    const scan = scanQueue(rig, settlement.book, open);
    const refusals = new Map(scan.refused.map((refusal) => [refusal.methodId, refusal]));
    const running = stripMethod(rig, scan);
    const shown = running ? methodById(settlement.book, running) : undefined;

    return {
      buildingId: open.id,
      charge: shown?.run.charge ?? CHARGE_STEADY,
      changingOver: rig.changeover > 0,
      queue: rig.queue.map((id: string): QueueEntry => {
        const method = methodById(settlement.book, id);
        const item = method?.until?.item ?? method?.outputs[0]?.item ?? null;
        return {
          id,
          label: method?.label ?? id,
          item: item ?? null,
          stock: item ? storedStock(open, item) : 0,
          target: method?.until?.target ?? null,
          running: id === running,
          refusal: refusals.get(id)?.kind ?? null,
          why: refusals.get(id)?.why ?? '',
        };
      }),
    };
  }

  /**
   * What a building with no knobs has to say for itself.
   *
   * A land work is the ground opened and a works that holds no rig is a floor with sacks on it:
   * neither has a setting to choose, and both are still worth opening — looking into a well and
   * seeing what is standing in the crate is the whole of what anybody wanted from it.
   */
  private holdingView(): HoldingView | null {
    const open = this.openBuilding();
    if (!open || open.rig) return null;

    return {
      label: labelOf(open),
      state: open.clearing ? 'being cleared' : open.state.toLowerCase(),
      stock: visibleBuffers(open)
        .filter((buffer) => buffer.amount > 0)
        .map((buffer): [Item, number] => [buffer.item, buffer.amount]),
    };
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

  private progressOf(settlement: Settlement | undefined): Progress {
    const buildings = settlement ? [...settlement.buildings.values()] : [];
    const hearth = settlement?.buildings.get(settlement.hearthId);
    let kept = 0;
    for (const buffer of hearth ? visibleBuffers(hearth) : []) kept += buffer.amount;

    const drawsWater = buildings.some((building) =>
      building.design.blocks.some(
        (block) =>
          block.kind === BlockKind.Source &&
          block.item === ItemType.Water &&
          building.yields.includes(ItemType.Water),
      ),
    );

    return {
      buildings: buildings.length,
      surplus: settlement
        ? budgetOf(this.world, settlement)
        : budgetOf(this.world, EMPTY_TOWN),
      // Only while it is still wanted. This is built on every publish, and the ledger asks for
      // the bearing exactly until the town has a well of its own.
      water: hearth && !drawsWater ? bearingToWater(this.world, hearth.position) : null,
      drawsWater,
      combines: buildings.some((building) =>
        building.design.blocks.some((block) => block.kind === BlockKind.Combine),
      ),
      kept,
    };
  }

  private buildSnapshot(): HudSnapshot {
    const settlement = this.openSettlement();
    const hearth = settlement?.buildings.get(settlement.hearthId);

    return {
      seed: this.world.seed,
      tick: this.engine.tickCount,
      playing: this.playing,
      speed: this.speed,
      zoom: this.zoom,
      detail: this.detail(),
      settlementName: settlement?.name ?? null,
      delivered: hearth
        ? visibleBuffers(hearth)
            .filter((buffer) => buffer.amount > 0)
            .map((buffer): [Item, number] => [buffer.item, buffer.amount])
        : [],
      carriers: settlement
        ? [...settlement.carriers.values()].map((carrier) => ({
            id: carrier.id,
            state: carrier.state,
            carrying: carrier.carryingItem,
          }))
        : [],
      hovered: this.hoveredLabel,
      openBuilding: this.openBuildingId,
      openSettlement: this.openSettlementId,
      tool: this.tool,
      designs: buildableDesigns(this.world),
      settlementCount: this.world.settlements.size,
      progress: this.progressOf(settlement),
      rig: this.rigView(),
      holding: this.holdingView(),
    };
  }
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

const COMPASS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];

/**
 * Where to walk to find water, in words.
 *
 * The map draws every river and lake on it, so this is not the only way to find water the way
 * it was when the map's one mark was a spring — it is the shortcut for a player who has just
 * founded and does not want to go hunting. Which is why it says a distance and a bearing rather
 * than pointing at anything in particular.
 */
function bearingToWater(world: GameWorld, from: Vec2): string | null {
  const nearest = nearestWater(world.seed, from);
  if (!nearest) return null;

  const dx = nearest.x - from.x;
  const dy = nearest.y - from.y;
  const octant = Math.round((Math.atan2(dy, dx) / (Math.PI * 2)) * 8 + 8) % 8;
  return `${Math.round(Math.hypot(dx, dy))} paces ${COMPASS[octant] ?? 'away'}`;
}

export const ITEM_ORDER: Item[] = [...ITEM_TYPES];
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
