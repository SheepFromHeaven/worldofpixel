import { LIVES, Stage } from '../fauna/life.ts';

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
}

const DEFAULT_LANDING = 2;

const SAFETY = 1.25;

const TRAINING: Readonly<Record<string, Training>> = {
  blackbear: { gripMin: 0.05, gripMax: 0.5, touch: 0.5, landing: 1.25 },
  squirrel: { gripMin: 0.005, gripMax: 3, touch: 0.3, jump: 3 },
  flyingsquirrel: { gripMin: 0.005, gripMax: 3, touch: 0.2, jump: 1.5, glide: 3, glideMax: 40 },
  dormouse: { gripMin: 0.003, gripMax: 1, touch: 0.15, jump: 0.8 },
  marten: { gripMin: 0.01, gripMax: 1.5, touch: 0.4, jump: 3 },
  raccoon: { gripMin: 0.03, gripMax: 0.6, touch: 0.4, jump: 0.5 },
  macaque: { gripMin: 0.01, gripMax: 2, touch: 0.6, jump: 4 },
  chimpanzee: { gripMin: 0.02, gripMax: 1, touch: 0.8, jump: 2.5 },
  gibbon: { gripMin: 0.01, gripMax: 1, touch: 1, jump: 6 },
  orangutan: { gripMin: 0.03, gripMax: 1, touch: 1, jump: 1.5, landing: 1.5 },
  sloth: { gripMin: 0.01, gripMax: 1.5, touch: 0.6, landing: 1.25 },
  leopard: { gripMin: 0.05, gripMax: 1.5, touch: 0.5, jump: 4 },
};

export const CLIMBERS: readonly string[] = Object.keys(TRAINING);

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
