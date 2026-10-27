import { Biome } from '../../sim/types.ts';
import { isWater } from '../../sim/terrain/worldfield.ts';
import { Water } from '../../sim/terrain/hydrology.ts';
import type { SkyView } from '../../sim/weather/skyView.ts';
import type { World } from '../../sim/world.ts';
import { Cover } from '../../sim/world.ts';
import type { UniformLocations } from './glHelpers.ts';
import { setTextureFiltering, zoomFade } from './glHelpers.ts';
import { LightningFlash } from './lightningFlash.ts';
import type { Lighting } from './lighting.ts';
import type { LitView } from './litLayer.ts';
import {
  CANOPY_HIDE_FROM_ZOOM,
  CANOPY_HIDE_TO_ZOOM,
  CLOUD_HEIGHT_TILES,
} from './litLayerConstants.ts';
import { fillSky, latitudeSpan, SKY_ROWS, SKY_WIDTH, skyBuffer, skyPeaks } from './skyGrid.ts';
import {
  TEXTURE_UNIT_CLOUDS,
  TEXTURE_UNIT_GROUND_STATE,
  TEXTURE_UNIT_ECO,
  TEXTURE_UNIT_HEIGHT,
  TEXTURE_UNIT_PRECIPITATION,
  TEXTURE_UNIT_SKY_PLACES,
  TEXTURE_UNIT_WATER_MASK,
  TEXTURE_UNIT_WEATHER_PROPENSITY,
  TEXTURE_UNIT_WIND_PRESSURE_TEMPERATURE,
} from './textureUnits.ts';

export const WEATHER_UNIFORM_NAMES = [
  'uWeather',
  'uWeatherRect',
  'uSky',
  'uDrift',
  'uCloudShift',
  'uPlace',
  'uPlaceRect',
  'uLat',
  'uSkyState',
  'uGroundState',
  'uWaterMask',
  'uMaskRect',
  'uStorm',
  'uField',
  'uCloud',
] as const;

export type WeatherUniformLocations = UniformLocations<(typeof WEATHER_UNIFORM_NAMES)[number]>;

const SOURCES_REFRESH_MINIMUM_MILLISECONDS = 1500;

export class WeatherDataTextures {
  readonly lightningFlash = new LightningFlash();
  readonly shadowStrength = { sun: 0, moon: 0 };

  heightTexture: WebGLTexture | null = null;
  ecoTexture: WebGLTexture | null = null;
  leafAndPetalSourcesTexture: WebGLTexture | null = null;

  private weatherPropensityTexture: WebGLTexture | null = null;
  private waterMaskTexture: WebGLTexture | null = null;
  private precipitationTexture: WebGLTexture | null = null;
  private groundStateTexture: WebGLTexture | null = null;
  private windPressureTemperatureTexture: WebGLTexture | null = null;
  private cloudsTexture: WebGLTexture | null = null;
  private skyPlacesTexture: WebGLTexture | null = null;

  private readonly skyPlacesData = skyBuffer();
  private skyPlacesKey = '';
  private terrainTexturesWorldSeed = -1;
  private sourcesWorldSeed = -1;
  private sourcesWorldRevision = -1;
  private sourcesUploadedAtMilliseconds = -10000;
  private skyUploadedFrom: SkyView | null = null;
  private skyUploadedRevision = -1;

  constructor(private readonly gl: WebGL2RenderingContext) {}

  update(world: World, sky: SkyView, seconds: number, lighting: Lighting): void {
    const { gl } = this;
    this.updateSkyPlaces(world, lighting);
    this.lightningFlash.follow(world, sky, seconds);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    this.updateTerrainTextures(world);
    this.updateLeafAndPetalSources(world);
    this.updateSkyTextures(world, sky);
  }

