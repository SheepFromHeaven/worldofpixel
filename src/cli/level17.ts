import { World } from '../sim/world.ts';
import { Sky } from '../sim/weather/sky.ts';
import { CLOUD_WATER_CAP } from '../sim/weather/clouds.ts';
import { MAX_PRESSURE_CENTRES } from '../sim/weather/pressureCentres.ts';
import type { LevelResult, Logger } from './harness.ts';
import { check, TEST_SEED } from './harness.ts';
import { header } from './render.ts';

const SUMMER_SOLSTICE = 0.375;
const WINTER_SOLSTICE = 0.875;
const NOON = 0.5;

const extremes = (values: Float32Array): { lowest: number; highest: number } => {
  let lowest = Infinity;
  let highest = -Infinity;
  for (const value of values) {
    if (value < lowest) lowest = value;
    if (value > highest) highest = value;
  }
  return { lowest, highest };
};

const everyValueIsFinite = (values: Float32Array): boolean => values.every((value) => Number.isFinite(value));

export function runLevel17(log: Logger): LevelResult {
  log(header('LEVEL 17 — The weather: Earth\'s range of heat, wind from pressure, clouds that stay in bounds'));

  const world = World.generate(TEST_SEED);
  const sky = new Sky(world, 0);

  const yearRange = { lowest: Infinity, highest: -Infinity };
  for (const season of [SUMMER_SOLSTICE, WINTER_SOLSTICE]) {
    for (const timeOfDay of [0.2, NOON]) {
      sky.setCalendar(timeOfDay, season);
      const { lowest, highest } = extremes(sky.temperature.surfaceTemperature);
      yearRange.lowest = Math.min(yearRange.lowest, lowest);
      yearRange.highest = Math.max(yearRange.highest, highest);
    }
  }
  log(`    surface temperature over the year: ${yearRange.lowest.toFixed(1)} to ${yearRange.highest.toFixed(1)} C`);

  sky.setCalendar(NOON, SUMMER_SOLSTICE);
  const summerPressure = Float32Array.from(sky.winds.pressure);
  sky.setCalendar(NOON, WINTER_SOLSTICE);
  const pressureShift = summerPressure.reduce((total, value, cell) => total + Math.abs(value - sky.winds.pressure[cell]!), 0);

  sky.advanceTo(2);
  const cloudWater = extremes(sky.clouds.cloudWater);

  const again = new Sky(World.generate(TEST_SEED), 0);
  again.setCalendar(NOON, WINTER_SOLSTICE);
  const sameStart = new Sky(World.generate(TEST_SEED), 0);
  sameStart.setCalendar(NOON, WINTER_SOLSTICE);

  sky.forcedWeather = 'rain';
  const rainyOvercast = extremes(sky.clouds.overcast).highest;
  sky.forcedWeather = 'clear';
  const clearOvercast = extremes(sky.clouds.overcast).highest;
  sky.forcedWeather = null;

  const results = [
    check(log, 'it gets colder than -30 C and hotter than 28 C, and no further than Earth goes',
      yearRange.lowest < -30 && yearRange.lowest > -70 && yearRange.highest > 28 && yearRange.highest < 55),
    check(log, 'the year moves the pressure belts', pressureShift > 100),
    check(log, 'every field stays a real number after two days of weather',
      [sky.winds.pressure, sky.winds.windSpeed, sky.clouds.cloudWater, sky.clouds.vapour, sky.temperature.surfaceTemperature, sky.groundSurface.snowCover, sky.lightning.charge].every(everyValueIsFinite)),
    check(log, 'cloud water stays between nothing and its cap', cloudWater.lowest >= 0 && cloudWater.highest <= CLOUD_WATER_CAP),
    check(log, 'there are no more pressure centres than the map can draw', sky.winds.pressureCentres.length <= MAX_PRESSURE_CENTRES),
    check(log, 'two skies from one seed agree', again.winds.pressure.every((value, cell) => value === sameStart.winds.pressure[cell]!)),
    check(log, 'forcing rain overcasts the sky and forcing clear takes it away', rainyOvercast > 0.3 && clearOvercast === 0),
    check(log, 'the textures are bytes for every cell',
      sky.textures.fieldData.length === sky.grid.cellCount * 4 && sky.textures.cloudData.length === sky.grid.cellCount * 4),
  ];

  const passed = results.every(Boolean);
  return { title: 'The weather', passed, detail: passed ? 'heat, wind and cloud behave' : 'the weather is out of bounds' };
}
