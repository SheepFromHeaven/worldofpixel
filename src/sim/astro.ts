export const AXIAL_TILT_RADIANS = (23.44 * Math.PI) / 180;

export const LONGITUDE_SPAN_DEGREES = 240;

export interface Bearing {
  east: number;
  south: number;
  up: number;
}

export interface SunAndMoonBearings {
  sun: Bearing;
  moon: Bearing;
}

const SEASON_PHASE_OF_SPRING_EQUINOX = 0.125;
const DEGREES_TO_RADIANS = Math.PI / 180;

export const sunEclipticLongitudeOf = (seasonPhase: number): number =>
  2 * Math.PI * (seasonPhase - SEASON_PHASE_OF_SPRING_EQUINOX);

export const declinationFromEclipticLongitude = (eclipticLongitude: number): number =>
  Math.asin(Math.sin(AXIAL_TILT_RADIANS) * Math.sin(eclipticLongitude));

export function bodyBearingAt(latitudeDegrees: number, declination: number, hourAngle: number): Bearing {
  const latitude = latitudeDegrees * DEGREES_TO_RADIANS;
  const horizontalReach = Math.cos(declination);
  const east = -horizontalReach * Math.sin(hourAngle);
  const north =
    Math.sin(declination) * Math.cos(latitude) - horizontalReach * Math.sin(latitude) * Math.cos(hourAngle);
  const up =
    Math.sin(latitude) * Math.sin(declination) + Math.cos(latitude) * horizontalReach * Math.cos(hourAngle);
  return { east, south: -north, up };
}

export const dayFractionOffsetAtMapPosition = (acrossTheMapFromWestToEast: number): number =>
  ((acrossTheMapFromWestToEast - 0.5) * LONGITUDE_SPAN_DEGREES) / 360;

export const localSolarTimeOfDay = (mapMiddleTimeOfDay: number, dayFractionOffset: number): number => {
  const localTime = mapMiddleTimeOfDay + dayFractionOffset;
  return localTime - Math.floor(localTime);
};

export function sunAndMoonBearingsAt(
  latitudeDegrees: number,
  localTimeOfDay: number,
  seasonPhase: number,
  moonPhase: number,
): SunAndMoonBearings {
  const hourAngle = 2 * Math.PI * (localTimeOfDay - 0.5);
  const sunLongitude = sunEclipticLongitudeOf(seasonPhase);
  const moonLagBehindSun = 2 * Math.PI * moonPhase;
  return {
    sun: bodyBearingAt(latitudeDegrees, declinationFromEclipticLongitude(sunLongitude), hourAngle),
    moon: bodyBearingAt(
      latitudeDegrees,
      declinationFromEclipticLongitude(sunLongitude + moonLagBehindSun),
      hourAngle - moonLagBehindSun,
    ),
  };
}

export const southernSeasonPhaseOf = (northernSeasonPhase: number): number => (northernSeasonPhase + 0.5) % 1;

export const seasonPhaseAtLatitude = (northernSeasonPhase: number, latitudeDegrees: number): number =>
  latitudeDegrees < 0 ? southernSeasonPhaseOf(northernSeasonPhase) : northernSeasonPhase;

const MONTH_LENGTHS_STARTING_IN_MARCH: readonly (readonly [string, number])[] = [
  ['mar', 31],
  ['apr', 30],
  ['may', 31],
  ['jun', 30],
  ['jul', 31],
  ['aug', 31],
  ['sep', 30],
  ['oct', 31],
  ['nov', 30],
  ['dec', 31],
  ['jan', 31],
  ['feb', 28],
];

export const DAYS_IN_A_CALENDAR_YEAR = 365;

export function dateName(seasonPhase: number): string {
  let dayOfYear = Math.min(DAYS_IN_A_CALENDAR_YEAR - 1, Math.floor(seasonPhase * DAYS_IN_A_CALENDAR_YEAR));
  for (const [monthName, monthLength] of MONTH_LENGTHS_STARTING_IN_MARCH) {
    if (dayOfYear < monthLength) return `${dayOfYear + 1} ${monthName}`;
    dayOfYear -= monthLength;
  }
  return '28 feb';
}

export const SEASON_NAMES: readonly string[] = ['spring', 'summer', 'autumn', 'winter'];

export const seasonName = (seasonPhase: number): string =>
  SEASON_NAMES[Math.floor(seasonPhase * 4) % 4] ?? 'spring';
