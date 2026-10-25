import { DIAL } from '../render/palette.ts';

export const DIAL_WIDTH = 40;

export const DIAL_HEIGHT = 44;

const CENTRE_X = DIAL_WIDTH / 2;

const CENTRE_Y = 24;

const PLATE = 15.5;

const BEZEL = 18.5;

const LIP = 1;

const RIVETS = 4;

const SUN_AT = -8;

const MOON_AT = 8;

const RAYS = 8;

const STARS: readonly (readonly [number, number])[] = [
  [-9, 6],
  [8, 5],
  [-4, 13],
  [9, 11],
  [3, 14],
];

const ARROW_HALF_WIDTHS = [3, 3, 2, 2, 1, 0];

const ARROW_TOP = 1;

function unpack(colour: number): [number, number, number, number] {
  return [(colour >>> 24) & 255, (colour >>> 16) & 255, (colour >>> 8) & 255, colour & 255];
}

const FADE_HALF = 5;

const FADE_STEPS = 5;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const PIN_OUTER = 3.4;

const PIN_INNER = 2.5;

function mix(from: number, to: number, share: number): number {
  const a = unpack(from);
  const b = unpack(to);
  const channel = (index: 0 | 1 | 2): number => Math.round(a[index] + (b[index] - a[index]) * share);
  return ((channel(0) << 24) | (channel(1) << 16) | (channel(2) << 8) | 0xff) >>> 0;
}

function glyph(u: number, v: number): number | null {
  if (v < 0) {
    const sun = Math.hypot(u, v - SUN_AT);
    if (sun <= 3.6) return sun <= 1.8 ? DIAL.sunHot : DIAL.sun;
    for (let ray = 0; ray < RAYS; ray += 1) {
      const angle = (ray / RAYS) * Math.PI * 2;
      if (Math.hypot(u - Math.cos(angle) * 5.4, v - SUN_AT - Math.sin(angle) * 5.4) <= 0.9) return DIAL.ray;
    }
    return null;
  }

  if (Math.hypot(u, v - MOON_AT) <= 4.2 && Math.hypot(u - 2, v - MOON_AT + 1.2) > 3.5) return DIAL.moon;
  for (const [sx, sy] of STARS) if (Math.abs(u - sx) < 0.6 && Math.abs(v - sy) < 0.6) return DIAL.star;
  return null;
}

function dialColour(x: number, y: number, u: number, v: number): number {
  const marked = glyph(u, v);
  if (marked !== null) return marked;

  const share = Math.min(1, Math.max(0, (v + FADE_HALF) / (FADE_HALF * 2)));
  const stepped = Math.floor(share * FADE_STEPS + (BAYER[(y % 4) * 4 + (x % 4)]! + 0.5) / 16) / FADE_STEPS;
  const sky = v < -9 ? DIAL.dayHigh : DIAL.day;
  const dark = v > 10 ? DIAL.nightLow : DIAL.night;
  return mix(sky, dark, Math.min(1, stepped));
}

function bezelColour(dx: number, dy: number, reach: number): number | null {
  if (reach > BEZEL) return null;
  if (reach > BEZEL - LIP) return DIAL.frame;
  if (reach <= PLATE) return DIAL.frame;

  for (let rivet = 0; rivet < RIVETS; rivet += 1) {
    const angle = Math.PI / 4 + (rivet * Math.PI) / 2;
    const at = (PLATE + BEZEL) / 2;
    const gap = Math.hypot(dx - Math.cos(angle) * at, dy - Math.sin(angle) * at);
    if (gap <= 0.8) return DIAL.rivet;
    if (gap <= 1.5) return DIAL.frame;
  }

  const light = -(dx + dy) / (reach * 1.45);
  if (light > 0.4) return DIAL.pinLight;
  if (light < -0.4) return DIAL.pinDark;
  return DIAL.pin;
}

function pinColour(dx: number, dy: number): number | null {
  const reach = Math.hypot(dx, dy);
  if (reach > PIN_OUTER) return null;
  if (reach > PIN_INNER) return DIAL.frame;
  const light = -(dx + dy) / (PIN_INNER * 1.6);
  if (light > 0.45) return DIAL.pinLight;
  if (light < -0.45) return DIAL.pinDark;
  return DIAL.pin;
}

export function drawDial(ctx: CanvasRenderingContext2D, dayFraction: number): void {
  const image = ctx.createImageData(DIAL_WIDTH, DIAL_HEIGHT);
  const turn = (dayFraction - 0.5) * Math.PI * 2;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);

  const paint = (x: number, y: number, colour: number): void => {
    if (x < 0 || y < 0 || x >= DIAL_WIDTH || y >= DIAL_HEIGHT) return;
    const at = (y * DIAL_WIDTH + x) * 4;
    const [r, g, b, a] = unpack(colour);
    image.data[at] = r;
    image.data[at + 1] = g;
    image.data[at + 2] = b;
    image.data[at + 3] = a;
  };

  for (let y = 0; y < DIAL_HEIGHT; y += 1) {
    for (let x = 0; x < DIAL_WIDTH; x += 1) {
      const dx = x + 0.5 - CENTRE_X;
      const dy = y + 0.5 - CENTRE_Y;
      const reach = Math.hypot(dx, dy);
      if (reach > PLATE - LIP) {
        const ring = bezelColour(dx, dy, reach);
        if (ring !== null) paint(x, y, ring);
        continue;
      }
      paint(x, y, pinColour(dx, dy) ?? dialColour(x, y, dx * cos + dy * sin, -dx * sin + dy * cos));
    }
  }

  ARROW_HALF_WIDTHS.forEach((half, row) => {
    const y = ARROW_TOP + row;
    for (let x = -half - 1; x <= half + 1; x += 1) paint(Math.floor(CENTRE_X) + x, y, Math.abs(x) <= half ? DIAL.arrow : DIAL.arrowEdge);
  });
  paint(Math.floor(CENTRE_X), ARROW_TOP + ARROW_HALF_WIDTHS.length, DIAL.arrowEdge);

  ctx.clearRect(0, 0, DIAL_WIDTH, DIAL_HEIGHT);
  ctx.putImageData(image, 0, 0);
}
