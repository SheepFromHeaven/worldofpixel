import { LIVES, Stage } from '../fauna/life.ts';

export interface ClimbHabits {
  taste: number;
  gap: readonly [number, number];
  perch: readonly [number, number];
  arboreal: number;
  search: number;
  escape?: number;
}

export interface Ability {
  key: string;
  mass: number;
  gripMin: number;
  gripMax: number;
  touch: number;
  jump: number;
  glide: number;
  glideMax: number;
  landing: number;
  safety: number;
}

interface Training {
  gripMin: number;
  gripMax: number;
  touch: number;
  jump?: number;
  glide?: number;
  glideMax?: number;
  landing?: number;
  habits: ClimbHabits;
}

const DEFAULT_LANDING = 2;

const SAFETY = 1.25;

const TRAINING: Readonly<Record<string, Training>> = {
  blackbear: { gripMin: 0.05, gripMax: 0.5, touch: 0.5, landing: 1.25, habits: { taste: 0.06, gap: [6, 18], perch: [8, 40], arboreal: 0.05, search: 14 } },
  squirrel: { gripMin: 0.005, gripMax: 3, touch: 0.3, jump: 3, habits: { taste: 0.95, gap: [3, 8], perch: [4, 20], arboreal: 0.85, search: 14, escape: 0.9 } },
  flyingsquirrel: { gripMin: 0.005, gripMax: 3, touch: 0.2, jump: 1.5, glide: 3, glideMax: 40, habits: { taste: 0.95, gap: [3, 8], perch: [10, 40], arboreal: 0.9, search: 14, escape: 0.8 } },
  dormouse: { gripMin: 0.003, gripMax: 1, touch: 0.15, jump: 0.8, habits: { taste: 0.9, gap: [3, 8], perch: [10, 60], arboreal: 0.9, search: 14 } },
  marten: { gripMin: 0.01, gripMax: 1.5, touch: 0.4, jump: 3, habits: { taste: 0.5, gap: [4, 12], perch: [6, 30], arboreal: 0.4, search: 14 } },
  raccoon: { gripMin: 0.03, gripMax: 0.6, touch: 0.4, jump: 0.5, habits: { taste: 0.3, gap: [6, 18], perch: [10, 60], arboreal: 0.1, search: 14 } },
  macaque: { gripMin: 0.01, gripMax: 2, touch: 0.6, jump: 4, habits: { taste: 0.8, gap: [3, 10], perch: [6, 30], arboreal: 0.7, search: 14 } },
  chimpanzee: { gripMin: 0.02, gripMax: 1, touch: 0.8, jump: 2.5, habits: { taste: 0.7, gap: [4, 12], perch: [8, 40], arboreal: 0.5, search: 14 } },
  gibbon: { gripMin: 0.01, gripMax: 1, touch: 1, jump: 6, habits: { taste: 1, gap: [2, 6], perch: [5, 25], arboreal: 0.95, search: 14 } },
  orangutan: { gripMin: 0.03, gripMax: 1, touch: 1, jump: 1.5, landing: 1.5, habits: { taste: 0.9, gap: [3, 10], perch: [10, 60], arboreal: 0.9, search: 14 } },
  sloth: { gripMin: 0.01, gripMax: 1.5, touch: 0.6, landing: 1.25, habits: { taste: 1, gap: [3, 8], perch: [30, 120], arboreal: 0.95, search: 14 } },
  leopard: { gripMin: 0.05, gripMax: 1.5, touch: 0.5, jump: 4, habits: { taste: 0.4, gap: [6, 18], perch: [20, 120], arboreal: 0.3, search: 14 } },
};

export const CLIMBERS: readonly string[] = Object.keys(TRAINING);

export const habitsOf = (key: string, own?: Partial<ClimbHabits>): ClimbHabits | null => {
  const training = TRAINING[key];
  return training ? { ...training.habits, ...own } : null;
};

export const abilityOf = (key: string, stage: number = Stage.Adult): Ability | null => {
  const training = TRAINING[key];
  const life = LIVES.find((one) => one.key === key);
  if (!training || !life) return null;
  return {
    key,
    mass: life.mass[stage]!,
    gripMin: training.gripMin,
    gripMax: training.gripMax,
    touch: training.touch,
    jump: training.jump ?? 0,
    glide: training.glide ?? 0,
    glideMax: training.glideMax ?? 0,
    landing: training.landing ?? DEFAULT_LANDING,
    safety: SAFETY,
  };
};
