import { blocksOf } from '../sim/buildings.ts';
import { BlockKind } from '../sim/types.ts';
import type { Building, Carrier, Settlement, TickReport } from '../sim/types.ts';

function describeBuilding(building: Building): string {
  const waiting: string[] = [];
  const ready: string[] = [];
  const bins = new Map<string, number>();

  for (const { block, state } of blocksOf(building)) {
    const held = state.held;
    if (block.kind === BlockKind.Input && held) waiting.push(`${held.item}:${held.amount}`);
    if (block.kind === BlockKind.Output && held) ready.push(`${held.item}:${held.amount}`);
    if (block.kind === BlockKind.Storage && held && held.amount > 0) {
      bins.set(held.item, (bins.get(held.item) ?? 0) + held.amount);
    }
    for (const hopper of state.hoppers.values()) waiting.push(`${hopper.item}:${hopper.amount}`);
  }

  const stored = [...bins.entries()].map(([item, n]) => `${item}×${n}`).join(' ');

  return (
    `    ${building.design.label.padEnd(16)} ${building.state.padEnd(8)}` +
    ` | in ${(waiting.join(' ') || '-').padEnd(26)} | out ${(ready.join(' ') || '-').padEnd(14)}` +
    `${stored ? ` | store ${stored}` : ''}`
  );
}

function describeCarrier(carrier: Carrier): string {
  const load = carrier.carryingItem ?? '—';
  const leg = carrier.pathId ? `${carrier.pathId.split('/').pop()} ${carrier.progress.toFixed(2)}` : `at ${carrier.atId.split('/').pop()}`;
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
