export const MOON_PHASE_CYCLE_DAYS = 8;

export const YEAR_LENGTH_IN_GAME_DAYS = 32;

export const DAY_SECONDS = 1440;

export const FIRST_TIME_OF_DAY = 0.425;

export const FIRST_SEASON_PHASE = 0.3;

export const MOON_PHASE_NAMES: readonly string[] = [
  'new moon',
  'waxing crescent',
  'first quarter',
  'waxing gibbous',
  'full moon',
  'waning gibbous',
  'last quarter',
  'waning crescent',
];

export const moonPhaseName = (moonPhase: number): string =>
  MOON_PHASE_NAMES[Math.round(moonPhase * MOON_PHASE_NAMES.length) % MOON_PHASE_NAMES.length] ?? 'new moon';

export interface CalendarMoment {
  timeOfDay: number;
  seasonPhase: number;
  moonPhase: number;
  completedDays: number;
}

export interface CalendarState {
  timeOfDay: number;
  completedDays: number;
  elapsedDays: number;
  seasonOffset: number;
  moonOffset: number;
}

const wrapToZeroToOne = (value: number): number => ((value % 1) + 1) % 1;

export class Calendar {
  timeOfDay = FIRST_TIME_OF_DAY;
  completedDays = 0;
  elapsedDays = 0;

  private seasonOffset = FIRST_SEASON_PHASE;
  private moonOffset = 0;

  get seasonPhase(): number {
    return wrapToZeroToOne(this.elapsedDays / YEAR_LENGTH_IN_GAME_DAYS + this.seasonOffset);
  }

  get moonPhase(): number {
    return this.moonPhaseWithOffset(this.moonOffset);
  }

  get totalDays(): number {
    return this.completedDays + this.timeOfDay;
  }

  get moment(): CalendarMoment {
    return {
      timeOfDay: this.timeOfDay,
      seasonPhase: this.seasonPhase,
      moonPhase: this.moonPhase,
      completedDays: this.completedDays,
    };
  }

  state(): CalendarState {
    return {
      timeOfDay: this.timeOfDay,
      completedDays: this.completedDays,
      elapsedDays: this.elapsedDays,
      seasonOffset: this.seasonOffset,
      moonOffset: this.moonOffset,
    };
  }

  restore(state: CalendarState): void {
    this.timeOfDay = state.timeOfDay;
    this.completedDays = state.completedDays;
    this.elapsedDays = state.elapsedDays;
    this.seasonOffset = state.seasonOffset;
    this.moonOffset = state.moonOffset;
  }

  advanceByDays(days: number): void {
    this.timeOfDay += days;
    this.elapsedDays += days;
    if (this.timeOfDay >= 1) {
      this.timeOfDay -= 1;
      this.completedDays += 1;
    }
  }

  setMinuteOfDay(minute: number): void {
    const target = Math.min(1439, Math.max(0, minute)) / 1440;
    if (target > this.timeOfDay) this.elapsedDays += target - this.timeOfDay;
    this.timeOfDay = target;
  }

  setSeasonPhase(phase: number): void {
    this.seasonOffset = wrapToZeroToOne(phase) - ((this.elapsedDays / YEAR_LENGTH_IN_GAME_DAYS) % 1);
  }

  setMoonPhase(phase: number): void {
    this.moonOffset = wrapToZeroToOne(phase) - this.moonPhaseWithOffset(0);
  }

  private moonPhaseWithOffset(offset: number): number {
    return wrapToZeroToOne((this.completedDays + this.timeOfDay) / MOON_PHASE_CYCLE_DAYS + 0.5 + offset);
  }
}
