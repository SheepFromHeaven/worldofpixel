import type { Described } from '../sim/geology/describe.ts';
import { Cave } from '../sim/geology/caves.ts';
import { geologyOf, peakMetres, sliceCount, sliceElevation, STEP_METRES } from '../sim/geology/geology.ts';
import { lightSourcesOf } from '../render/lit/lightSources.ts';
import { windOver } from '../render/lit/localWind.ts';
import { STRATA_VIEW_MODE } from '../render/lit/litLayerConstants.ts';
import { EMPTY } from '../modules/mammals/shared.ts';
import { poseFor } from '../content/animals/catalogue.ts';
import { PoseBlender } from './poseBlend.ts';
import { MAMMALS } from '../modules/mammals/api.ts';
import { AGENT_CAPACITY, AGENT_FLOATS, packAgent } from '../render/lit/mammalAgents.ts';
import type { MammalAgents } from '../render/lit/mammalAgents.ts';
import type { Brush, Mark, StructureView } from '../modules/client.ts';
import type { Camera, Viewport } from '../render/camera.ts';
import { viewZoom } from '../render/camera.ts';
import type { FogView } from '../render/lit/litLayer.ts';
import type { Lighting, PointLight } from '../render/lit/lighting.ts';
import { flickered, skyAt } from '../render/lit/lighting.ts';
import { placeOf } from '../sim/daylight.ts';
import type { CalendarMoment } from '../sim/calendar.ts';
import type { Calendar, CalendarState } from '../sim/calendar.ts';
import { moonPhaseName } from '../sim/calendar.ts';
import { dateName, localSolarTimeOfDay, southernSeasonPhaseOf } from '../sim/astro.ts';
import { SCALE } from '../render/screen.ts';
import { seasonalStateForBothHemispheres } from '../modules/flora/api.ts';
import type { SkyView } from '../modules/weather/api.ts';
import type { Detail } from '../render/terrainPixels.ts';
import { detailFor } from '../render/worldLayer.ts';
import type { Vec2 } from '../sim/geometry.ts';
import type { TileIndex } from '../sim/grid.ts';
import { NOWHERE, TILE, WORLD_SCALE } from '../sim/grid.ts';
import type { Tile } from '../sim/tile.ts';
import { ItemType } from '../modules/items/api.ts';
import type { FaunaMirror } from '../modules/fauna/api.ts';
import type { Shoals } from '../modules/fish/api.ts';
import type { People } from '../modules/people/api.ts';
import { NOBODY } from '../modules/people/api.ts';
import type { Thought } from '../modules/thoughts/api.ts';
import { isCritical } from '../modules/thoughts/api.ts';
import type { PersonView } from './personView.ts';
import type { Achievement } from '../modules/achievements/api.ts';
import { ACHIEVEMENTS } from '../modules/achievements/api.ts';
import { GAME_EMITTERS } from '../modules/index.ts';
import type { OfferContext } from '../sim/offers.ts';
import { gather, igniterIn } from '../modules/fire/api.ts';
import type { Command, GameMode } from '../sim/simulation.ts';
import type { Link } from './link.ts';
import type { Replica } from '../sim/link/replica.ts';
import type { World } from '../sim/world.ts';
import { Trial } from '../modules/discovery/api.ts';
import type { MindView } from '../modules/mind/api.ts';
import { newSlot, readSave, writeSave } from './persist.ts';
import { connect } from './link.ts';
import { connected, launched } from './launch.ts';
import { fit, fogView, held, open, pan, reframe, zoomAt } from './camera.ts';
import { arm, disarm } from './brush.ts';
import { dropIdea, forget, mindKnows, pick, ripe, toggleMind } from './mindActions.ts';
import { buildSnapshot, cellAt, debugView, readout, seasonHere, weatherHere } from './readout.ts';
import { DRIFT, FOCUS_SECONDS, FOG_LIFT_SECONDS, FREE_MIN_ZOOM, LOCKED_MIN_ZOOM, PERSON_REACH_TILES, SAVE_SECONDS, TOAST_SECONDS, WIND } from './gameTuning.ts';

