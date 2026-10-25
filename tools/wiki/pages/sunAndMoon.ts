import { skyAt } from '../../../src/render/lit/lighting.ts';
import {
  AXIAL_TILT_RADIANS,
  bodyBearingAt,
  dateName,
  dayFractionOffsetAtMapPosition,
  declinationFromEclipticLongitude,
  LONGITUDE_SPAN_DEGREES,
  seasonName,
  sunAndMoonBearingsAt,
  sunEclipticLongitudeOf,
} from '../../../src/sim/astro.ts';
import {
  FIRST_SEASON_PHASE,
  MOON_PHASE_CYCLE_DAYS,
  MOON_PHASE_NAMES,
  YEAR_LENGTH_IN_GAME_DAYS,
} from '../../../src/sim/calendar.ts';
import type { CalendarMoment } from '../../../src/sim/calendar.ts';
import type { Page, PageLink } from '../page.ts';
import { callout, figure, flow, grid, SERIES, table } from '../page.ts';
import { hex, mix } from '../raster.ts';
import { heatmap, legend, lineChart, samples } from '../svg.ts';

const DAY_SECONDS = 1440;
const DEGREES = 180 / Math.PI;

const SOLSTICE_SUMMER = 0.375;
const SOLSTICE_WINTER = 0.875;
const EQUINOX = 0.125;

const HOURS = (v: number): string => `${Math.round(v)}`;

const MONTHS = ['mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb'];

const elevation = (latitude: number, hour: number, seasonPhase: number, moonPhase = 0): number =>
  Math.asin(Math.max(-1, Math.min(1, sunAndMoonBearingsAt(latitude, hour / 24, seasonPhase, moonPhase).sun.up))) * DEGREES;

const moonElevation = (latitude: number, hour: number, seasonPhase: number, moonPhase: number): number =>
  Math.asin(Math.max(-1, Math.min(1, sunAndMoonBearingsAt(latitude, hour / 24, seasonPhase, moonPhase).moon.up))) * DEGREES;

function dayLength(latitude: number, seasonPhase: number): number {
  const declination = declinationFromEclipticLongitude(sunEclipticLongitudeOf(seasonPhase));
  let up = 0;
  const N = 96;
  for (let i = 0; i < N; i += 1) if (bodyBearingAt(latitude, declination, ((i + 0.5) / N) * 2 * Math.PI).up > 0) up += 1;
  return (up / N) * 24;
}

const DARK = hex('#1c2540');
const LIGHT = hex('#f0d890');

const shade = (t: number): string => {
  const [r, g, b] = mix(DARK, LIGHT, Math.min(1, Math.max(0, t)));
  return `rgb(${r},${g},${b})`;
};

function moment(seasonPhase: number, timeOfDay: number, moonPhase = 0): CalendarMoment {
  return { timeOfDay, seasonPhase, moonPhase, completedDays: 0 };
}

