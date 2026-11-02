import { MIPS } from '../groundSprites.ts';
import type { FaunaTexture } from './faunaTexture.ts';
import { FogPass } from './fogPass.ts';
import { folkInstances } from './folkInstances.ts';
import { GroundGradePass } from './groundGradePass.ts';
import { GrownTrees } from './grownTrees.ts';
import { MAX_POINTS } from './lighting.ts';
import { GROUND_MARKS_FROM_ZOOM, LOW_MARK_SHADOWS_FROM_ZOOM, PLACEMENT_BLOCK_TILES, STRATA_VIEW_MODE, VIEW_MARGIN_TILES } from './litLayerConstants.ts';
import { MapViewPass } from './mapViewPass.ts';
import type { Frame, PassDef, RenderContext } from './passes.ts';
import { PropPass } from './propPass.ts';
import { PropPlacementCache } from './propPlacementCache.ts';
import type { SceneryProp } from './scenery.ts';
import { TerrainLightPass } from './terrainLightPass.ts';
import { WaterPass } from './waterPass.ts';

const WIND_VIEW_MODE = 3;

export const replacesTheScene = (viewMode: number): boolean => viewMode === 1 || viewMode === 2 || (viewMode >= 4 && viewMode !== STRATA_VIEW_MODE);

export class Scene {
  readonly placement: PropPlacementCache;
  readonly grownTrees: GrownTrees;
  readonly props: PropPass;
  readonly grade: GroundGradePass;
  readonly terrain: TerrainLightPass;
  readonly water: WaterPass;
  readonly mapView: MapViewPass;
  readonly fog: FogPass;
  readonly fauna: FaunaTexture;
  scenery: readonly SceneryProp[] | null = null;
  instanceCount = 0;

  constructor(context: RenderContext) {
    const { gl, quad, weather } = context;
    this.placement = new PropPlacementCache(gl);
    this.grownTrees = new GrownTrees(gl);
    this.placement.grownTrees = this.grownTrees;
    this.props = new PropPass(gl, quad.cornersBuffer, weather);
    this.grade = new GroundGradePass(gl, quad.fullScreenVertexArray, weather);
    this.terrain = new TerrainLightPass(gl, quad.fullScreenVertexArray, weather);
    this.water = new WaterPass(gl, quad.fullScreenVertexArray, weather);
    this.mapView = new MapViewPass(gl, quad.fullScreenVertexArray, weather);
    this.fog = new FogPass(gl, quad.fullScreenVertexArray);
    this.fauna = context.fauna;
  }

  ground(frame: Frame): void {
    const { world, view, lighting, points } = frame;
    this.props.occluders = null;
    this.instanceCount = 0;
    const atlas = this.placement.atlas;
    frame.standing = atlas !== null && frame.mip < MIPS && !frame.skipped('props');
    if (!atlas || !frame.standing) return;

    const { placement, grownTrees } = this;
    const { grid } = world;
    const halfWidthTiles = view.width / (2 * view.zoom) + VIEW_MARGIN_TILES;
    const halfHeightTiles = view.height / (2 * view.zoom) + VIEW_MARGIN_TILES;
    const firstColumn = Math.max(0, Math.floor(grid.column(view.centre.x - halfWidthTiles) / PLACEMENT_BLOCK_TILES));
    const lastColumn = Math.min(Math.floor((grid.columns - 1) / PLACEMENT_BLOCK_TILES), Math.floor(grid.column(view.centre.x + halfWidthTiles) / PLACEMENT_BLOCK_TILES));
    const firstRow = Math.max(0, Math.floor(grid.row(view.centre.y - halfHeightTiles) / PLACEMENT_BLOCK_TILES));
    const lastRow = Math.min(Math.floor((grid.rows - 1) / PLACEMENT_BLOCK_TILES), Math.floor(grid.row(view.centre.y + halfHeightTiles) / PLACEMENT_BLOCK_TILES));

    const torchBodies = placement.torchBodies(lighting.points.slice(0, MAX_POINTS));
    const torches = torchBodies ? new Float32Array(0) : placement.torchInstances(lighting.points.slice(0, MAX_POINTS), view.time);
    const folk = view.people ? folkInstances(world, view.people, view, (name) => placement.entry(name), (name) => (grownTrees.ready ? grownTrees.entry(name) : undefined)) : null;
    const extras = new Float32Array(torches.length + (folk?.instances.length ?? 0));
    extras.set(torches);
    if (folk) extras.set(folk.instances, torches.length);
    const collected = this.scenery
      ? placement.sceneryInstances(this.scenery, extras, torchBodies, folk)
      : frame.time('collect instances (cpu)', () =>
          placement.collectInstances(
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
          ),
        );
    this.instanceCount = collected.instanceCount;
    frame.note('instances', collected.instanceCount);
    frame.time('prop shadows on ground', () => {
      if (!frame.skipped('shadows')) this.props.prepareAndDrawGroundShadows(world, view, lighting, atlas, collected.data, collected.instanceCount, collected.casterCount, points);
    });
    frame.note('tree bodies', this.props.setGrown(collected.shadowOnly, collected.bodies, (art) => grownTrees.atlases.get(art)));
  }
}

