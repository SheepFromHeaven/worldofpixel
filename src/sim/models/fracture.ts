import { clamp, round2 } from './units.ts';

export type HammerId = 'hard' | 'soft' | 'antler';

export interface Hammer {
  label: string;
  shock: number;
  spread: number;
  crush: number;
}

export const HAMMERS: Record<HammerId, Hammer> = {
  hard: { label: 'Hard stone', shock: 1, spread: 0.35, crush: 1 },
  soft: { label: 'Soft stone', shock: 0.72, spread: 0.6, crush: 0.5 },
  antler: { label: 'Antler', shock: 0.5, spread: 0.85, crush: 0.18 },
};

export interface KnapParams {
  hammer?: HammerId;
  angle?: number;
  force?: number;
  setback?: number;
  prepared?: boolean;
}

export type FlakeGrade = 'scrap' | 'rough' | 'good' | 'fine';

export interface KnapResult {
  ok: boolean;
  why?: string;
  grade?: FlakeGrade;
  ratio?: number;
  length?: number;
  flakes?: number;
  fromOneCore?: number;
  edgeLife?: number;
}

const OVERHANG = 90;
const BEST_ANGLE = 72;

export function knap(params: KnapParams): KnapResult {
  const hammer = HAMMERS[params.hammer ?? 'hard'];
  const angle = params.angle ?? BEST_ANGLE;
  const force = clamp(params.force ?? 0.6, 0, 1);
  const setback = clamp(params.setback ?? 0.5, 0, 1);
  const prepared = params.prepared ?? false;

  if (angle >= OVERHANG) {
    return { ok: false, why: 'The platform overhangs, so the blow slides off.', flakes: 0 };
  }
  const angleFit = clamp(1 - Math.abs(angle - BEST_ANGLE) / 32, 0, 1);
  const crush = clamp((hammer.crush * (prepared ? 0.35 : 1) * force - angleFit * 0.45) * 1.4, 0, 1);
  if (crush > 0.62) {
    return {
      ok: false,
      why: 'The platform crushed: too much hammer for an unprepared edge.',
      flakes: 1,
      grade: 'scrap',
    };
  }
  if (force > 0.9 && hammer.shock > 0.8) {
    return { ok: false, why: 'The core snapped in two.', flakes: 0 };
  }

  const length = force * (0.5 + hammer.spread) * (0.55 + angleFit * 0.65) * (1.25 - setback * 0.5);
  const thickness = force * hammer.shock * (0.5 + setback * 0.8);
  const ratio = length / Math.max(0.08, thickness);
  return {
    ok: true,
    grade: ratio > 2.4 ? 'fine' : ratio > 1.5 ? 'good' : 'rough',
    ratio: round2(ratio),
    length: round2(length),
    fromOneCore: Math.max(1, Math.round(9 - ratio * 2.2)),
    edgeLife: Math.round(6 + ratio * 9),
  };
}
