import { SEASON_DIAL } from '../render/palette.ts';
import { BAYER, mix } from './dayDial.ts';
import type { DiscFace } from './dayDial.ts';

export const SEASON_ANCHOR = 0.05;

const QUARTERS = 4;

const BLEND_HALF = 0.022;

const WINDOW = 4;

const RING = 10.5;

const BLEND_STEPS = 5;

const QUARTER_COLOURS: readonly (readonly [number, number])[] = [
  [SEASON_DIAL.spring, SEASON_DIAL.springHigh],
  [SEASON_DIAL.summer, SEASON_DIAL.summerHigh],
  [SEASON_DIAL.autumn, SEASON_DIAL.autumnLow],
  [SEASON_DIAL.winter, SEASON_DIAL.winterLow],
];

export const seasonNameOf = (phase: number): string => ['spring', 'summer', 'autumn', 'winter'][Math.floor((((phase % 1) + 1) % 1) * QUARTERS)]!;

const phaseAt = (u: number, v: number): number => {
  const turns = (Math.atan2(v, u) + Math.PI / 2) / (Math.PI * 2);
  return (((SEASON_ANCHOR - turns) % 1) + 1) % 1;
};

const motif = (quarter: number, du: number, dv: number): number | null => {
  const reach = Math.hypot(du, dv);
  if (quarter === 0) {
    if (reach <= 1.2) return SEASON_DIAL.blossom;
    if (Math.abs(du) <= 0.5 && dv >= 1 && dv <= 3.5) return SEASON_DIAL.sprout;
    return null;
  }
  if (quarter === 1) {
    if (reach <= 1.9) return SEASON_DIAL.sun;
    return null;
  }
  if (quarter === 2) {
    if (Math.abs(du) + Math.abs(dv) <= 2.2) return SEASON_DIAL.leaf;
    return null;
  }
  if (Math.abs(du) < 0.6 || Math.abs(dv) < 0.6 || Math.abs(Math.abs(du) - Math.abs(dv)) < 0.6) return reach <= 2.8 ? SEASON_DIAL.snow : null;
  return null;
};

export const seasonFace: DiscFace = (x, y, u, v) => {
  const phase = phaseAt(u, v);
  const reach = Math.hypot(u, v);
  const scaled = phase * QUARTERS;
  const quarter = Math.floor(scaled) % QUARTERS;
  if (reach > 4 && reach < RING + 2) {
    const centre = (quarter + 0.5) / QUARTERS;
    const angle = (SEASON_ANCHOR - centre) * Math.PI * 2 - Math.PI / 2;
    const cx = Math.cos(angle) * RING * 0.62;
    const cy = Math.sin(angle) * RING * 0.62;
    const mark = motif(quarter, u - cx, v - cy);
    if (mark !== null) return mark;
  }
  const edge = scaled - quarter;
  const near = edge < BLEND_HALF * QUARTERS ? -1 : edge > 1 - BLEND_HALF * QUARTERS ? 1 : 0;
  const [base, tone] = QUARTER_COLOURS[quarter]!;
  const own = reach < WINDOW + 3 ? tone : base;
  if (near === 0) return own;
  const other = QUARTER_COLOURS[(quarter + near + QUARTERS) % QUARTERS]![0];
  const share = near === -1 ? 0.5 - edge / (BLEND_HALF * QUARTERS * 2) : (edge - (1 - BLEND_HALF * QUARTERS)) / (BLEND_HALF * QUARTERS * 2);
  const stepped = Math.floor(share * BLEND_STEPS + (BAYER[(y % 4) * 4 + (x % 4)]! + 0.5) / 16) / BLEND_STEPS;
  return mix(own, other, Math.min(1, stepped));
};
