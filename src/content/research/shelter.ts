import { from, goal, research } from './definition.ts';

export const FRAME = research('frame', 'frame', from(['branch', 'branch'], 'Frame', 'Two sticks leaned together stand up on their own.'));

export const BED = research('bed', 'bed', goal(), from(['frame', 'fibre'], 'Bed', 'Fibre laid over a frame is softer than the ground, and off it.'));

export const SHELTER = research('shelter', 'shelter', from(['frame', 'cord'], 'Shelter', 'A frame lashed with cord keeps its shape against the wind.'));

export const HUT = research('hut', 'hut', goal(), from(['shelter', 'fibre'], 'Hut', 'Fibre thatched over a shelter turns the weather away.'));
