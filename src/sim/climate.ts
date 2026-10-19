import { cellY, SEA_LEVEL, WORLD_EXTENT } from './heightmap.ts';
import type { FieldGrid } from './heightmap.ts';
import { Water } from './hydrology.ts';
import { hashString, rng } from './rng.ts';
import { Biome } from './types.ts';

/**
 * How high the highest ground stands, in metres. Nothing measures in metres here except the
 * lapse rate, and air cools at a rate per kilometre whatever the map is drawn at.
 */
const PEAK_METRES = 2200;

/** Land height as 0 at the shore and 1 at the highest peak — what altitude means below. */
export const altitudeOf = (height: number): number =>
  Math.max(0, (height - SEA_LEVEL) / (1 - SEA_LEVEL));

/** Rock above the treeline. Not a climate: a slope that steep is stone whatever the weather. */
const HIGHLAND = 0.62;

export interface Latitudes {
  north: number;
  south: number;
}

/**
 * Which band of the globe this world sits in.
 *
 * A map is a window on a planet, not the whole of one, and *which* window is most of what makes
 * two seeds feel like different places: a world drawn at 55°-20° has taiga at the top and
 * scrubland at the bottom, one drawn at 30°-5° is desert giving way to jungle. Rolled from the
 * seed, so it is part of the map rather than a setting.
 */
export function latitudesOf(seed: number): Latitudes {
  const random = rng(hashString(`latitude:${seed}`));
  const north = 16 + random() * 64;
  // A span narrow enough that the whole map is one climate reads as a mistake; wide enough that
  // the bands cross it is what gives a world more than one kind of ground.
  const span = 22 + random() * 26;
  return { north, south: north - span };
}

const latitudeAt = (latitudes: Latitudes, y: number): number =>
  latitudes.north - (y / WORLD_EXTENT.height) * (latitudes.north - latitudes.south);

const TROPIC = 16;
const TROPICAL_GRADIENT = 0.15;
const EQUATOR_TEMPERATURE = 27;

/**
 * Minus twelve, not the minus thirty a pole actually reaches.
 *
 * The fall from the tropics to the pole is drawn as one straight line here, and a line steep
 * enough to end at a real pole passes through 1°C at the latitude of Paris — so a temperate map
 * came out as taiga from edge to edge. The game never draws a pole; it draws the band in the
 * middle, and this is the slope that gets that band right.
 */
const POLE_TEMPERATURE = -12;

/** Sea-level temperature at a latitude: flat through the tropics, then falling to the pole. */
function seaLevelTemperature(latitude: number): number {
  const absolute = Math.abs(latitude);
  if (absolute <= TROPIC) return EQUATOR_TEMPERATURE - absolute * TROPICAL_GRADIENT;

  const atTropic = EQUATOR_TEMPERATURE - TROPIC * TROPICAL_GRADIENT;
  const gradient = (atTropic - POLE_TEMPERATURE) / (90 - TROPIC);
  return atTropic - (absolute - TROPIC) * gradient;
}

/** Degrees Celsius for every cell: where it lies on the globe, less what it costs to climb. */
export function temperatures(
  grid: FieldGrid,
  height: Float32Array,
  latitudes: Latitudes,
): Float32Array {
  const temperature = new Float32Array(grid.columns * grid.rows);

  for (let row = 0; row < grid.rows; row += 1) {
    const atSea = seaLevelTemperature(latitudeAt(latitudes, cellY(grid, row)));
    const at = row * grid.columns;
    for (let column = 0; column < grid.columns; column += 1) {
      const metres = altitudeOf(height[at + column]!) * PEAK_METRES;
      temperature[at + column] = atSea - (metres / 1000) * 6.5;
    }
  }

  return temperature;
}

/**
 * Rain per five degrees of latitude: wet where air rises, dry where it sinks.
 *
 * The doldrums at the equator are wet all year, the horse latitudes around 25° are the world's
 * deserts, the storm track at 50-60° is wet all year again, and the poles are a cold desert.
 * This one table is why a map has deserts in a band rather than wherever the noise felt like it.
 */
const LATITUDE_RAIN = [4, 2, 2, 2, 1, 1, 2, 2, 2, 2, 3, 3, 2, 2, 1, 1, 1, 0.5];