export const scene: PassDef<Scene> = {
  id: 'scene',
  skip: 'scene',
  create: (context) => new Scene(context),
  startle: (pass, x, y, seconds) => pass.water.throwRipple(x, y, seconds),
  feed: (pass, value) => {
    pass.scenery = value as readonly SceneryProp[] | null;
  },
  dispose: (pass) => {
    pass.grownTrees.dispose();
    pass.placement.dispose();
  },
  entries: [
    { stage: 'ground', order: 0, label: 'props (collect)', run: (pass, frame) => pass.ground(frame) },
    {
      stage: 'water',
      order: 0,
      label: 'water',
      run: (pass, frame) => {
        if (!frame.skipped('water')) pass.water.draw(frame.world, frame.view, frame.lighting);
        else if (frame.view.ground) pass.water.uploadPaintedGround(frame.view.ground);
      },
    },
    { stage: 'light', order: 0, label: 'terrain light', skip: 'terrain', run: (pass, frame) => pass.terrain.draw(frame.world, frame.view, frame.lighting) },
    { stage: 'light', order: 10, label: 'ground grade (night, snow, litter, fog)', skip: 'grade', run: (pass, frame) => pass.grade.draw(frame.world, frame.view, frame.lighting, frame.points, pass.props.occluders) },
    { stage: 'light', order: 20, label: 'fauna texture', run: (pass, frame) => pass.fauna.update(frame.view.fauna) },
    {
      stage: 'props',
      order: 0,
      label: 'props and shadows on marks',
      skip: 'props',
      when: (frame) => frame.standing,
      run: (pass) => {
        if (pass.instanceCount > 0) pass.props.drawPropsAndShadowsOntoMarks();
      },
    },
    { stage: 'cut', order: 0, label: 'strata', when: (frame) => frame.viewMode === STRATA_VIEW_MODE, run: (pass, frame) => pass.mapView.draw(frame.world, frame.view, frame.lighting, frame.viewMode, frame.sky) },
    { stage: 'map', order: 0, label: 'wind map', when: (frame) => frame.viewMode === WIND_VIEW_MODE, run: (pass, frame) => pass.mapView.draw(frame.world, frame.view, frame.lighting, frame.viewMode, frame.sky) },
    { stage: 'replace', order: 0, label: 'map view', run: (pass, frame) => pass.mapView.draw(frame.world, frame.view, frame.lighting, frame.viewMode, frame.sky) },
    { stage: 'veil', order: 0, label: 'fog', skip: 'fog', run: (pass, frame) => pass.fog.draw(frame.view) },
  ],
};
