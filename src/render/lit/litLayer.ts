import type { Vec2 } from '../../sim/geometry.ts';
import type { FaunaMirror } from '../../modules/fauna/api.ts';
import type { Shoals } from '../../modules/fish/api.ts';
import type { People } from '../../modules/people/api.ts';
import type { SkyView } from '../../modules/weather/api.ts';
import type { World } from '../../sim/world.ts';
import { MIPS } from '../groundSprites.ts';
import { levelFor, TEXEL } from '../terrainPixels.ts';
import { FaunaTexture } from './faunaTexture.ts';
import type { HumanDraw } from './humanPass.ts';
import { FogPass } from './fogPass.ts';
import { folkInstances } from './folkInstances.ts';
import { createQuadGeometry } from './glHelpers.ts';
import { GroundGradePass } from './groundGradePass.ts';
import type { Lighting } from './lighting.ts';
import { MAX_POINTS } from './lighting.ts';
import './corePasses.ts';
import { passDefs, stagesInOrder } from './passes.ts';
import type { Entry, Frame, PassDef, RenderContext, Stage } from './passes.ts';
import {
  GROUND_MARKS_FROM_ZOOM,
  LOW_MARK_SHADOWS_FROM_ZOOM,
  PLACEMENT_BLOCK_TILES,
  STRATA_VIEW_MODE,
  VIEW_MARGIN_TILES,
} from './litLayerConstants.ts';
import { MapViewPass } from './mapViewPass.ts';
import { PassTimer } from './passTimer.ts';
import { packPointLights } from './pointLightData.ts';
import { PropPass } from './propPass.ts';
import { GrownTrees } from './grownTrees.ts';
import { PropPlacementCache } from './propPlacementCache.ts';
import type { SceneryProp } from './scenery.ts';
import { TerrainLightPass } from './terrainLightPass.ts';
import { WaterPass } from './waterPass.ts';
import { WeatherDataTextures } from './weatherDataTextures.ts';
import type { MammalAgents } from './mammalAgents.ts';
import type { ZooState } from './zoo.ts';

export interface LitView {
  centre: Vec2;
  zoom: number;
  width: number;
  height: number;
  time: number;
  ground: HTMLCanvasElement | null;
  people: People | null;
  shoals: Shoals | null;
  fauna: FaunaMirror | null;
  fog: FogView | null;
  depth: number;
  see?: readonly SeeThrough[];
  xray?: boolean;
  ghost?: { sprite: string; x: number; y: number };
}

export interface SeeThrough {
  x: number;
  y: number;
  lift: number;
  radius: number;
  strength?: number;
  simple?: boolean;
}

export interface FogView {
  x: number;
  y: number;
  inner: number;
  edge: number;
}

export interface LitLayer {
  readonly showsFolk: boolean;
  draw(world: World, view: LitView, lighting: Lighting, sky: SkyView, viewMode: number): void;
  throwRipple(x: number, y: number, seconds: number): void;
  setZoos(states: readonly ZooState[], focus: ZooState | null): void;
  setMammalAgents(agents: MammalAgents | null): void;
  setHumans(people: readonly HumanDraw[]): void;
  setScenery(props: readonly SceneryProp[] | null): void;
  probeZoo(world: World, view: LitView, lighting: Lighting): Vec2 | null;
  dispose(): void;
}

const MAP_VIEW_MODES_THAT_REPLACE_THE_SCENE = (viewMode: number): boolean =>
  viewMode === 1 || viewMode === 2 || (viewMode >= 4 && viewMode !== STRATA_VIEW_MODE);
const WIND_VIEW_MODE = 3;