/** Air cannot climb past this much of the way up the world; a range this high wrings it dry. */
const PASSABLE = 0.81;

/** How steeply rain increases with the climb. 0.625 of full altitude is a mountain range. */
const OROGRAPHIC = 0.625;

const MAX_HUMIDITY = 120;

/**
 * How far inland the wind carries its water, as a multiple of what the model would do on its own.
 *
 * The rain model drops a tenth of what the air holds on every cell it crosses, which is a rate
 * per *cell* and therefore a rate per however finely the world happens to be cut. This field is
 * cut half a parcel at a time, five times finer than the graph the model was written for, so
 * left alone the wind arrives bone dry a fifth of the way in and the whole interior of every
 * continent is desert. Scaled by the cut, so changing `FIELD` does not change the climate.
 */
const SPREAD = 3;

/**
 * Rain, by walking the wind across the map.
 *
 * Wind comes in off the sea carrying water, drops it as it is forced up over the land, and
 * arrives dry on the far side — so a coast is wet, a range is wetter on the side the wind hits,
 * and the country behind it is a rain shadow. It is the crudest possible weather model and it
 * is the one that puts deserts where a reader expects to find them, which is the whole job.
 */
export function precipitation(
  grid: FieldGrid,
  height: Float32Array,
  temperature: Float32Array,
  latitudes: Latitudes,
  seed: number,
): Float32Array {
  const rain = new Float32Array(grid.columns * grid.rows);
  const random = rng(hashString(`wind:${seed}`));

  // Westerlies in the temperate bands, easterlies in the tropics — the trade winds. Which way
  // the map's own wind runs therefore falls out of where the map sits on the globe.
  const middle = (latitudes.north + latitudes.south) / 2;
  const step = Math.abs(middle) > 30 ? 1 : -1;

  const bandRain = (y: number): number => {
    const band = Math.min(LATITUDE_RAIN.length - 1, Math.floor(Math.abs(latitudeAt(latitudes, y)) / 5));
    return LATITUDE_RAIN[band] ?? 1;
  };

  const fall = (humidity: number, here: number, next: number): number => {
    const normal = Math.max(humidity / (10 * SPREAD), 1);
    const climb = Math.max(altitudeOf(height[next]!) - altitudeOf(height[here]!), 0) * 80;
    const slope = (altitudeOf(height[next]!) / OROGRAPHIC) ** 2;
    return Math.min(humidity, Math.max(1, normal + climb * slope));
  };

  const blow = (first: number, onward: number, steps: number, ceiling: number): void => {
    let humidity = ceiling * (1 - altitudeOf(height[first]!));
    if (humidity <= 0) return;

    let here = first;
    for (let s = 0; s < steps - 1; s += 1, here += onward) {
      const next = here + onward;
      if (temperature[here]! < -5) continue;

      if (height[here]! < SEA_LEVEL) {
        // Over water the wind picks moisture up, and drops a share of it the moment it makes
        // landfall — which is why a coast is green even with a desert a day's walk inland.
        if (height[next]! >= SEA_LEVEL) rain[next] = rain[next]! + Math.max(humidity / 15, 1);
        else humidity = Math.min(humidity + 5 * SPREAD, ceiling);
        continue;
      }

      const blocked = altitudeOf(height[next]!) > PASSABLE;
      const fell = blocked ? humidity : fall(humidity, here, next);
      rain[here] = rain[here]! + fell;
      humidity = blocked ? 0 : Math.max(0, humidity - fell + (fell > 1.5 ? 1 : 0));
    }
  };

  for (let row = 0; row < grid.rows; row += 1) {
    const ceiling = MAX_HUMIDITY * bandRain(cellY(grid, row));
    const first = step > 0 ? row * grid.columns : row * grid.columns + grid.columns - 1;
    blow(first, step, grid.columns, ceiling);
  }

  // One pass across the other axis as well, at a third of the strength. Wind that only ever
  // blows one way leaves every coast on one side of the map wet and every coast on the other
  // dry, which reads as a lighting bug rather than as weather.
  const down = random() < 0.5 ? 1 : -1;
  for (let column = 0; column < grid.columns; column += 1) {
    const ceiling = MAX_HUMIDITY * bandRain(cellY(grid, down > 0 ? 0 : grid.rows - 1)) * 0.34;
    const first = down > 0 ? column : (grid.rows - 1) * grid.columns + column;
    blow(first, down * grid.columns, grid.rows, ceiling);
  }

  // Back into rain per patch of ground, rather than per cell of a grid that happens to be cut
  // this fine. Spreading the wind's water over five times as many cells leaves a fifth as much
  // in each of them, and the biome table reads these numbers as absolute: unscaled, every acre
  // of the world comes out in the one band between grassland and scrub.
  for (let cell = 0; cell < rain.length; cell += 1) rain[cell] = rain[cell]! * SPREAD;

  return rain;
}

