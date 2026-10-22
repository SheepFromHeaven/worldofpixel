
export interface Surface {
  x: number;
  y: number;
  normal: readonly [number, number, number];
}

export interface Sun {
  kind: 'sun';
  toward: readonly [number, number, number];
  strength: number;
}

export interface Glow {
  kind: 'glow';
  x: number;
  y: number;
  reach: number;
  strength: number;
  flatten?: number;
}

export interface Rings {
  kind: 'rings';
  x: number;
  y: number;
  spacing: number;
  breaks: number;
  rotation: number;
  reach: number;
  strength: number;
  flatten?: number;
}

export type Light = Sun | Glow | Rings;

const dot = (a: readonly [number, number, number], b: readonly [number, number, number]): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function normalize(v: readonly [number, number, number]): [number, number, number] {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function fromLight(light: Glow | Rings, surface: Surface): { distance: number; angle: number } {
  const flatten = light.flatten ?? 1;
  const dx = surface.x - light.x;
  const dy = (surface.y - light.y) * flatten;
  return { distance: Math.hypot(dx, dy), angle: Math.atan2(surface.y - light.y, surface.x - light.x) };
}

export interface Illumination {
  total: number;
  warm: number;
}

export function illuminate(lights: readonly Light[], surface: Surface): Illumination {
  let total = 0;
  let warm = 0;

  for (const light of lights) {
    if (light.kind === 'sun') {
      const facing = (dot(surface.normal, normalize(light.toward)) + 1) / 2;
      total += facing * light.strength;
      continue;
    }

    const { distance, angle } = fromLight(light, surface);
    if (distance > light.reach) continue;
    const falloff = 1 - distance / light.reach;

    if (light.kind === 'glow') {
      const fell = falloff * falloff * light.strength;
      total += fell;
      warm += fell;
      continue;
    }

    if (Math.cos(light.breaks * (angle - light.rotation)) <= 0) continue;
    const crest = Math.cos((distance / light.spacing) * Math.PI * 2);
    if (crest > 0) {
      const ringing = crest * falloff * light.strength;
      total += ringing;
      warm += ringing;
    }
  }

  return { total, warm };
}
