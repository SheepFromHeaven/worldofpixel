import { useSyncExternalStore } from 'react';
import type { HudSnapshot } from './game.ts';
import { game } from './game.ts';
import { useEffect, useRef, useState } from 'react';
import { PixelBody, PixelHeading, PixelIcon, PixelText } from './pixel/Pixel.tsx';
import { BADGE_HEIGHT, BADGE_WIDTH, drawBadge } from './brainBadge.ts';
import { DIAL_CENTRE_Y, DIAL_HEIGHT, DIAL_WIDTH, drawDial, drawPin, PIN_SIZE } from './dayDial.ts';
import type { IconName } from './pixel/Pixel.tsx';
import { MindPanel } from './MindPanel.tsx';
import { PersonSheet, StructureSheet, TileSheet } from './Sheets.tsx';
import type { MindHost } from './mindArt.ts';
import { music } from './music.ts';

const GAME_MIND: MindHost = {
  view: () => game.replica.mind,
  pick: (parent) => game.pick(parent),
  drop: () => game.dropIdea(),
  forget: (id) => game.forget(id),
  lookAt: (person) => game.lookAt(person),
};

export function useHud(): HudSnapshot {
  return useSyncExternalStore(
    (listen) => game.subscribe(listen),
    () => game.read(),
    () => game.read(),
  );
}

function MenuButton({ hud }: { hud: HudSnapshot }): React.JSX.Element {
  return (
    <div className="se-group">
      <button type="button" className={hud.menu ? 'se-tile se-on' : 'se-tile'} aria-label="menu" title="menu" onClick={() => game.openMenu()}>
        <PixelIcon name="menu" />
      </button>
    </div>
  );
}

const SPEEDS: readonly (readonly [IconName, number, string])[] = [
  ['pause', 0, 'pause'],
  ['play', 1, 'normal speed'],
  ['fast', 2, 'twice as fast'],
  ['faster', 3, 'three times as fast'],
];

function TimeControls({ hud }: { hud: HudSnapshot }): React.JSX.Element {
  return (
    <div className="se-group se-times">
      {SPEEDS.map(([icon, value, label]) => (
        <button
          key={icon}
          type="button"
          aria-label={label}
          title={label}
          className={hud.speed === value ? 'se-tile se-on' : 'se-tile'}
          onClick={() => game.setSpeed(value)}
        >
          <PixelIcon name={icon} />
        </button>
      ))}
    </div>
  );
}

function MusicControls(): React.JSX.Element {
  const state = useSyncExternalStore(music.subscribe, music.getSnapshot, music.getSnapshot);

  return (
    <div className="se-group se-music">
      <button
        type="button"
        aria-label="music"
        title={state.on ? `music on${state.playing ? `: ${state.playing}` : ''}` : 'music off'}
        className={state.on ? 'se-tile se-on' : 'se-tile'}
        onClick={() => music.setOn(!state.on)}
      >
        <PixelIcon name="pipes" />
      </button>
      <input
        className="se-slider"
        type="range"
        min={0}
        max={1}
        step={0.02}
        value={state.volume}
        aria-label="music volume"
        disabled={!state.on}
        onChange={(event) => music.setVolume(Number(event.currentTarget.value))}
      />
    </div>
  );
}

const BADGE_SCALE = 2;

function BrainBadge({ hud }: { hud: HudSnapshot }): React.JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = hud.mind;
  const working = view?.hypotheses.filter((hypothesis) => hypothesis.state === 0 && !hypothesis.order).length ?? 0;
  const learned = view?.learned ?? 0;
  const forming = hud.forming !== null && !hud.mindOpen;

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (ctx) drawBadge(ctx);
  }, []);

  const title = forming ? 'a new idea is forming' : working > 0 ? `${working} idea${working === 1 ? '' : 's'} being carried out` : 'what the people know';

  return (
    <div className={hud.brain === 'arriving' ? 'se-badge se-badge-arriving' : 'se-badge'} style={{ width: BADGE_WIDTH * BADGE_SCALE, height: BADGE_HEIGHT * BADGE_SCALE }}>
      <canvas ref={canvas} width={BADGE_WIDTH} height={BADGE_HEIGHT} style={{ width: BADGE_WIDTH * BADGE_SCALE, height: BADGE_HEIGHT * BADGE_SCALE }} />
      <button
        key={learned}
        type="button"
        aria-label="mind"
        title={title}
        className={['se-badge-button', 'se-glow', hud.mindOpen ? 'se-on' : '', forming ? 'se-badge-forming' : ''].filter(Boolean).join(' ')}
        onClick={() => game.toggleMind()}
      >
        <PixelIcon name="brain" />
        {working > 0 ? <PixelText className="se-brain-count">{String(working)}</PixelText> : null}
      </button>
    </div>
  );
}

const DIAL_SCALE = 2;

