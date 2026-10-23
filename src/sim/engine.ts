import { stations } from './area.ts';
import { processBuilding } from './buildings.ts';
import { assignJob, collectClaims, findJob, stepCarrier } from './carriers.ts';
import { WEAR_FADE_TICKS, fadeWear } from './footpaths.ts';
import { drainNeeds, needJob, recordDay } from './needs.ts';
import { runStation } from './process.ts';
import { hashString } from './rng.ts';
import type { Settlement, TickEvent, TickReport } from './types.ts';
import { CarrierState } from './types.ts';
import type { GameWorld } from './world.ts';

export class LogisticsEngine {
  tickCount = 0;

  constructor(readonly world: GameWorld) {}

  tick(): TickReport {
    this.tickCount += 1;
    const events: TickEvent[] = [];

    for (const settlement of this.world.settlements.values()) {
      this.tickSettlement(settlement, events);
    }

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

    const manned = new Set<string>();
    for (const carrier of settlement.carriers.values()) {
      if (carrier.state !== CarrierState.Working) continue;
      manned.add(carrier.atId);
      manned.add(`${carrier.atId}#${carrier.job?.slot ?? 0}`);
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

      for (const { slot } of stations(building)) {
        for (const made of runStation(building, slot, settlement.book, manned.has(`${building.id}#${slot}`)).produced) {
          events.push({ tick, kind: 'produced', buildingId: building.id, item: made.item });
        }
      }
    }

    for (const carrier of settlement.carriers.values()) {
      drainNeeds(carrier);
      if (carrier.state !== CarrierState.Idle || carrier.job) continue;
      const need = needJob(this.world, settlement, carrier);
      if (need && assignJob(this.world, settlement, carrier, need)) continue;
      const job = findJob(settlement, carrier, collectClaims(settlement));
      if (job) assignJob(this.world, settlement, carrier, job);
    }

    for (const carrier of settlement.carriers.values()) {
      events.push(...stepCarrier(this.world, settlement, carrier, tick));
    }
    recordDay(settlement, tick);
  }

  traceHash(): number {
    const parts: string[] = [String(this.tickCount)];

    for (const settlement of this.world.settlements.values()) {
      for (const building of settlement.buildings.values()) {
        const stock = [...building.stock].map(([item, amount]) => `${item}=${amount}`).join(',');
        const slots = building.slots
          .map((slot) => {
            const station = slot.station;
            return `${slot.design?.id ?? '-'}${station ? `:${station.running?.recipeId ?? '-'}/${station.running?.progress ?? 0}/${station.changeover}/${station.last ?? '-'}` : ''}`;
          })
          .join(';');
        parts.push(
          `${building.id}|${building.state}|${building.clearing?.done ?? '-'}|${stock}` +
            `|${[...building.delivered.entries()].map(([item, n]) => `${item}=${n}`).join(',')}` +
            `|${building.stage}/${building.raising?.done ?? '-'}|${slots}|${building.queue.map((line) => `${line.recipeId}@${line.slot}`).join('>')}`,
        );
      }
      for (const carrier of settlement.carriers.values()) {
        parts.push(
          `${carrier.id}|${carrier.state}|${carrier.carryingItem ?? '-'}|${carrier.trail.length}` +
            `|${carrier.position.x.toFixed(6)},${carrier.position.y.toFixed(6)}|${carrier.atId}|${carrier.left}|${carrier.handling}` +
            `|${carrier.needs.thirst.toFixed(6)},${carrier.needs.hunger.toFixed(6)},${carrier.needs.rest.toFixed(6)}|${carrier.away ?? '-'}`,
        );
      }

      for (const recipe of settlement.book.recipes.values()) {
        parts.push(
          recipe.trace() +
            `|${recipe.ticks}`,
        );
      }
      for (const row of settlement.book.rows) {
        parts.push(`${row.recipeId}|${row.param}|${row.value}|${row.outcome}`);
      }
      parts.push(settlement.book.instruments.join(','));
      for (const named of settlement.book.named) parts.push(JSON.stringify(named));
    }

    parts.push([...this.world.wear].map(([id, steps]) => `${id}=${steps}`).join(','));
    return hashString(parts.join(';'));
  }
}