function sunCharts(): string {
  const declination = lineChart({
    x: { label: 'year, from 1 march', domain: [0, 1], ticks: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1], format: (v) => ['mar', '', 'jun', '', 'sep', '', 'dec', '', 'mar'][Math.round(v * 8)] ?? '' },
    y: { label: 'sun declination (degrees)', domain: [-25, 25], ticks: [-23.44, 0, 23.44] },
    horizontals: [{ at: 0 }],
    series: [{ name: 'declination', colour: SERIES.gold, points: samples(0, 1, 240, (p) => declinationFromEclipticLongitude(sunEclipticLongitudeOf(p)) * DEGREES) }],
    legend: false,
    label: 'The sun declination over the year',
  });
  const day = (season: number, name: string): string =>
    lineChart({
      x: { label: 'local solar time (hours)', domain: [0, 24], ticks: [0, 6, 12, 18, 24], format: HOURS },
      y: { label: 'sun elevation (degrees)', domain: [-90, 90], ticks: [-90, -45, 0, 45, 90] },
      horizontals: [{ at: 0, label: 'horizon' }],
      series: [0, 30, 60, 75].map((lat, i) => ({
        name: `${lat} N`,
        colour: [SERIES.red, SERIES.gold, SERIES.green, SERIES.blue][i]!,
        points: samples(0, 24, 96, (h) => elevation(lat, h, season)),
      })),
      label: `The sun's elevation through a day at ${name}`,
    });
  return `${grid(
    figure(declination, `<b>The sun's latitude.</b> The season gives the sun's ecliptic longitude, and its declination follows from the axial tilt of ${(AXIAL_TILT_RADIANS * DEGREES).toFixed(2)} degrees. Zero at the equinoxes (phase 0.125 and 0.625), at its peak at the northern midsummer (0.375).`),
    figure(day(SOLSTICE_SUMMER, 'the northern midsummer'), '<b>Midsummer.</b> High and short-shadowed in the tropics, low and long towards the pole, and at 75 degrees north the sun never sets.'),
  )}
${figure(day(SOLSTICE_WINTER, 'the northern midwinter'), '<b>Midwinter.</b> The same four places half a year later. At 75 degrees north the sun never rises. The sun is also a body with a bearing: <code>bodyBearingAt</code> turns latitude, declination and hour angle into east, south and up, where north is the top of the screen and east the right.')}`;
}

function dayLengthFigure(): string {
  const map = heatmap({
    width: 560,
    height: 340,
    x: { label: 'year, from 1 march', domain: [0, 1], ticks: Array.from({ length: 13 }, (_, i) => i / 12), format: (v) => MONTHS[Math.round(v * 12)] ?? '' },
    y: { label: 'latitude (degrees)', domain: [-70, 70], ticks: [-60, -30, 0, 30, 60] },
    columns: 120,
    rows: 70,
    colourAt: (season, latitude) => shade(dayLength(latitude, Math.min(0.9999, season)) / 24),
    label: 'Hours of daylight by latitude and day of the year',
  });
  return `${figure(map, '<b>Hours of daylight.</b> Dark is night all day, gold is sun all day. The equator is a steady 12 hours. The poles go from midnight sun to polar night over the year, and the pattern is mirrored in the south.')}${legend([
    { name: '0 h', colour: shade(0) },
    { name: '6 h', colour: shade(0.25) },
    { name: '12 h', colour: shade(0.5) },
    { name: '18 h', colour: shade(0.75) },
    { name: '24 h', colour: shade(1) },
  ])}`;
}

function terminatorFigure(): string {
  const panel = (season: number, label: string): string =>
    heatmap({
      width: 480,
      height: 300,
      x: { label: 'longitude across the map (degrees from the middle)', domain: [-LONGITUDE_SPAN_DEGREES / 2, LONGITUDE_SPAN_DEGREES / 2], ticks: [-120, -60, 0, 60, 120] },
      y: { label: 'latitude (degrees)', domain: [-70, 70], ticks: [-60, -30, 0, 30, 60] },
      columns: 120,
      rows: 70,
      colourAt: (longitude, latitude) =>
        shade(skyAt(moment(season, 0.5), { latitude, offset: dayFractionOffsetAtMapPosition(longitude / LONGITUDE_SPAN_DEGREES + 0.5) }).daylight),
      label,
    });
  return grid(
    figure(panel(EQUINOX, 'Daylight over the map at the equinox when it is noon in the middle'), '<b>Equinox.</b> It is noon along the middle column, so the edges are dawn and dusk. The terminator is the straight line of the tilt.'),
    figure(panel(SOLSTICE_SUMMER, 'Daylight over the map at the northern midsummer when it is noon in the middle'), '<b>Northern midsummer.</b> The terminator bends: the polar north is lit throughout and the south is dark.'),
  );
}

