import { useState } from 'react';
import { ClassicPreset } from 'rete';
import { Drag, Presets, type RenderEmit } from 'rete-react-plugin';
import type { PortChannel, PortDirection } from '../../engine/types.js';
import { getBridge } from '../bridgeRef.js';
import type { ChannelSocket, CombineNodeRete, Schemes } from '../schemes.js';
import { useNodeVisual, type NodeVisual, type PortVisual } from '../simStore.js';
import { CHANNEL_COLORS, PORT_CHANNELS, STATUS_COLORS } from '../theme.js';
import { ElementIcon } from './ElementIcon.js';

const { RefSocket } = Presets.classic;

type Props = {
  data: CombineNodeRete & { width?: number; height?: number };
  emit: RenderEmit<Schemes>;
};

function statusLabel(visual: NodeVisual): string {
  switch (visual.status) {
    case 'disabled':
      return 'Offline';
    case 'crafting':
      return visual.recipeLabel ? `Active [${visual.recipeLabel}]` : 'Active';
    case 'blocked':
      return 'Backpressure';
    case 'overpressure':
      return 'Pressure Warning';
    case 'starved':
      return visual.recipeLabel ? `Waiting [${visual.recipeLabel}]` : 'Waiting';
    default:
      return visual.recipeLabel ? `Ready [${visual.recipeLabel}]` : 'Idle';
  }
}

function PortRow({
  port,
  socket,
  socketKey,
  side,
  nodeId,
  locked,
  emit,
}: {
  port: PortVisual | undefined;
  socket: ChannelSocket;
  socketKey: string;
  side: PortDirection;
  nodeId: string;
  locked: boolean;
  emit: RenderEmit<Schemes>;
}) {
  const fill = port && port.capacity > 0 ? port.fill / port.capacity : 0;
  const color = CHANNEL_COLORS[socket.channel];
  const socketEl = (
    <RefSocket
      name={`${side}-socket`}
      side={side}
      emit={emit}
      socketKey={socketKey}
      nodeId={nodeId}
      payload={socket}
    />
  );

  return (
    <div className={`ec-port ec-port-${side}`}>
      {side === 'input' && socketEl}
      <ElementIcon resource={port?.resource} color={color} />
      <div className="ec-port-body">
        <div className="ec-port-head">
          <span
            className="ec-port-label"
            style={{ color }}
            title={`${socket.channel} · ${port?.resource ?? 'empty'}`}
          >
            {port?.resource ?? socket.channel}
          </span>
          {side === 'output' ? (
            <span className="ec-port-rate">{port?.itemsPerSecond.toFixed(1) ?? '0.0'}/s</span>
          ) : (
            <span className="ec-port-rate">
              {port?.fill ?? 0}/{port?.capacity ?? 0}
            </span>
          )}
        </div>
        <div className="ec-port-gauge">
          <div
            className="ec-port-gauge-fill"
            style={{ width: `${Math.min(100, fill * 100)}%`, background: color }}
          />
        </div>
      </div>
      {side === 'output' && socketEl}
      {!locked && (
        <Drag.NoDrag>
          <button
            className="ec-port-remove"
            title={`Remove ${socket.channel} ${side}`}
            onClick={() => void getBridge()?.removePort(nodeId, side, socketKey)}
          >
            ×
          </button>
        </Drag.NoDrag>
      )}
    </div>
  );
}

export function CombineNodeUI({ data, emit }: Props) {
  const visual = useNodeVisual(data.id);
  const [channel, setChannel] = useState<PortChannel>(PORT_CHANNELS[0]!);

  const inputs = Object.entries(data.inputs).filter(
    (entry): entry is [string, ClassicPreset.Input<ChannelSocket>] => Boolean(entry[1]),
  );
  const outputs = Object.entries(data.outputs).filter(
    (entry): entry is [string, ClassicPreset.Output<ChannelSocket>] => Boolean(entry[1]),
  );
  const byId = (ports: PortVisual[], id: string) => ports.find((port) => port.portId === id);

  const addPort = (side: PortDirection) => void getBridge()?.addPort(data.id, side, channel);

  return (
    <div
      className={`ec-node ec-status-${visual.status}`}
      style={{ width: data.width }}
      data-testid="node"
    >
      <header className="ec-node-head">
        <Drag.NoDrag>
          <button
            className={visual.enabled ? 'ec-power ec-power-on' : 'ec-power'}
            title={visual.enabled ? 'Switch node off' : 'Switch node on'}
            aria-pressed={visual.enabled}
            onClick={() => void getBridge()?.toggleNode(data.id)}
          >
            ⏻
          </button>
        </Drag.NoDrag>
        <span className="ec-node-title">{data.label}</span>
        <span className="ec-node-id">{data.id}</span>
        <Drag.NoDrag>
          <button
            className="ec-node-remove"
            title="Remove node"
            onClick={() => void getBridge()?.removeNode(data.id)}
          >
            ×
          </button>
        </Drag.NoDrag>
      </header>

      <div className="ec-node-status" style={{ color: STATUS_COLORS[visual.status] }}>
        <span className="ec-status-dot" style={{ background: STATUS_COLORS[visual.status] }} />
        {data.kind === 'sink'
          ? visual.status === 'crafting'
            ? 'Receiving'
            : 'Idle'
          : statusLabel(visual)}
        {data.kind === 'combine' && <span className="ec-node-heat">heat T{visual.heatTier}</span>}
      </div>

      <div className="ec-node-columns">
        <div className="ec-column">
          {inputs.map(([key, input]) => (
            <PortRow
              key={key}
              socketKey={key}
              side="input"
              nodeId={data.id}
              emit={emit}
              socket={input.socket}
              locked={data.locked}
              port={byId(visual.inputs, key)}
            />
          ))}
        </div>
        <div className="ec-column ec-column-out">
          {outputs.length === 0 && data.kind === 'combine' && (
            <div className="ec-port-empty">no recipe</div>
          )}
          {data.kind === 'sink' && <div className="ec-port-empty">out into the world</div>}
          {outputs.map(([key, output]) => (
            <PortRow
              key={key}
              socketKey={key}
              side="output"
              nodeId={data.id}
              emit={emit}
              socket={output.socket}
              locked
              port={byId(visual.outputs, key)}
            />
          ))}
        </div>
      </div>

      <footer className="ec-node-foot">
        <div className="ec-buffer">
          <div
            className="ec-buffer-fill"
            style={{
              width: `${visual.bufferCapacity ? (visual.bufferUsed / visual.bufferCapacity) * 100 : 0}%`,
              background: STATUS_COLORS[visual.status],
            }}
          />
          <span className="ec-buffer-label">
            buffer {visual.bufferUsed}/{visual.bufferCapacity}
          </span>
        </div>
        {data.kind === 'sink' ? (
          <div className="ec-port-locked">{visual.delivered} delivered</div>
        ) : data.kind === 'source' ? (
          <div className="ec-port-locked">fixed ports</div>
        ) : (
          <Drag.NoDrag>
            <div className="ec-port-tools">
              <select
                value={channel}
                onChange={(event) => setChannel(event.target.value as PortChannel)}
                style={{ color: CHANNEL_COLORS[channel] }}
              >
                {PORT_CHANNELS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <button onClick={() => addPort('input')}>+ Input</button>
            </div>
          </Drag.NoDrag>
        )}
      </footer>

      {visual.warning && <div className="ec-node-warning">{visual.warning}</div>}
    </div>
  );
}
