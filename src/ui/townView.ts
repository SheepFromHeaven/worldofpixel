import type { Standing } from './rigView.ts';

export const DAY_PARTS = ['rest', 'water', 'food', 'work', 'idle'] as const;

export type DayPart = (typeof DAY_PARTS)[number];

export interface DayHours {
  part: DayPart;
  hours: number;
}

export interface StandingIn {
  id: string;
  label: string;
  stock: Standing;
  capacity: number;
}

export interface TownView {
  name: string;
  people: number;
  sheltered: number;
  vessels: number;
  buildings: number;
  day: DayHours[];
  spare: number;
  standing: StandingIn[];
}

export const DAY_LABELS: Record<DayPart, string> = {
  rest: 'sleeping',
  water: 'drinking',
  food: 'eating',
  work: 'working',
  idle: 'nothing to do',
};
