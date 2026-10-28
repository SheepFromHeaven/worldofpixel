import type { Species } from '../plants/species.ts';
import { hash2 } from '../rng.ts';

export type NodeKind = 'trunk' | 'branch' | 'tip';

export interface ClimbNode {
  x: number;
  y: number;
  z: number;
  radius: number;
  parent: number;
  kind: NodeKind;
}

export interface TreeGraph {
  tile: number;
  x: number;
  y: number;
  species: Species;
  metres: number;
  crownRadius: number;
  crownBase: number;
  nodes: ClimbNode[];
}

export const MAX_NODES = 128;

export const CAPACITY_KG = 70000;

export const MIN_CLIMBABLE_METRES = 3;

const TRUNK_STEP_METRES = 1.5;

const GOLDEN_ANGLE = 2.39996;

const TIP_RADIUS = 0.008;

export const capacityOf = (radius: number, wood: number): number => wood * CAPACITY_KG * radius ** 2.5;

export const radiusFor = (kilograms: number, wood: number): number => (kilograms / Math.max(1e-6, wood * CAPACITY_KG)) ** 0.4;

export const climbable = (species: Species | null, metres: number): species is Species => species !== null && species.layer === 'canopy' && species.wood > 0 && metres >= MIN_CLIMBABLE_METRES;

const baseRadius = (species: Species, metres: number): number => Math.max(0.03, metres * (species.habit === 'conifer' ? 0.012 : species.habit === 'palm' ? 0.007 : 0.016));

const jitter = (seed: number, tile: number, salt: number): number => hash2(tile, salt, seed) - 0.5;

export const buildTree = (seed: number, tile: number, x: number, y: number, species: Species, metres: number): TreeGraph => {
  const conifer = species.habit === 'conifer';
  const palm = species.habit === 'palm';
  const crownRadius = metres * (0.15 + 0.15 * species.crown) * (conifer ? 0.6 : 1);
  const crownBase = palm ? metres : metres * (conifer ? 0.15 : 0.55 - 0.25 * species.crown);
  const trunkTop = palm ? metres * 0.95 : conifer ? metres * 0.95 : crownBase + (metres - crownBase) * 0.6;
  const r0 = baseRadius(species, metres);
  const radiusAt = (z: number): number => Math.max(0.02, r0 * (1 - 0.7 * (z / metres)));
  const nodes: ClimbNode[] = [];
  const steps = Math.max(1, Math.ceil(trunkTop / TRUNK_STEP_METRES));
  for (let step = 0; step <= steps; step += 1) {
    const z = (trunkTop * step) / steps;
    nodes.push({ x, y, z, radius: radiusAt(z), parent: step === 0 ? -1 : step - 1, kind: 'trunk' });
  }
  if (palm) return { tile, x, y, species, metres, crownRadius, crownBase, nodes };

  const count = Math.min(conifer ? 20 : 14, conifer ? 6 + Math.floor(metres / 3) : 4 + Math.floor(metres / 4));
  for (let index = 0; index < count && nodes.length + 5 <= MAX_NODES; index += 1) {
    const t = (index + 0.5) / count;
    const z = crownBase + t * (metres * 0.92 - crownBase);
    const trunk = Math.min(steps, Math.max(1, Math.round((z / trunkTop) * steps)));
    const azimuth = index * GOLDEN_ANGLE + jitter(seed, tile, index) * 0.9;
    const length = Math.max(0.6, crownRadius * (conifer ? 1 - 0.85 * t : 1 - Math.abs(t - 0.35) * 1.2) * (0.85 + 0.3 * (hash2(tile, index + 99, seed))));
    const rise = conifer ? -0.08 : 0.15;
    const start = radiusAt(z) * 0.5 * (0.6 + 0.4 * (length / Math.max(0.6, crownRadius)));
    const dx = Math.cos(azimuth);
    const dy = Math.sin(azimuth);
    const base = nodes.length;
    nodes.push({ x: x + dx * radiusAt(z), y: y + dy * radiusAt(z), z, radius: Math.max(TIP_RADIUS, start), parent: trunk, kind: 'branch' });
    nodes.push({ x: x + dx * length * 0.5, y: y + dy * length * 0.5, z: z + rise * length * 0.4, radius: Math.max(TIP_RADIUS, start * 0.6), parent: base, kind: 'branch' });
    nodes.push({ x: x + dx * length, y: y + dy * length, z: z + rise * length, radius: Math.max(TIP_RADIUS, start * 0.25), parent: base + 1, kind: 'tip' });
    for (const side of [-1, 1]) {
      const fork = azimuth + side * 0.6;
      nodes.push({ x: x + Math.cos(fork) * length * 0.85, y: y + Math.sin(fork) * length * 0.85, z: z + rise * length * 0.9, radius: Math.max(TIP_RADIUS, start * 0.18), parent: base + 1, kind: 'tip' });
    }
  }
  return { tile, x, y, species, metres, crownRadius, crownBase, nodes };
};
