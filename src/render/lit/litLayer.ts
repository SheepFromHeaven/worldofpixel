import type { Vec2 } from '../../sim/geometry.ts';
import type { FaunaMirror } from '../../sim/fauna/pack.ts';
import type { Shoals } from '../../sim/fish/shoals.ts';
import type { People } from '../../sim/people/people.ts';
import type { SkyView } from '../../sim/weather/skyView.ts';
import type { World } from '../../sim/world.ts';
import { MIPS } from '../groundSprites.ts';
import { levelFor, TEXEL } from '../terrainPixels.ts';
import { CloudPass } from './cloudPass.ts';
import { FaunaTexture } from './faunaTexture.ts';
import { FishPass } from './fishPass.ts';
import { AmphibianPass } from './amphibianPass.ts';
import { BirdPass } from './birdPass.ts';
import { ReptilePass } from './reptilePass.ts';
import { InsectPass } from './insectPass.ts';
import { MammalPass } from './mammalPass.ts';
import { FogPass } from './fogPass.ts';
import { folkInstances } from './folkInstances.ts';
import { FallingLeavesPass } from './fallingLeavesPass.ts';
import { createQuadGeometry } from './glHelpers.ts';
import { GroundGradePass } from './groundGradePass.ts';
import type { Lighting } from './lighting.ts';
import { MAX_POINTS } from './lighting.ts';
import {
  SORTED_WITH_PROPS,
  UNDERLAY,
  GROUND_MARKS_FROM_ZOOM,
  LOW_MARK_SHADOWS_FROM_ZOOM,
  PLACEMENT_BLOCK_TILES,
  STRATA_VIEW_MODE,
  VIEW_MARGIN_TILES,
} from './litLayerConstants.ts';
import { MapViewPass } from './mapViewPass.ts';
import { PassTimer } from './passTimer.ts';
import { packPointLights } from './pointLightData.ts';
import { PrecipitationPass } from './precipitationPass.ts';
import { PropPass } from './propPass.ts';
import { GrownTrees } from './grownTrees.ts';
import { PropPlacementCache } from './propPlacementCache.ts';
import type { SceneryTree } from './scenery.ts';
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
}

export interface SeeThrough {
  x: number;
  y: number;
  lift: number;
  radius: number;
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
  setZoo(zoo: ZooState | null): void;
  setMammalAgents(agents: MammalAgents | null): void;
  setScenery(trees: readonly SceneryTree[] | null): void;
  probeZoo(world: World, view: LitView, lighting: Lighting): Vec2 | null;
  dispose(): void;
}

const MAP_VIEW_MODES_THAT_REPLACE_THE_SCENE = (viewMode: number): boolean =>
  viewMode === 1 || viewMode === 2 || (viewMode >= 4 && viewMode !== STRATA_VIEW_MODE);
const WIND_VIEW_MODE = 3;

