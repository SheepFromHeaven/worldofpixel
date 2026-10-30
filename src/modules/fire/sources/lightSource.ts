export type LightColour = readonly [number, number, number];

export type Flame = 'none' | 'torch' | 'campfire';

export interface LightBehaviour {
  flicker: number;
  windShare: number;
  flame: Flame;
  lift: number;
}

export const STEADY: LightBehaviour = { flicker: 0, windShare: 0, flame: 'none', lift: 0 };

export class LightSource {
  constructor(
    readonly reach: number,
    readonly strength: number,
    readonly colour: LightColour,
    readonly behaviour: LightBehaviour = STEADY,
  ) {}
}
