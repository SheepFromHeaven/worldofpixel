import { bandStep, seaLevelTemperature, zonalFlow } from '../../../src/sim/terrain/climate.ts';
import type { Weather } from '../../../src/sim/terrain/weather.ts';
import { WEATHER_STEP } from '../../../src/sim/terrain/weather.ts';
import { Water } from '../../../src/sim/terrain/hydrology.ts';
import { YEAR_LENGTH_IN_GAME_DAYS } from '../../../src/sim/calendar.ts';
import { condensationThresholdOf, saturationVapour } from '../../../src/sim/weather/clouds.ts';
import type { ForcedWeather } from '../../../src/sim/weather/forcedWeather.ts';
import { GroundSurface } from '../../../src/sim/weather/groundSurface.ts';
import { Precipitation } from '../../../src/sim/weather/precipitation.ts';
import { Sky } from '../../../src/sim/weather/sky.ts';
import {
  dailyTemperatureSwing,
  seasonalTemperatureSwing,
  SEASONAL_SWING_CELSIUS,
  yearlyTemperatureCycle,
} from '../../../src/sim/weather/temperature.ts';
import { WeatherGrid } from '../../../src/sim/weather/weatherGrid.ts';
import type { Winds } from '../../../src/sim/weather/winds.ts';
import { coriolisStrengthAt, PRESSURE_BELT_SHIFT_DEGREES, zonalPressureAt } from '../../../src/sim/weather/winds.ts';
import { World } from '../../../src/sim/world.ts';
import { SEED } from '../context.ts';
import { heat, mono } from '../maps.ts';
import type { Page, PageLink } from '../page.ts';
import { callout, figure, flow, grid, img, SERIES } from '../page.ts';
import type { Rgb } from '../raster.ts';
import { line, mix, ramp, renderMap } from '../raster.ts';
import { lineChart, niceTicks, samples } from '../svg.ts';

const NOON = 0.5;

const NORTH_SUMMER = 0.375;
const NORTH_WINTER = 0.875;

interface Run {
  sky: Sky;
  world: World;
  day: number;
}

function start(seasonPhase: number, forced: ForcedWeather | null = null): Run {
  const world = World.generate(SEED);
  const sky = new Sky(world, NOON);
  sky.setCalendar(NOON, seasonPhase);
  if (forced) sky.forcedWeather = forced;
  return { sky, world, day: 0 };
}

function advance(run: Run, seasonPhase: number, days: number, each?: (run: Run) => void, every = 0.1): void {
  const end = run.day + days;
  while (run.day < end - 1e-9) {
    run.day += 0.05;
    const clock = (NOON + run.day) % 1;
    const season = (seasonPhase + run.day / YEAR_LENGTH_IN_GAME_DAYS) % 1;
    run.sky.setCalendar(clock, season);
    run.sky.advanceTo(NOON + run.day);
    const sample = Math.round(run.day / every);
    if (each && Math.abs(run.day - sample * every) < 1e-6) each(run);
  }
}

function cellMap(name: string, run: Run, colour: (cell: number) => Rgb, overlay?: (pixels: Uint8Array, width: number, height: number, scale: number) => void): string {
  const { sky, world } = run;
  const g = sky.grid;
  return renderMap(name, {
    columns: g.columns,
    rows: g.rows,
    step: 1,
    zoom: 4,
    colourAt: (c, r) => {
      const cell = g.cellIndex(c, r);
      const tile = world.grid.at(Math.min(world.grid.columns - 1, c * WEATHER_STEP + 8), Math.min(world.grid.rows - 1, r * WEATHER_STEP + 8));
      const base = colour(cell);
      return world.field.water[tile] === Water.Ocean ? mix(base, [34, 62, 96], 0.28) : base;
    },
    ...(overlay ? { overlay } : {}),
  });
}

