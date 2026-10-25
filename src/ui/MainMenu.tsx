import { useState } from 'react';
import type { Launch } from './launch.ts';
import { GAME_MODES } from './launch.ts';
import type { GameMode } from './launch.ts';
import { forgetSave, newSlot, savedGames } from './persist.ts';
import type { SaveSummary } from './persist.ts';
import { PixelBody, PixelHeading, PixelText } from './pixel/Pixel.tsx';
import { PixelTile } from './pixel/Tile.tsx';
import { randomSeed, seedFrom } from './seed.ts';

type Page = 'title' | 'play' | 'load' | 'new';

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

function Load({ onLaunch, onBack }: { onLaunch: (launch: Launch) => void; onBack: () => void }): React.JSX.Element {
  const [saves, setSaves] = useState(savedGames);

  return (
    <>
      <PixelHeading>load game</PixelHeading>
      {saves.length === 0 ? <PixelBody>no saved games yet</PixelBody> : null}
      <ul className="se-menu-saves">
        {saves.map((save) => (
          <li key={save.slot} className="se-slot">
            <div
              role="button"
              tabIndex={0}
              className="se-slot-open"
              onClick={() => onLaunch({ slot: save.slot, seed: save.seed, mode: save.mode })}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onLaunch({ slot: save.slot, seed: save.seed, mode: save.mode });
              }}
            >
              <span
                className="se-slot-shot"
                style={save.shot ? { backgroundImage: `url(${save.shot})` } : undefined}
              />
              <span className="se-slot-label">
                <PixelText>{`seed ${save.seed}, ${save.mode}`}</PixelText>
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

  return (
    <>
      <PixelHeading>new game</PixelHeading>
      <div className="se-menu-row">
        {GAME_MODES.map((kind) => (
          <PixelTile key={kind} wide held={kind === mode} label={MODE_WORDS[kind].name} onClick={() => setMode(kind)} />
        ))}
      </div>
      <p className="se-menu-blurb">
        <PixelBody>{MODE_WORDS[mode].blurb}</PixelBody>
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
        <PixelTile label="start" onClick={() => onLaunch({ slot: newSlot(), seed: seedFrom(seed), mode })} />
      </div>
    </>
  );
}

export function MainMenu({ onLaunch }: { onLaunch: (launch: Launch) => void }): React.JSX.Element {
  const [page, setPage] = useState<Page>('title');
  const hasSaves = page === 'play' ? savedGames().length > 0 : false;

  return (
    <main className="se-menu">
      <div className="se-board se-menu-panel">
        {page === 'title' ? (
          <>
            <PixelHeading>scribble empire</PixelHeading>
            <PixelTile wide label="play" onClick={() => setPage('play')} />
            <PixelTile wide label="docs" onClick={() => window.open('/docs/wiki/index.html', '_blank', 'noopener')} />
          </>
        ) : null}
        {page === 'play' ? (
          <>
            <PixelHeading>play</PixelHeading>
            <PixelTile wide label="new game" onClick={() => setPage('new')} />
            {hasSaves ? (
              <PixelTile wide label="load game" onClick={() => setPage('load')} />
            ) : (
              <PixelTile wide disabled label="load game" reason="nothing saved" />
            )}
            <PixelTile label="back" onClick={() => setPage('title')} />
          </>
        ) : null}
        {page === 'load' ? <Load onLaunch={onLaunch} onBack={() => setPage('play')} /> : null}
        {page === 'new' ? <NewGame onLaunch={onLaunch} onBack={() => setPage('play')} /> : null}
      </div>
    </main>
  );
}
