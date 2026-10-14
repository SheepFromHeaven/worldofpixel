import type { ChannelSocket } from '../schemes.ts';
import { useNodeVisual } from '../simStore.ts';
import { CHANNEL_COLORS } from '../theme.ts';

export function CustomSocket({ data }: { data: ChannelSocket }) {
  const visual = useNodeVisual(data.nodeId);
  const ports = data.direction === 'input' ? visual.inputs : visual.outputs;
  const port = ports.find((candidate) => candidate.portId === data.portId);

  return (
    <div
      className="ec-socket"
      title={`${data.channel} ${data.direction} · ${port?.resource ?? 'empty'}`}
      style={{ background: CHANNEL_COLORS[data.channel] }}
    />
  );
}