function arrows(run: Run): (pixels: Uint8Array, width: number, height: number, scale: number) => void {
  const { sky } = run;
  const g = sky.grid;
  return (pixels, width, height, scale) => {
    for (let r = 1; r < g.rows; r += 3) {
      for (let c = 1; c < g.columns; c += 3) {
        const cell = g.cellIndex(c, r);
        const east = sky.winds.windEastward[cell]!;
        const south = sky.winds.windSouthward[cell]!;
        const speed = Math.hypot(east, south);
        if (speed < 1) continue;
        const length = Math.min(1, speed / 14) * 9 + 2;
        const dx = (east / speed) * length;
        const dy = (south / speed) * length;
        const x = (c + 0.5) * scale;
        const y = (r + 0.5) * scale;
        const colour: Rgb = ramp([[59, 53, 44], [192, 81, 64]], Math.min(1, speed / 16));
        line(pixels, width, height, x - dx / 2, y - dy / 2, x + dx / 2, y + dy / 2, colour);
        const back = Math.atan2(dy, dx) + Math.PI;
        for (const side of [-0.5, 0.5]) {
          line(pixels, width, height, x + dx / 2, y + dy / 2, x + dx / 2 + Math.cos(back + side) * 3, y + dy / 2 + Math.sin(back + side) * 3, colour);
        }
      }
    }
    for (const centre of sky.winds.pressureCentres) {
      const x = (centre.x / WEATHER_STEP) * scale;
      const y = (centre.y / WEATHER_STEP) * scale;
      const high = centre.strength > 0;
      const colour: Rgb = high ? [192, 40, 40] : [30, 80, 170];
      for (let a = 0; a < 48; a += 1) {
        const px = Math.round(x + Math.cos((a / 48) * 2 * Math.PI) * 6);
        const py = Math.round(y + Math.sin((a / 48) * 2 * Math.PI) * 6);
        if (px >= 0 && py >= 0 && px < width && py < height) pixels.set([colour[0], colour[1], colour[2], 255], (py * width + px) * 4);
      }
    }
  };
}

const PRESSURE_LOW: Rgb = [48, 96, 176];
const PRESSURE_MID: Rgb = [244, 241, 234];
const PRESSURE_HIGH: Rgb = [192, 70, 50];

function mapsOfTheSeasons(): { temperature: string; pressure: string; summer: Run } {
  const summer = start(NORTH_SUMMER);
  advance(summer, NORTH_SUMMER, 3);
  const winter = start(NORTH_WINTER);
  advance(winter, NORTH_WINTER, 3);

  const temp = (run: Run, name: string): string => cellMap(name, run, (cell) => heat(run.sky.temperature.airTemperature[cell]!));
  const pressure = (run: Run, name: string): string =>
    cellMap(name, run, (cell) => ramp([PRESSURE_LOW, PRESSURE_MID, PRESSURE_HIGH], (run.sky.winds.pressure[cell]! + 2.5) / 5), arrows(run));

  return {
    temperature: grid(
      figure(img(temp(summer, 'wx-temp-summer.png'), 'Air temperature in northern summer'), '<b>Northern summer, local noon at the middle.</b> Day 3 of a run starting at the summer peak, so the warm belt sits north of the equator.'),
      figure(img(temp(winter, 'wx-temp-winter.png'), 'Air temperature in northern winter'), '<b>Northern winter.</b> The same world half a year later. Land swings further than water, and the poles swing most.'),
    ),
    pressure: grid(
      figure(img(pressure(summer, 'wx-pressure-summer.png'), 'Pressure and wind in northern summer'), '<b>Northern summer.</b> Red is high, blue is low. Arrows are the wind, redder is faster. Rings mark the strongest highs (red) and lows (blue).'),
      figure(img(pressure(winter, 'wx-pressure-winter.png'), 'Pressure and wind in northern winter'), '<b>Northern winter.</b> The belts have slid 9 degrees south and the land has cooled into highs. The pattern of highs and lows is a new day of noise.'),
    ),
    summer,
  };
}

