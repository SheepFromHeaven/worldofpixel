import { processBuilding } from './buildings.ts';
import { assignJob, collectClaims, findJob, stepCarrier } from './carriers.ts';
import { WEAR_FADE_TICKS, fadeWear } from './footpaths.ts';
import { drainNeeds, needJob, recordDay } from './needs.ts';
import { runRig } from './process.ts';
import { hashString } from './rng.ts';
import { CarrierState } from './types.ts';
import type { Settlement, TickEvent, TickReport } from './types.ts';
import type { GameWorld } from './world.ts';

/**
 * The settlement clock. Order is fixed and every collection iterates in insertion order, so the
 * same world seed replays identically — the levels in `cli/` assert exact counts at exact ticks.
 *
 * 1. Work    — every building says what it is doing, and a rig standing on the floor works
 *              down its queue (`process.ts`).
 * 2. Dispatch— every villager's needs run down; an idle one with a need down to its mark goes
 *              to see to it (`needs.ts`), and the rest claim a job: a haul, reserving one unit
 *              of supply and one slot of hopper, or a shift at a land work nobody is on.
 * 3. Walk    — carriers walk the ground, wearing it as they go, pick up or drop off on arrival,
 *              and anyone inside a land work draws the next unit of their batch out of the ground.
 * 4. Fade    — every so often the worn ground grows back a little.
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

    // Paths grow back where nobody walks (`footpaths.ts`).
    if (this.tickCount % WEAR_FADE_TICKS === 0) fadeWear(this.world);

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

      for (const made of runRig(building, settlement.book, manned.has(building.id)).produced) {
        events.push({ tick, kind: 'produced', buildingId: building.id, item: made.item });
      }
    }

    // A villager's own needs come before the town's work, and only between errands: a walk
    // already begun is finished, and a shift already started is worked to its end.
    for (const carrier of settlement.carriers.values()) {
      drainNeeds(carrier);
      if (carrier.state !== CarrierState.Idle || carrier.job) continue;
      const need = needJob(this.world, settlement, carrier);
      if (need && assignJob(this.world, settlement, carrier, need)) continue;
      const job = findJob(this.world, settlement, carrier, collectClaims(settlement));
      if (job) assignJob(this.world, settlement, carrier, job);
    }

    for (const carrier of settlement.carriers.values()) {
      events.push(...stepCarrier(this.world, settlement, carrier, tick));
    }
    recordDay(settlement, tick);
  }

  /** A fingerprint of the whole simulation state — two identical runs must agree on it. */
  traceHash(): number {
    const parts: string[] = [String(this.tickCount)];

    for (const settlement of this.world.settlements.values()) {
      for (const building of settlement.buildings.values()) {
        // In insertion order, which is itself state: a depleted line is deleted rather than
        // left at zero, so two towns holding the same goods hash the same and two that reached
        // them in a different order do not.
        const stock = [...building.stock].map(([item, amount]) => `${item}=${amount}`).join(',');
        const rig = building.rig;
        parts.push(
          `${building.id}|${building.state}|${building.clearing?.done ?? '-'}|${stock}` +
            `|${[...building.delivered.entries()].map(([item, n]) => `${item}=${n}`).join(',')}` +
            `|${rig ? `${rig.queue.join('>')}:${rig.running?.methodId ?? '-'}/${rig.running?.progress ?? 0}/${rig.changeover}/${rig.last ?? '-'}` : '-'}`,
        );
      }
      for (const carrier of settlement.carriers.values()) {
        parts.push(
          `${carrier.id}|${carrier.state}|${carrier.carryingItem ?? '-'}|${carrier.trail.length}` +
            `|${carrier.position.x.toFixed(6)},${carrier.position.y.toFixed(6)}|${carrier.atId}|${carrier.left}|${carrier.handling}` +
            `|${carrier.needs.thirst.toFixed(6)},${carrier.needs.hunger.toFixed(6)},${carrier.needs.rest.toFixed(6)}|${carrier.away ?? '-'}`,
        );
      }

      // The book is state and nothing derives it: a method's settings are exactly what two
      // runs could differ on. Left out, level 12 passed with the whole book deleted from the
      // save, which made its claim — the same world, going on tracing the same — vacuous.
      for (const method of settlement.book.methods.values()) {
        parts.push(
          `${method.id}|${method.run.charge}/${method.run.damper ?? '-'}/${method.run.fuel ?? '-'}` +
            `|${method.ticks}`,
        );
      }
      for (const row of settlement.book.rows) {
        parts.push(`${row.methodId}|${row.param}|${row.value}|${row.outcome}`);
      }
      // By what each technique *is*, not by `join` on an object: `Technique[]` stringified to
      // a row of `[object Object]`, so two towns that had named different things hashed the
      // same — which is the exact vacuousness the lines above this one were added to fix.
      parts.push(settlement.book.instruments.join(','));
      for (const named of settlement.book.named) parts.push(JSON.stringify(named));
    }

    // And the ground they have worn, which is as much the state of the world as they are.
    parts.push([...this.world.wear].map(([id, steps]) => `${id}=${steps}`).join(','));
    return hashString(parts.join(';'));
  }
}
