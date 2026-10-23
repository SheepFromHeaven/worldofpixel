import { dateName, declinationFromEclipticLongitude, sunEclipticLongitudeOf, sunAndMoonBearingsAt, dayFractionOffsetAtMapPosition, seasonPhaseAtLatitude, southernSeasonPhaseOf } from '../sim/astro.ts';
import { Calendar, moonPhaseName } from '../sim/calendar.ts';
import type { LevelResult, Logger } from './harness.ts';
import { check } from './harness.ts';
import { header } from './render.ts';

const SUMMER_SOLSTICE = 0.375;
const WINTER_SOLSTICE = 0.875;
const EQUINOX = 0.125;
const NOON = 0.5;
const MIDNIGHT = 0;

const elevationDegrees = (up: number): number => (Math.asin(up) * 180) / Math.PI;

export function runLevel15(log: Logger): LevelResult {
  log(header('LEVEL 15 — The heavens: the sun and the moon keep to the sky they would keep on Earth'));

  const tolerance = 0.2;
  const overheadAtEquator = sunAndMoonBearingsAt(0, NOON, EQUINOX, 0).sun.up;
  const midlatitudeSummerNoon = elevationDegrees(sunAndMoonBearingsAt(45, NOON, SUMMER_SOLSTICE, 0).sun.up);
  const midlatitudeWinterNoon = elevationDegrees(sunAndMoonBearingsAt(45, NOON, WINTER_SOLSTICE, 0).sun.up);
  log(`    equator at an equinox noon: ${elevationDegrees(overheadAtEquator).toFixed(1)} degrees`);
  log(`    45 degrees north at midsummer noon ${midlatitudeSummerNoon.toFixed(1)}, at midwinter noon ${midlatitudeWinterNoon.toFixed(1)}`);

  const hoursOfDay = Array.from({ length: 48 }, (_, half) => half / 48);
  const midnightSunLowest = Math.min(...hoursOfDay.map((time) => sunAndMoonBearingsAt(70, time, SUMMER_SOLSTICE, 0).sun.up));
  const polarNightHighest = Math.max(...hoursOfDay.map((time) => sunAndMoonBearingsAt(70, time, WINTER_SOLSTICE, 0).sun.up));

  const sunriseBearing = sunAndMoonBearingsAt(0, 0.25, EQUINOX, 0).sun;
  const sunsetBearing = sunAndMoonBearingsAt(0, 0.75, EQUINOX, 0).sun;

  const fullMoonAtMidnight = sunAndMoonBearingsAt(0, MIDNIGHT, EQUINOX, 0.5).moon.up;
  const newMoonBesideSun = sunAndMoonBearingsAt(30, 0.4, 0.3, 0);
  const moonLagsSun =
    Math.abs(newMoonBesideSun.moon.east - newMoonBesideSun.sun.east) < 0.1 &&
    Math.abs(newMoonBesideSun.moon.up - newMoonBesideSun.sun.up) < 0.1;

  const calendar = new Calendar();
  calendar.setMoonPhase(0.5);

  const results = [
    check(log, 'the ecliptic turns once a year and the sun stands at 23.44 degrees at midsummer',
      Math.abs((declinationFromEclipticLongitude(sunEclipticLongitudeOf(SUMMER_SOLSTICE)) * 180) / Math.PI - 23.44) < 0.01),
    check(log, 'the sun is overhead at the equator at an equinox noon', overheadAtEquator > 0.9999),
    check(log, 'noon sun at 45 degrees is 68.4 at midsummer and 21.6 at midwinter',
      Math.abs(midlatitudeSummerNoon - 68.44) < tolerance && Math.abs(midlatitudeWinterNoon - 21.56) < tolerance),
    check(log, 'at 70 degrees the summer sun never sets and the winter sun never rises',
      midnightSunLowest > 0 && polarNightHighest < 0),
    check(log, 'the sun rises in the east (right of the map) and sets in the west',
      sunriseBearing.east > 0.99 && sunsetBearing.east < -0.99),
    check(log, 'a full moon stands highest at midnight and a new moon travels with the sun',
      fullMoonAtMidnight > 0.99 && moonLagsSun),
    check(log, 'the southern hemisphere is half a year behind',
      Math.abs(seasonPhaseAtLatitude(0.1, 10) - 0.1) < 1e-9 && Math.abs(seasonPhaseAtLatitude(0.1, -10) - 0.6) < 1e-9 && southernSeasonPhaseOf(0.7) < 0.3),
    check(log, 'the year starts on the first of March and ends on the twenty-eighth of February',
      dateName(0) === '1 mar' && dateName(0.9999) === '28 feb'),
    check(log, 'the map is 240 degrees of longitude wide, so its middle keeps the map clock',
      Math.abs(dayFractionOffsetAtMapPosition(0.5)) < 1e-12 && Math.abs(dayFractionOffsetAtMapPosition(1) - dayFractionOffsetAtMapPosition(0) - 240 / 360) < 1e-12),
    check(log, 'setting the moon phase sticks, however far the days have run',
      (() => {
        calendar.advanceByDays(3.7);
        calendar.setMoonPhase(0.5);
        return moonPhaseName(calendar.moonPhase) === 'full moon';
      })()),
  ];

  const passed = results.every(Boolean);
  return { title: 'The heavens', passed, detail: passed ? 'sun and moon keep Earth\'s sky' : 'a body is out of place' };
}