function temperatureCharts(): string {
  const year = lineChart({
    x: { label: 'year, from 1 march', domain: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1], format: (v) => ['mar', 'jun', 'sep', 'dec', 'mar'][Math.round(v * 4)]! },
    y: { label: 'air temperature (C)', domain: [-30, 40] },
    horizontals: [{ at: 0 }],
    series: [
      ...[10, 30, 45, 60].map((lat, i) => ({
        name: `${lat} N inland`,
        colour: [SERIES.red, SERIES.gold, SERIES.green, SERIES.blue][i]!,
        points: samples(0, 1, 120, (p) => seaLevelTemperature(lat) + yearlyTemperatureCycle(p) * seasonalTemperatureSwing(lat, 0)),
      })),
      { name: '45 N on the coast', colour: SERIES.green, dashed: true, points: samples(0, 1, 120, (p) => seaLevelTemperature(45) + yearlyTemperatureCycle(p) * seasonalTemperatureSwing(45, 1)) },
    ],
    label: 'Temperature over the year at four latitudes',
  });
  const swing = lineChart({
    x: { label: 'latitude (degrees)', domain: [0, 90] },
    y: { label: 'half the summer to winter range (C)', domain: [0, 26] },
    series: [0, 0.5, 1].map((share, i) => ({
      name: share === 0 ? 'inland' : share === 1 ? 'open water' : 'half water',
      colour: [SERIES.red, SERIES.gold, SERIES.blue][i]!,
      points: samples(0, 90, 90, (lat) => seasonalTemperatureSwing(lat, share)),
    })),
    verticals: [{ at: 55, label: 'full swing from 55' }],
    label: 'Seasonal swing by latitude and water share',
  });
  const day = lineChart({
    x: { label: 'local solar time (hours)', domain: [0, 24], ticks: [0, 6, 12, 18, 24] },
    y: { label: 'air temperature (C)', domain: [10, 40] },
    series: [
      { name: 'ocean, 30 N', colour: SERIES.blue, share: 1, dryness: 0.1, lat: 30 },
      { name: 'wet land, 30 N', colour: SERIES.green, share: 0, dryness: 0.1, lat: 30 },
      { name: 'dry interior, 30 N', colour: SERIES.gold, share: 0, dryness: 1, lat: 30 },
    ].map((c) => ({
      name: c.name,
      colour: c.colour,
      points: samples(0, 24, 96, (h) => seaLevelTemperature(c.lat) + dailyTemperatureSwing(c.share, c.dryness) * Math.cos(2 * Math.PI * (h / 24 - 0.58))),
    })),
    verticals: [{ at: 0.58 * 24, label: 'warmest 13:55' }],
    label: 'Temperature over a day for sea, wet land and desert',
  });
  return `${grid(
    figure(year, `<b>The year.</b> Every cell's temperature is its place's mean plus a cosine peaking at <code>seasonPhase 0.375</code> times its seasonal swing. The swing is up to ${SEASONAL_SWING_CELSIUS} degrees, scaled by latitude and by how continental the cell is. A year is ${YEAR_LENGTH_IN_GAME_DAYS} game days.`),
    figure(swing, '<b>The swing.</b> Grows with latitude to 55 degrees and stays full beyond. Water cuts it to a quarter, which is why coasts are mild.'),
  )}
${figure(day, '<b>The day.</b> A cosine peaking at 0.58 of the day, local to each cell (the map spans 240 degrees of longitude, so its edges are dawn and dusk). Dry inland air swings 10 degrees, sea air 1.5.')}`;
}

function windCharts(): string {
  const pressure = lineChart({
    x: { label: 'latitude (degrees, + north)', domain: [-90, 90], ticks: [-90, -60, -30, 0, 30, 60, 90] },
    y: { label: 'zonal pressure', domain: [-0.6, 0.6] },
    horizontals: [{ at: 0 }],
    series: [
      { name: 'northern summer', colour: SERIES.red, points: samples(-90, 90, 360, (lat) => zonalPressureAt(lat - PRESSURE_BELT_SHIFT_DEGREES)) },
      { name: 'northern winter', colour: SERIES.blue, points: samples(-90, 90, 360, (lat) => zonalPressureAt(lat + PRESSURE_BELT_SHIFT_DEGREES)) },
      { name: 'equinox', colour: SERIES.grey, dashed: true, points: samples(-90, 90, 360, (lat) => zonalPressureAt(lat)) },
    ],
    label: 'The zonal pressure base by latitude',
  });
  const flowChart = lineChart({
    x: { label: 'latitude (degrees, + north)', domain: [-90, 90], ticks: [-90, -60, -30, 0, 30, 60, 90] },
    y: { label: 'zonal flow (+ eastward)', domain: [-1, 1] },
    horizontals: [{ at: 0 }],
    bands: [{ from: 30, to: 60, label: 'westerly' }, { from: -60, to: -30, label: 'westerly' }],
    series: [
      { name: 'zonalFlow', colour: SERIES.ink, points: samples(-90, 90, 360, zonalFlow) },
      { name: 'prevailing wind direction (rain)', colour: SERIES.red, dashed: true, points: samples(-90, 90, 360, (lat) => 0.9 * bandStep(lat)) },
    ],
    label: 'Zonal flow by latitude, with the prevailing wind',
  });
  const coriolis = lineChart({
    x: { label: 'latitude (degrees)', domain: [0, 90] },
    y: { label: 'share of wind that follows isobars', domain: [0, 1] },
    series: [{ name: 'geostrophic share', colour: SERIES.blue, points: samples(0, 90, 180, (lat) => Math.abs(coriolisStrengthAt(lat))) }],
    legend: false,
    label: 'Coriolis share by latitude',
  });
  return `${grid(
    figure(pressure, `<b>High at 30 and the poles, low at the equator and 60.</b> The belts slide ${PRESSURE_BELT_SHIFT_DEGREES} degrees toward the summer hemisphere. That is the horse latitude and storm track pattern in one cosine.`),
    figure(flowChart, '<b>Easterly, calm, westerly, calm.</b> The zonal flow drifts the highs and lows. The dashed line is the direction the rain-bearing wind blows in <code>precipitation</code>: easterly under 30 and beyond 60, westerly between.'),
  )}
${figure(coriolis, '<b>Turned wind.</b> Wind is the pressure gradient turned 90 degrees by the Coriolis force, clockwise round a high in the north and anticlockwise in the south. Near the equator it blows straight down the gradient instead, and the share grows to full by about 14.5 degrees.')}`;
}

