import { CHARGE_STEADY, CHARGE_STEPS, emptyBook, methodById } from '../sim/book.ts';
import type { MethodId } from '../sim/book.ts';
import type { Batch, HoldingView, QueueEntry, RigView, Standing } from './rigView.ts';
import { DAY_PARTS } from './townView.ts';
import type { DayHours, DayPart, StandingIn, TownView } from './townView.ts';
import { TICKS_PER_SECOND, affordableBankings, batchTicks, costOf, linesFor, scanQueue, yieldOf } from '../sim/process.ts';
import type { Rig, Scan } from '../sim/process.ts';
import { DAY_HOURS, dayOf, vesselsHeld } from '../sim/needs.ts';
import { labelOf, storedStock } from '../sim/buildings.ts';
import { totalHeld } from '../sim/stock.ts';
import { LogisticsEngine } from '../sim/engine.ts';
import { buildableDesigns, canBuild, canRaze, placeBuilding, raze } from '../sim/construction.ts';
import { HEARTH_DESIGN, HEARTH_DESIGN_ID } from '../sim/designs.ts';
import { landWorkById, workServes } from '../sim/landWorks.ts';
import { bedsIn as areaBeds, capacityOf, firstStation, groundWork, shelteredArea } from '../sim/area.ts';
import type { LandWork } from '../sim/landWorks.ts';
import { lerp } from '../sim/geometry.ts';
import type { Vec2 } from '../sim/geometry.ts';
import { PARCEL, cellAt, parcelOf } from '../sim/parcels.ts';
import type { Detail } from '../sim/parcels.ts';
import { landYield } from '../sim/markers.ts';
import { CarrierState, ITEM_TYPES, ItemType } from '../sim/types.ts';
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

export { TICKS_PER_SECOND };
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
  /** Whether the town's own slab is open. */
  statsOpen: boolean;
  /** The town that slab is about: the one the player is looking at, if there is one. */
  town: TownView | null;
}

type Listener = () => void;

/**
 * A land work's shift as a batch: the ground eats nothing, and how far through it is comes off
 * the villager inside, who hands the whole batch over when the shift ends.
 */
function shiftOf(work: LandWork, settlement: Settlement | undefined, buildingId: BuildingId): Batch {
  let progress = 0;
  for (const carrier of settlement?.carriers.values() ?? []) {
    if (carrier.state !== CarrierState.Working || carrier.atId !== buildingId) continue;
    progress = Math.max(0, Math.min(1, (work.ticks - carrier.handling) / work.ticks));
  }
  return {
    uses: [],
    makes: [{ item: work.item, amount: work.batch }],
    seconds: work.ticks / TICKS_PER_SECOND,
    progress,
    ...(work.pool ? { pool: work.pool.map((entry) => ({ ...entry })) } : {}),
  };
}

/**
 * The method the rig's strip is about: the one running, or — when nothing is — the one the scan
 * would take next, or — when nothing can run at all — the head of the queue.
 *
 * One definition, used by the drawing and by the hand both, because on this panel they are the
 * same thing: the strip circles a banking and clicking another fire sets it. Written out twice
 * it was written differently — the readout fell through to the scan and the hand fell through to
 * the head of the queue — and those part company exactly where the queue falls through, which is
 * the opening state of every game. Nothing on screen moved and a method nobody was looking at
 * was retuned.
 *
 * The head of the queue is the last resort because a town with no wood has nothing running and
 * nothing runnable, and a strip about no method at all circled a fire and then ignored every
 * press.
 */