export function createLitLayer(canvas: HTMLCanvasElement): LitLayer | null {
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
  let waterPass: WaterPass;
  let fishPass: FishPass;
  let faunaTexture: FaunaTexture;
  let insectPass: InsectPass;
  let amphibianPass: AmphibianPass;
  let reptilePass: ReptilePass;
  let birdPass: BirdPass;
  let mammalPass: MammalPass;
  let fallingLeavesPass: FallingLeavesPass;
  let precipitationPass: PrecipitationPass;
  let cloudPass: CloudPass;
  let mapViewPass: MapViewPass;
  let fogPass: FogPass;
  try {
    propPass = new PropPass(gl, quad.cornersBuffer, weather);
    groundGradePass = new GroundGradePass(gl, quad.fullScreenVertexArray, weather);
    waterPass = new WaterPass(gl, quad.fullScreenVertexArray, weather);
    fishPass = new FishPass(gl, quad.cornersBuffer, weather);
    faunaTexture = new FaunaTexture(gl);
    insectPass = new InsectPass(gl, quad.fullScreenVertexArray, weather, faunaTexture);
    amphibianPass = new AmphibianPass(gl, quad.fullScreenVertexArray, weather, faunaTexture);
    reptilePass = new ReptilePass(gl, quad.fullScreenVertexArray, weather, faunaTexture);
    birdPass = new BirdPass(gl, quad.fullScreenVertexArray, weather, faunaTexture);
    mammalPass = new MammalPass(gl, quad.fullScreenVertexArray, weather, faunaTexture);
    fallingLeavesPass = new FallingLeavesPass(gl, quad.fullScreenVertexArray, weather);
    precipitationPass = new PrecipitationPass(gl, quad.fullScreenVertexArray, weather);
    cloudPass = new CloudPass(gl, quad.fullScreenVertexArray, weather);
    mapViewPass = new MapViewPass(gl, quad.fullScreenVertexArray, weather);
    fogPass = new FogPass(gl, quad.fullScreenVertexArray);
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
  let scenery: readonly SceneryTree[] | null = null;
  let zooGroup: ZooState['group'] | null = null;
  const hidden = (name: string, group: ZooState['group']): boolean => skipped(name) || (zooGroup !== null && zooGroup !== group);

  const drawScene = (world: World, view: LitView, lighting: Lighting, sky: SkyView): void => {
    timer.time('weather textures', () => weather.update(world, sky, view.time, lighting));
    clearEverything(view);
    gl.disable(gl.DEPTH_TEST);

    const pointLights = packPointLights(lighting);
    propPass.occluders = null;
    const spriteMipLevel = Math.round(Math.log2(levelFor(view.zoom).texel / TEXEL));
    const atlas = placement.atlas;
    const propsAreStanding = atlas !== null && spriteMipLevel < MIPS && !skipped('props');
    showsFolk = propsAreStanding && view.people !== null;

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

      const torches = placement.torchInstances(lighting.points.slice(0, MAX_POINTS), view.time);
      const folk = view.people ? folkInstances(world, view.people, view, (name) => placement.entry(name)) : new Float32Array(0);
      const extras = new Float32Array(torches.length + folk.length);
      extras.set(torches);
      extras.set(folk, torches.length);
      const collected = scenery ? placement.sceneryInstances(scenery, extras) : timer.time('collect instances (cpu)', () => placement.collectInstances(
        world,
        firstColumn,
        lastColumn,
        firstRow,
        lastRow,
        {
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
    });
    timer.time('fish', () => {
      if (!skipped('fish')) fishPass.draw(world, view, lighting);
    });
    timer.time('ground grade (night, snow, litter, fog)', () => {
      if (!skipped('grade')) groundGradePass.draw(world, view, lighting, pointLights, propPass.occluders);
    });

    faunaTexture.update(view.fauna);

    timer.time('insects (under)', () => {
      if (hidden('insects', 'insect')) return;
      insectPass.prepare(world, view);
      insectPass.draw(world, view, lighting, UNDERLAY);
    });

    timer.time('amphibians (under)', () => {
      if (hidden('amphibians', 'amphibian')) return;
      amphibianPass.prepare(world, view);
      amphibianPass.draw(world, view, lighting, UNDERLAY);
    });

    timer.time('reptiles (under)', () => {
      if (hidden('reptiles', 'reptile')) return;
      reptilePass.prepare(world, view);
      reptilePass.draw(world, view, lighting, UNDERLAY);
    });

    timer.time('birds (under)', () => {
      if (hidden('birds', 'bird')) return;
      birdPass.prepare(world, view);
      birdPass.draw(world, view, lighting, UNDERLAY);
    });

    timer.time('mammals (under)', () => {
      if (hidden('mammals', 'mammal')) return;
      mammalPass.prepare(world, view);
      mammalPass.draw(world, view, lighting, UNDERLAY);
    });

    if (propsAreStanding && instanceCount > 0) {
      timer.time('props and shadows on marks', () => {
        if (!skipped('props')) propPass.drawPropsAndShadowsOntoMarks();
      });
    }

    timer.time('animals (sorted with props)', () => {
      if (!hidden('insects', 'insect')) insectPass.draw(world, view, lighting, SORTED_WITH_PROPS);
      if (!hidden('amphibians', 'amphibian')) amphibianPass.draw(world, view, lighting, SORTED_WITH_PROPS);
      if (!hidden('reptiles', 'reptile')) reptilePass.draw(world, view, lighting, SORTED_WITH_PROPS);
      if (!hidden('mammals', 'mammal')) mammalPass.draw(world, view, lighting, SORTED_WITH_PROPS);
      if (view.xray && !hidden('mammals', 'mammal')) mammalPass.drawThrough(world, view, lighting);
      if (!hidden('birds', 'bird')) birdPass.draw(world, view, lighting, SORTED_WITH_PROPS);
    });
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
      drawScene(world, view, lighting, sky);
      if (viewMode === STRATA_VIEW_MODE) mapViewPass.draw(world, view, lighting, viewMode, sky);
      timer.time('falling leaves', () => {
        if (!skipped('leaves')) fallingLeavesPass.draw(world, view, lighting);
      });
      timer.time('precipitation', () => {
        if (!skipped('precipitation')) precipitationPass.draw(world, view, lighting);
      });
      timer.time('clouds', () => {
        if (!skipped('clouds')) cloudPass.draw(world, view, lighting);
      });
      if (viewMode === WIND_VIEW_MODE) mapViewPass.draw(world, view, lighting, viewMode, sky);
      timer.time('fog', () => {
        if (!skipped('fog')) fogPass.draw(view);
      });
      timer.frame();
    },

    setScenery(trees) {
      scenery = trees;
    },

    setMammalAgents(agents) {
      mammalPass.setAgents(agents);
    },

    setZoo(zoo) {
      zooGroup = zoo?.group ?? null;
      insectPass.zoo = zoo?.group === 'insect' ? zoo : null;
      amphibianPass.zoo = zoo?.group === 'amphibian' ? zoo : null;
      reptilePass.zoo = zoo?.group === 'reptile' ? zoo : null;
      birdPass.zoo = zoo?.group === 'bird' ? zoo : null;
      mammalPass.zoo = zoo?.group === 'mammal' ? zoo : null;
    },

    probeZoo(world, view, lighting) {
      if (!zooGroup) return null;
      const pass = { insect: insectPass, amphibian: amphibianPass, reptile: reptilePass, bird: birdPass, mammal: mammalPass }[zooGroup];
      return pass.probe(world, view, lighting);
    },

    throwRipple(x, y, seconds) {
      waterPass.throwRipple(x, y, seconds);
      insectPass.startle(x, y, seconds);
      amphibianPass.startle(x, y, seconds);
      reptilePass.startle(x, y, seconds);
      birdPass.startle(x, y, seconds);
      mammalPass.startle(x, y, seconds);
    },

    dispose() {
      grownTrees.dispose();
      placement.dispose();
    },
  };
}
