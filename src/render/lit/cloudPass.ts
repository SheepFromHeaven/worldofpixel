import type { World } from '../../sim/world.ts';
import type { UniformLocations } from './glHelpers.ts';
import { findUniforms, linkProgram, setViewUniforms, useAlphaBlendingWithoutDepth, zoomFade } from './glHelpers.ts';
import type { Lighting } from './lighting.ts';
import type { LitView } from './litLayer.ts';
import { CLOUD_BODIES_FROM_ZOOM, CLOUD_BODIES_GONE_BY_ZOOM, MAX_VISIBLE_BOLTS } from './litLayerConstants.ts';
import { CLOUDS_AND_LIGHTNING_FRAGMENT_SHADER } from './shaders/shaderSources.ts';
import { FULL_SCREEN_QUAD_VERTEX_SHADER } from './shaders/shaderSources.ts';
import type { WeatherUniformLocations } from './weatherDataTextures.ts';
import type { WeatherDataTextures } from './weatherDataTextures.ts';
import { WEATHER_UNIFORM_NAMES } from './weatherDataTextures.ts';

const CLOUD_UNIFORM_NAMES = ['uView', 'uBuffer', 'uBody', 'uBoltCount', 'uBolt', 'uBoltMeta', ...WEATHER_UNIFORM_NAMES] as const;

export class CloudPass {
  private readonly program: WebGLProgram;
  private readonly locations: UniformLocations<(typeof CLOUD_UNIFORM_NAMES)[number]>;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly fullScreenVertexArray: WebGLVertexArrayObject,
    private readonly weather: WeatherDataTextures,
  ) {
    this.program = linkProgram(gl, FULL_SCREEN_QUAD_VERTEX_SHADER, CLOUDS_AND_LIGHTNING_FRAGMENT_SHADER);
    this.locations = findUniforms(gl, this.program, CLOUD_UNIFORM_NAMES);
  }

  draw(world: World, view: LitView, lighting: Lighting): void {
    const cloudBodyVisibility = 1 - zoomFade(view.zoom, CLOUD_BODIES_FROM_ZOOM, CLOUD_BODIES_GONE_BY_ZOOM);
    if (cloudBodyVisibility <= 0.01) return;

    const { gl, locations } = this;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.fullScreenVertexArray);
    useAlphaBlendingWithoutDepth(gl);
    setViewUniforms(gl, locations, view);
    gl.uniform1f(locations.uBody, cloudBodyVisibility);

    const nearestBolts = [...this.weather.lightningFlash.liveBolts]
      .sort(
        (a, b) =>
          Math.hypot(a.bolt.ex - view.centre.x, a.bolt.ey - view.centre.y) -
          Math.hypot(b.bolt.ex - view.centre.x, b.bolt.ey - view.centre.y),
      )
      .slice(0, MAX_VISIBLE_BOLTS);
    const boltPaths = new Float32Array(MAX_VISIBLE_BOLTS * 4);
    const boltMetadata = new Float32Array(MAX_VISIBLE_BOLTS * 4);
    nearestBolts.forEach(({ bolt, firstSeenAtSeconds }, index) => {
      boltPaths.set([bolt.ox, bolt.oy, bolt.ex, bolt.ey], index * 4);
      boltMetadata.set([bolt.id * 1.618, firstSeenAtSeconds, bolt.ground ? 1 : 0, 0], index * 4);
    });
    gl.uniform1i(locations.uBoltCount, nearestBolts.length);
    gl.uniform4fv(locations.uBolt, boltPaths);
    gl.uniform4fv(locations.uBoltMeta, boltMetadata);

    this.weather.bindTo(locations as WeatherUniformLocations, world, view, lighting);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
