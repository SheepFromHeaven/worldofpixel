export type Vec3 = readonly [number, number, number];

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export const scaled = (a: Vec3, factor: number): Vec3 => [a[0] * factor, a[1] * factor, a[2] * factor];

export const between = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export const distance = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export const unit = (a: Vec3): Vec3 => {
  const length = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
};

export const UP: Vec3 = [0, 0, 1];

export function tilted(direction: Vec3, angle: number, azimuth: number): Vec3 {
  const helper: Vec3 = Math.abs(direction[2]) < 0.9 ? UP : [1, 0, 0];
  const across = unit(cross(direction, helper));
  const along = cross(direction, across);
  const sideways = Math.sin(angle);
  return unit(add(scaled(direction, Math.cos(angle)), add(scaled(across, Math.cos(azimuth) * sideways), scaled(along, Math.sin(azimuth) * sideways))));
}