function lightCharts(): string {
  const series = (season: number, name: string) =>
    (['daylight', 'gloom'] as const).map((key, i) => ({
      name: `${key}, ${name}`,
      colour: [SERIES.gold, SERIES.blue][i]!,
      dashed: season === SOLSTICE_WINTER,
      points: samples(0, 24, 144, (h) => skyAt(moment(season, h / 24), { latitude: 45, offset: 0 })[key]),
    }));
  const fog = lineChart({
    x: { label: 'local solar time (hours)', domain: [0, 24], ticks: [0, 6, 12, 18, 24], format: HOURS },
    y: { label: 'amount (0 to 1)', domain: [0, 1] },
    series: [
      ...series(SOLSTICE_SUMMER, 'summer'),
      ...series(SOLSTICE_WINTER, 'winter'),
      { name: 'fog', colour: SERIES.grey, points: samples(0, 24, 144, (h) => skyAt(moment(SOLSTICE_SUMMER, h / 24), { latitude: 45, offset: 0 }).fog) },
    ],
    label: 'Daylight, gloom and fog through a day at 45 north',
  });
  const moonLight = lineChart({
    x: { label: 'local solar time (hours)', domain: [0, 24], ticks: [0, 6, 12, 18, 24], format: HOURS },
    y: { label: 'moon elevation (degrees)', domain: [-90, 90], ticks: [-90, -45, 0, 45, 90] },
    horizontals: [{ at: 0, label: 'horizon' }],
    series: [0.25, 0.5, 0.75].map((phase, i) => ({
      name: `${MOON_PHASE_NAMES[Math.round(phase * 8)]}`,
      colour: [SERIES.blue, SERIES.gold, SERIES.violet][i]!,
      points: samples(0, 24, 96, (h) => moonElevation(30, h, EQUINOX, phase)),
    })),
    label: 'The moon at three phases through a day at 30 north',
  });
  return `${grid(
    figure(fog, '<b>The day at 45 north.</b> Daylight is a smoothstep of the sun\'s height from just below the horizon (-0.03) to 0.2. Gloom is what is left, dimmed by moonlight, and is what the night tint over the ground follows. Fog is thick until dawn, burns off by mid-morning and gathers again at dusk.'),
    figure(moonLight, '<b>The moon lags the sun.</b> It sits 2 pi times its phase of ecliptic ahead of the sun and lags it in hour angle by the same, so it rises later every night, and the full moon (phase 0.5) is up all night.'),
  )}`;
}

function moonTable(): string {
  return table(
    ['Phase', 'Name', 'Illumination', 'Moonlight at its best'],
    MOON_PHASE_NAMES.map((name, i) => {
      const illumination = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / MOON_PHASE_NAMES.length);
      return [`${i}/8`, name, `${(illumination * 100).toFixed(0)}%`, illumination > 0.99 ? 'strong' : illumination < 0.01 ? 'none' : 'weak'];
    }),
  );
}

function seasonTable(): string {
  return table(
    ['Day of the year', 'Phase', 'North', 'South'],
    [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875].map((p) => [dateName(p), p.toFixed(3), seasonName(p), seasonName((p + 0.5) % 1)]),
  );
}

export const LINK: PageLink = {
  slug: 'sun-and-moon',
  title: 'Sun, moon and seasons',
  summary: 'Real celestial geometry on a strip of planet: day length, the terminator, moon phases and hemispheres.',
};

