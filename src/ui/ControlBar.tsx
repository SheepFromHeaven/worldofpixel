import { useEffect, useState, useSyncExternalStore } from 'react';
import { game, randomSeed, seedFrom, SPEEDS } from './game.ts';
import { PixelHeading, PixelText } from './pixel/Pixel.tsx';
import { PixelTile } from './pixel/Tile.tsx';

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
      <PixelTile
        icon="dice"
        label="New map"
        title="Roll a fresh world"
        onClick={() => game.newWorld(randomSeed())}
      />
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
        <PixelTile
          icon={hud.playing ? 'pause' : 'play'}
          label={hud.playing ? 'Pause' : 'Play'}
          onClick={() => game.setPlaying(!hud.playing)}
        />
        <PixelTile icon="step" label="Step" disabled={hud.playing} onClick={() => game.step()} />
        {/*
          * The town, as it can see itself: who is here, where their day goes, and what is
          * standing in the buildings. The fire is the band — there is no drawing of a person
          * on the sheet, and a crate would make it a panel about goods.
          */}
        <PixelTile
          icon="hearth"
          label="The day"
          title="Who is here, how their day goes, and what is standing about"
          held={hud.statsOpen}
          onClick={() => game.toggleStats()}
        />
        {SPEEDS.map((speed) => (
          <PixelTile
            key={speed}
            label={`x${speed}`}
            held={hud.speed === speed}
            onClick={() => game.setSpeed(speed)}
          />
        ))}
      </div>

      <SeedField seed={hud.seed} />

      <div className="se-tick">
        <PixelText>{`tick ${hud.tick}`}</PixelText>
      </div>
    </header>
  );
}