export type Tool = 'clear' | 'tread' | 'bolt' | 'uproot';

export const TOOLS: readonly Tool[] = ['clear', 'tread', 'bolt', 'uproot'];

export interface AchievementView {
  id: string;
  title: string;
  reason: string;
  unlocks: readonly string[];
}

export interface TileView {
  index: TileIndex;
  column: number;
  row: number;
  centre: Vec2;
  biome: string;
  standing: string;
  elevation: number;
  wear: number;
  under: Described | null;
  readout: readonly (readonly [string, string])[];
  walkable: boolean;
  refusal: string | null;
}

export interface HudSnapshot {
  seed: number;
  zoom: number;
  detail: Detail;
  tool: Tool | null;
  day: boolean;
  dayFraction: number;
  announcement: AchievementView | null;
  person: PersonView | null;
  structure: StructureView | null;
  speed: number;
  sky: string;
  weather: string;
  minutes: number;
  season: number;
  moon: number;
  forced: number;
  panel: boolean;
  view: number;
  depth: number;
  slices: number;
  plane: number;
  hovered: TileView | null;
  opened: TileView | null;
  tiles: number;
  trial: boolean;
  mind: MindView | null;
  mindOpen: boolean;
  forming: number | null;
}

type Listener = () => void;

interface DebugView {
  seed: number;
  mode: GameMode;
  x: number;
  y: number;
  zoom: number;
  forced: number;
  calendar: CalendarState;
}

function parseView(view: DebugView): DebugView {
  const numbers = [view.seed, view.x, view.y, view.zoom, view.forced, view.calendar?.timeOfDay, view.calendar?.elapsedDays];
  if (!numbers.every((value) => typeof value === 'number' && Number.isFinite(value)) || (view.mode !== 'settle' && view.mode !== 'discover')) {
    throw new Error('not a view copied by the target button');
  }
  return view;
}

export class Game {
  link: Link;
  mode: GameMode;
  slot: string;

  camera: Camera = { centre: { x: 0, y: 0 }, zoom: 1 };
  tool: Tool | null = null;
  brush: Brush | null = null;

  panel = false;
  mindOpen = false;
  readonly noticed = new Set<number>();
  viewMode = 0;
  depth = 0;

  selectedPerson: number = NOBODY;
  selectedStructure: TileIndex = NOWHERE;

  trial: Trial | null = null;
  trialPerson: number = NOBODY;

  fogLift = 0;
  toast: Achievement | null = null;
  toastLeft = 0;
  waiting: Achievement[] = [];

  skyline = '';

  hoveredIndex: TileIndex = NOWHERE;
  openedIndex: TileIndex = NOWHERE;

  viewport: Viewport | null = null;
  listeners = new Set<Listener>();
  snapshot: HudSnapshot;
  unbind: () => void = () => undefined;

  constructor(slot: string, link: Link) {
    this.slot = slot;
    this.link = link;
    const saved = readSave(slot);
    this.mode = link.replica.mode;
    this.bind();
    if (saved) {
      if (this.mode === 'settle' && this.free) this.fogLift = 1;
      this.restoredCamera = { centre: { x: saved.camera.x, y: saved.camera.y }, zoom: saved.camera.zoom };
    }
    this.snapshot = buildSnapshot(this);
  }

  get replica(): Replica {
    return this.link.replica;
  }

  get world(): World {
    return this.replica.world;
  }

  get sky(): SkyView {
    return this.replica.sky;
  }

  get shoals(): Shoals {
    return this.replica.shoals;
  }

  readonly agentData = new Float32Array(AGENT_CAPACITY * AGENT_FLOATS);
  readonly blender = new PoseBlender();
  focusClock = -Infinity;