export function build(): Page {
  return {
    ...LINK,
    lede: 'Day and night are a place, not a moment. The map is a strip of the planet, its rows are latitudes and its columns a 240 degree span of longitude, so the sun is high and short-shadowed in the tropics, low and long at the poles, and the middle of the map is at noon while its edges are at dawn and dusk.',
    code: ['src/sim/astro.ts', 'src/sim/calendar.ts', 'src/render/lit/lighting.ts', 'src/render/lit/skyGrid.ts'],
    sections: [
      {
        id: 'clock',
        title: 'The clock and the calendar',
        html: `<p>Time is <code>clock</code> (0 to 1, a day, 0.5 is noon at the middle) plus <code>elapsed</code>, every day ever run. A day lasts ${DAY_SECONDS} seconds at normal speed, 24 minutes, and the speed multiplies it. A year is ${YEAR_LENGTH_IN_GAME_DAYS} days and the moon turns through ${MOON_PHASE_CYCLE_DAYS} phases in ${MOON_PHASE_CYCLE_DAYS} days. A game begins at ${FIRST_SEASON_PHASE} of the year, ${dateName(FIRST_SEASON_PHASE)}, which is ${seasonName(FIRST_SEASON_PHASE)} in the north.</p>
${flow([
  { title: 'Season phase', text: 'The year as 0 to 1, from 1 march. The north\'s; the south is half a year on.' },
  { title: 'Ecliptic longitude', text: 'Where the sun is on its path. Spring equinox at 0.125.' },
  { title: 'Declination', text: 'From the axial tilt: the sun\'s latitude.' },
  { title: 'Hour angle', text: 'From local solar time: noon is straight overhead.' },
  { title: 'Bearing', text: 'East, south and up. North is the top of the screen.' },
])}
<p>Everything drawn by sun and moon follows from the two elevations: <code>daylight</code>, <code>moonLight</code>, <code>gloom</code>, the ambient, the fog and the cloud colours. The shadows follow the bearings. The 2D ground cannot be re-lit, so its baked relief is lit from the top-left whatever the sun does, and a grade pass lays the night over it.</p>`,
      },
      {
        id: 'sun',
        title: 'The sun',
        html: sunCharts(),
      },
      {
        id: 'length',
        title: 'Day length',
        html: `<p>Nothing is stored for day length. It falls out of the same geometry, counting the hours with the sun above the horizon.</p>${dayLengthFigure()}`,
      },
      {
        id: 'strip',
        title: 'A strip of the planet',
        html: `<p>Local solar time is the map centre's clock plus an offset of up to a third of a day (<code>dayFractionOffsetAtMapPosition</code>: 240 degrees over 360). The renderer cannot take one sky, so it evaluates <code>skyAt</code> on a 64 by 48 grid of places, packs the results into a texture, and every pass reads its own place from it. These two pictures are that same function, drawn.</p>
${terminatorFigure()}
<p>The strip's time readout is the local time under the camera. The day dial and the time-zone view (17 one-hour bands) both read the same offset. Weather takes its day swing from each cell's own local time, so a front crossing the map brings its own afternoon with it.</p>`,
      },
      {
        id: 'light',
        title: 'Light through a day',
        html: lightCharts(),
      },
      {
        id: 'moon',
        title: 'The moon',
        html: `<p>The moon is a real body. Its illumination is <code>0.5 - 0.5 cos(2 pi phase)</code> and its light is a smoothstep of its height times that, so it casts its own fainter shadows only when it is up, lit and the sun is not.</p>${moonTable()}`,
      },
      {
        id: 'hemispheres',
        title: 'Seasons are a hemisphere',
        html: `<p>The season is the north's. The south is half a year on (<code>southernSeasonPhaseOf</code>). The shaders find a place's latitude from its world y and blend between the two tables across plus or minus 8 degrees of the equator, so a prop at the equator picks the northern or southern table by its own hash and the equator is a patchwork of autumn and spring and not a seam. The sun does not care: its declination is the one global season.</p>
${seasonTable()}
<p>Seasons are the quarters of the year, and the equinoxes and solstices sit in the middle of each quarter, not at its start. So the sun crosses the equator on 15 April and reaches its peak on 15 July, about three and a half weeks after Earth does, and the date labels follow that.</p>
${callout('<p>The year slider in the sky panel is a day of the year (<code>17 jun</code>), with the season in each hemisphere underneath. <code>dateName</code> turns phase into a date and starts the year on the first of March. See <a href="ecosystem.html">the ecosystem page</a> for what a season does to each species.</p>')}`,
      },
    ],
  };
}
