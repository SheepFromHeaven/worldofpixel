import { PLANET } from '../render/palette.ts';

export const PLANET_WIDTH = 144;
export const PLANET_HEIGHT = 108;

const BLOCK = 2;
const RADIUS = 34;
const CENTRE_X = PLANET_WIDTH / 2;
const CENTRE_Y = PLANET_HEIGHT / 2;
const SPIN = 0.35;
const DUST = 56;
const STARS = 44;
const MOON_FROM = 0.9;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export const PHASES: readonly { from: number; message: string }[] = [
  { from: 0, message: 'gathering stardust' },
  { from: 0.08, message: 'cooling the surface' },
  { from: 0.22, message: 'raising the mountains' },
  { from: 0.34, message: 'filling the seas' },
  { from: 0.46, message: 'spreading humidity' },
  { from: 0.58, message: 'cutting the rivers' },
  { from: 0.68, message: 'stirring the winds' },
  { from: 0.78, message: 'seeding life' },
  { from: 0.9, message: 'hardening the rock' },
  { from: 0.97, message: 'settling the sky and the creatures' },
];

export function messageFor(progress: number): string {
  let message = PHASES[0]!.message;
  for (const phase of PHASES) if (progress >= phase.from) message = phase.message;
  return message;
}

const clamp = (value: number, low = 0, high = 1): number => Math.min(high, Math.max(low, value));

const ease = (t: number): number => t * t * (3 - 2 * t);

const between = (from: number, to: number, value: number): number => ease(clamp((value - from) / (to - from)));