function cloudCharts(): string {
  const saturation = lineChart({
    x: { label: 'air temperature (C)', domain: [-20, 45], ticks: [-20, -10, 0, 10, 20, 30, 40] },
    y: { label: 'vapour the air can hold', domain: [0, 1.8] },
    verticals: [{ at: -12, label: 'clamped below -12' }, { at: 40, label: 'above 40' }],
    series: [{ name: 'saturationVapour', colour: SERIES.blue, points: samples(-20, 45, 130, saturationVapour) }],
    legend: false,
    label: 'Saturation vapour by temperature',
  });
  const threshold = lineChart({
    x: { label: 'lift (0 to 1)', domain: [0, 1] },
    y: { label: 'vapour needed before cloud forms', domain: [0, 0.6] },
    series: [0, 0.6, 1].map((water, i) => ({
      name: `cloud water ${water}`,
      colour: [SERIES.grey, SERIES.gold, SERIES.red][i]!,
      points: samples(0, 1, 100, (lift) => condensationThresholdOf(saturationVapour(20), lift, water)),
    })),
    label: 'Condensation threshold by lift at 20 degrees',
  });
  return grid(
    figure(saturation, '<b>Warm air holds far more.</b> Clausius-Clapeyron shaped: it grows about 5.5% a degree, so a warm sea makes far more cloud than a cold one.'),
    figure(threshold, '<b>Lift lowers the bar.</b> At 20 degrees, with no lift the air must be fully saturated. Full lift needs under half of it, and a deep cloud feeds itself on top (the latent heat term), which is how a thunderhead grows out of a cumulus.'),
  );
}

function precipitationCharts(): string {
  const evaluate = (count: number, fill: (i: number) => { overcast: number; towering: number; temperature: number }) => {
    const g = new WeatherGrid(count, 1);
    const precipitation = new Precipitation(g, { humid: new Float32Array(count).fill(0.5) } as unknown as Weather);
    const overcast = g.createCellArray();
    const towering = g.createCellArray();
    const temperature = g.createCellArray();
    for (let i = 0; i < count; i += 1) {
      const sample = fill(i);
      overcast[i] = sample.overcast;
      towering[i] = sample.towering;
      temperature[i] = sample.temperature;
    }
    precipitation.compute(null, overcast, towering, temperature, { windSpeed: g.createCellArray(), gustNoise: g.createCellArray() } as unknown as Winds);
    return precipitation;
  };
  const N = 200;
  const byTemperature = evaluate(N + 1, (i) => ({ overcast: 1, towering: 0, temperature: -8 + (i / N) * 20 }));
  const byOvercast = evaluate(N + 1, (i) => ({ overcast: i / N, towering: 0, temperature: 12 }));
  const byTowering = evaluate(N + 1, (i) => ({ overcast: 1, towering: i / N, temperature: 18 }));
  const at = (array: Float32Array, from: number, to: number): [number, number][] => Array.from(array, (v, i) => [from + ((to - from) * i) / N, v] as [number, number]);

  return grid(
    figure(lineChart({
      x: { label: 'surface temperature (C)', domain: [-8, 12], ticks: [-8, -4, 0, 4, 8, 12] },
      y: { label: 'fall at full overcast', domain: [0, 1.05] },
      series: [
        { name: 'rain', colour: SERIES.blue, points: at(byTemperature.rain, -8, 12) },
        { name: 'snow', colour: SERIES.grey, points: at(byTemperature.snowfall, -8, 12) },
      ],
      label: 'Rain and snow by temperature',
    }), '<b>Rain turns to snow at 1.5.</b> The frozen share runs from 1.5 degrees down to 0, linearly, so there is sleet in between. Nothing else decides it.'),
    figure(lineChart({
      x: { label: 'overcast (0 to 1)', domain: [0, 1] },
      y: { label: 'rain', domain: [0, 1.05] },
      series: [{ name: 'rain', colour: SERIES.blue, points: at(byOvercast.rain, 0, 1) }],
      legend: false,
      label: 'Rain by overcast',
    }), '<b>It rains when it is thick enough.</b> Nothing below 0.25 overcast, full by 0.75. Overcast itself is read off the cloud water, from 0.3 to 1.1.'),
    figure(lineChart({
      x: { label: 'towering cloud (0 to 1)', domain: [0, 1] },
      y: { label: 'thunder', domain: [0, 1.05] },
      series: [{ name: 'thunder', colour: SERIES.gold, points: at(byTowering.thunder, 0, 1) }],
      legend: false,
      label: 'Thunder by towering cloud',
    }), '<b>Only a cumulonimbus makes thunder.</b> From 0.4 towering cloud, and only above 8 degrees. Towering is a deep cloud in warm air.'),
  );
}

