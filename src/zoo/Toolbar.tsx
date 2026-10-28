import { useEffect, useState } from 'react';
import { drawDial } from '../ui/dayDial.ts';
import { PixelText } from '../ui/pixel/Pixel.tsx';
import { PixelTile } from '../ui/pixel/Tile.tsx';
import { seasonFace, seasonNameOf, SEASON_ANCHOR } from '../ui/seasonDial.ts';
import { drawDisc } from '../ui/dayDial.ts';
import { Dial } from './Dial.tsx';
import type { Terrain } from './stage.ts';
import { TERRAINS } from './stage.ts';
import { groundReady, swatchOf } from './swatch.ts';

const TAU = Math.PI * 2;

const POLL_MILLISECONDS = 250;

const paintDay = (ctx: CanvasRenderingContext2D, value: number): void => drawDial(ctx, value);

const paintSeason = (ctx: CanvasRenderingContext2D, value: number): void => drawDisc(ctx, (value - SEASON_ANCHOR) * TAU, seasonFace);

const clockOf = (day: number): string => {
  const minutes = Math.round(day * 24 * 60) % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};

export interface Switches {
  grid: boolean;
  texture: boolean;
  shading: boolean;
  tint: boolean;
  model: boolean;
  paused: boolean;
  erase: boolean;
  control: boolean;
}

interface ToolbarProps {
  canControl: boolean;
  terrain: Terrain;
  setTerrain: (terrain: Terrain) => void;
  switches: Switches;
  toggle: (name: keyof Switches) => void;
  hour: number;
  setHour: (hour: number) => void;
  season: number;
  setSeason: (season: number) => void;
  placed: number;
  onClear: () => void;
  onFollow: () => void;
}

function useGroundReady(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (groundReady()) return;
    const timer = window.setInterval(() => {
      if (!groundReady()) return;
      window.clearInterval(timer);
      setTick((value) => value + 1);
    }, POLL_MILLISECONDS);
    return () => window.clearInterval(timer);
  }, []);
  return tick;
}

export function Toolbar({ canControl, terrain, setTerrain, switches, toggle, hour, setHour, season, setSeason, placed, onClear, onFollow }: ToolbarProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  useGroundReady();

  const choose = (one: Terrain): void => {
    setTerrain(one);
    setOpen(false);
  };

  const swatch = (one: Terrain): React.JSX.Element => <img className="zoo-swatch" src={swatchOf(one) ?? undefined} alt="" />;

  return (
    <div className="zoo-toolwrap">
      <nav className="se-board zoo-tools">
        <button type="button" className={open ? 'se-tile se-on zoo-terrain' : 'se-tile zoo-terrain'} title={`terrain: ${terrain.title}`} onClick={() => setOpen(!open)}>
          {swatch(terrain)}
        </button>
        <span className="zoo-rule" />
        <PixelTile icon="grid" title="grid" held={switches.grid} onClick={() => toggle('grid')} />
        <PixelTile icon="texture" title="ground texture" held={switches.texture} onClick={() => toggle('texture')} />
        <PixelTile icon="shade" title="shading" held={switches.shading} onClick={() => toggle('shading')} />
        <PixelTile icon="night" title="night tint" held={switches.tint} onClick={() => toggle('tint')} />
        <PixelTile icon="cube" title="3d model" held={switches.model} onClick={() => toggle('model')} />
        <span className="zoo-rule" />
        <PixelTile icon="raze" title="erase what you placed (escape to stop)" held={switches.erase} onClick={() => toggle('erase')} />
        <PixelTile icon="hand" title={canControl ? "control human: right click opens the game's radial menu" : 'control human: place a human first'} held={switches.control} disabled={!canControl && !switches.control} onClick={() => toggle('control')} />
        <PixelTile icon="trash" title={`clear all ${placed} placed`} disabled={placed === 0} onClick={onClear} />
        <span className="zoo-rule" />
        <PixelTile icon={switches.paused ? 'play' : 'pause'} title={switches.paused ? 'start' : 'pause'} onClick={() => toggle('paused')} />
        <PixelTile icon="target" title="recentre on the animal (space)" onClick={onFollow} />
        <span className="zoo-rule" />
        <Dial value={hour} label={clockOf(hour)} title="turn to set the time of day" paint={paintDay} onChange={setHour} />
        <Dial value={season} label={seasonNameOf(season)} title="turn to set the season" paint={paintSeason} onChange={setSeason} />
      </nav>
      {open && (
        <div className="se-board zoo-flyout">
          {TERRAINS.map((one) => (
            <button key={one.key} type="button" className={one === terrain ? 'se-tile se-on zoo-terrain zoo-pick' : 'se-tile zoo-terrain zoo-pick'} onClick={() => choose(one)}>
              {swatch(one)}
              <PixelText>{one.title}</PixelText>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
