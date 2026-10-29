import type { People } from './people/people.ts';

export type AchievementId = 'fire';

export interface Achievement {
  id: AchievementId;
  title: string;
  reason: string;
  unlocks: readonly string[];
  reached: (people: People) => boolean;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: 'fire',
    title: 'Fire',
    reason: 'Flint threw a spark, kindling took it, a branch caught: a flame that can be carried and kept.',
    unlocks: ['The fog pulls back from the camp', 'You can move the view and zoom out, while the fire stays in sight', 'You can zoom in closer'],
    reached: (people) => people.knowledge.hasDiscoveredFire,
  },
];

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
    for (const achievement of ACHIEVEMENTS) if (!this.has(achievement.id) && achievement.reached(people)) this.earn(achievement.id);
  }
}