  bindTo(locations: WeatherUniformLocations, world: World, view: LitView, lighting: Lighting): void {
    const { gl } = this;
    const { grid } = world;
    const weather = world.field.weather;
    const strike = this.lightningFlash.latestStrike;

    this.bindTexture(TEXTURE_UNIT_WEATHER_PROPENSITY, this.weatherPropensityTexture, locations.uWeather);
    this.bindTexture(TEXTURE_UNIT_PRECIPITATION, this.precipitationTexture, locations.uSkyState);
    this.bindTexture(TEXTURE_UNIT_GROUND_STATE, this.groundStateTexture, locations.uGroundState);
    this.bindTexture(TEXTURE_UNIT_WATER_MASK, this.waterMaskTexture, locations.uWaterMask);
    this.bindTexture(TEXTURE_UNIT_WIND_PRESSURE_TEMPERATURE, this.windPressureTemperatureTexture, locations.uField);
    this.bindTexture(TEXTURE_UNIT_HEIGHT, this.heightTexture, null);
    this.bindTexture(TEXTURE_UNIT_ECO, this.ecoTexture, null);
    this.bindTexture(TEXTURE_UNIT_CLOUDS, this.cloudsTexture, locations.uCloud);
    this.bindTexture(TEXTURE_UNIT_SKY_PLACES, this.skyPlacesTexture, locations.uPlace);

    const worldWidth = grid.columns * grid.spacing;
    const worldHeight = grid.rows * grid.spacing;
    gl.uniform4f(locations.uMaskRect, grid.minX, grid.minY, worldWidth, worldHeight);
    gl.uniform4f(locations.uPlaceRect, grid.minX, grid.minY, worldWidth, worldHeight);
    gl.uniform4f(
      locations.uWeatherRect,
      grid.minX,
      grid.minY,
      weather.columns * weather.step * grid.spacing,
      weather.rows * weather.step * grid.spacing,
    );

    const closenessToStrike = Math.min(
      1,
      Math.max(0.25, 1.25 - Math.hypot(view.centre.x - strike.x, view.centre.y - strike.y) / 260),
    );
    const beneathCanopy = zoomFade(view.zoom, CANOPY_HIDE_FROM_ZOOM, CANOPY_HIDE_TO_ZOOM);
    gl.uniform4f(
      locations.uStorm,
      this.lightningFlash.flashStrength(view.time) * closenessToStrike,
      strike.x,
      strike.y,
      beneathCanopy,
    );

    const zoomedIn = Math.min(1, Math.max(0, (view.zoom - 20) / 40));
    gl.uniform4f(locations.uSky, 1 - 0.45 * zoomedIn, lighting.cover, view.time, lighting.daylight);
    gl.uniform3f(locations.uLat, ...latitudeSpan(world.seed));
    gl.uniform2f(locations.uDrift, ...lighting.drift);

    const [sunEast, sunSouth, sunUp] = lighting.toward;
    const cloudShadowLean = CLOUD_HEIGHT_TILES / Math.max(sunUp, 0.3);
    const cloudShadowLength = Math.hypot(sunEast, sunSouth) * cloudShadowLean;
    const cloudShadowScale = cloudShadowLength > 70 ? 70 / cloudShadowLength : 1;
    gl.uniform2f(
      locations.uCloudShift,
      -sunEast * cloudShadowLean * cloudShadowScale,
      -sunSouth * cloudShadowLean * cloudShadowScale,
    );
  }

  private bindTexture(unit: number, texture: WebGLTexture | null, location: WebGLUniformLocation | null): void {
    const { gl } = this;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    if (location) gl.uniform1i(location, unit);
  }