  mammalAgents(): MammalAgents {
    const { animals } = this.replica;
    const now = performance.now() / 1000;
    this.blender.begin();
    let count = 0;
    for (let at = 0; at < animals.n; at += 1) {
      if (animals.species[at] === EMPTY) continue;
      const kind = MAMMALS[animals.species[at]!]!;
      packAgent(this.agentData, count, {
        x: animals.posX[at]!,
        y: animals.posY[at]!,
        dirX: animals.dirX[at]!,
        dirY: animals.dirY[at]!,
        species: animals.species[at]!,
        stage: animals.stage[at]!,
        key: animals.key[at]!,
        travelled: animals.travelled[at]!,
        going: animals.going[at]!,
        groupKey: animals.groupKey[at]!,
        member: animals.member[at]!,
        denX: animals.denX[at]!,
        denY: animals.denY[at]!,
        glance: animals.glance[at]!,
        state: animals.state[at]!,
        height: animals.posZ[at]!,
        pose: this.blender.blend(at, animals.species[at]! * 65536 + animals.groupKey[at]! * 4096 + animals.member[at]!, animals.state[at]!, poseFor(kind.key, animals.state[at]!, kind.length, kind.legs, animals.travelled[at]!, animals.going[at]! === 1, animals.since[at]!, animals.left[at]!, animals.pitch[at]!), now),
      });
      count += 1;
    }
    this.blender.end();
    return { count, data: this.agentData, isolated: false };
  }

  watch(centre: Vec2, radius: number): void {
    const now = performance.now();
    if (now - this.focusClock < FOCUS_SECONDS * 1000) return;
    this.focusClock = now;
    this.link.send({ kind: 'focus', x: centre.x, y: centre.y, radius });
  }

  startle(point: Vec2): void {
    this.link.send({ kind: 'startle', x: point.x, y: point.y });
  }

  get fauna(): FaunaMirror | null {
    return this.replica.fauna;
  }

  get people(): People {
    return this.replica.people;
  }

  get calendar(): Calendar {
    return this.replica.calendar;
  }

  get speed(): number {
    return this.replica.speed;
  }

  get playTime(): number {
    return this.replica.playTimeAt(performance.now());
  }

  bind(): void {
    this.unbind();
    this.unbind = this.link.subscribe((message) => {
      if (message.kind === 'frame') {
        if (message.frame.changed || message.frame.mind) this.publish();
        return;
      }
      const { event } = message;
      if (event.kind === 'achievement') {
        const achievement = ACHIEVEMENTS.find((candidate) => candidate.id === event.id);
        if (achievement) this.announce(achievement);
      } else this.openTrial(event.person, event.tile, event.items, event.seed);
    });
  }

  reset(): void {
    this.fogLift = 0;
    this.selectedPerson = NOBODY;
    this.toast = null;
    this.waiting = [];
    this.trial = null;
    this.trialPerson = NOBODY;
  }

  get zoomFloor(): number {
    if (this.mode === 'discover') return 0;
    return this.free ? FREE_MIN_ZOOM : LOCKED_MIN_ZOOM;
  }

  async newWorld(seed: number): Promise<void> {
    this.save();
    const carry = this.link.carry();
    this.link.close();
    this.link = await connect({ seed, size: WORLD_SCALE, mode: this.mode, saved: null, carry });
    this.bind();
    this.slot = newSlot();
    this.shot = null;
    this.reset();
    this.hoveredIndex = NOWHERE;
    this.openedIndex = NOWHERE;
    this.tool = null;
    this.brush = null;
    open(this);
    this.publish();
  }

  leave(): void {
    this.save();
    window.location.reload();
  }

  unsaved = 0;

  restoredCamera: Camera | null = null;

  saveDue = false;

  shot: string | null = null;

  persist(seconds: number): void {
    this.unsaved += seconds;
    if (this.unsaved >= SAVE_SECONDS) this.saveDue = true;
  }

  save(): void {
    this.unsaved = 0;
    this.saveDue = false;
    const state = this.link.latest;
    if (!state) return;
    writeSave({
      slot: this.slot,
      seed: this.world.seed,
      size: WORLD_SCALE,
      mode: this.mode,
      savedAt: Date.now(),
      camera: { x: this.camera.centre.x, y: this.camera.centre.y, zoom: this.camera.zoom },
      ...state,
    }, this.shot);
  }