function groundCharts(): string {
  const scenario = (steps: number, dt: number, input: (t: number) => { rain: number; snow: number; temperature: number }): { wet: [number, number][]; snow: [number, number][] } => {
    const surface = new GroundSurface(new WeatherGrid(1, 1));
    const wet: [number, number][] = [];
    const snow: [number, number][] = [];
    for (let k = 0; k <= steps; k += 1) {
      const t = k * dt;
      wet.push([t, surface.wetness[0]!]);
      snow.push([t, surface.snowCover[0]!]);
      const { rain, snow: fall, temperature } = input(t);
      surface.integrate(dt, 1, Float32Array.of(rain), Float32Array.of(fall), Float32Array.of(temperature));
    }
    return { wet, snow };
  };
  const warm = scenario(240, 1 / 24, (t) => ({ rain: t > 0.5 && t < 1.5 ? 0.8 : 0, snow: 0, temperature: 15 }));
  const hot = scenario(240, 1 / 24, (t) => ({ rain: t > 0.5 && t < 1.5 ? 0.8 : 0, snow: 0, temperature: 30 }));
  const thaw = scenario(480, 1 / 24, (t) => ({ rain: 0, snow: t > 0.5 && t < 4 ? 0.7 : 0, temperature: t < 10 ? -4 : 5 }));
  const hours = (series: [number, number][]): string => {
    const dry = series.find(([t, v]) => t > 1.5 && v < 0.01);
    return dry ? String(Math.round((dry[0] - 1.5) * 24)) : 'more than 200';
  };
  return grid(
    figure(lineChart({
      x: { label: 'days', domain: [0, 10] },
      y: { label: 'wet ground (0 to 1)', domain: [0, 1.05] },
      series: [
        { name: 'rain for a day, 15 C', colour: SERIES.blue, points: warm.wet },
        { name: 'the same at 30 C', colour: SERIES.red, points: hot.wet },
      ],
      label: 'Wet ground after a day of rain at two temperatures',
    }), `<b>Rain wets, warmth dries.</b> Wetness gains 6 times the rain a day and loses 0.9 a day plus 0.05 per degree above 10. After the rain stops it takes ${hours(warm.wet)} hours to dry at 15 degrees and ${hours(hot.wet)} at 30.`),
    figure(lineChart({
      x: { label: 'days', domain: [0, 20], ticks: [0, 5, 10, 15, 20] },
      y: { label: 'amount (0 to 1)', domain: [0, 1.05] },
      series: [
        { name: 'snow cover', colour: SERIES.grey, points: thaw.snow },
        { name: 'wet ground', colour: SERIES.blue, points: thaw.wet },
      ],
      verticals: [{ at: 10, label: 'thaw to +5 C' }],
      label: 'Snow cover and wetness through a freeze and a thaw',
    }), '<b>Snow builds, then melts into wet.</b> At -4 degrees snowfall builds cover and it just sits. When it warms to +5 the melt capacity is 0.35 per degree above half a degree, so the cover goes in about a day, and every unit of snow melted becomes 1.5 of wetness, which then dries off. A slow thaw at +2 leaves no wet ground at all, because the ground dries as fast as the snow melts.'),
  );
}

interface Sample {
  day: number;
  rain: number;
  snow: number;
  thunder: number;
  overcast: number;
  felled: number;
}

function sampleRun(phase: number, days: number): Sample[] {
  const run = start(phase);
  const rows: Sample[] = [];
  advance(run, phase, days, (r) => {
    const { precipitation, clouds, stormDamage, grid: g } = r.sky;
    let rain = 0;
    let snow = 0;
    let thunder = 0;
    let overcast = 0;
    for (let i = 0; i < g.cellCount; i += 1) {
      if (precipitation.rain[i]! > 0.2) rain += 1;
      if (precipitation.snowfall[i]! > 0.2) snow += 1;
      if (precipitation.thunder[i]! > 0.3) thunder += 1;
      overcast += clouds.overcast[i]!;
    }
    rows.push({ day: r.day, rain: rain / g.cellCount, snow: snow / g.cellCount, thunder: thunder / g.cellCount, overcast: overcast / g.cellCount, felled: stormDamage.treesFelled });
  });
  return rows;
}