const hashed = (x: number, y: number, z: number): number => {
  let h = Math.imul(x + 374761393, 668265263) ^ Math.imul(y + 1274126177, 2246822519) ^ Math.imul(z + 912366877, 3266489917);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function noise(x: number, y: number, z: number): number {
  const fx = Math.floor(x);
  const fy = Math.floor(y);
  const fz = Math.floor(z);
  const tx = ease(x - fx);
  const ty = ease(y - fy);
  const tz = ease(z - fz);
  const corner = (dx: number, dy: number): number =>
    lerp(hashed(fx + dx, fy + dy, fz), hashed(fx + dx, fy + dy, fz + 1), tz);
  return lerp(lerp(corner(0, 0), corner(1, 0), tx), lerp(corner(0, 1), corner(1, 1), tx), ty);
}

const fbm = (x: number, y: number, z: number): number =>
  noise(x, y, z) * 0.65 + noise(x * 2.3 + 7, y * 2.3 + 3, z * 2.3 + 5) * 0.35;

const pick = (ramp: readonly number[], index: number): number =>
  ramp[Math.min(ramp.length - 1, Math.max(0, Math.round(index)))]!;

const dither = (column: number, row: number): number => (BAYER[(row & 3) * 4 + (column & 3)]! + 0.5) / 16;

export interface PlanetState {
  formed: number;
  heat: number;
  sea: number;
  life: number;
  ice: number;
  cloud: number;
  air: number;
  moon: number;
}

const KEYS: readonly (keyof PlanetState)[] = ['formed', 'heat', 'sea', 'life', 'ice', 'cloud', 'air', 'moon'];

export function desiredState(share: number): PlanetState {
  return {
    formed: clamp(share / 0.12),
    heat: 1 - between(0.1, 0.36, share),
    sea: between(0.34, 0.52, share) * 0.6,
    life: between(0.76, 0.95, share),
    ice: between(0.5, 0.7, share),
    cloud: between(0.44, 0.62, share) * 0.5 + between(0.62, 0.8, share) * 0.1,
    air: between(0.4, 0.6, share),
    moon: share >= MOON_FROM ? 1 : 0,
  };
}

const STIFFNESS = 5;
const MOST_AHEAD = 0.035;
const CREEP_PER_SECOND = 0.004;
const CEILING = 0.99;

export class Planet {
  readonly state: PlanetState = desiredState(0);
  private readonly speed: Record<keyof PlanetState, number> = {
    formed: 0,
    heat: 0,
    sea: 0,
    life: 0,
    ice: 0,
    cloud: 0,
    air: 0,
    moon: 0,
  };
  private reached = 0;
  private ahead = 0;

  target(share: number): void {
    this.reached = Math.max(this.reached, share);
    this.ahead = Math.max(this.ahead, this.reached);
  }

  step(seconds: number): void {
    const dt = Math.min(0.1, seconds);
    this.ahead = Math.min(CEILING, Math.min(this.reached + MOST_AHEAD, this.ahead + CREEP_PER_SECOND * dt));
    this.ahead = Math.max(this.ahead, this.reached);
    const desired = desiredState(this.ahead);
    const damping = 2 * Math.sqrt(STIFFNESS);
    for (const key of KEYS) {
      const velocity = this.speed[key] + ((desired[key] - this.state[key]) * STIFFNESS - damping * this.speed[key]) * dt;
      this.speed[key] = velocity;
      this.state[key] = clamp(this.state[key] + velocity * dt, 0, 1);
    }
  }
}

export function settledState(share: number): PlanetState {
  return desiredState(share);
}

export function paintPlanet(pixels: Uint8ClampedArray, state: PlanetState, seconds: number): void {
  const mask = new Uint8Array(PLANET_WIDTH * PLANET_HEIGHT);

  const put = (x: number, y: number, color: number): void => {
    if (x < 0 || y < 0 || x >= PLANET_WIDTH || y >= PLANET_HEIGHT) return;
    const at = (y * PLANET_WIDTH + x) * 4;
    pixels[at] = color >>> 24;
    pixels[at + 1] = (color >>> 16) & 255;
    pixels[at + 2] = (color >>> 8) & 255;
    pixels[at + 3] = 255;
  };

  const block = (x: number, y: number, size: number, color: number): void => {
    for (let dy = 0; dy < size; dy += 1) for (let dx = 0; dx < size; dx += 1) put(x + dx, y + dy, color);
  };

  for (let y = 0; y < PLANET_HEIGHT; y += 1) {
    for (let x = 0; x < PLANET_WIDTH; x += 1) put(x, y, PLANET.space);
  }

  for (let star = 0; star < STARS; star += 1) {
    const x = Math.floor(hashed(star, 1, 9) * (PLANET_WIDTH / BLOCK)) * BLOCK;
    const y = Math.floor(hashed(star, 2, 9) * (PLANET_HEIGHT / BLOCK)) * BLOCK;
    const bright = hashed(star, 3, 9) > 0.8;
    const dim = hashed(star, Math.floor(seconds * 1.3 + hashed(star, 4, 9) * 9), 11) < 0.3;
    block(x, y, dim ? 1 : bright ? 2 : 1, bright && !dim ? PLANET.starBright : PLANET.star);
  }

  const formed = ease(state.formed);
  const radius = 3 + (RADIUS - 3) * formed;
  const { heat, sea, life, air } = state;
  const iceAmount = state.ice;
  const cloudAmount = state.cloud;
  const rotation = seconds * SPIN;
  const turn = { cos: Math.cos(rotation), sin: Math.sin(rotation) };
  const drift = { cos: Math.cos(rotation * 1.4 + 2), sin: Math.sin(rotation * 1.4 + 2) };

  const moonAngle = seconds * 0.6;
  const moonReach = RADIUS + 13 + (1 - state.moon) * 46;
  const moonX = CENTRE_X + Math.cos(moonAngle) * moonReach;
  const moonY = CENTRE_Y + Math.sin(moonAngle) * moonReach * 0.32 - 8;
  const moonShown = state.moon > 0.02;
  const moonBehind = Math.sin(moonAngle) < 0;
  const moon = (): void => {
    const left = Math.round(moonX / BLOCK) * BLOCK;
    const top = Math.round(moonY / BLOCK) * BLOCK;
    const cells = [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]] as const;
    for (const [cx, cy] of cells) {
      block(left + cx * BLOCK, top + cy * BLOCK, BLOCK, pick(PLANET.moon, cx < 0 || cy < 0 ? 2 : cx > 0 || cy > 0 ? 0 : 1));
    }
  };
  if (moonShown && moonBehind) moon();

  if (formed < 0.995) {
    for (let grain = 0; grain < DUST; grain += 1) {
      const angle = hashed(grain, 5, 3) * Math.PI * 2 + seconds * (0.5 + hashed(grain, 6, 3));
      const reach = (18 + hashed(grain, 7, 3) * 46) * (1 - 0.9 * formed);
      if (reach < radius + 1) continue;
      const x = Math.round((CENTRE_X + Math.cos(angle) * reach) / BLOCK) * BLOCK;
      const y = Math.round((CENTRE_Y + Math.sin(angle) * reach * 0.8) / BLOCK) * BLOCK;
      block(x, y, hashed(grain, 8, 3) > 0.7 ? BLOCK : 1, pick(PLANET.dust, hashed(grain, 9, 3) * 3));
    }
  }

  const span = Math.ceil(radius / BLOCK) + 3;
  for (let row = -span; row < span; row += 1) {
    for (let column = -span; column < span; column += 1) {
      const dx = ((column + 0.5) * BLOCK) / radius;
      const dy = ((row + 0.5) * BLOCK) / radius;
      const reach = dx * dx + dy * dy;
      const px = CENTRE_X + column * BLOCK;
      const py = CENTRE_Y + row * BLOCK;
      const light = Math.max(0, 1 - Math.hypot(dx + 0.45, dy + 0.45) / 1.5);

      if (reach > 1) {
        const edge = Math.sqrt(reach);
        if (heat > 0.05 && edge < 1.22 && dither(column, row) < heat * (1.22 - edge) * 3.5) {
          block(px, py, BLOCK, pick(PLANET.glow, (1.22 - edge) * 10 + heat));
        } else if (air > 0.05 && edge < 1.12 && light > 0.15 && dither(column, row) < air * light) {
          block(px, py, BLOCK, PLANET.air);
        }
        continue;
      }

      const z = Math.sqrt(1 - reach);
      const x3 = dx * turn.cos + z * turn.sin;
      const z3 = -dx * turn.sin + z * turn.cos;
      const y3 = dy;
      const height = fbm(x3 * 1.6 + 11, y3 * 1.6, z3 * 1.6);
      const shade = Math.min(3, Math.round(light * 3));
      let color: number;

      const flow = fbm(x3 * 2.4, y3 * 2.4, z3 * 2.4 + seconds * 0.25);
      const crustLevel = 0.78 - heat * 0.5;
      if (heat > 0.02 && flow > crustLevel) {
        color = pick(PLANET.magma, 0.4 + (flow - crustLevel) * 5 + light * 1.4 + heat * 1.3);
      } else if (height < sea && heat < 0.35) {
        const shallow = height > sea - 0.05 ? 1 : 0;
        color = pick(PLANET.sea, shade + shallow - 1);
      } else if (Math.abs(y3) > 0.93 - iceAmount * 0.1 + (noise(x3 * 5, 0, z3 * 5) - 0.5) * 0.06 && iceAmount > 0.02) {
        color = pick(PLANET.ice, light * 2);
      } else {
        const grows = noise(x3 * 4 + 50, y3 * 4, z3 * 4) < 0.2 + life * 0.7 * (1 - y3 * y3 * 0.5);
        color =
          life > 0.02 && grows && heat < 0.35
            ? pick(PLANET.land, shade)
            : pick(PLANET.crust, light * 2 + (height - sea) * 3);
      }

      if (cloudAmount > 0.02) {
        const cx = x3 * drift.cos - z3 * drift.sin;
        const cz = x3 * drift.sin + z3 * drift.cos;
        const cloud = fbm(cx * 3.4 + 30, y3 * 4, cz * 3.4);
        const level = 0.8 - cloudAmount * 0.3;
        if (cloud + (dither(column, row) - 0.5) * 0.06 > level) {
          color = pick(PLANET.cloud, light * 2 + (cloud > level + 0.07 ? 1 : 0));
        }
      }

      block(px, py, BLOCK, color);
      for (let y = 0; y < BLOCK; y += 1) for (let x = 0; x < BLOCK; x += 1) mask[(py + y) * PLANET_WIDTH + px + x] = 1;
    }
  }

  const solid = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < PLANET_WIDTH && y < PLANET_HEIGHT && mask[y * PLANET_WIDTH + x] === 1;
  for (let y = 0; y < PLANET_HEIGHT; y += 1) {
    for (let x = 0; x < PLANET_WIDTH; x += 1) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) put(x, y, PLANET.ink);
    }
  }

  if (moonShown && !moonBehind) moon();
}
