import { at, from, goal, research } from '../../content/research/definition.ts';

export const FRAME = research('frame', 'frame', at(22), from(['branch', 'branch'], 'Frame', 'Two sticks leaned together stand up on their own.'));

export const BED = research('bed', 'bed', at(23), goal(), from(['frame', 'fibre'], 'Bed', 'Fibre laid over a frame is softer than the ground, and off it.'));

export const SHELTER = research('shelter', 'shelter', at(24), from(['frame', 'cord'], 'Shelter', 'A frame lashed with cord keeps its shape against the wind.'));

export const HUT = research('hut', 'hut', at(25), goal(), from(['shelter', 'fibre'], 'Hut', 'Fibre thatched over a shelter turns the weather away.'));

export const RESEARCH_ENTRIES = [FRAME, BED, SHELTER, HUT];