function seriesRun(): string {
  const summerRows = sampleRun(NORTH_SUMMER, 8);
  const winterRows = sampleRun(NORTH_WINTER, 8);
  const pick = (rows: Sample[], f: (r: Sample) => number): [number, number][] => rows.map((r) => [r.day, f(r)]);
  const rows = summerRows;
  const peak = (list: Sample[], f: (r: Sample) => number): number => Math.max(...list.map(f));
  const ceiling = niceTicks(0, Math.max(peak(summerRows, (r) => r.overcast), peak(winterRows, (r) => r.overcast), peak(summerRows, (r) => r.rain)) * 1.15, 4).at(-1) ?? 0.1;
  const percent = (v: number): string => `${(v * 100).toFixed(0)}%`;

  const stormy = start(NORTH_SUMMER, 'thunder');
  const charge: [number, number][] = [];
  const bolts: [number, number][] = [];
  const grounded: [number, number][] = [];
  advance(stormy, NORTH_SUMMER, 2, (r) => {
    let peak = 0;
    for (const c of r.sky.lightning.charge) peak = Math.max(peak, c);
    charge.push([r.day, peak]);
    bolts.push([r.day, r.sky.lightning.dischargeCount]);
    grounded.push([r.day, r.sky.lightning.groundStrikeCount]);
  });

  return `${grid(
    figure(lineChart({
      x: { label: 'days', domain: [0, 8] },
      y: { label: 'share of the map', domain: [0, ceiling], ticks: niceTicks(0, ceiling, 4), format: (v) => `${Math.round(v * 100)}%` },
      series: [
        { name: 'overcast, summer', colour: SERIES.grey, points: pick(summerRows, (r) => r.overcast) },
        { name: 'overcast, winter', colour: SERIES.grey, dashed: true, points: pick(winterRows, (r) => r.overcast) },
        { name: 'raining, summer', colour: SERIES.blue, points: pick(summerRows, (r) => r.rain) },
        { name: 'raining, winter', colour: SERIES.blue, dashed: true, points: pick(winterRows, (r) => r.rain) },
        { name: 'snowing, winter', colour: SERIES.violet, points: pick(winterRows, (r) => r.snow) },
      ],
      label: 'Share of the map overcast, raining and snowing over eight days, in summer and winter',
    }), `<b>Eight days of natural weather</b> from the northern summer peak and from the northern winter, sampled every tenth of a day on the whole map. Overcast peaks at ${percent(peak(summerRows, (r) => r.overcast))} of the map in summer and ${percent(peak(winterRows, (r) => r.overcast))} in winter, rain at ${percent(peak(summerRows, (r) => r.rain))} and ${percent(peak(winterRows, (r) => r.rain))}, and snow at ${percent(peak(winterRows, (r) => r.snow))} of the map in winter. Natural weather is a few moving systems and not a blanket, which is why the sky panel can force one.`),
    figure(lineChart({
      x: { label: 'days of forced thunder', domain: [0, 2] },
      y: { label: 'charge in the fullest cell', domain: [0, 1.2] },
      horizontals: [{ at: 1, label: 'discharges at 1' }],
      series: [{ name: 'peak charge', colour: SERIES.gold, points: charge }],
      legend: false,
      label: 'Charge in the fullest cell during forced thunder',
    }), '<b>A discharge, not a dice roll.</b> A thunder cell gathers charge from its heaviness, warmth, core and pressure contrast. At 1 it fires, drops to a residue of under 0.18 and its neighbours give up half a unit each, so flashes space themselves out.'),
  )}
${figure(lineChart({
    x: { label: 'days of forced thunder', domain: [0, 2] },
    y: { label: 'count since the start', domain: [0, Math.max(10, Math.ceil((bolts.at(-1)?.[1] ?? 10) * 1.05))] },
    series: [
      { name: 'discharges', colour: SERIES.gold, points: bolts },
      { name: 'reached the ground', colour: SERIES.red, points: grounded },
    ],
    label: 'Cumulative lightning discharges and ground strikes during forced thunder',
  }), `<b>Two in five reach the ground.</b> In this run ${bolts.at(-1)?.[1] ?? 0} bolts fired and ${grounded.at(-1)?.[1] ?? 0} struck, each with a 60% chance of felling the tree it hits. Over the eight natural summer days above, wind and storms felled ${rows.at(-1)?.felled.toLocaleString() ?? 0} trees on a map of millions of tiles.`)}`;
}

function fallingMap(name: string, run: Run): string {
  const { precipitation } = run.sky;
  return cellMap(name, run, (c) => {
    let colour: Rgb = [244, 241, 234];
    colour = mix(colour, [60, 120, 190], Math.min(1, precipitation.rain[c]!));
    colour = mix(colour, [150, 130, 190], Math.min(1, precipitation.snowfall[c]!));
    colour = mix(colour, [230, 180, 40], Math.min(1, precipitation.thunder[c]!));
    colour = mix(colour, [205, 160, 90], Math.min(1, precipitation.dust[c]!));
    return colour;
  });
}