export function createLitLayer(canvas: HTMLCanvasElement, groups: ReadonlySet<string> | null = null): LitLayer | null {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    depth: true,
    stencil: true,
    antialias: false,
  });
  if (!gl) return null;

  const quad = createQuadGeometry(gl);
  const timer = new PassTimer(gl);
  const skipped = (name: string): boolean => ((globalThis as { litSkip?: string[] }).litSkip ?? []).includes(name);
  const weather = new WeatherDataTextures(gl);
  const placement = new PropPlacementCache(gl);
  const grownTrees = new GrownTrees(gl);
  placement.grownTrees = grownTrees;

  let propPass: PropPass;
  let groundGradePass: GroundGradePass;
  let terrainLightPass: TerrainLightPass;
  let waterPass: WaterPass;
  let zooHumans: readonly HumanDraw[] = [];
  let faunaTexture: FaunaTexture;
  let mapViewPass: MapViewPass;
  let fogPass: FogPass;
  const instances = new Map<string, unknown>();
  try {
    propPass = new PropPass(gl, quad.cornersBuffer, weather);
    groundGradePass = new GroundGradePass(gl, quad.fullScreenVertexArray, weather);
    terrainLightPass = new TerrainLightPass(gl, quad.fullScreenVertexArray, weather);
    waterPass = new WaterPass(gl, quad.fullScreenVertexArray, weather);
    faunaTexture = new FaunaTexture(gl);
    mapViewPass = new MapViewPass(gl, quad.fullScreenVertexArray, weather);
    fogPass = new FogPass(gl, quad.fullScreenVertexArray);
    const context: RenderContext = { gl, quad, weather, fauna: faunaTexture };
    for (const def of passDefs()) instances.set(def.id, def.create(context));
  } catch (error) {
    console.warn('lit props unavailable:', error);
    return null;
  }

  const clearEverything = (view: LitView): void => {
    gl.viewport(0, 0, view.width, view.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
  };

  let showsFolk = false;
  let scenery: readonly SceneryProp[] | null = null;
  let zoos: readonly ZooState[] = [];
  let focus: ZooState | null = null;
  const hidden = (name: string, group: ZooState['group']): boolean => skipped(name) || (groups !== null && !groups.has(group)) || (zoos.length > 0 && !zoos.some((one) => one.group === group));
  const pinned = (group: ZooState['group'], pass: { zoo: ZooState | null }, run: () => void, once = false): void => {
    const list = zoos.filter((one) => one.group === group);
    if (list.length === 0) {
      pass.zoo = null;
      run();
      return;
    }
    for (const one of once ? list.slice(0, 1) : list) {
      pass.zoo = one;
      run();
    }
  };

  const feed = (id: string, value: unknown): void => {
    const def = passDefs().find((one) => one.id === id);
    def?.feed?.(instances.get(id), value);
  };

  const plan = new Map<Stage, { def: PassDef<unknown>; entry: Entry<unknown> }[]>();
  for (const stage of stagesInOrder()) {
    const todo: { def: PassDef<unknown>; entry: Entry<unknown> }[] = [];
    for (const def of passDefs()) for (const entry of def.entries) if (entry.stage === stage) todo.push({ def, entry });
    plan.set(stage, todo.sort((a, b) => a.entry.order - b.entry.order));
  }
  const runStage = (stage: Stage, frame: Frame): void => {
    for (const { def, entry } of plan.get(stage) ?? []) {
      if (def.group ? hidden(def.skip, def.group) : skipped(def.skip)) continue;
      if (entry.when && !entry.when(frame)) continue;
      const pass = instances.get(def.id);
      const pin = (draw: () => void): void => (def.group ? pinned(def.group, pass as { zoo: ZooState | null }, draw, entry.once === true) : draw());
      timer.time(entry.label, () => entry.run(pass, frame, pin));
    }
  };

  const drawScene = (world: World, view: LitView, lighting: Lighting, sky: SkyView): Frame => {
    timer.time('weather textures', () => weather.update(world, sky, view.time, lighting));
    clearEverything(view);
    gl.disable(gl.DEPTH_TEST);

    const pointLights = packPointLights(lighting);
    propPass.occluders = null;
    const spriteMipLevel = Math.round(Math.log2(levelFor(view.zoom).texel / TEXEL));
    const atlas = placement.atlas;
    const propsAreStanding = atlas !== null && spriteMipLevel < MIPS && !skipped('props');
    showsFolk = propsAreStanding && view.people !== null;
    const frame: Frame = { world, view, lighting, sky, standing: propsAreStanding, mip: spriteMipLevel, humans: zooHumans };

    let instanceCount = 0;
    if (atlas && propsAreStanding) {
      const { grid } = world;
      const halfWidthTiles = view.width / (2 * view.zoom) + VIEW_MARGIN_TILES;
      const halfHeightTiles = view.height / (2 * view.zoom) + VIEW_MARGIN_TILES;
      const firstColumn = Math.max(0, Math.floor(grid.column(view.centre.x - halfWidthTiles) / PLACEMENT_BLOCK_TILES));
      const lastColumn = Math.min(
        Math.floor((grid.columns - 1) / PLACEMENT_BLOCK_TILES),
        Math.floor(grid.column(view.centre.x + halfWidthTiles) / PLACEMENT_BLOCK_TILES),
      );
      const firstRow = Math.max(0, Math.floor(grid.row(view.centre.y - halfHeightTiles) / PLACEMENT_BLOCK_TILES));
      const lastRow = Math.min(
        Math.floor((grid.rows - 1) / PLACEMENT_BLOCK_TILES),
        Math.floor(grid.row(view.centre.y + halfHeightTiles) / PLACEMENT_BLOCK_TILES),
      );

      const torchBodies = placement.torchBodies(lighting.points.slice(0, MAX_POINTS));
      const torches = torchBodies ? new Float32Array(0) : placement.torchInstances(lighting.points.slice(0, MAX_POINTS), view.time);
      const folk = view.people ? folkInstances(world, view.people, view, (name) => placement.entry(name), (name) => (grownTrees.ready ? grownTrees.entry(name) : undefined)) : null;
      const extras = new Float32Array(torches.length + (folk?.instances.length ?? 0));
      extras.set(torches);
      if (folk) extras.set(folk.instances, torches.length);
      const collected = scenery ? placement.sceneryInstances(scenery, extras, torchBodies, folk) : timer.time('collect instances (cpu)', () => placement.collectInstances(
        world,
        firstColumn,
        lastColumn,
        firstRow,
        lastRow,
        {
          torches: torchBodies,
          withGroundMarks: view.zoom >= GROUND_MARKS_FROM_ZOOM,
          lowMarksCastShadows: view.zoom >= LOW_MARK_SHADOWS_FROM_ZOOM,
          view: {
            minX: view.centre.x - view.width / (2 * view.zoom),
            maxX: view.centre.x + view.width / (2 * view.zoom),
            minY: view.centre.y - view.height / (2 * view.zoom),
            maxY: view.centre.y + view.height / (2 * view.zoom),
          },
        },
        extras,
        folk,
      ));
      instanceCount = collected.instanceCount;
      const casterCount = collected.casterCount;
      timer.note('instances', instanceCount);
      timer.time('prop shadows on ground', () => {
        if (!skipped('shadows')) propPass.prepareAndDrawGroundShadows(world, view, lighting, atlas, collected.data, instanceCount, casterCount, pointLights);
      });
      timer.note('tree bodies', propPass.setGrown(collected.shadowOnly, collected.bodies, (art) => grownTrees.atlases.get(art)));
    }

    timer.time('water', () => {
      if (!skipped('water')) waterPass.draw(world, view, lighting);
      else if (view.ground) waterPass.uploadPaintedGround(view.ground);
    });
    runStage('water', frame);
    timer.time('terrain light', () => {
      if (!skipped('terrain')) terrainLightPass.draw(world, view, lighting);
    });
    timer.time('ground grade (night, snow, litter, fog)', () => {
      if (!skipped('grade')) groundGradePass.draw(world, view, lighting, pointLights, propPass.occluders);
    });

    faunaTexture.update(view.fauna);

    runStage('underlay', frame);

    if (propsAreStanding && instanceCount > 0) {
      timer.time('props and shadows on marks', () => {
        if (!skipped('props')) propPass.drawPropsAndShadowsOntoMarks();
      });
    }

    runStage('sorted', frame);
    return frame;
  };

  return {
    get showsFolk() {
      return showsFolk;
    },

    draw(world, view, lighting, sky, viewMode) {
      if (MAP_VIEW_MODES_THAT_REPLACE_THE_SCENE(viewMode)) {
        weather.update(world, sky, view.time, lighting);
        clearEverything(view);
        mapViewPass.draw(world, view, lighting, viewMode, sky);
        fogPass.draw(view);
        return;
      }
      const frame = drawScene(world, view, lighting, sky);
      if (viewMode === STRATA_VIEW_MODE) mapViewPass.draw(world, view, lighting, viewMode, sky);
      runStage('overlay', frame);
      if (viewMode === WIND_VIEW_MODE) mapViewPass.draw(world, view, lighting, viewMode, sky);
      timer.time('fog', () => {
        if (!skipped('fog')) fogPass.draw(view);
      });
      timer.frame();
    },

    setScenery(props) {
      scenery = props;
    },

    setHumans(people) {
      zooHumans = people;
    },

    setMammalAgents(agents) {
      feed('mammals', agents);
    },

    setZoos(states, focused) {
      zoos = states;
      focus = focused;
    },

    probeZoo(world, view, lighting) {
      if (!focus || focus.group === 'human') return null;
      const def = passDefs().find((one) => one.group === focus!.group);
      if (!def?.probe) return null;
      const pass = instances.get(def.id) as { zoo: ZooState | null };
      pass.zoo = focus;
      return def.probe(pass, world, view, lighting);
    },

    throwRipple(x, y, seconds) {
      waterPass.throwRipple(x, y, seconds);
      for (const def of passDefs()) def.startle?.(instances.get(def.id), x, y, seconds);
    },

    dispose() {
      grownTrees.dispose();
      placement.dispose();
    },
  };
}
