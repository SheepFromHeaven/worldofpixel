import { useEffect, useState, useSyncExternalStore } from 'react';
import { game, randomSeed, seedFrom, SPEEDS } from './game.ts';
import { PixelHeading, PixelIcon, PixelText } from './pixel/Pixel.tsx';

function SeedField({ seed }: { seed: number }): React.JSX.Element {
  const [draft, setDraft] = useState(String(seed));
  useEffect(() => setDraft(String(seed)), [seed]);

  return (
    <form
      className="se-seed"
      onSubmit={(event) => {
        event.preventDefault();
        game.newWorld(seedFrom(draft));
      }}
    >
      <label htmlFor="se-seed-input">
        <PixelText>seed</PixelText>
      </label>
      <input
        id="se-seed-input"
        value={draft}
        spellCheck={false}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => setDraft(String(seed))}
      />
      <button type="button" title="Roll a fresh world" onClick={() => game.newWorld(randomSeed())}>
        <PixelIcon name="dice" />
        <PixelText>New map</PixelText>
      </button>
    </form>
  );
}

const DETAIL_NAMES = { vast: 'World', coarse: 'Region', medium: 'Country', fine: 'Ground' } as const;

export function ControlBar(): React.JSX.Element {
  const hud = useSyncExternalStore(game.subscribe, game.getSnapshot);

  return (
    <header className="se-bar">
      <div className="se-title">
        <PixelHeading>Scribble Empire</PixelHeading>
      </div>

      <div className="se-trail" aria-label="zoom">
        <span className="se-crumb-here">
          <PixelText>{DETAIL_NAMES[hud.detail]}</PixelText>
        </span>
        <span className="se-zoom">
          <PixelText>{`x${hud.zoom.toFixed(1)}`}</PixelText>
        </span>
      </div>

      <div className="se-controls">
        <button type="button" onClick={() => game.setPlaying(!hud.playing)}>
          <PixelIcon name={hud.playing ? 'pause' : 'play'} />
          <PixelText>{hud.playing ? 'Pause' : 'Play'}</PixelText>
        </button>
        <button type="button" onClick={() => game.step()} disabled={hud.playing}>
          <PixelIcon name="step" />
          <PixelText>Step</PixelText>
        </button>
        {SPEEDS.map((speed) => (
          <button
            key={speed}
            type="button"
            className={hud.speed === speed ? 'se-on' : undefined}
            onClick={() => game.setSpeed(speed)}
          >
            <PixelText>{`x${speed}`}</PixelText>
          </button>
        ))}
      </div>

      <SeedField seed={hud.seed} />

      <div className="se-tick">
        <PixelText>{`tick ${hud.tick}`}</PixelText>
      </div>
    </header>
  );
}