function cloudMaps(run: Run): string {
  const { clouds } = run.sky;
  const vapour = cellMap('wx-vapour.png', run, (c) => mono(Math.min(1, clouds.vapour[c]! / 1.4), [244, 241, 234], [60, 120, 170]));
  const lift = cellMap('wx-lift.png', run, (c) => mono(Math.sqrt(clouds.lift[c]!), [244, 241, 234], [150, 60, 130]));
  const water = cellMap('wx-cloud-water.png', run, (c) => mono(Math.min(1, clouds.cloudWater[c]! / 1.6), [244, 241, 234], [70, 76, 96]));
  const kinds = cellMap('wx-cloud-kinds.png', run, (c) => {
    const towering = Math.sqrt(clouds.towering[c]!);
    const layered = Math.sqrt(clouds.layered[c]!);
    const high = Math.max(0, clouds.high[c]! * (1 - Math.min(1, clouds.cloudWater[c]!)) - 0.25) / 0.75;
    let colour: Rgb = [244, 241, 234];
    colour = mix(colour, [226, 190, 90], Math.min(1, high * 0.7));
    colour = mix(colour, [70, 100, 150], Math.min(1, layered));
    colour = mix(colour, [150, 40, 40], Math.min(1, towering));
    return colour;
  });
  const natural = fallingMap('wx-falling.png', run);
  const storm = start(NORTH_SUMMER, 'storm');
  advance(storm, NORTH_SUMMER, 1);
  const forced = fallingMap('wx-falling-storm.png', storm);
  return `${grid(
    figure(img(vapour, 'Water vapour'), '<b>Vapour</b> made over standing water most, wet and humid land less, scaled by saturation. It is the fuel.'),
    figure(img(lift, 'Lift'), '<b>Lift</b> from convergence into a low, air forced up a slope and surface heating. It lowers the threshold for cloud.'),
  )}
${grid(
    figure(img(water, 'Cloud water'), '<b>Cloud water</b> is the liquid part, the conserved quantity. Everything about overcast and rain is read off this one field.'),
    figure(img(kinds, 'Kinds of cloud'), '<b>Kinds of cloud.</b> Dark red is towering (cumulonimbus), blue is layered (stratus), yellow is high (cirrus). The shader draws cumulus, stratus, cumulonimbus, cirrus and altocumulus from these.'),
  )}
${grid(
    figure(img(natural, 'What falls in natural summer weather'), '<b>What falls.</b> Blue rain, violet snow, gold thunder, tan dust: natural weather at day 3 of the summer run. Mostly dry, with rain along fronts.'),
    figure(img(forced, 'What falls under a forced storm'), '<b>A forced storm,</b> one day in. The sky panel holds the cloud water high and the temperature up, and everything downstream (rain, thunder, gale, felled trees) follows.'),
  )}`;
}

export const LINK: PageLink = {
  slug: 'weather',
  title: 'Weather',
  summary: 'Temperature, pressure, wind, clouds, rain, snow, storms and lightning, all driven by Sky.',
};

