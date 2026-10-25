import { moonPhaseName } from '../sim/calendar.ts';
import { dateName, seasonName, DAYS_IN_A_CALENDAR_YEAR } from '../sim/astro.ts';
import type { HudSnapshot } from './game.ts';
import { game } from './game.ts';
import { PixelBody, PixelText } from './pixel/Pixel.tsx';

const VIEWS: readonly string[] = ['normal', 'height', 'heat', 'wind', 'zones', 'seasons', 'eco'];

const WEATHERS: readonly string[] = ['auto', 'clear', 'rain', 'thunder', 'snow', 'storm', 'sand'];

export function SkyPanel({ hud }: { hud: HudSnapshot }): React.JSX.Element | null {
  if (!hud.panel) return null;

  const hours = String(Math.floor(hud.minutes / 60)).padStart(2, '0');
  const minutes = String(hud.minutes % 60).padStart(2, '0');

  return (
    <aside className="se-board se-sky">
      <header className="se-section">
        <PixelText>the sky</PixelText>
      </header>

      <div className="se-dial">
        <PixelBody>{`middle ${hours}:${minutes}`}</PixelBody>
        <input
          className="se-slider"
          type="range"
          min={0}
          max={1439}
          step={10}
          value={hud.minutes}
          onChange={(event) => game.setMinutes(Number(event.currentTarget.value))}
        />
      </div>

      <div className="se-dial">
        <PixelBody>{moonPhaseName(hud.moon)}</PixelBody>
        <input
          className="se-slider"
          type="range"
          min={0}
          max={7}
          step={1}
          value={Math.round(hud.moon * 8) % 8}
          onChange={(event) => game.setMoon(Number(event.currentTarget.value) / 8)}
        />
      </div>

      <div className="se-dial">
        <PixelBody>{`date ${dateName(hud.season)}`}</PixelBody>
        <input
          className="se-slider"
          type="range"
          min={0}
          max={DAYS_IN_A_CALENDAR_YEAR - 1}
          step={1}
          value={Math.floor(hud.season * DAYS_IN_A_CALENDAR_YEAR)}
          onChange={(event) => game.setSeason(Number(event.currentTarget.value) / DAYS_IN_A_CALENDAR_YEAR)}
        />
        <PixelBody className="se-strip-sub">{`north ${seasonName(hud.season)}, south ${seasonName((hud.season + 0.5) % 1)}`}</PixelBody>
      </div>

      <div className="se-weathers">
        {VIEWS.map((word, index) => (
          <button
            key={word}
            type="button"
            className={index === hud.view ? 'se-tile se-on' : 'se-tile'}
            onClick={() => game.setView(index)}
          >
            <PixelText>{word}</PixelText>
          </button>
        ))}
      </div>

      <div className="se-weathers">
        {WEATHERS.map((word, index) => (
          <button
            key={word}
            type="button"
            className={index === hud.forced ? 'se-tile se-on' : 'se-tile'}
            onClick={() => game.setForced(index)}
          >
            <PixelText>{word}</PixelText>
          </button>
        ))}
      </div>
    </aside>
  );
}
