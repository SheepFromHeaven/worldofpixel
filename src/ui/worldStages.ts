import { Resources } from '../engine/recipes.js';
import type { ResourceId } from '../engine/types.js';

export interface WorldStage {
  id: string;
  title: string;
  blurb: string;
  resource: ResourceId;
  needed: number;
  /** Everything after the rock needs a rock to sit on. */
  needsPlanet: boolean;
}

export const WORLD_STAGES: readonly WorldStage[] = [
  {
    id: 'rock',
    title: 'A bare rock',
    blurb: 'Dust gathers until it holds together as a world.',
    resource: Resources.Earth,
    needed: 10,
    needsPlanet: false,
  },
  {
    id: 'seas',
    title: 'Seas',
    blurb: 'Water pools in the low places.',
    resource: Resources.Water,
    needed: 10,
    needsPlanet: true,
  },
  {
    id: 'sky',
    title: 'A sky',
    blurb: 'Air wraps the rock in weather.',
    resource: Resources.Air,
    needed: 10,
    needsPlanet: true,
  },
  {
    id: 'volcanoes',
    title: 'Volcanoes',
    blurb: 'Fire finds its way back to the surface.',
    resource: Resources.Fire,
    needed: 8,
    needsPlanet: true,
  },
  {
    id: 'riverbeds',
    title: 'Riverbeds',
    blurb: 'Mud settles into channels across the land.',
    resource: Resources.Mud,
    needed: 8,
    needsPlanet: true,
  },
  {
    id: 'clouds',
    title: 'Clouds',
    blurb: 'Steam rises and hangs above the seas.',
    resource: Resources.Steam,
    needed: 6,
    needsPlanet: true,
  },
  {
    id: 'settlements',
    title: 'Settlements',
    blurb: 'Clay becomes walls, and someone moves in.',
    resource: Resources.ClayBlock,
    needed: 10,
    needsPlanet: true,
  },
];

export interface StageProgress {
  stage: WorldStage;
  have: number;
  unlocked: boolean;
  /** How far past the threshold, 0..1, used to grow a stage's detail. */
  depth: number;
}

export interface WorldState {
  hasPlanet: boolean;
  planetRadius: number;
  progress: StageProgress[];
  counts: Record<string, number>;
  next: StageProgress | null;
}

const MIN_RADIUS = 58;
const MAX_RADIUS = 118;

function countFor(have: number, needed: number, max: number): number {
  if (have < needed) return 0;
  return Math.max(1, Math.min(max, Math.floor(have / needed)));
}

export function evaluateWorld(totals: Map<ResourceId, number>): WorldState {
  const earth = totals.get(Resources.Earth) ?? 0;
  const rockStage = WORLD_STAGES[0]!;
  const hasPlanet = earth >= rockStage.needed;

  const progress: StageProgress[] = WORLD_STAGES.map((stage) => {
    const have = totals.get(stage.resource) ?? 0;
    const unlocked = have >= stage.needed && (!stage.needsPlanet || hasPlanet);
    return {
      stage,
      have,
      unlocked,
      depth: Math.min(1, have / (stage.needed * 4)),
    };
  });

  const counts: Record<string, number> = {
    seas: countFor(totals.get(Resources.Water) ?? 0, 10, 5),
    volcanoes: countFor(totals.get(Resources.Fire) ?? 0, 8, 4),
    riverbeds: countFor(totals.get(Resources.Mud) ?? 0, 8, 4),
    clouds: countFor(totals.get(Resources.Steam) ?? 0, 6, 5),
    settlements: countFor(totals.get(Resources.ClayBlock) ?? 0, 10, 6),
    sky: countFor(totals.get(Resources.Air) ?? 0, 10, 3),
  };

  if (!hasPlanet) {
    for (const key of Object.keys(counts)) counts[key] = 0;
  }

  return {
    hasPlanet,
    planetRadius: hasPlanet
      ? Math.min(MAX_RADIUS, MIN_RADIUS + Math.sqrt(earth) * 7)
      : MIN_RADIUS,
    progress,
    counts,
    next: progress.find((entry) => !entry.unlocked) ?? null,
  };
}

/** Dust motes shown before the rock forms; fewer remain as the planet pulls them in. */
export function dustMotes(earth: number, needed: number): number {
  const remaining = Math.max(0, needed - earth);
  return Math.max(4, Math.min(26, remaining * 2 + 4));
}
