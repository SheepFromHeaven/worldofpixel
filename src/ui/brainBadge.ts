import { DIAL } from '../render/palette.ts';
import { BAYER, unpack } from './dayDial.ts';

export const BADGE_RADIUS = 40;

export const BADGE_WIDTH = BADGE_RADIUS * 2 + 2;

export const BADGE_HEIGHT = BADGE_RADIUS + 1;

const RIM = 4;

const RIVETS = [0.25, 0.5, 0.75];

function rimColour(dx: number, dy: number, reach: number): number {
  for (const share of RIVETS) {
    const angle = share * Math.PI;
    const at = BADGE_RADIUS - RIM / 2 - 0.5;
    const gap = Math.hypot(dx - Math.cos(angle) * at, dy - Math.sin(angle) * at);
    if (gap <= 0.8) return DIAL.rivet;
    if (gap <= 1.5) return DIAL.frame;
  }
  const light = -(dx + dy) / (reach * 1.45);
  if (light > 0.2) return DIAL.pinLight;
  if (light < -0.5) return DIAL.pinDark;
  return DIAL.pin;
}

function faceColour(x: number, y: number, reach: number): number {
  const shade = reach / (BADGE_RADIUS - RIM);
  const threshold = (BAYER[(y % 4) * 4 + (x % 4)]! + 0.5) / 16;
  return shade * 0.9 > 0.45 + threshold * 0.5 ? DIAL.pinDark : DIAL.pin;
}

export function drawBadge(ctx: CanvasRenderingContext2D): void {
  const image = ctx.createImageData(BADGE_WIDTH, BADGE_HEIGHT);
  const centre = BADGE_WIDTH / 2;

  for (let y = 0; y < BADGE_HEIGHT; y += 1) {
    for (let x = 0; x < BADGE_WIDTH; x += 1) {
      const dx = x + 0.5 - centre;
      const dy = y + 0.5;
      const reach = Math.hypot(dx, dy);
      if (reach > BADGE_RADIUS) continue;
      let colour: number;
      if (reach > BADGE_RADIUS - 1) colour = DIAL.frame;
      else if (reach > BADGE_RADIUS - RIM) colour = rimColour(dx, dy, reach);
      else if (reach > BADGE_RADIUS - RIM - 1) colour = DIAL.frame;
      else colour = faceColour(x, y, reach);
      image.data.set(unpack(colour), (y * BADGE_WIDTH + x) * 4);
    }
  }

  ctx.clearRect(0, 0, BADGE_WIDTH, BADGE_HEIGHT);
  ctx.putImageData(image, 0, 0);
}
