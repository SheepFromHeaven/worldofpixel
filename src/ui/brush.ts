import { brushOf } from '../modules/client.ts';
import type { Command } from '../sim/simulation.ts';
import type { Game } from './game.ts';

export function arm(game: Game, command: Command): void {
  const kind = typeof command.brush === 'string' ? brushOf(command.brush) : undefined;
  const brush = kind ? kind.arm({ world: game.world, send: (sent) => game.link.send(sent) }, command) : null;
  if (!brush) return;
  game.brush = brush;
  game.tool = null;
  game.publish();
}

export function disarm(game: Game): boolean {
  if (!game.brush) return false;
  game.brush = null;
  game.publish();
  return true;
}
