import { useSyncExternalStore } from 'react';
import { NOWHERE } from '../sim/grid.ts';
import type { HudSnapshot } from './game.ts';
import { game } from './game.ts';
import { useEffect, useRef, useState } from 'react';
import { PixelBody, PixelHeading, PixelIcon, PixelText } from './pixel/Pixel.tsx';
import { NOBODY } from '../modules/people/api.ts';
import { BADGE_HEIGHT, BADGE_WIDTH, drawBadge } from './brainBadge.ts';
import { DIAL_CENTRE_Y, DIAL_HEIGHT, DIAL_WIDTH, drawDial, drawPin, PIN_SIZE } from './dayDial.ts';
import type { IconName } from './pixel/Pixel.tsx';
import { MindPanel } from './MindPanel.tsx';
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
    <div className="se-copyview">
      <button type="button" className={copied ? 'se-tile se-on' : 'se-tile'} aria-label="copy view" title="copy position, zoom, time and seed" onClick={copy}>
        <PixelIcon name="target" />
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

type Tone = 'plain' | 'cold' | 'warn';

const SLOTS = ['head', 'arms', 'body', 'hands', 'legs', 'feet'] as const;

const SLOT_PIXELS = 36;

function Slot({ name, art, held }: { name: (typeof SLOTS)[number]; art: string | null; held: string | null }): React.JSX.Element {
  return (
    <div className={`se-slot se-slot-${name}`} title={art ? `${name}: ${held ?? ''}` : `${name}: nothing`}>
      {art ? <ItemThumb art={art} size={SLOT_PIXELS} /> : <PixelIcon name={`slot-${name}`} />}
    </div>
  );
}

function Need({ icon, word, tone, label }: { icon: IconName; word: string; tone: Tone; label: string }): React.JSX.Element {
  return (
    <div className={`se-folk-need se-folk-${tone}`} title={label}>
      <PixelIcon name={icon} />
      <PixelText>{word}</PixelText>
    </div>
  );
}

function PersonSheet({ hud }: { hud: HudSnapshot }): React.JSX.Element | null {
  const person = hud.person;
  if (!person) return null;
  const freezing = person.conditions.includes('freezing');
  const cold = freezing || person.conditions.includes('cold');
  const toneOf = (bad: boolean): Tone => (bad ? 'warn' : 'plain');

  return (
    <aside className="se-wood se-folk">
      <header className="se-folk-head">
        <PixelHeading>{person.name}</PixelHeading>
        <button type="button" className="se-folk-close" aria-label="close" title="close" onClick={() => game.selectPerson(NOBODY)}>
          <PixelIcon name="close" />
        </button>
      </header>
      <div className="se-folk-body">
        <div className="se-folk-doll">
          {SLOTS.map((slot) => (
            <Slot key={slot} name={slot} art={slot === 'hands' ? person.heldArt : null} held={slot === 'hands' ? person.holding : null} />
          ))}
        </div>
        <div className="se-folk-needs">
        <Need icon="hearth" label="warmth" word={freezing ? 'freezing' : cold ? 'cold' : 'warm'} tone={cold ? 'cold' : 'plain'} />
        <Need icon="berries" label="food" word={person.hungerWord} tone={toneOf(person.hungerBad)} />
        <Need icon="water" label="water" word={person.thirstWord} tone={toneOf(person.thirstBad)} />
        <Need icon="night" label="rest" word={person.tirednessWord} tone={toneOf(person.tirednessBad)} />
        </div>
      </div>
      {person.thoughts.length > 0 ? (
        <div className="se-folk-thoughts">
          {person.thoughts.map((thought) => (
            <PixelText key={thought.text} className={thought.critical ? 'se-folk-thought se-folk-critical' : 'se-folk-thought'}>
              {thought.text}
            </PixelText>
          ))}
        </div>
      ) : null}
    </aside>
  );
}

interface SpriteBox {
  x: number;
  y: number;
  size: number;
}

interface PropSheet {
  width: number;
  height: number;
  sprites: ReadonlyMap<string, SpriteBox>;
}

const NEED_PIXELS = 80;

let propSheet: Promise<PropSheet | null> | null = null;

const loadPropSheet = (): Promise<PropSheet | null> => {
  propSheet ??= fetch('/props/props.json')
    .then((reply) => reply.json() as Promise<{ sheet: { width: number; height: number }; props: (SpriteBox & { name: string })[] }>)
    .then((manifest) => ({ width: manifest.sheet.width, height: manifest.sheet.height, sprites: new Map(manifest.props.map((one) => [one.name, one])) }))
    .catch(() => null);
  return propSheet;
};

function ItemThumb({ art, size = NEED_PIXELS }: { art: string; size?: number }): React.JSX.Element {
  const [sheet, setSheet] = useState<PropSheet | null>(null);
  useEffect(() => {
    void loadPropSheet().then(setSheet);
  }, []);
  const box = sheet?.sprites.get(`item.${art}.s0`);
  if (!sheet || !box) return <i className="se-need-thumb" style={{ width: size, height: size }} />;
  const scale = size / box.size;
  return (
    <i
      className="se-need-thumb"
      style={{
        width: size,
        height: size,
        backgroundImage: 'url(/props/albedo.png)',
        backgroundSize: `${sheet.width * scale}px ${sheet.height * scale}px`,
        backgroundPosition: `${-box.x * scale}px ${-box.y * scale}px`,
      }}
    />
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
      {structure.stored ? (
        <div className="se-needs">
          <PixelBody>{structure.title === 'knapping floor' ? 'lying' : 'holds'}</PixelBody>
          <div className="se-needs-row">
            {structure.stored.length === 0 ? <PixelText>nothing</PixelText> : null}
            {structure.stored.map((item) => (
              <div key={item.icon} className="se-need" title={item.name}>
                <ItemThumb art={item.icon} />
                {item.count > 1 ? <PixelText className="se-need-count">{`${item.count}x`}</PixelText> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {structure.missing && structure.missing.length > 0 ? (
        <div className="se-needs">
          <PixelBody>missing</PixelBody>
          <div className="se-needs-row">
            {structure.missing.map((need) => (
              <div key={need.icon} className="se-need" title={need.name}>
                <ItemThumb art={need.icon} />
                {need.count > 1 ? <PixelText className="se-need-count">{`${need.count}x`}</PixelText> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
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
      <PersonSheet hud={hud} />
      <StructureSheet hud={hud} />
      <AchievementToast hud={hud} />
      <GameMenu hud={hud} />
      <TileSheet hud={hud} />
    </>
  );
}
