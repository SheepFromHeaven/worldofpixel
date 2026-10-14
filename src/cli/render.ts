import { sortedEntries, totalOf } from '../engine/buffers.ts';
import { isProductKey, parseProductKey, SimulationEngine } from '../engine/engine.ts';
import type { CombineNode, TickReport } from '../engine/types.ts';
import { parseStackKey } from '../engine/types.ts';

function describeBuffer(node: CombineNode): string {
  const entries = [...node.internalBuffer.entries()].filter(([, amount]) => amount > 0);
  if (entries.length === 0) return 'empty';
  return entries
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, amount]) => {
      const parsed = isProductKey(key) ? parseProductKey(key) : parseStackKey(key);
      const marker = isProductKey(key) ? '*' : '';
      return `${marker}${parsed.resource}:${amount}`;
    })
    .join(' ');
}

function describePorts(node: CombineNode): string {
  const ports = [...node.outputs.values()].map((port) => {
    const contents = sortedEntries(port.buffer.contents)
      .map(([resource, amount]) => `${resource}:${amount}`)
      .join(' ');
    const flag = port.blocked ? ' [BLOCKED]' : '';
    return `${port.channel}(${contents || '-'}/${port.buffer.capacity})${flag}`;
  });
  return ports.join(' ') || 'none';
}

export function renderTick(engine: SimulationEngine, report: TickReport): string {
  const lines: string[] = [`  tick ${String(report.tick).padStart(2, '0')}`];

  for (const node of engine.nodes.values()) {
    const heat = node.source ? '' : ` heat=T${node.heatTier}`;
    const recipe = node.lastRecipeId ? ` recipe=${node.lastRecipeId}` : '';
    lines.push(
      `    ${node.label.padEnd(14)} ${node.status.padEnd(12)}${heat}${recipe}` +
        ` | out ${describePorts(node)}` +
        ` | buf ${describeBuffer(node)} (${totalOf(node.internalBuffer)}/${node.bufferCapacity})`,
    );
  }

  for (const warning of report.warnings) {
    lines.push(`    ! ${warning.nodeId}: ${warning.message}`);
  }

  return lines.join('\n');
}

export function header(title: string): string {
  return `\n${'='.repeat(78)}\n${title}\n${'='.repeat(78)}`;
}

export function verdict(label: string, passed: boolean, detail: string): string {
  return `  ${passed ? 'PASS' : 'FAIL'}  ${label} — ${detail}`;
}
