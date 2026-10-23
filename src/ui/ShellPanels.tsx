import { useSyncExternalStore } from 'react';
import { SCALE } from '../render/screen.ts';
import { NOWHERE } from '../sim/grid.ts';
import type { HudSnapshot, Tool } from './game.ts';
import { game, TOOLS } from './game.ts';
import { PixelBody, PixelText } from './pixel/Pixel.tsx';
import { SkyPanel } from './SkyPanel.tsx';
import { randomSeed, seedFrom } from './seed.ts';

export function useHud(): HudSnapshot {
  return useSyncExternalStore(
    (listen) => game.subscribe(listen),
    () => game.read(),
    () => game.read(),
  );
}

const TOOL_WORDS: Record<Tool, string> = {
  look: 'look',
  clear: 'clear',
  tread: 'tread',
  torch: 'torch',
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
    </form>
  );
}

const SPEEDS: readonly (readonly [string, number])[] = [
  ['pause', 0],
  ['1x', 1],
  ['2x', 2],
  ['3x', 3],
];

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
          disabled={!reaches && tool !== 'look'}
          onClick={() => game.setTool(tool === hud.tool ? 'look' : tool)}
        >
          <PixelText>{TOOL_WORDS[tool]}</PixelText>
        </button>
      ))}
      <button type="button" className={hud.clockMenu ? 'se-tile se-on' : 'se-tile'} onClick={() => game.toggleClockMenu()}>
        <PixelText>{hud.speed > 0 ? `day ${hud.speed}x` : 'day'}</PixelText>
      </button>
      {hud.clockMenu ? (
        <div className="se-board se-speeds">
          {SPEEDS.map(([word, value]) => (
            <button
              key={word}
              type="button"
              className={hud.speed === value ? 'se-tile se-on' : 'se-tile'}
              onClick={() => game.setSpeed(value)}
            >
              <PixelText>{word}</PixelText>
            </button>
          ))}
        </div>
      ) : null}
      <button type="button" className={hud.panel ? 'se-tile se-on' : 'se-tile'} onClick={() => game.togglePanel()}>
        <PixelText>sky</PixelText>
      </button>
      <button type="button" className={hud.view > 0 ? 'se-tile se-on' : 'se-tile'} onClick={() => game.setView((hud.view + 1) % 6)}>
        <PixelText>{['map', 'height', 'heat', 'wind', 'zones', 'seasons'][hud.view] ?? 'map'}</PixelText>
      </button>
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
      <SeedBox />
      <Bar hud={hud} />
      <TileSheet hud={hud} />
      <SkyPanel hud={hud} />
    </>
  );
}