export function build(): Page {
  const seasons = mapsOfTheSeasons();
  const probe = seasons.summer.sky;

  return {
    ...LINK,
    lede: `Weather is a state the simulation keeps and the renderer only draws. It lives on a coarse grid of ${probe.grid.columns} by ${probe.grid.rows} cells, one per ${WEATHER_STEP} tiles, and is driven by one conductor, <code>Sky</code>, which calls each piece in the order the weather depends on itself. Every map here is a snapshot of that grid from a real run.`,
    code: ['src/sim/weather/sky.ts', 'temperature.ts', 'winds.ts', 'clouds.ts', 'precipitation.ts', 'groundSurface.ts', 'stormDamage.ts', 'lightning.ts'],
    sections: [
      {
        id: 'conductor',
        title: 'The conductor',
        html: `<p><code>Sky</code> owns the grid and the pieces, and nothing else. Whenever the clock moves, it recomputes the instantaneous state in this order, each step reading only what came before it:</p>
${flow([
  { title: 'Winds', text: 'Pressure field, then the wind it blows.' },
  { title: 'Temperature', text: 'Air temperature by place, hour and season.' },
  { title: 'Lift', text: 'Convergence, slope and heating.' },
  { title: 'Overcast', text: 'Read off the cloud water.' },
  { title: 'Cloud kinds', text: 'Towering, layered and high.' },
  { title: 'Surface chill', text: 'Overcast cools the ground two degrees.' },
  { title: 'Precipitation', text: 'Rain, snow, thunder and dust.' },
  { title: 'Gale', text: 'From wind speed, thunder and dust.' },
])}
<p>Then, in fixed ticks of 1/240 of a day, with bigger steps after a skip (never dropping time), it moves the things that remember:</p>
${flow([
  { title: 'Form clouds', text: 'Make vapour, condense, rain out, carry on the wind.' },
  { title: 'Ground', text: 'Wetness and snow cover, integrated.' },
  { title: 'Storm damage', text: 'Gale, thunder and snow load fell trees.' },
  { title: 'Lightning', text: 'Charge gathers, discharges, and strikes.' },
])}
<p>The world is spun up for 36 steps before it opens so there is weather from the first frame. The renderer reads the result as a handful of small textures. The <b>sky panel</b> can force the weather (clear, rain, thunder, snow, storm, sand) by holding the cloud water, the temperature or the dust at a level. A forced weather changes the inputs, so everything downstream still behaves.</p>
${callout('<p>The fastest way to go wrong here is to read a number off the wrong step. Temperature is computed before overcast chills it, so "the temperature" is three different arrays: <code>airTemperature</code>, <code>forcedTemperature</code> and <code>surfaceTemperature</code>. Rain and snow read the surface one.</p>')}`,
      },
      {
        id: 'temperature',
        title: 'Temperature',
        html: `<p>The cell's mean comes from the world field: latitude, less 6.5 degrees a kilometre of altitude (<a href="world-generation.html">see world generation</a>). On top of it sit two cosines, one for the day and one for the year, each scaled by how continental the place is.</p>
${temperatureCharts()}
${seasons.temperature}`,
      },
      {
        id: 'wind',
        title: 'Pressure and wind',
        html: `<p>Wind comes from pressure. The pressure of a cell is a <b>zonal base</b> that depends on latitude only, plus moving noise highs and lows, less a thermal term (warm land lowers pressure, cold land raises it). The wind is the gradient, turned. The noise comes in two layers cross-faded every day and restarting on a new seed, because advected for weeks the rows would decorrelate into fine horizontal streaks.</p>
${windCharts()}
${seasons.pressure}
<p>Weather follows pressure: a front is a low, weighted by humidity, so storms sit in lows and the horse latitudes stay dry. Gale is wind speed, from 6 to 18 m/s. The wind map in the game draws the same arrows, with isobars every half unit and the same highs and lows ringed.</p>`,
      },
      {
        id: 'clouds',
        title: 'Clouds',
        html: `<p>Clouds are a conserved quantity the simulation moves, makes and rains out. Each cell keeps <code>vapour</code> and <code>cloud</code> (liquid water). Vapour is made over standing water, wet land and humid land. It condenses when it exceeds a saturation threshold lowered by lift, and re-evaporates if it falls below it. Both are carried on the wind by semi-Lagrangian advection every 1/40 of a day.</p>
${cloudCharts()}
${cloudMaps(seasons.summer)}
<p><b>Rain is the cloud emptying.</b> Precipitation takes a share of the water every tick (2.6 a day for a heavy cloud), so a raining cloud thins, stops and dissipates unless fed. Sinking air in a high removes cloud and vapour. The kinds of cloud are the renderer's reading of this state, not a second simulation.</p>`,
      },
      {
        id: 'precipitation',
        title: 'Rain, snow and thunder',
        html: `<p>Precipitation is read, not simulated: the cloud has already done the work. These three curves were drawn by feeding the real <code>Precipitation</code> class a row of made-up cells.</p>
${precipitationCharts()}
<p>Dust is the fourth kind: strong wind (from 5 to 11 m/s), dry land and a gust noise, which is what makes a sandstorm in dry windy cells.</p>`,
      },
      {
        id: 'ground',
        title: 'Wet ground and snow',
        html: `<p>The ground remembers the weather. Every tick it integrates rain, snow and temperature into two numbers per cell, <code>wetness</code> and <code>snowCover</code>, and the renderer lays puddles, darkening and white on the ground from them. The drying rate is about a day, so wet ground outlasts the rain by hours, and snow cover outlasts a cold snap by as long as it stays below freezing.</p>
${groundCharts()}`,
      },
      {
        id: 'storms',
        title: 'Storms, felled trees and lightning',
        html: `<p><b>The ground is changed for real.</b> Each tick, a cell rolls a hazard from gale squared, thunder and the weight of settled snow, scaled up by wet soil. It fells that many trees: <code>World.fell</code> turns <code>Cover.Tree</code> into <code>Cover.Fallen</code> and stamps the block so it re-bakes. This is what a world looks like after a long autumn.</p>
${seriesRun()}`,
      },
    ],
  };
}
