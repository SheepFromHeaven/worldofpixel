import { useState } from 'react';
import type { Launch } from './launch.ts';
import { GAME_MODES, sizeName, WORLD_SIZES } from './launch.ts';
import type { GameMode } from './launch.ts';
import { SHEET_VERSION } from '../pixel/ui/metrics.ts';
import { forgetSave, newSlot, savedGames } from './persist.ts';
import type { SaveSummary } from './persist.ts';
import { PixelBody, PixelHeading, PixelIcon, PixelText } from './pixel/Pixel.tsx';
import { PixelTile } from './pixel/Tile.tsx';
import { randomSeed, seedFrom } from './seed.ts';

type Page = 'title' | 'load' | 'new';

const MODE_WORDS: Record<GameMode, { name: string; blurb: string }> = {
  settle: {
    name: 'settle',
    blurb: 'Adam and Eve wake with nothing and the world is small until they find fire.',
  },
  discover: {
    name: 'discover',
    blurb: 'Nobody is placed and the camera is free. The weather and the seasons run while you explore the map.',
  },
};

const stamp = (save: SaveSummary): string => {
  const day = `day ${Math.floor(save.days) + 1}`;
  if (!save.savedAt) return day;
  return `${day}, ${new Date(save.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
};

function Load({
  onLaunch,
  onCreate,
  onBack,
}: {
  onLaunch: (launch: Launch) => void;
  onCreate: () => void;
  onBack: () => void;
}): React.JSX.Element {
  const [saves, setSaves] = useState(savedGames);

  return (
    <>
      <PixelHeading>play</PixelHeading>
      <ul className="se-menu-saves">
        <li className="se-slot">
          <button type="button" className="se-slot-open se-slot-new" title="create world" onClick={onCreate}>
            <span className="se-slot-shot se-slot-blank">
              <PixelIcon name="plus" />
            </span>
            <span className="se-slot-label">
              <PixelText>create world</PixelText>
            </span>
          </button>
        </li>
        {saves.map((save) => (
          <li key={save.slot} className="se-slot">
            <div
              role="button"
              tabIndex={0}
              className="se-slot-open"
              onClick={() => onLaunch({ slot: save.slot, seed: save.seed, mode: save.mode, size: save.size ?? 1 })}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onLaunch({ slot: save.slot, seed: save.seed, mode: save.mode, size: save.size ?? 1 });
              }}
            >
              <span
                className="se-slot-shot"
                style={save.shot ? { backgroundImage: `url(${save.shot})` } : undefined}
              />
              <span className="se-slot-label">
                <PixelText>{`seed ${save.seed}, ${save.mode}, ${sizeName(save.size ?? 1)}`}</PixelText>
                <PixelText>{stamp(save)}</PixelText>
              </span>
            </div>
            <button
              type="button"
              className="se-tile se-slot-delete"
              title="delete"
              onClick={() => {
                forgetSave(save.slot);
                setSaves(savedGames());
              }}
            >
              <PixelText>x</PixelText>
            </button>
          </li>
        ))}
      </ul>
      <PixelTile label="back" onClick={onBack} />
    </>
  );
}

function NewGame({ onLaunch, onBack }: { onLaunch: (launch: Launch) => void; onBack: () => void }): React.JSX.Element {
  const [mode, setMode] = useState<GameMode>('settle');
  const [seed, setSeed] = useState(() => String(randomSeed()));
  const [size, setSize] = useState(WORLD_SIZES[0]!.scale);

  return (
    <>
      <PixelHeading>create world</PixelHeading>
      <div className="se-menu-row">
        {GAME_MODES.map((kind) => (
          <PixelTile key={kind} wide held={kind === mode} label={MODE_WORDS[kind].name} onClick={() => setMode(kind)} />
        ))}
      </div>
      <p className="se-menu-blurb">
        <PixelBody>{MODE_WORDS[mode].blurb}</PixelBody>
      </p>
      <div className="se-menu-row">
        {WORLD_SIZES.map((option) => (
          <PixelTile key={option.name} wide held={option.scale === size} label={option.name} onClick={() => setSize(option.scale)} />
        ))}
      </div>
      <p className="se-menu-blurb">
        <PixelBody>{WORLD_SIZES.find((option) => option.scale === size)?.blurb ?? ''}</PixelBody>
      </p>
      <div className="se-menu-row">
        <PixelText>seed</PixelText>
        <input
          className="se-seedbox"
          value={seed}
          spellCheck={false}
          onChange={(event) => setSeed(event.target.value)}
        />
        <PixelTile label="roll" onClick={() => setSeed(String(randomSeed()))} />
      </div>
      <div className="se-menu-row">
        <PixelTile label="back" onClick={onBack} />
        <PixelTile label="create" onClick={() => onLaunch({ slot: newSlot(), seed: seedFrom(seed), mode, size })} />
      </div>
    </>
  );
}

export function MainMenu({ onLaunch }: { onLaunch: (launch: Launch) => void }): React.JSX.Element {
  const [page, setPage] = useState<Page>('title');

  return (
    <main className="se-menu">
      <div className="se-board se-menu-panel">
        {page === 'title' ? (
          <>
            <img className="se-logo" src={`/ui/logo.png?v=${SHEET_VERSION}`} alt="world of pixels" />
            <PixelTile wide icon="play" label="play" onClick={() => setPage('load')} />
            <PixelTile
              wide
              icon="docs"
              label="docs"
              onClick={() => window.open('/docs/wiki/index.html', '_blank', 'noopener')}
            />
          </>
        ) : null}
        {page === 'load' ? <Load onLaunch={onLaunch} onCreate={() => setPage('new')} onBack={() => setPage('title')} /> : null}
        {page === 'new' ? <NewGame onLaunch={onLaunch} onBack={() => setPage('load')} /> : null}
      </div>
    </main>
  );
}