  openTrial(person: number, tile: TileIndex, items: readonly ItemType[], seed: number): void {
    if (this.trial) return;
    this.trial = new Trial(tile, items, seed);
    this.trialPerson = person;
    this.publish();
  }

  leaveTrial(): void {
    const trial = this.trial;
    if (!trial) return;
    const person = this.trialPerson;
    this.trial = null;
    this.trialPerson = NOBODY;
    this.link.send({ kind: 'commitTrial', person, outcome: trial.outcome() });
  }

  advanceTrial(seconds: number): void {
    this.trial?.update(seconds);
  }

  personAt(point: Vec2): number {
    let found = NOBODY;
    let least = PERSON_REACH_TILES;
    for (let person = 0; person < this.people.count; person += 1) {
      const away = Math.hypot(this.people.posX[person]! - point.x, this.people.posY[person]! - point.y);
      if (away < least) {
        least = away;
        found = person;
      }
    }
    return found;
  }

  selectPerson(person: number): void {
    if (person === this.selectedPerson && (person !== NOBODY || this.selectedStructure === NOWHERE)) return;
    this.selectedPerson = person;
    if (person !== NOBODY) this.selectedStructure = NOWHERE;
    this.publish();
  }

  lookAt(person: number): void {
    if (person === NOBODY || !this.viewport) return;
    this.selectPerson(person);
    this.camera = held(this, { centre: { x: this.people.posX[person]!, y: this.people.posY[person]! }, zoom: this.camera.zoom }, this.viewport);
    this.publish();
  }

  selectAt(point: Vec2): void {
    const person = this.personAt(point);
    if (person !== NOBODY) {
      this.selectPerson(person);
      return;
    }
    const index = this.tileUnder(point);
    this.selectedStructure = this.world.structures.hasStructure(index) ? index : NOWHERE;
    this.selectedPerson = NOBODY;
    this.publish();
  }

  clearStructureSelection(): void {
    if (this.selectedStructure === NOWHERE) return;
    this.selectedStructure = NOWHERE;
    this.publish();
  }

  get free(): boolean {
    return this.replica.free;
  }

  announce(achievement: Achievement): void {
    this.waiting.push(achievement);
    if (!this.toast) this.nextToast();
    this.publish();
  }

  nextToast(): void {
    this.toast = this.waiting.shift() ?? null;
    this.toastLeft = TOAST_SECONDS;
  }

  dismissToast(): void {
    if (!this.toast) return;
    this.nextToast();
    this.publish();
  }

  advanceShell(seconds: number): void {
    if (this.free && this.fogLift < 1) this.fogLift = Math.min(1, this.fogLift + seconds / FOG_LIFT_SECONDS);
    if (!this.toast) return;
    this.toastLeft -= seconds;
    if (this.toastLeft <= 0) this.dismissToast();
  }

  get zoom(): number {
    return viewZoom(this.camera);
  }

  get view(): Camera {
    return { centre: this.camera.centre, zoom: this.zoom };
  }

  detail(): Detail {
    return detailFor(this.zoom / SCALE);
  }

  get reaches(): boolean {
    return this.zoom / SCALE >= TILE;
  }

  tileUnder(point: Vec2): TileIndex {
    const { grid } = this.world;
    const column = Math.floor((point.x - grid.minX) / grid.spacing);
    const row = Math.floor((point.y - grid.minY) / grid.spacing);
    return grid.at(column, row);
  }

  tile(index: TileIndex): Tile | null {
    return index === NOWHERE ? null : this.world.tile(index);
  }

