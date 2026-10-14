import type { ChannelSocket } from '../schemes.js';
import { useNodeVisual } from '../simStore.js';
import { CHANNEL_COLORS } from '../theme.js';

export function CustomSocket({ data }: { data: ChannelSocket }) {
  const visual = useNodeVisual(data.nodeId);
  const ports = data.direction === 'input' ? visual.inputs : visual.outputs;
  const port = ports.find((candidate) => candidate.portId === data.portId);

  return (
    <div
      className="ec-socket"
      title={`${data.channel} ${data.direction} · ${port?.resource ?? 'empty'}`}
      style={{
        background: CHANNEL_COLORS[data.channel],
        boxShadow: `0 0 8px ${CHANNEL_COLORS[data.channel]}66`,
      }}
    />
  );
}