function stripMethod(rig: Rig, scan: Scan, lines: readonly MethodId[]): MethodId | null {
  return rig.running?.methodId ?? scan.method?.id ?? lines[0] ?? null;
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

  toggleStats(): void {
    this.statsOpen = !this.statsOpen;
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
   * What this parcel would have to give for the thing in hand to work, and whether it does.
   *
   * Land works only, because they are the only buildings the ground gates: a rig is fed
   * through its door by carriers and can stand anywhere one can walk, so drawing a row of
   * wants under its ghost would be marking a decision the player is not making.
   */
  ghostInputs(): GhostInput[] {
    const work = this.tool === 'hearth' ? undefined : this.heldLandWork();
    if (!work || !this.hoveredParcelId) return [];
    const ground = landYield(this.world, this.hoveredParcelId);
    const biome = parcelOf(this.world.seed, this.hoveredParcelId).biome;

    return [{ item: work.item, from: 'ground', ok: workServes(work, biome, ground) }];
  }

  /** The design the build tool is holding, if it is holding one. */
  heldDesign(): Design | undefined {
    const designId = designIdOfTool(this.tool);
    if (designId === null) return undefined;
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
    const open = this.openStation();
    if (!open) return;
    const { area, slot, rig, settlement } = open;
    const running = stripMethod(rig, scanQueue(rig, settlement.book, area, slot), linesFor(area, slot));
    const method = running ? methodById(settlement.book, running) : undefined;
    if (!method) return;
    method.run = { ...method.run, charge: Math.max(0, Math.min(CHARGE_STEPS.length - 1, charge)) };
    this.publish();
  }

  /**
   * Shuffle the list. The scan is in declaration order, so this is the whole of the policy. A
   * line swaps with the next one up or down bound to the same station, since that station's
   * queue is what the panel shows.
   */
  moveInQueue(methodId: string, by: number): void {
    const open = this.openStation();
    if (!open) return;
    const { area, slot } = open;
    const mine = area.queue
      .map((line, index) => ({ line, index }))
      .filter((entry) => entry.line.slot === slot);
    const at = mine.findIndex((entry) => entry.line.methodId === methodId);
    const other = mine[at + by];
    const self = mine[at];
    if (!self || !other) return;
    area.queue[self.index] = other.line;
    area.queue[other.index] = self.line;
    this.publish();
  }

  /** The station the open area's panel is about: the first one standing in it, for now. */
  private openStation(): { area: Building; slot: number; rig: Rig; settlement: Settlement } | null {
    const area = this.openBuilding();
    const station = area ? firstStation(area) : undefined;
    const settlement = area ? this.settlementOfBuilding(area.id) : undefined;
    if (!area || !station || !settlement) return null;
    return { area, slot: station.slot, rig: station.rig, settlement };
  }

  private settlementOfBuilding(buildingId: BuildingId): Settlement | undefined {
    for (const settlement of this.world.settlements.values()) {
      if (settlement.buildings.has(buildingId)) return settlement;
    }
    return undefined;
  }

  private rigView(): RigView | null {
    const station = this.openStation();
    if (!station) return null;
    const { area: open, slot, rig, settlement } = station;

    const lines = linesFor(open, slot);
    const scan = scanQueue(rig, settlement.book, open, slot);
    const refusals = new Map(scan.refused.map((refusal) => [refusal.methodId, refusal]));
    const running = stripMethod(rig, scan, lines);
    const shown = running ? methodById(settlement.book, running) : undefined;

    return {
      buildingId: open.id,
      label: station.area.slots[slot]?.design?.label ?? labelOf(open),
      capacity: capacityOf(open),
      process: rig.process,
      charge: shown?.run.charge ?? CHARGE_STEADY,
      affordable: shown
        ? affordableBankings(rig, shown, open)
        : CHARGE_STEPS.map(() => true),
      changingOver: rig.changeover > 0,
      queue: lines.map((id: string): QueueEntry => {
        const method = methodById(settlement.book, id);
        return {
          id,
          label: method?.label ?? id,
          uses: method ? costOf(rig, method) : [],
          makes: method ? yieldOf(rig, method) : [],
          seconds: method ? batchTicks(rig, method) / TICKS_PER_SECOND : 0,
          running: id === running,
          progress:
            method && rig.running?.methodId === id ? rig.running.progress / batchTicks(rig, method) : 0,
          refusal: refusals.get(id)?.kind ?? null,
          why: refusals.get(id)?.why ?? '',
        };
      }),
      stock: standingIn(open),
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
    if (!open || firstStation(open)) return null;

    const view: HoldingView = {
      label: labelOf(open),
      state: open.clearing ? 'being cleared' : open.state.toLowerCase(),
      stock: standingIn(open),
      capacity: capacityOf(open),
    };
    const work = groundWork(open);
    if (work && !open.clearing) view.work = shiftOf(work, this.settlementOfBuilding(open.id), open.id);
    return view;
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

  /**
   * What the town can see of itself: who is here, how their day goes, and what is lying about.
   *
   * Only while the slab is open: a snapshot is built on every publish, and nobody is looking at
   * this the rest of the time.
   */
  private townView(): TownView | null {
    const settlement = this.statsOpen ? this.statsTown() : undefined;
    if (!settlement) return null;

    const day = dayOf(settlement);
    const people = settlement.carriers.size;
    let roofed = 0;
    for (const building of settlement.buildings.values()) {
      if (!building.clearing && shelteredArea(building)) roofed += areaBeds(building);
    }
    const hearth = settlement.buildings.get(settlement.hearthId);
    const standing: StandingIn[] = [];
    // The store first, because it is the one building the player is always asking about, and
    // then the rest in the order they were raised — which is the order they are remembered in.
    for (const building of settlement.buildings.values()) {
      const stock = standingIn(building);
      if (stock.length === 0) continue;
      const entry = { id: building.id, label: labelOf(building), stock, capacity: capacityOf(building) };
      if (building === hearth) standing.unshift(entry);
      else standing.push(entry);
    }

    return {
      name: settlement.name,
      people,
      sheltered: Math.min(people, roofed),
      vessels: vesselsHeld(settlement),
      buildings: settlement.buildings.size,
      day: dayHours(day),
      spare: Math.round((day.work + day.idle) * people),
      standing,
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
    const kept = hearth ? totalHeld(hearth) : 0;

    // A land work is the only thing that opens the ground, so a town draws water exactly when
    // one of them is a well standing on water — a lean-to on a bank is a bed by a river.
    const drawsWater = buildings.some(
      (building) =>
        building.yields.includes(ItemType.Water) &&
        groundWork(building)?.item === ItemType.Water,
    );

    return {
      buildings: buildings.length,
      // Only while it is still wanted. This is built on every publish, and the ledger asks for
      // the bearing exactly until the town has a well of its own.
      water: hearth && !drawsWater ? bearingToWater(this.world, hearth.position) : null,
      drawsWater,
      combines: buildings.some((building) => firstStation(building) !== undefined),
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
      delivered: hearth ? standingIn(hearth) : [],
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
      statsOpen: this.statsOpen,
      town: this.townView(),
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

/** What is standing in a building, as every slab draws it: a line an item, in arrival order. */
function standingIn(building: Building): Standing {
  return [...building.stock].filter(([, amount]) => amount > 0);
}

/**
 * A villager's day as it was watched, in whole hours, coming to fourteen exactly.
 *
 * Whole hours because the sun is the only instrument this town owns and it reads to about one
 * — a stretch written as 1.6 hours is a clock nobody has built. Exactly fourteen because the
 * drawing *is* a day: six independent roundings come to thirteen or fifteen as often as not,
 * and a day with a notch missing out of it is a panel that cannot be trusted about anything
 * else. So the remainders are shared out largest first, ties going to the earlier part of the
 * day, which keeps it in declaration order and so in the trace.
 */
function dayHours(day: Record<DayPart, number>): DayHours[] {
  const parts = DAY_PARTS.map((part) => {
    const exact = day[part];
    return { part, hours: Math.floor(exact), rest: exact - Math.floor(exact) };
  });

  let left = DAY_HOURS - parts.reduce((total, part) => total + part.hours, 0);
  for (const part of [...parts].sort((a, b) => b.rest - a.rest)) {
    if (left <= 0) break;
    part.hours += 1;
    left -= 1;
  }

  return parts.map(({ part, hours }): DayHours => ({ part, hours }));
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