  async loadView(text: string): Promise<void> {
    const view = JSON.parse(text) as DebugView;
    parseView(view);
    this.save();
    const carry = { calendar: view.calendar, speed: 0, playTime: 0 };
    this.link.close();
    this.link = await connect({ seed: view.seed, size: WORLD_SCALE, mode: view.mode, saved: null, carry });
    this.mode = this.link.replica.mode;
    this.bind();
    this.slot = newSlot();
    this.shot = null;
    this.reset();
    this.hoveredIndex = NOWHERE;
    this.openedIndex = NOWHERE;
    this.tool = null;
    this.brush = null;
    this.restoredCamera = { centre: { x: view.x, y: view.y }, zoom: view.zoom };
    this.link.send({ kind: 'setForced', index: view.forced });
    open(this);
    this.publish();
  }

  skip(hours: number): void {
    this.link.send({ kind: 'skip', hours });
  }

  get clock(): number {
    return this.calendar.timeOfDay;
  }

  get elapsed(): number {
    return this.calendar.elapsedDays;
  }

  get moon(): number {
    return this.calendar.moonPhase;
  }

  get season(): number {
    return this.calendar.seasonPhase;
  }

  get moment(): CalendarMoment {
    return this.calendar.moment;
  }

  seasons(): Pick<Lighting, 'seasonalShaderTable' | 'fallingLeaves' | 'blowingPetals' | 'leafLitter'> {
    const state = seasonalStateForBothHemispheres(this.season, southernSeasonPhaseOf(this.season));
    return {
      seasonalShaderTable: state.shaderTable,
      fallingLeaves: state.fallingLeaves,
      blowingPetals: state.blowingPetals,
      leafLitter: state.leafLitter,
    };
  }

  lightingAt(seconds: number): Lighting {
    return {
      ...skyAt(this.moment, placeOf(this.world.grid, this.world.seed, this.camera.centre)),
      moment: this.moment,
      ...this.seasons(),
      drift: [this.world.field.prevailing * DRIFT, DRIFT * 0.25],
      wind: WIND,
      points: flickered(this.lightSources(), seconds),
    };
  }

  lightSources(): PointLight[] {
    return lightSourcesOf(this.world, this.people, this.camera.centre, (x, y) => Math.hypot(...windOver(this.world, this.sky, x, y)));
  }

  advance(seconds: number): void {
    this.replica.interpolate(performance.now());
    if (this.selectedStructure !== NOWHERE && !this.world.structures.hasStructure(this.selectedStructure)) this.clearStructureSelection();
    this.advanceShell(seconds);
    this.persist(seconds);
    this.advanceTrial(seconds);
    this.refreshSkyline();
  }

  thoughtsOf(person: number): readonly Thought[] {
    return this.replica.thoughtsOf(person);
  }

  isAlarmed(person: number): boolean {
    return isCritical(this.thoughtsOf(person));
  }

  send(command: Command): void {
    if (command.kind === 'arm') {
      arm(this, command);
      return;
    }
    this.link.send(command);
  }

  get offers(): OfferContext {
    return {
      world: this.world,
      people: this.people,
      mode: this.mode,
      depth: this.depth,
      plane: this.plane,
      knows: (id) => mindKnows(this, id),
      igniterNear: (x, y) => igniterIn(gather(GAME_EMITTERS, this.world, this.people), x, y),
      deepCaveAt: (index) => this.deepCaveAt(index),
    };
  }

  deepCaveAt(index: TileIndex): boolean {
    const at = this.world.grid.centre(index);
    const cell = geologyOf(this.world).sample(at.x, at.y, this.plane, { rock: 0, mineral: 0, cave: 0, above: 0, life: 0 });
    return cell.cave === Cave.Open || cell.cave === Cave.Dripstone;
  }

  setForced(index: number): void {
    this.link.send({ kind: 'setForced', index });
  }

  setSpeed(speed: number): void {
    this.link.send({ kind: 'setSpeed', speed });
  }

  togglePause(): void {
    this.link.send({ kind: 'togglePause' });
  }

  cycleSpeed(): void {
    this.link.send({ kind: 'cycleSpeed' });
  }

  get shownView(): number {
    return this.depth > 0 ? STRATA_VIEW_MODE : this.viewMode;
  }

