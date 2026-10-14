import type { NodeEditor } from 'rete';
import type { EngineBridge } from './EngineBridge.ts';
import { SOURCE_CATALOG } from './nodeCatalog.ts';
import type { Schemes } from './schemes.ts';

const LAYOUT: Record<string, { x: number; y: number }> = {
  earth: { x: -330, y: -210 },
  water: { x: 60, y: -210 },
  fire: { x: -330, y: 70 },
  air: { x: 60, y: 70 },
};

/** The canvas opens on the four elements and nothing else; the player builds the rest. */
export async function buildStartingGraph(
  _editor: NodeEditor<Schemes>,
  bridge: EngineBridge,
): Promise<void> {
  for (const entry of SOURCE_CATALOG) {
    await bridge.createNode({
      id: entry.key,
      label: entry.label,
      source: { channel: entry.channel, resource: entry.resource, rate: 1 },
      position: LAYOUT[entry.key] ?? { x: 0, y: 0 },
    });
  }
}
