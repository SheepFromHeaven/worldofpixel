import { Presets } from 'rete-react-plugin';
import { getBridge } from '../bridgeRef.js';
import type { Schemes } from '../schemes.js';
import { useConnectionVisual } from '../simStore.js';
import { CHANNEL_COLORS } from '../theme.js';
import { iconIdFor } from './ElementIcon.js';

const { useConnection } = Presets.classic;

const MIN_TRAVEL_SECONDS = 1;
const MAX_TRAVEL_SECONDS = 6;
const MAX_RIDERS = 4;

/** Quantised so a drifting flow average doesn't restart the SMIL animation every tick. */
function travelSeconds(itemsPerSecond: number): number {
  const raw = 12 / Math.max(itemsPerSecond, 0.1);
  const clamped = Math.min(MAX_TRAVEL_SECONDS, Math.max(MIN_TRAVEL_SECONDS, raw));
  return Math.round(clamped * 2) / 2;
}

export function CustomConnection({ data }: { data: Schemes['Connection'] }) {
  const { path, start, end } = useConnection();
  const visual = useConnectionVisual(data.id);

  if (!path) return null;

  const color = visual.channel ? CHANNEL_COLORS[visual.channel] : '#7D7466';
  const flowing = visual.itemsPerSecond > 0.05;
  const duration = travelSeconds(visual.itemsPerSecond);
  const riders = flowing
    ? Math.min(MAX_RIDERS, Math.max(1, Math.round(visual.itemsPerSecond / 2)))
    : 0;
  const pathId = `ec-path-${data.id}`;

  const remove = (event: React.PointerEvent) => {
    event.stopPropagation();
    void getBridge()?.removeConnection(data.id);
  };

  return (
    <svg className="ec-connection">
      <path className="ec-cable-hit" d={path} />
      <path id={pathId} className="ec-cable" d={path} style={{ stroke: color }} />
      <path className="ec-cable-grain" d={path} style={{ stroke: color }} />

      {Array.from({ length: riders }, (_, index) => (
        <g key={`${duration}-${riders}-${index}`} className="ec-rider" style={{ color }}>
          <use href={`#${iconIdFor(visual.resource)}`} x="-9" y="-9" width="18" height="18" />
          <animateMotion
            dur={`${duration}s`}
            begin={`-${((index * duration) / riders).toFixed(2)}s`}
            repeatCount="indefinite"
          >
            <mpath href={`#${pathId}`} />
          </animateMotion>
        </g>
      ))}

      {start && end && (
        <g
          className="ec-cable-remove"
          transform={`translate(${(start.x + end.x) / 2}, ${(start.y + end.y) / 2})`}
          onPointerDown={remove}
        >
          <title>Remove pipe</title>
          <circle r="10" />
          <path d="M -3.6 -3.4 C -1.4 -1.2, 1.4 1.4, 3.6 3.6 M 3.4 -3.6 C 1.2 -1.4, -1.4 1.2, -3.6 3.4" />
        </g>
      )}
    </svg>
  );
}