  get slices(): number {
    return sliceCount(this.world);
  }

  get plane(): number {
    return sliceElevation(this.world, this.depth);
  }

  setDepth(level: number): void {
    const next = Math.min(this.slices, Math.max(0, Math.round(level)));
    if (next === this.depth) return;
    this.depth = next;
    this.publish();
  }

  dig(levels: number): void {
    this.setDepth(this.depth + levels);
  }

  toSeaLevel(): void {
    this.setDepth(peakMetres(this.world) / STEP_METRES);
  }

  setView(mode: number): void {
    this.viewMode = mode;
    this.publish();
  }

  togglePanel(): void {
    this.panel = !this.panel;
    this.publish();
  }

  setMinutes(minutes: number): void {
    this.link.send({ kind: 'setMinutes', minutes });
  }

  setSeason(phase: number): void {
    this.link.send({ kind: 'setSeason', phase });
  }

  setMoon(phase: number): void {
    this.link.send({ kind: 'setMoon', phase });
  }

  get shownMinutes(): number {
    return Math.floor((this.clock * 1440) / 10) * 10;
  }

  localDay(): number {
    const { world } = this;
    return localSolarTimeOfDay(this.clock, placeOf(world.grid, world.seed, this.camera.centre).offset);
  }

  localLabel(): string {
    const local = this.localDay();
    const total = Math.floor((local * 1440) / 10) * 10;
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  clockLabel(): string {
    const total = this.shownMinutes;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  refreshSkyline(): void {
    const label = `${this.localLabel()}, ${dateName(this.season)}, ${seasonHere(this)}, ${moonPhaseName(this.moon)}, ${weatherHere(this)}`;
    if (label === this.skyline) return;
    this.skyline = label;
    this.publish();
  }

  setTool(tool: Tool | null): void {
    this.tool = tool;
    this.brush = null;
    this.publish();
  }

  openTile(index: TileIndex): void {
    this.openedIndex = index;
    this.publish();
  }

  use(index: TileIndex): void {
    if (index === NOWHERE || this.tool === null) return;

    this.link.send({ kind: 'use', tool: this.tool, tile: index });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  read(): HudSnapshot {
    return this.snapshot;
  }

  publish(): void {
    this.snapshot = buildSnapshot(this);
    for (const listener of this.listeners) listener();
  }


  fit(viewport: Viewport): void {
    return fit(this, viewport);
  }

  reframe(viewport: Viewport): void {
    return reframe(this, viewport);
  }

  open(): void {
    return open(this);
  }

  held(camera: Camera, viewport: Viewport): Camera {
    return held(this, camera, viewport);
  }

  fogView(): FogView | null {
    return fogView(this);
  }

  pan(dx: number, dy: number, viewport: Viewport): void {
    return pan(this, dx, dy, viewport);
  }

  zoomAt(screen: Vec2, viewport: Viewport, factor: number): void {
    return zoomAt(this, screen, viewport, factor);
  }

  debugView(): string {
    return debugView(this);
  }

  disarm(): boolean {
    return disarm(this);
  }

  rotate(): boolean {
    if (!this.brush) return false;
    this.brush.turn();
    return true;
  }

  marksAt(index: TileIndex): Mark[] {
    return this.brush ? this.brush.marks(index) : [];
  }

  placeAt(index: TileIndex): boolean {
    return this.brush ? this.brush.apply(index) : false;
  }

  pick(parent: number): void {
    return pick(this, parent);
  }

  dropIdea(): void {
    return dropIdea(this);
  }

  forget(id: number): void {
    return forget(this, id);
  }

  toggleMind(): void {
    return toggleMind(this);
  }

  ripe(): readonly number[] {
    return ripe(this);
  }

  cellAt(point: Vec2): number {
    return cellAt(this, point);
  }

  readout(tile: Tile): readonly (readonly [string, string])[] {
    return readout(this, tile);
  }
}

const launch = launched();

export const game = new Game(launch.slot, await connected());
