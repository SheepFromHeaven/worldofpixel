/**
 * What lights a sprite.
 *
 * A sprite is drawn from above, so there is no camera and no scene — a light here is a rule for
 * how bright a cell is, given where it sits and which way its surface leans. That is enough for
 * the two things sprites actually need: a sun somewhere off the corner of the tile, and things
 * on the tile that glow.
 */

export interface Surface {
  x: number;
  y: number;
  /** Which way the surface leans, as a unit vector; z points up out of the tile. */
  normal: readonly [number, number, number];
}

/**
 * The sun. Far enough away that every cell is lit from the same angle, so only the lean of the
 * surface decides how bright it is.
 */
export interface Sun {
  kind: 'sun';
  /** Where the light comes *from*, in tile coordinates — y is down, z is up out of the tile. */
  toward: readonly [number, number, number];
  strength: number;
}

/** Something on the tile that gives off light: a fire, a forge, water welling up. */
export interface Glow {
  kind: 'glow';
  x: number;
  y: number;
  /** How far the light carries before it is spent. */
  reach: number;
  strength: number;
  /** Squashes the light vertically, so it lies on the ground instead of facing the viewer. */
  flatten?: number;
}

/**
 * Rings running out from a point — a ripple, a shockwave, a pulse of heat.
 *
 * Broken into arcs rather than closed, which is the whole trick: a complete ring reads as a
 * target painted on the sprite, and two arcs with gaps between them read as something moving.
 */
export interface Rings {
  kind: 'rings';
  x: number;
  y: number;
  /** Distance from one ring to the next. */
  spacing: number;
  /** How many gaps run around the rings. */
  breaks: number;
  /** Turns the gaps to where they look least like a pattern. */
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

/**
 * How much light falls on a cell, and how much of that came from something burning.
 *
 * The split is the whole point. A sum alone can say a stone is brightly lit but not *what by* —
 * and stone lit by the sun and stone lit by a fire are not the same colour, they are two sets of
 * colours someone chose. `warm` is the share that came from glows and rings rather than the sun,
 * and `shade` uses it to cross a material from its daylight ramp to its firelit one.
 */
export interface Illumination {
  total: number;
  warm: number;
}

export function illuminate(lights: readonly Light[], surface: Surface): Illumination {
  let total = 0;
  let warm = 0;

  for (const light of lights) {
    if (light.kind === 'sun') {
      // Half-Lambert rather than a hard cosine: a surface turned fully away from the sun still
      // takes a step of the ramp, and the sprite keeps its shape in shadow instead of going flat.
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
