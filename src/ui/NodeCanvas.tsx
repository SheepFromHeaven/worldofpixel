import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { NodeEditor } from 'rete';
import { AreaExtensions, AreaPlugin } from 'rete-area-plugin';
import { ConnectionPlugin, Presets as ConnectionPresets } from 'rete-connection-plugin';
import { Presets, ReactPlugin, useRete } from 'rete-react-plugin';
import { setBridge } from './bridgeRef.ts';
import { ContextMenu } from './components/ContextMenu.tsx';
import { ControlBar, type CanvasView } from './components/ControlBar.tsx';
import { WorldView } from './components/WorldView.tsx';
import { SketchAssets } from './components/SketchAssets.tsx';
import { CombineNodeUI } from './components/CombineNodeUI.tsx';
import { CustomConnection } from './components/CustomConnection.tsx';
import { CustomSocket } from './components/CustomSocket.tsx';
import { buildStartingGraph } from './startingGraph.ts';
import { EngineBridge } from './EngineBridge.ts';
import { menuStore } from './menuStore.ts';
import type { AreaExtra, Schemes } from './schemes.ts';
import { simStore } from './simStore.ts';
import { RectSocketPosition } from './socketPosition.ts';

export interface Canvas {
  editor: NodeEditor<Schemes>;
  area: AreaPlugin<Schemes, AreaExtra>;
  bridge: EngineBridge;
  destroy(): void;
}

export async function createCanvas(container: HTMLElement): Promise<Canvas> {
  const editor = new NodeEditor<Schemes>();
  const area = new AreaPlugin<Schemes, AreaExtra>(container);
  const connection = new ConnectionPlugin<Schemes, AreaExtra>();
  const render = new ReactPlugin<Schemes, AreaExtra>({ createRoot });

  render.addPreset(
    Presets.classic.setup({
      socketPositionWatcher: new RectSocketPosition(),
      customize: {
        node: () => CombineNodeUI,
        socket: () => CustomSocket,
        connection: () => CustomConnection,
      },
    }),
  );
  connection.addPreset(ConnectionPresets.classic.setup());

  editor.use(area);
  area.use(connection);
  area.use(render);

  area.addPipe((context) => {
    if (context.type !== 'contextmenu') return context;

    const { event, context: target } = context.data;
    event.preventDefault();

    const rect = container.getBoundingClientRect();
    const { x: tx, y: ty, k } = area.area.transform;
    const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top };

    menuStore.open({
      screen,
      area: { x: (screen.x - tx) / k, y: (screen.y - ty) / k },
      target:
        target === 'root'
          ? { kind: 'root' }
          : 'source' in target
            ? { kind: 'connection', id: target.id }
            : { kind: 'node', id: target.id },
    });
    return;
  });

  AreaExtensions.selectableNodes(area, AreaExtensions.selector(), {
    accumulating: AreaExtensions.accumulateOnCtrl(),
  });
  AreaExtensions.simpleNodesOrder(area);

  const bridge = new EngineBridge(editor, area, simStore);
  bridge.attach();
  setBridge(bridge);

  await buildStartingGraph(editor, bridge);
  bridge.publish(null);
  await AreaExtensions.zoomAt(area, editor.getNodes());

  return {
    editor,
    area,
    bridge,
    destroy() {
      bridge.destroy();
      setBridge(null);
      area.destroy();
    },
  };
}

export function NodeCanvas() {
  const [ref, canvas] = useRete(createCanvas);
  const [view, setView] = useState<CanvasView>('workshop');

  return (
    <div className="ec-shell">
      <ControlBar bridge={canvas?.bridge ?? null} view={view} onView={setView} />
      {/* The editor stays mounted behind the world sheet: unmounting it would tear
          down the rete area and lose the player's graph. */}
      <div className="ec-stage">
        <div ref={ref} className="ec-canvas" />
        <ContextMenu />
        <WorldView active={view === 'world'} />
      </div>
      <SketchAssets />
    </div>
  );
}
