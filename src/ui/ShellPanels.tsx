import { useSyncExternalStore } from 'react';
import { SCALE } from '../render/screen.ts';
import { NOWHERE } from '../sim/grid.ts';
import type { HudSnapshot, Tool } from './game.ts';
import { game, TOOLS } from './game.ts';
import { useEffect, useRef, useState } from 'react';
import { PixelBody, PixelHeading, PixelIcon, PixelText } from './pixel/Pixel.tsx';
import { NOBODY } from '../sim/people/people.ts';
import { DIAL_HEIGHT, DIAL_WIDTH, drawDial } from './dayDial.ts';
import type { IconName } from './pixel/Pixel.tsx';
import { SkyPanel } from './SkyPanel.tsx';
import { music } from './music.ts';
import { randomSeed, seedFrom } from './seed.ts';

export function useHud(): HudSnapshot {
  return useSyncExternalStore(
    (listen) => game.subscribe(listen),
    () => game.read(),
    () => game.read(),
  );
}

const TOOL_WORDS: Record<Tool, string> = {
  clear: 'clear',
  tread: 'tread',
  bolt: 'bolt',
  uproot: 'uproot',
};

function Strip({ hud }: { hud: HudSnapshot }): React.JSX.Element {
  const under = hud.hovered ?? hud.opened;

  return (
    <header className="se-board se-strip">
      <div className="se-strip-main">
        <PixelText>{`seed ${hud.seed}`}</PixelText>
        <PixelBody className="se-strip-sub">
          {under ? `${under.biome}, ${under.standing}` : hud.sky}
        </PixelBody>
        <PixelBody className="se-strip-sub">{`zoom ${(hud.zoom / SCALE).toFixed(1)}, ${hud.weather}`}</PixelBody>
      </div>
    </header>
  );
}

function SeedBox(): React.JSX.Element {
  const onSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const field = new FormData(event.currentTarget).get('seed');
    game.newWorld(seedFrom(typeof field === 'string' ? field : ''));
  };

  return (
    <form className="se-board se-clock" onSubmit={onSubmit}>
      <input name="seed" className="se-seedbox" placeholder="seed" spellCheck={false} />
      <button type="submit" className="se-tile">
        <PixelText>open</PixelText>
      </button>
      <button type="button" className="se-tile" onClick={() => game.newWorld(randomSeed())}>
        <PixelText>roll</PixelText>
      </button>
      <button type="button" className="se-tile" onClick={() => game.leave()}>
        <PixelText>menu</PixelText>
      </button>
    </form>
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
    <div className="se-board se-times">
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
    <div className="se-board se-music">
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

function DayDial({ day }: { day: number }): React.JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (ctx) drawDial(ctx, day);
  }, [day]);

  return (
    <div className="se-board se-dial" title="time of day">
      <canvas ref={canvas} width={DIAL_WIDTH} height={DIAL_HEIGHT} style={{ width: DIAL_WIDTH * 2, height: DIAL_HEIGHT * 2 }} />
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
    <div className="se-copyview">
      <button type="button" className={copied ? 'se-tile se-on' : 'se-tile'} aria-label="copy view" title="copy position, zoom, time and seed" onClick={copy}>
        <PixelIcon name="target" />
      </button>
    </div>
  );
}

function Bar({ hud }: { hud: HudSnapshot }): React.JSX.Element {
  const { reaches } = game;

  return (
    <div className="se-buildbar">
      {reaches ? null : (
        <span className="se-board se-bar-hint">
          <PixelBody>zoom in to work the ground</PixelBody>
        </span>
      )}
      {TOOLS.map((tool) => (
        <button
          key={tool}
          type="button"
          className={tool === hud.tool ? 'se-tile se-on' : 'se-tile'}
          disabled={!reaches}
          onClick={() => game.setTool(tool === hud.tool ? null : tool)}
        >
          <PixelText>{TOOL_WORDS[tool]}</PixelText>
        </button>
      ))}
      <button type="button" className={hud.panel ? 'se-tile se-on' : 'se-tile'} onClick={() => game.togglePanel()}>
        <PixelText>sky</PixelText>
      </button>
      <button type="button" className={hud.view > 0 ? 'se-tile se-on' : 'se-tile'} onClick={() => game.setView((hud.view + 1) % 6)}>
        <PixelText>{['map', 'height', 'heat', 'wind', 'zones', 'seasons'][hud.view] ?? 'map'}</PixelText>
      </button>
    </div>
  );
}

function Gauge({ word, value, share, tone }: { word: string; value: string; share: number; tone: 'plain' | 'cold' | 'warn' }): React.JSX.Element {
  return (
    <div className="se-tilesheet-row se-gauge">
      <dt>
        <PixelBody>{word}</PixelBody>
      </dt>
      <dd>
        <PixelBody>{value}</PixelBody>
        <div className={tone === 'plain' ? 'se-meter' : `se-meter se-meter-${tone}`}>
          <i style={{ width: `${Math.round(share * 100)}%` }} />
        </div>
      </dd>
    </div>
  );
}

