import { DAY_TICKS } from '../sim/needs.ts';
import type { Tool } from './game.ts';
import { PixelText } from './pixel/Pixel.tsx';
import { PixelTile } from './pixel/Tile.tsx';
import type { BarView, ClockView, StripView } from './shellView.ts';

export function Strip({
  strip,
  onDice,
  onOpen,
}: {
  strip: StripView;
  onDice: () => void;
  onOpen: () => void;
}): React.JSX.Element {
  return (
    <header className="se-board se-strip">
      <button type="button" className="se-strip-main" onClick={onOpen} title="Who is here, and how their day goes">
        <PixelText>{strip.town ? `${strip.people} people  ${strip.spare}h spare` : `seed ${strip.seed}`}</PixelText>
        <span className={strip.trouble ? 'se-strip-warn' : 'se-strip-sub'}>
          <PixelText>{strip.town ? (strip.trouble ?? `seed ${strip.seed}`) : 'no town yet'}</PixelText>
        </span>
      </button>
      <PixelTile icon="dice" title="Roll a fresh world" onClick={onDice} />
    </header>
  );
}

const SPEEDS = [1, 2, 4] as const;

export function Clock({
  clock,
  onPlaying,
  onSpeed,
}: {
  clock: ClockView;
  onPlaying: (playing: boolean) => void;
  onSpeed: (speed: number) => void;
}): React.JSX.Element {
  const day = Math.floor(clock.tick / DAY_TICKS) + 1;
  const filled = Math.floor(((clock.tick % DAY_TICKS) / DAY_TICKS) * 10);
  return (
    <div className="se-board se-clock">
      <span className="se-clock-day">
        <PixelText>{`day ${day}`}</PixelText>
        <span className="se-sun" role="img" aria-label="how far through the day">
          {Array.from({ length: 10 }, (_, index) => (
            <i key={index} className={index < filled ? 'se-sun-on' : undefined} />
          ))}
        </span>
      </span>
      <PixelTile icon="pause" title="Pause" held={!clock.playing} onClick={() => onPlaying(false)} />
      {SPEEDS.map((speed) => (
        <PixelTile
          key={speed}
          label={`x${speed}`}
          held={clock.playing && clock.speed === speed}
          onClick={() => {
            onSpeed(speed);
            onPlaying(true);
          }}
        />
      ))}
    </div>
  );
}

const NEEDS_GROUND = 'zoom in to build';
const NEEDS_GROUND_WHY = 'too far to see the ground';

export function Bar({ bar, onTool }: { bar: BarView; onTool: (tool: Tool) => void }): React.JSX.Element {
  const hasTown = bar.towns > 0;
  const hint =
    bar.tool !== 'inspect' && bar.reason
      ? bar.reason
      : bar.tool === 'found'
      ? 'click open ground'
      : bar.tool === 'area'
        ? 'click ground in your claim'
        : bar.tool === 'raze'
          ? 'click an area'
          : hasTown
            ? ''
            : bar.fine
              ? 'light the fire'
              : '';

  const tool = (value: Tool, icon: 'found' | 'design' | 'raze', label: string, reason: string | null, title: string) => (
    <PixelTile
      key={value}
      icon={icon}
      label={label}
      title={reason === NEEDS_GROUND ? NEEDS_GROUND_WHY : (reason ?? title)}
      held={bar.tool === value}
      disabled={reason !== null}
      {...(reason ? { reason } : {})}
      onClick={() => onTool(bar.tool === value ? 'inspect' : value)}
    />
  );

  return (
    <div className="se-buildbar">
      {tool('found', 'found', 'Found', bar.fine ? null : NEEDS_GROUND, 'Click open ground to start a settlement')}
      {tool(
        'area',
        'design',
        'Work area',
        !bar.fine ? NEEDS_GROUND : hasTown ? null : 'found a town first',
        'Click ground inside your claim to mark out a work area, shift to keep marking',
      )}
      {tool('raze', 'raze', 'Raze', !bar.fine ? NEEDS_GROUND : hasTown ? null : 'nothing built yet', 'Click a work area to take it down')}
      {hint ? (
        <span className="se-board se-bar-hint">
          <PixelText>{hint}</PixelText>
        </span>
      ) : null}
    </div>
  );
}

export function RailEdge(): React.JSX.Element {
  return <div className="se-railedge" aria-hidden="true" />;
}
