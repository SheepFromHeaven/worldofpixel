import { at, from, goal, research } from '../../content/research/definition.ts';

export const SHARP = research('sharp', 'sharp edge', at(8), from(['flint', 'stone'], 'Sharp edge', 'A stone knocked on flint takes an edge.'));

export const BINDING = research('binding', 'binding', at(10), from(['branch', 'fibre'], 'Binding', 'Fibre wound round a stick holds a thing fast.', { spend: ['branch', 'plantFibre'] }));

export const TOOL = research('tool', 'stone tool', at(11), goal(), from(['sharp', 'binding'], 'Stone tool', 'An edge bound to a handle is a tool, and a place to work it is a knapping floor.', { spend: ['flint'], make: ['handAxe'], order: 'Knap Hand Axe', station: 'floor' }));

export const CORD = research('cord', 'cord', at(15), from(['fibre', 'fibre'], 'Cord', 'Fibres twisted together make a cord that holds.', { spend: ['plantFibre', 'plantFibre'], make: ['cord'], order: 'Twist Cord' }));

export const BASKET = research('basket', 'basket', at(16), from(['cord', 'fibre'], 'Basket', 'Cord and fibre woven round make something to carry a lot in.', { spend: ['plantFibre', 'cord'], make: ['basket'], order: 'Weave Basket' }));

export const SPEAR = research('spear', 'spear', at(20), goal(), from(['sharp', 'branch'], 'Spear', 'A stick with an edge on it reaches farther than a hand.'));

export const SNARE = research('snare', 'snare', at(21), goal(), from(['cord', 'branch'], 'Snare', 'A loop of cord on a bent stick holds what walks into it.'));

export const RESEARCH_ENTRIES = [SHARP, BINDING, TOOL, CORD, BASKET, SPEAR, SNARE];
