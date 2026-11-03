import type { People } from '../people/api.ts';
import { DARK_GLOOM, EntityState } from '../people/api.ts';

export type AchievementId = 'fire' | 'idea' | 'night' | 'light';

export interface Achievement {
  id: AchievementId;
  title: string;
  reason: string;
  unlocks: readonly string[];
  quiet?: boolean;
  reached: (people: People, earned: Achievements) => boolean;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: 'fire',
    title: 'Fire',
    reason: 'Flint threw a spark, kindling took it, a branch caught: a flame that can be carried and kept.',
    unlocks: ['The fog pulls back from the camp', 'You can move the view and zoom out, while the fire stays in sight', 'You can zoom in closer'],
    reached: (people) => people.knowledge.hasDiscoveredFire,
  },
  {
    id: 'idea',
    title: 'An idea',
    reason: 'Two things found side by side suggested a third.',
    unlocks: ['The mind'],
    quiet: true,
    reached: (people) => (people.mind?.ripe().length ?? 0) > 0,
  },
  {
    id: 'night',
    title: 'Night',
    reason: 'The dark came down for the first time.',
    unlocks: [],
    quiet: true,
    reached: (people) => darkest(people) > DARK_GLOOM,
  },
  {
    id: 'light',
    title: 'The light is back!',
    reason: 'The first night is over, and the sun came up again.',
    unlocks: ['The day dial: how far the day has turned'],
    reached: (people, earned) => earned.has('night') && darkest(people) < DAWN_GLOOM,
  },
];

const DAWN_GLOOM = 0.15;

function darkest(people: People): number {
  let most = -1;
  for (let person = 0; person < people.count; person += 1) {
    if (people.state[person] === EntityState.Dead) continue;
    most = Math.max(most, people.gloom[person]!);
  }
  return most < 0 ? DAWN_GLOOM : most;
}

type Listener = (achievement: Achievement) => void;

export class Achievements {
  private readonly earned: AchievementId[] = [];
  private readonly listeners = new Set<Listener>();

  has(id: AchievementId): boolean {
    return this.earned.includes(id);
  }

  get ids(): readonly AchievementId[] {
    return this.earned;
  }

  restore(ids: readonly string[]): void {
    this.earned.length = 0;
    for (const id of ids) if (ACHIEVEMENTS.some((candidate) => candidate.id === id)) this.earned.push(id as AchievementId);
  }

  get count(): number {
    return this.earned.length;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  earn(id: AchievementId): boolean {
    if (this.has(id)) return false;
    const achievement = ACHIEVEMENTS.find((candidate) => candidate.id === id);
    if (!achievement) return false;

    this.earned.push(id);
    for (const listener of this.listeners) listener(achievement);
    return true;
  }

  check(people: People): void {
    for (const achievement of ACHIEVEMENTS) if (!this.has(achievement.id) && achievement.reached(people, this)) this.earn(achievement.id);
  }
}