function PersonSheet({ hud }: { hud: HudSnapshot }): React.JSX.Element | null {
  const person = hud.person;
  if (!person) return null;

  return (
    <aside className="se-board se-person">
      <header className="se-person-head">
        <PixelHeading>{person.name}</PixelHeading>
        <button type="button" className="se-tile" onClick={() => game.selectPerson(NOBODY)}>
          <PixelText>close</PixelText>
        </button>
      </header>
      <dl className="se-tilesheet">
        <Row word="doing" value={person.doing} />
        <Row word="hands" value={person.holding} />
        <Gauge word="heat" value={`${person.bodyTemp.toFixed(1)} C`} share={person.warmth} tone={person.conditions.includes('cold') || person.conditions.includes('freezing') ? 'cold' : 'plain'} />
        <Gauge word="stamina" value={`${Math.round(person.stamina * 100)}%`} share={person.stamina} tone={person.stamina < 0.2 ? 'warn' : 'plain'} />
        <Gauge word="hunger" value={person.hungerWord} share={person.hunger} tone={person.hunger > 0.7 ? 'warn' : 'plain'} />
        <Gauge word="thirst" value={person.thirstWord} share={person.thirst} tone={person.thirst > 0.7 ? 'warn' : 'plain'} />
        <Gauge word="tired" value={person.tirednessWord} share={person.tiredness} tone={person.tiredness > 0.7 ? 'warn' : 'plain'} />
        <Row word="pace" value={`${person.speed.toFixed(1)} m/s`} />
        <Row word="at" value={`${person.column}, ${person.row}`} />
        {person.conditions.length > 0 ? <Row word="feels" value={person.conditions.join(', ')} /> : null}
      </dl>
      <div className="se-thoughts">
        {person.thoughts.map((thought) => (
          <div key={thought.text} className={thought.critical ? 'se-thought se-thought-critical' : 'se-thought'}>
            <PixelBody>{thought.text}</PixelBody>
          </div>
        ))}
      </div>
    </aside>
  );
}

function StructureSheet({ hud }: { hud: HudSnapshot }): React.JSX.Element | null {
  const structure = hud.structure;
  if (!structure) return null;

  return (
    <aside className="se-board se-person">
      <header className="se-person-head">
        <PixelHeading>{structure.title}</PixelHeading>
        <button type="button" className="se-tile" onClick={() => game.clearStructureSelection()}>
          <PixelText>close</PixelText>
        </button>
      </header>
      <dl className="se-tilesheet">
        {structure.share === null ? null : <Gauge word={structure.title.endsWith('site') ? 'built' : 'filled'} value={structure.gauge} share={structure.share} tone="plain" />}
        {structure.rows.map(([word, value]) => (
          <Row key={word} word={word} value={value} />
        ))}
      </dl>
    </aside>
  );
}

function AchievementToast({ hud }: { hud: HudSnapshot }): React.JSX.Element | null {
  const earned = hud.announcement;
  if (!earned) return null;

  return (
    <div className="se-toast-slot">
      <div key={earned.id} className="se-board se-toast" role="status" onClick={() => game.dismissToast()}>
        <div className="se-toast-coin">
          <PixelIcon name={`coin-${earned.id}` as IconName} />
        </div>
        <div className="se-toast-text">
          <PixelText className="se-toast-kicker">milestone reached</PixelText>
          <PixelBody>{earned.title}</PixelBody>
          <PixelText>{earned.reason}</PixelText>
          {earned.unlocks.length > 0 ? (
            <>
              <PixelText className="se-toast-kicker">unlocks</PixelText>
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

function Row({ word, value }: { word: string; value: string }): React.JSX.Element {
  return (
    <div className="se-tilesheet-row">
      <dt>
        <PixelBody>{word}</PixelBody>
      </dt>
      <dd>
        <PixelBody>{value}</PixelBody>
      </dd>
    </div>
  );
}

function TileSheet({ hud }: { hud: HudSnapshot }): React.JSX.Element | null {
  const tile = hud.opened;
  if (!tile) return null;

  return (
    <aside className="se-dock se-ledger se-slab">
      <header className="se-section">
        <PixelText>{`tile ${tile.column}, ${tile.row}`}</PixelText>
      </header>
      <dl className="se-tilesheet">
        <Row word="ground" value={tile.biome} />
        <Row word="standing" value={tile.standing} />
        <Row word="worn" value={String(tile.wear)} />
        <Row word="walking" value={tile.refusal ?? 'open'} />
        {tile.readout.map(([word, value]) => (
          <Row key={word} word={word} value={value} />
        ))}
      </dl>
      <button type="button" className="se-tile" onClick={() => game.openTile(NOWHERE)}>
        <PixelText>close</PixelText>
      </button>
    </aside>
  );
}

export function ShellPanels(): React.JSX.Element {
  const hud = useHud();

  return (
    <>
      <Strip hud={hud} />
      <div className="se-topright">
        <SeedBox />
        <DayDial day={hud.dayFraction} />
        <TimeControls hud={hud} />
        <MusicControls />
      </div>
      <Bar hud={hud} />
      <CopyView />
      <PersonSheet hud={hud} />
      <StructureSheet hud={hud} />
      <AchievementToast hud={hud} />
      <TileSheet hud={hud} />
      <SkyPanel hud={hud} />
    </>
  );
}
