import { labelOf } from '../sim/buildings.ts';
import { totalHeld } from '../sim/stock.ts';
import type { Building, Carrier, Settlement, TickReport } from '../sim/types.ts';

function describeBuilding(building: Building): string {
  const standing = [...building.stock.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([item, amount]) => `${item}×${amount}`)
    .join(' ');

  return (
    `    ${labelOf(building).padEnd(16)} ${building.state.padEnd(8)}` +
    ` | holding ${(standing || '-').padEnd(40)}` +
    ` | ${totalHeld(building)} in all`
  );
}

function describeCarrier(carrier: Carrier): string {
  const load = carrier.carryingItem ?? '—';
  const leg = carrier.trail.length > 0 ? `${carrier.trail.length} steps to go` : `at ${carrier.atId.split('/').pop()}`;
  return `    ${carrier.id.split('/').pop()?.padEnd(16)} ${carrier.state.padEnd(16)} carrying ${String(load).padEnd(8)} ${leg}`;
}

export function renderTick(settlement: Settlement, report: TickReport): string {
  const lines = [`  tick ${String(report.tick).padStart(4, '0')}`];
  for (const building of settlement.buildings.values()) lines.push(describeBuilding(building));
  for (const carrier of settlement.carriers.values()) lines.push(describeCarrier(carrier));
  for (const event of report.events) {
    if (event.kind === 'produced') continue;
    lines.push(`    · ${event.kind} ${event.item ?? ''} ${event.detail ?? ''}`.trimEnd());
  }
  return lines.join('\n');
}

export function header(title: string): string {
  return `\n${'='.repeat(78)}\n${title}\n${'='.repeat(78)}`;
}

export function verdict(label: string, passed: boolean, detail: string): string {
  return `  ${passed ? 'PASS' : 'FAIL'}  ${label} — ${detail}`;
}
