import { useEffect } from 'react';
import { Channel } from '../../engine/types.js';
import { getBridge } from '../bridgeRef.js';
import { menuStore, useMenu, type MenuState } from '../menuStore.js';
import { SOURCE_CATALOG } from '../nodeCatalog.js';
import { useNodeVisual } from '../simStore.js';

interface Item {
  label: string;
  run: () => void;
  danger?: boolean;
}

function rootItems(menu: MenuState): Item[] {
  const bridge = getBridge();
  if (!bridge) return [];

  const items: Item[] = [
    {
      label: 'Combine Node',
      run: () => {
        const id = bridge.nextNodeId();
        void bridge.createNode({
          id,
          label: `Combine Node #${id.split('-')[1] ?? ''}`,
          inputs: [{ channel: Channel.Solid }, { channel: Channel.Fluid }],
          bufferCapacity: 12,
          position: menu.area,
        });
      },
    },
  ];

  items.push({
    label: 'World (delivery point)',
    run: () => {
      void bridge.createNode({
        id: bridge.nextNodeId('world'),
        label: 'World',
        sink: true,
        position: menu.area,
      });
    },
  });

  for (const entry of SOURCE_CATALOG) {
    items.push({
      label: entry.label,
      run: () => {
        void bridge.createNode({
          id: bridge.nextNodeId(entry.key),
          label: entry.label,
          source: { channel: entry.channel, resource: entry.resource, rate: 1 },
          position: menu.area,
        });
      },
    });
  }

  return items;
}

function NodeItems({ id }: { id: string }) {
  const visual = useNodeVisual(id);
  const bridge = getBridge();

  return (
    <>
      <button
        className="ec-menu-item"
        onClick={() => {
          void bridge?.toggleNode(id);
          menuStore.close();
        }}
      >
        {visual.enabled ? 'Switch off' : 'Switch on'}
      </button>
      <button
        className="ec-menu-item ec-menu-danger"
        onClick={() => {
          void bridge?.removeNode(id);
          menuStore.close();
        }}
      >
        Remove node
      </button>
    </>
  );
}

export function ContextMenu() {
  const menu = useMenu();

  useEffect(() => {
    if (!menu) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') menuStore.close();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menu]);

  if (!menu) return null;

  const items =
    menu.target.kind === 'root'
      ? rootItems(menu)
      : menu.target.kind === 'connection'
        ? [
            {
              label: 'Remove pipe',
              danger: true,
              run: () => {
                const id = menu.target.kind === 'connection' ? menu.target.id : '';
                void getBridge()?.removeConnection(id);
              },
            },
          ]
        : [];

  return (
    <>
      <div className="ec-menu-backdrop" onPointerDown={() => menuStore.close()} />
      <div className="ec-menu" style={{ left: menu.screen.x, top: menu.screen.y }}>
        {menu.target.kind === 'root' && <div className="ec-menu-title">Add node</div>}
        {menu.target.kind === 'node' ? (
          <NodeItems id={menu.target.id} />
        ) : (
          items.map((item) => (
            <button
              key={item.label}
              className={item.danger ? 'ec-menu-item ec-menu-danger' : 'ec-menu-item'}
              onClick={() => {
                item.run();
                menuStore.close();
              }}
            >
              {item.label}
            </button>
          ))
        )}
      </div>
    </>
  );
}
