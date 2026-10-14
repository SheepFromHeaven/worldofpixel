import { Presets } from 'rete-react-plugin';
import { getBridge } from '../bridgeRef.ts';
import type { Schemes } from '../schemes.ts';
import { useConnectionVisual } from '../simStore.ts';
import { CHANNEL_COLORS } from '../theme.ts';

const { useConnection } = Presets.classic;

const MIN_PULSE_SECONDS = 0.25;
const MAX_PULSE_SECONDS = 2.5;

export function CustomConnection({ data }: { data: Schemes['Connection'] }) {
  const { path, start, end } = useConnection();
  const visual = useConnectionVisual(data.id);

  if (!path) return null;

  const color = visual.channel ? CHANNEL_COLORS[visual.channel] : '#475569';
  const flowing = visual.itemsPerSecond > 0.05;
  const duration = Math.min(
    MAX_PULSE_SECONDS,
    Math.max(MIN_PULSE_SECONDS, 4 / Math.max(visual.itemsPerSecond, 0.1)),
  );

  const remove = (event: React.MouseEvent | React.PointerEvent) => {
    event.stopPropagation();
    void getBridge()?.removeConnection(data.id);
  };

  return (
    <svg className="ec-connection">
      <path className="ec-cable-hit" d={path} />
      <path className="ec-cable" d={path} style={{ stroke: color }} />
      {flowing && (
        <path
          className="ec-cable-pulse"
          d={path}
          style={{ stroke: color, animationDuration: `${duration}s` }}
        />
      )}
      {start && end && (
        <g
          className="ec-cable-remove"
          transform={`translate(${(start.x + end.x) / 2}, ${(start.y + end.y) / 2})`}
          onPointerDown={remove}
        >
          <title>Remove pipe</title>
          <circle r="9" style={{ stroke: color }} />
          <path d="M -3.5 -3.5 L 3.5 3.5 M 3.5 -3.5 L -3.5 3.5" />
        </g>
      )}
    </svg>
  );
}
