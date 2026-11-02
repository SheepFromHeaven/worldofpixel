import { BUILDABLES } from '../../content/buildables.ts';
import { TURNS } from '../../content/stations/definition.ts';
import { NOWHERE } from '../../sim/grid.ts';
import type { Brush, BrushKind } from '../clientSlots.ts';

export const structureBrush: BrushKind = {
  id: 'structure',
  arm(host, args) {
    const station = BUILDABLES.find((def) => def.key === args.station);
    if (!station) return null;
    const command = typeof args.place === 'string' ? args.place : null;
    let turn = 0;
    const brush: Brush = {
      turn: () => {
        turn = (turn + 1) % TURNS;
      },
      marks: (tile) => (tile === NOWHERE ? [] : host.world.structures.fit(station, tile, turn)),
      ghost: (tile) => {
        const cells = brush.marks(tile).filter((cell) => cell.tile !== NOWHERE).map((cell) => host.world.grid.centre(cell.tile));
        if (cells.length === 0) return undefined;
        return {
          sprite: station.key === 'campfire' ? 'campfire.base' : station.sprite,
          x: cells.reduce((sum, cell) => sum + cell.x, 0) / cells.length,
          y: cells.reduce((sum, cell) => sum + cell.y, 0) / cells.length,
        };
      },
      note: (tile) => {
        const refused = brush.marks(tile).find((cell) => cell.reason !== null)?.reason;
        return refused ? { text: `${station.name}: ${refused}`, refused: true } : { text: `${station.name}  R turns`, refused: false };
      },
      apply: (tile) => {
        if (tile === NOWHERE || !host.world.structures.fits(station, tile, turn)) return false;
        host.send(command ? { kind: command, tile } : { kind: 'blueprint', station: station.key, tile, turn });
        return true;
      },
    };
    return brush;
  },
};