/**
 * What the ground has to grow on: the rain that falls on it, the water running through it, and
 * a share of what its neighbours get, so a biome's edge is a gradient rather than a cell wall.
 */
export function moisture(
  grid: FieldGrid,
  rain: Float32Array,
  water: Uint8Array,
  river: Int32Array,
  flux: Float32Array,
): Float32Array {
  const count = grid.columns * grid.rows;
  const wet = new Float32Array(count);

  for (let cell = 0; cell < count; cell += 1) {
    if (water[cell] !== Water.None) continue;

    let sum = rain[cell]! + (river[cell] !== 0 ? Math.max(flux[cell]! / 400, 2) : 0);
    let counted = 1;

    const column = cell % grid.columns;
    const row = (cell - column) / grid.columns;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const c = column + dx;
        const r = row + dy;
        if (c < 0 || c >= grid.columns || r < 0 || r >= grid.rows) continue;
        const near = r * grid.columns + c;
        // Standing water beside a cell wets it: the shore of a lake is not the climate of the
        // plain behind it, and this is the only thing that says so.
        sum += water[near] === Water.None ? rain[near]! : 30;
        counted += 1;
      }
    }

    wet[cell] = 4 + sum / counted;
  }

  return wet;
}

/**
 * The biome table, dry at the top and wet at the bottom, hot on the left and cold on the right.
 *
 * Azgaar's matrix, with his thirteen biomes folded into this game's seven by `AS`. The folding
 * is where the realism stops: a temperate rainforest and a tropical one are both Forest here,
 * because a biome in this game is a pencil ramp and six are all the ground has. What survives
 * the fold is the thing worth having — *where* the bands fall, and that they fall in bands.
 */
const MATRIX: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 10],
  [3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 9, 9, 9, 9, 10, 10, 10],
  [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 9, 9, 9, 9, 9, 10, 10, 10],
  [5, 6, 6, 6, 6, 6, 6, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 10, 10, 10],
  [7, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 9, 10, 10],
];

/** Hot desert, cold desert, savanna, grassland, the four forests, taiga, tundra — folded. */
const AS: readonly Biome[] = [
  Biome.Ocean,
  Biome.Desert,
  Biome.Desert,
  Biome.Meadow,
  Biome.Meadow,
  Biome.Forest,
  Biome.Forest,
  Biome.Forest,
  Biome.Forest,
  Biome.Forest,
  Biome.Tundra,
];

/** Waterlogged ground: too flat and too wet to drain, whether by the sea or along a river. */
function waterlogged(wet: number, temperature: number, altitude: number): boolean {
  if (temperature <= -2) return false;
  if (wet > 40 && altitude < 0.06) return true;
  return wet > 24 && altitude > 0.05 && altitude < 0.5;
}

export function classify(
  height: number,
  temperature: number,
  wet: number,
  onRiver: boolean,
): Biome {
  const altitude = altitudeOf(height);

  // Rock first, and cold second. Ground this high is bare stone whatever the weather, and a
  // peak called tundra is a peak drawn as grass.
  if (altitude > HIGHLAND) return Biome.Highland;
  if (temperature < -5) return Biome.Tundra;
  if (temperature >= 25 && !onRiver && wet < 8) return Biome.Desert;
  if (waterlogged(wet, temperature, altitude)) return Biome.Marsh;

  const wetBand = Math.min(Math.floor(wet / 5), 4);
  const coldBand = Math.min(Math.max(20 - Math.round(temperature), 0), 25);
  return AS[MATRIX[wetBand]![coldBand]!] ?? Biome.Meadow;
}
