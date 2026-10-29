export const Bubble = { None: 0, Thought: 1, Speech: 2 } as const;

export type Bubble = (typeof Bubble)[keyof typeof Bubble];

export const Glyph = { None: 0, Query: 1, Plus: 2, Bang: 3, Dots: 4, Neuron: 16 } as const;

export const BUBBLE_SLOTS = 4;
