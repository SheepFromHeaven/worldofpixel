import { blocksOf, processBuilding } from './buildings.ts';
import { assignJob, collectClaims, findJob, stepCarrier } from './carriers.ts';
import { hashString } from './rng.ts';
import { CarrierState } from './types.ts';
import type { Settlement, TickEvent, TickReport } from './types.ts';
import type { GameWorld } from './world.ts';

/**
 * The settlement clock. Order is fixed and every collection iterates in insertion order, so the
 * same world seed replays identically — the levels in `cli/` assert exact counts at exact ticks.
 *
 * 1. Work    — every building runs its own interior: belts step, combines craft.
 * 2. Dispatch— idle carriers claim a job: a haul, reserving one unit of supply and one slot of
 *              hopper, or a shift at a land work nobody is on.
 * 3. Walk    — carriers advance along their current leg, pick up or drop off on arrival, and
 *              anyone inside a land work draws the next unit of their batch out of the ground.
 *
 * Dispatch sits between the two so a carrier claims against this tick's production, and the whole
 * pass sees one consistent set of claims: a job taken earlier in the pass is visible to the next
 * carrier because claims are recomputed from the carriers themselves, not cached across the loop.
 */
export class LogisticsEngine {
  tickCount = 0;

  constructor(readonly world: GameWorld) {}

  tick(): TickReport {
    this.tickCount += 1;
    const events: TickEvent[] = [];

    for (const settlement of this.world.settlements.values()) {
      this.tickSettlement(settlement, events);
    }

    return { tick: this.tickCount, events };
  }

  run(ticks: number, onTick?: (report: TickReport) => void): void {
    for (let i = 0; i < ticks; i += 1) {
      const report = this.tick();
      onTick?.(report);
    }
  }

  private tickSettlement(settlement: Settlement, events: TickEvent[]): void {
    const tick = this.tickCount;

    // Who is inside working a land work, from the carriers themselves — the building keeps no
    // record of it, so there is nothing to fall out of step with the villager who is there.
    const manned = new Set<string>();
    for (const carrier of settlement.carriers.values()) {
      if (carrier.state === CarrierState.Working) manned.add(carrier.atId);
    }

    for (const building of settlement.buildings.values()) {
      const outcome = processBuilding(building, tick, manned.has(building.id));
      for (const item of outcome.produced) {
        events.push({ tick, kind: 'produced', buildingId: building.id, item });
      }
      for (const entry of outcome.delivered) {
        events.push({
          tick,
          kind: 'delivered',
          buildingId: building.id,
          item: entry.item,
          detail: String(entry.amount),
        });
      }
    }

    for (const carrier of settlement.carriers.values()) {
      if (carrier.state !== CarrierState.Idle || carrier.job) continue;
      const job = findJob(settlement, carrier, collectClaims(settlement));
      if (job) assignJob(settlement, carrier, job);
    }

    for (const carrier of settlement.carriers.values()) {
      events.push(...stepCarrier(settlement, carrier, tick));
    }
  }

  /** A fingerprint of the whole simulation state — two identical runs must agree on it. */
  traceHash(): number {
    const parts: string[] = [String(this.tickCount)];

    for (const settlement of this.world.settlements.values()) {
      for (const building of settlement.buildings.values()) {
        const squares = blocksOf(building)
          .map(({ state }) => {
            const held = state.held;
            const hoppers = [...state.hoppers.values()]
              .map((hopper) => `${hopper.item}=${hopper.amount}`)
              .join(',');
            return `${held ? `${held.item}:${held.amount}` : '-'}/${state.progress}/${state.cooldown}/${hoppers}`;
          })
          .join(' ');
        parts.push(
          `${building.id}|${building.state}|${building.clearing?.done ?? '-'}|${squares}` +
            `|${[...building.delivered.entries()].map(([item, n]) => `${item}=${n}`).join(',')}`,
        );
      }
      for (const carrier of settlement.carriers.values()) {
        parts.push(
          `${carrier.id}|${carrier.state}|${carrier.carryingItem ?? '-'}|${carrier.pathId ?? '-'}` +
            `|${carrier.progress.toFixed(6)}|${carrier.atId}|${carrier.left}|${carrier.handling}`,
        );
      }
    }

    return hashString(parts.join(';'));
  }
}
