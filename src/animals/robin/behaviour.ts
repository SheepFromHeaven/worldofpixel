import type { AnimalBehaviour, BirdHabits, Pose, PoseContext } from '../types.ts';
import { Gait } from '../../sim/birds/species.ts';

const FLY_PITCH = 0.25;

const SING_PITCH = 0.45;

const pose = ({ state, phase }: PoseContext): Pose => {
  if (state === 'fly') return [Math.sin(phase), 1, FLY_PITCH, 0];
  if (state === 'sing') return [0.5 + 0.5 * Math.sin(phase), 1, SING_PITCH, 0];
  if (state === 'hop') return [0, 0, 0.25, 0];
  return [0, 0, 0.4, 0];
};

export const behaviour: AnimalBehaviour<BirdHabits> = {
  habits: { gait: Gait.Perch, day: 1, night: 0, dusk: 0.4, shy: 0.5, rest: 9, speed: 7, reach: 8, skit: 3, beat: 14, altitude: 1.2, migrant: 0, sing: 0.6 },
  states: ['perch', 'hop', 'fly', 'sing'],
  hooks: { pose },
};
