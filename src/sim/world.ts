import type { Vec2 } from './geometry.ts';
import type { Design, DesignId, Settlement } from './types.ts';

export interface GameWorld {
  seed: number;
  settlements: Map<string, Settlement>;
  homeSettlementId: string | null;
  library: Map<DesignId, Design>;
  wear: Map<string, number>;
}

export function settlementNear(
  world: GameWorld,
  point: Vec2,
  reach: number,
): Settlement | undefined {
  let best: Settlement | undefined;
  let bestGap = reach;

  for (const settlement of world.settlements.values()) {
    const hearth = settlement.buildings.get(settlement.hearthId);
    if (!hearth) continue;
    const gap = Math.hypot(hearth.position.x - point.x, hearth.position.y - point.y);
    if (gap <= bestGap) {
      bestGap = gap;
      best = settlement;
    }
  }

  return best;
}
