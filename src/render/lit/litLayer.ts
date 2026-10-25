import type { Vec2 } from '../../sim/geometry.ts';
import type { People } from '../../sim/people/people.ts';
import { SEASONAL_LIMIT } from '../../sim/seasons/seasonalRegistry.ts';
import type { Sky } from '../../sim/weather/sky.ts';
import type { World } from '../../sim/world.ts';
import { MIPS } from '../groundSprites.ts';
import { levelFor, TEXEL } from '../terrainPixels.ts';
import { CloudPass } from './cloudPass.ts';
import { FogPass } from './fogPass.ts';
import { folkInstances } from './folkInstances.ts';
import { FallingLeavesPass } from './fallingLeavesPass.ts';
import { createQuadGeometry } from './glHelpers.ts';
import { GroundGradePass } from './groundGradePass.ts';
import type { Lighting } from './lighting.ts';
import { MAX_POINTS } from './lighting.ts';
import {
  CANOPY_HIDE_FROM_ZOOM,
  GROUND_MARKS_FROM_ZOOM,
  PLACEMENT_BLOCK_TILES,
  VIEW_MARGIN_TILES,
} from './litLayerConstants.ts';
import { MapViewPass } from './mapViewPass.ts';
import { packPointLights } from './pointLightData.ts';
import { PrecipitationPass } from './precipitationPass.ts';
import { PropPass } from './propPass.ts';
import { PropPlacementCache } from './propPlacementCache.ts';
import { WaterPass } from './waterPass.ts';
import { WeatherDataTextures } from './weatherDataTextures.ts';

export interface LitView {
  centre: Vec2;
  zoom: number;
  width: number;
  height: number;
  time: number;
  ground: HTMLCanvasElement | null;
  people: People | null;
  fog: FogView | null;
}

export interface FogView {
  x: number;
  y: number;
  inner: number;
  edge: number;
}

export interface LitLayer {
  readonly showsFolk: boolean;
  draw(world: World, view: LitView, lighting: Lighting, sky: Sky, viewMode: number): void;
  throwRipple(x: number, y: number, seconds: number): void;
  dispose(): void;
}

const MAP_VIEW_MODES_THAT_REPLACE_THE_SCENE = (viewMode: number): boolean =>
  viewMode === 1 || viewMode === 2 || viewMode >= 4;
const WIND_VIEW_MODE = 3;
const BARE_BRANCHES_APPEAR_BELOW_CANOPY_HIDING_BY = 2;

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
  const weather = new WeatherDataTextures(gl);
  const placement = new PropPlacementCache(gl);

  let propPass: PropPass;
  let groundGradePass: GroundGradePass;
  let waterPass: WaterPass;
  let fallingLeavesPass: FallingLeavesPass;
  let precipitationPass: PrecipitationPass;
  let cloudPass: CloudPass;
  let mapViewPass: MapViewPass;
  let fogPass: FogPass;
  try {
    propPass = new PropPass(gl, quad.cornersBuffer, weather);
    groundGradePass = new GroundGradePass(gl, quad.fullScreenVertexArray, weather);
    waterPass = new WaterPass(gl, quad.fullScreenVertexArray, weather);
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

  const drawScene = (world: World, view: LitView, lighting: Lighting, sky: Sky): void => {
    weather.update(world, sky, view.time, lighting);
    clearEverything(view);
    gl.disable(gl.DEPTH_TEST);

    const pointLights = packPointLights(lighting);
    const spriteMipLevel = Math.round(Math.log2(levelFor(view.zoom).texel / TEXEL));
    const atlas = placement.atlas;
    const propsAreStanding = atlas !== null && spriteMipLevel < MIPS;
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
      const collected = placement.collectInstances(
        world,
        firstColumn,
        lastColumn,
        firstRow,
        lastRow,
        {
          withGroundMarks: view.zoom >= GROUND_MARKS_FROM_ZOOM,
          withTrunks: view.zoom >= CANOPY_HIDE_FROM_ZOOM - BARE_BRANCHES_APPEAR_BELOW_CANOPY_HIDING_BY,
          withBareBranches: placement.bareBranchesAreShown(lighting, SEASONAL_LIMIT),
        },
        extras,
      );
      instanceCount = collected.instanceCount;
      propPass.prepareAndDrawGroundShadows(world, view, lighting, atlas, collected.data, instanceCount, pointLights);
    }

    waterPass.draw(world, view, lighting);
    groundGradePass.draw(world, view, lighting, pointLights);

    if (!propsAreStanding || instanceCount === 0) return;
    propPass.drawPropsAndShadowsOntoMarks();
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
      fallingLeavesPass.draw(world, view, lighting);
      precipitationPass.draw(world, view, lighting);
      cloudPass.draw(world, view, lighting);
      if (viewMode === WIND_VIEW_MODE) mapViewPass.draw(world, view, lighting, viewMode, sky);
      fogPass.draw(view);
    },

    throwRipple(x, y, seconds) {
      waterPass.throwRipple(x, y, seconds);
    },

    dispose() {
      placement.dispose();
    },
  };
}
