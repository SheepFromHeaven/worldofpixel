import { FOLK_DOTS } from '../render/palette.ts';
import type { People } from '../sim/people/people.ts';

const DOT_PIXELS = 2;

export function drawPeopleDots(ctx: CanvasRenderingContext2D, people: People, zoom: number): void {
  const size = DOT_PIXELS / zoom;
  for (let person = 0; person < people.count; person += 1) {
    ctx.fillStyle = FOLK_DOTS[person] ?? FOLK_DOTS[0]!;
    ctx.fillRect(people.posX[person]! - size / 2, people.posY[person]! - size / 2, size, size);
  }
}