function DayDial({ day, arriving }: { day: number; arriving: boolean }): React.JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pin = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (ctx) drawDial(ctx, day);
  }, [day]);

  useEffect(() => {
    const ctx = pin.current?.getContext('2d');
    if (ctx) drawPin(ctx);
  }, []);

  const centre = { x: (DIAL_WIDTH / 2) * DIAL_SCALE, y: DIAL_CENTRE_Y * DIAL_SCALE };
  const pinSide = PIN_SIZE * DIAL_SCALE;

  return (
    <div className={arriving ? 'se-group se-dial se-dial-arriving' : 'se-group se-dial'} title="time of day" style={{ width: DIAL_WIDTH * DIAL_SCALE }}>
      <div className="se-dial-face" style={{ height: centre.y }}>
        <canvas ref={canvas} width={DIAL_WIDTH} height={DIAL_HEIGHT} style={{ width: DIAL_WIDTH * DIAL_SCALE, height: DIAL_HEIGHT * DIAL_SCALE }} />
      </div>
      <canvas
        ref={pin}
        className="se-dial-pin"
        width={PIN_SIZE}
        height={PIN_SIZE}
        style={{ width: pinSide, height: pinSide, left: centre.x - pinSide / 2, top: `calc(var(--se-dial-top) + ${centre.y - pinSide / 2}px)` }}
      />
    </div>
  );
}

function CopyView(): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const copy = (): void => {
    void navigator.clipboard.writeText(game.debugView()).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  };

  return (
    <div className="se-copyview se-wood">
      <button type="button" className={copied ? 'se-tile se-on' : 'se-tile'} aria-label="copy view" title="copy position, zoom, time and seed" onClick={copy}>
        <PixelIcon name="target" />
      </button>
    </div>
  );
}

function AchievementToast({ hud }: { hud: HudSnapshot }): React.JSX.Element | null {
  const earned = hud.announcement;
  if (!earned) return null;

  return (
    <div className="se-toast-slot">
      <div key={earned.id} className="se-board se-wood se-toast" role="status" onClick={() => game.dismissToast()}>
        <div className="se-toast-coin">
          <PixelIcon name={`coin-${earned.id}` as IconName} />
        </div>
        <div className="se-toast-text">
          <PixelText className="se-label">milestone reached</PixelText>
          <PixelBody>{earned.title}</PixelBody>
          <PixelText>{earned.reason}</PixelText>
          {earned.unlocks.length > 0 ? (
            <>
              <PixelText className="se-label">unlocks</PixelText>
              {earned.unlocks.map((line) => (
                <PixelText key={line}>{`- ${line}`}</PixelText>
              ))}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function GameMenu({ hud }: { hud: HudSnapshot }): React.JSX.Element | null {
  if (hud.menu === null) return null;

  return (
    <div className="se-gamemenu-backdrop" onClick={(event) => event.target === event.currentTarget && game.closeMenu()}>
      <section className="se-gamemenu se-wood" role="dialog" aria-label={hud.menu}>
        <h2>
          <PixelHeading>{hud.menu === 'settings' ? 'settings' : 'menu'}</PixelHeading>
        </h2>
        {hud.menu === 'settings' ? (
          <>
            <div className="se-gamemenu-row">
              <PixelText>music</PixelText>
              <MusicControls />
            </div>
            <button type="button" className="se-tile" onClick={() => game.showMenu('main')}>
              <PixelText>back</PixelText>
            </button>
          </>
        ) : (
          <>
            <button type="button" className="se-tile" onClick={() => game.showMenu('settings')}>
              <PixelText>settings</PixelText>
            </button>
            <button type="button" className="se-tile" onClick={() => game.leave()}>
              <PixelText>exit</PixelText>
            </button>
          </>
        )}
      </section>
    </div>
  );
}

export function TopBar(): React.JSX.Element {
  const hud = useHud();

  return (
    <header className="se-bar se-topbar se-wood">
      <div className="se-topbar-side">
        <MenuButton hud={hud} />
      </div>
      {hud.brain ? <BrainBadge hud={hud} /> : null}
      <div className="se-topbar-side">
        {hud.dial ? <DayDial day={hud.dayFraction} arriving={hud.dial === 'arriving'} /> : null}
        <TimeControls hud={hud} />
      </div>
    </header>
  );
}

export function ShellPanels(): React.JSX.Element {
  const hud = useHud();

  return (
    <>
      <CopyView />
      <MindPanel open={hud.mindOpen} view={hud.mind} host={GAME_MIND} onClose={() => game.toggleMind()} />
      <div className="se-column">
        <PersonSheet hud={hud} />
        <StructureSheet hud={hud} />
        <TileSheet hud={hud} />
      </div>
      <AchievementToast hud={hud} />
      <GameMenu hud={hud} />
    </>
  );
}
