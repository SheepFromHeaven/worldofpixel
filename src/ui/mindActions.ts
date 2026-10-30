import { Kind, NEURONS, neuronIndex } from '../modules/mind/api.ts';
import type { Game } from './game.ts';

export function mindKnows(game: Game, id: string): boolean {
  if (game.mode === 'discover') return true;
  if (id === 'found') return game.replica.mind?.neurons.some((neuron) => NEURONS[neuron.index]?.kind === Kind.Thing) ?? false;
  const at = neuronIndex(id);
  return game.replica.mind?.neurons.some((neuron) => neuron.index === at) ?? false;
}

export function pick(game: Game, parent: number): void {
  game.link.send({ kind: 'pick', parent });
}

export function dropIdea(game: Game): void {
  game.link.send({ kind: 'drop' });
}

export function forget(game: Game, id: number): void {
  game.link.send({ kind: 'forget', id });
}

export function toggleMind(game: Game): void {
  game.mindOpen = !game.mindOpen;
  if (game.mindOpen) for (const result of ripe(game)) game.noticed.add(result);
  game.publish();
}

export function ripe(game: Game): readonly number[] {
  return game.replica.mind?.ripe ?? [];
}

export function newIdea(game: Game): number | null {
  return ripe(game).find((result) => !game.noticed.has(result)) ?? null;
}

export function wondering(game: Game, person: number): boolean {
  const id = game.people.wonder[person]!;
  return id >= 0 && (game.replica.mind?.hypotheses.some((hypothesis) => hypothesis.id === id && !hypothesis.order) ?? false);
}
