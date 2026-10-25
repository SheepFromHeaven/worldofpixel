export class HeatSource {
  constructor(
    readonly reach: number,
    readonly output: number,
  ) {}

  warmthAt(dx: number, dy: number): number {
    const near = 1 - Math.hypot(dx, dy) / this.reach;
    return near > 0 ? near * this.output : 0;
  }
}
