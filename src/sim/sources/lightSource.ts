export type LightColour = readonly [number, number, number];

export class LightSource {
  constructor(
    readonly reach: number,
    readonly strength: number,
    readonly colour: LightColour,
  ) {}
}