  private updateSkyPlaces(world: World, lighting: Lighting): void {
    const { gl } = this;
    const { moment } = lighting;
    const key = `${world.seed}:${Math.round((moment.completedDays + moment.timeOfDay) * 3000)}:${moment.seasonPhase.toFixed(4)}:${moment.moonPhase.toFixed(4)}`;
    if (this.skyPlacesTexture && key === this.skyPlacesKey) return;
    this.skyPlacesKey = key;

    fillSky(this.skyPlacesData, world.grid, world.seed, moment);
    const strengths = skyPeaks(this.skyPlacesData);
    this.shadowStrength.sun = strengths.sun;
    this.shadowStrength.moon = strengths.moon;

    this.skyPlacesTexture ??= gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.skyPlacesTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, SKY_WIDTH, SKY_ROWS, 0, gl.RGBA, gl.FLOAT, this.skyPlacesData);
    setTextureFiltering(gl, this.skyPlacesTexture!, gl.LINEAR);
  }

  private updateTerrainTextures(world: World): void {
    const { gl } = this;
    if (this.weatherPropensityTexture && this.terrainTexturesWorldSeed === world.seed) return;
    this.terrainTexturesWorldSeed = world.seed;

    const { columns, rows, data } = world.field.weather;
    this.weatherPropensityTexture ??= gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.weatherPropensityTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, columns, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    setTextureFiltering(gl, this.weatherPropensityTexture!, gl.LINEAR);

    const { grid } = world;
    const waterMask = new Uint8Array(grid.count * 4);
    for (let tile = 0; tile < grid.count; tile += 1) {
      const isWet = isWater(world.biome[tile] as never) || world.field.water[tile] !== Water.None;
      waterMask[tile * 4] = isWet ? 255 : 0;
      waterMask[tile * 4 + 2] = world.field.water[tile] === Water.Ocean ? 255 : 0;
    }
    smoothDepth(waterMask, world.depth, grid.columns, grid.rows);
    const heightBytes = new Uint8Array(grid.count);
    for (let tile = 0; tile < heightBytes.length; tile += 1) {
      heightBytes[tile] = Math.round(world.field.height[tile]! * 255);
    }

    this.heightTexture ??= gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.heightTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, grid.columns, grid.rows, 0, gl.RED, gl.UNSIGNED_BYTE, heightBytes);
    setTextureFiltering(gl, this.heightTexture!, gl.LINEAR);

    this.ecoTexture ??= gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.ecoTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, grid.columns, grid.rows, 0, gl.RED, gl.UNSIGNED_BYTE, world.eco);
    setTextureFiltering(gl, this.ecoTexture!, gl.NEAREST);

    this.waterMaskTexture ??= gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.waterMaskTexture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, grid.columns, grid.rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, waterMask);
    setTextureFiltering(gl, this.waterMaskTexture!, gl.LINEAR);
  }

  private updateLeafAndPetalSources(world: World): void {
    const { gl } = this;
    const staleEnough =
      this.sourcesWorldRevision !== world.revision &&
      performance.now() - this.sourcesUploadedAtMilliseconds > SOURCES_REFRESH_MINIMUM_MILLISECONDS;
    if (this.leafAndPetalSourcesTexture && this.sourcesWorldSeed === world.seed && !staleEnough) return;

    const { grid } = world;
    const sources = new Uint8Array(grid.count * 2);
    for (let tile = 0; tile < grid.count; tile += 1) {
      const hasTree = world.cover[tile]! === Cover.Tree;
      const hasBushOrMeadow = world.cover[tile]! === Cover.Bush || world.biome[tile] === Biome.Meadow;
      sources[tile * 2] = hasTree ? 255 : 0;
      sources[tile * 2 + 1] = hasBushOrMeadow ? 255 : 0;
    }
    this.leafAndPetalSourcesTexture ??= gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.leafAndPetalSourcesTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, grid.columns, grid.rows, 0, gl.RG, gl.UNSIGNED_BYTE, sources);
    setTextureFiltering(gl, this.leafAndPetalSourcesTexture!, gl.NEAREST);
    this.sourcesWorldSeed = world.seed;
    this.sourcesWorldRevision = world.revision;
    this.sourcesUploadedAtMilliseconds = performance.now();
  }

  private updateSkyTextures(world: World, sky: SkyView): void {
    const { gl } = this;
    const unchanged =
      this.skyUploadedFrom === sky &&
      this.skyUploadedRevision === sky.textures.revision &&
      this.precipitationTexture !== null;
    if (unchanged) return;

    const { columns, rows } = world.field.weather;
    const upload = (current: WebGLTexture | null, data: Uint8Array): WebGLTexture => {
      const texture = current ?? gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, columns, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      setTextureFiltering(gl, texture, gl.LINEAR);
      return texture;
    };
    this.cloudsTexture = upload(this.cloudsTexture, sky.textures.cloudData);
    this.windPressureTemperatureTexture = upload(this.windPressureTemperatureTexture, sky.textures.fieldData);
    this.precipitationTexture = upload(this.precipitationTexture, sky.textures.precipitationData);
    this.groundStateTexture = upload(this.groundStateTexture, sky.textures.groundData);
    this.skyUploadedFrom = sky;
    this.skyUploadedRevision = sky.textures.revision;
  }
}

const DEPTH_SMOOTH_TILES = 4;

function smoothDepth(mask: Uint8Array, depth: Uint8Array, columns: number, rows: number): void {
  const count = columns * rows;
  const wet = (tile: number): boolean => mask[tile * 4]! !== 0;
  const depthAcross = new Float32Array(count);
  const seaAcross = new Float32Array(count);
  const weightAcross = new Float32Array(count);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const tile = row * columns + column;
      const from = Math.max(0, column - DEPTH_SMOOTH_TILES);
      const to = Math.min(columns - 1, column + DEPTH_SMOOTH_TILES);
      let depthSum = 0;
      let seaSum = 0;
      let weight = 0;
      for (let c = from; c <= to; c += 1) {
        const at = row * columns + c;
        if (!wet(at)) continue;
        depthSum += depth[at]!;
        seaSum += mask[at * 4 + 2]!;
        weight += 1;
      }
      if (weight === 0) continue;
      depthAcross[tile] = depthSum / weight;
      seaAcross[tile] = seaSum / weight;
      weightAcross[tile] = weight;
    }
  }
  for (let row = 0; row < rows; row += 1) {
    const from = Math.max(0, row - DEPTH_SMOOTH_TILES);
    const to = Math.min(rows - 1, row + DEPTH_SMOOTH_TILES);
    for (let column = 0; column < columns; column += 1) {
      const tile = row * columns + column;
      let depthSum = 0;
      let seaSum = 0;
      let weight = 0;
      for (let r = from; r <= to; r += 1) {
        const at = r * columns + column;
        const w = weightAcross[at]!;
        if (w === 0) continue;
        depthSum += depthAcross[at]! * w;
        seaSum += seaAcross[at]! * w;
        weight += w;
      }
      if (weight === 0) continue;
      mask[tile * 4 + 1] = Math.round(depthSum / weight);
      mask[tile * 4 + 2] = Math.round(seaSum / weight);
      mask[tile * 4 + 3] = 255;
    }
  }
}
