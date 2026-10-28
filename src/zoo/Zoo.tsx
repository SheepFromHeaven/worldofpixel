import { useEffect, useMemo, useRef, useState } from 'react';
import { applyCamera, screenToWorld, visibleBounds, zoomAbout } from '../render/camera.ts';
import type { Viewport } from '../render/camera.ts';
import type { LitLayer } from '../render/lit/litLayer.ts';
import { createLitLayer } from '../render/lit/litLayer.ts';
import { bufferFor, present, SCALE } from '../render/screen.ts';
import type { Vec2 } from '../sim/geometry.ts';
import { TEXELS_PER_TILE } from '../sim/grid.ts';
import type { World } from '../sim/world.ts';
import type { ZooEntry } from './catalogue.ts';
import { GROUPS, ZOO } from './catalogue.ts';
import { groundPattern } from './groundTexture.ts';
import { Model3D, modelled } from './Model3D.tsx';
import { stageWorld, TERRAINS } from './stage.ts';
import type { Terrain } from './stage.ts';
import { DENSITIES, SEASONS, SEE_THROUGH_MODES, STAGES, standAround, TREE_LOOKS } from './scenery.ts';
import type { Density, Season, SeeThroughMode, TreeLook } from './scenery.ts';
import { emptyFauna, lightingFor, stillSky } from './surroundings.ts';
import type { ZooReadout } from './zoo.ts';
import { ZooSession } from './zoo.ts';

const CLICK_SLOP = 4;

const READOUT_SECONDS = 0.25;

const GRID_FAINT = 'rgba(0,0,0,0.045)';

const GRID_STRONG = 'rgba(0,0,0,0.1)';

const HOURS: readonly { key: string; title: string; hour: number }[] = [
  { key: 'dawn', title: 'dawn', hour: 0.27 },
  { key: 'day', title: 'noon', hour: 0.5 },
  { key: 'dusk', title: 'dusk', hour: 0.73 },
  { key: 'night', title: 'night', hour: 0 },
];

const fromAddress = (name: string): string | null => new URLSearchParams(window.location.search).get(name);

const writeAddress = (name: string, value: string): void => {
  const address = new URL(window.location.href);
  address.searchParams.set(name, value);
  window.history.replaceState(null, '', address);
};

export function Zoo(): React.JSX.Element {
  const [terrain, setTerrainState] = useState<Terrain>(() => TERRAINS.find((one) => one.key === fromAddress('terrain')) ?? TERRAINS[0]!);
  const [selected, setSelectedState] = useState<ZooEntry | null>(() => ZOO.find((one) => one.key === fromAddress('animal')) ?? ZOO[0] ?? null);
  const [paused, setPaused] = useState(false);
  const world = useMemo(() => stageWorld(terrain, TERRAINS.indexOf(terrain) + 1), [terrain]);
  const setTerrain = (one: Terrain): void => {
    writeAddress('terrain', one.key);
    setTerrainState(one);
  };
  const setSelected = (entry: ZooEntry): void => {
    writeAddress('animal', entry.key);
    setSelectedState(entry);
  };
  return <ZooView key={terrain.key} world={world} terrain={terrain} setTerrain={setTerrain} selected={selected} setSelected={setSelected} paused={paused} setPaused={setPaused} />;
}

interface ZooViewProps {
  world: World;
  terrain: Terrain;
  setTerrain: (terrain: Terrain) => void;
  selected: ZooEntry | null;
  setSelected: (entry: ZooEntry) => void;
  paused: boolean;
  setPaused: (paused: boolean) => void;
}

function drawStage(ctx: CanvasRenderingContext2D, terrain: Terrain, lens: { centre: Vec2; zoom: number }, pane: { width: number; height: number }, grid: boolean, textured: boolean): void {
  ctx.save();
  ctx.fillStyle = terrain.colour;
  ctx.fillRect(0, 0, pane.width, pane.height);
  applyCamera(ctx, lens, pane);
  const bounds = visibleBounds(lens, pane);
  const pattern = textured ? groundPattern(ctx, terrain) : null;
  if (pattern) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.scale(1 / TEXELS_PER_TILE, 1 / TEXELS_PER_TILE);
    ctx.fillStyle = pattern;
    ctx.fillRect(bounds.minX * TEXELS_PER_TILE, bounds.minY * TEXELS_PER_TILE, (bounds.maxX - bounds.minX) * TEXELS_PER_TILE, (bounds.maxY - bounds.minY) * TEXELS_PER_TILE);
    ctx.restore();
  }
  if (terrain.waterColour) {
    ctx.fillStyle = terrain.waterColour;
    ctx.fillRect(bounds.minX - 1, bounds.minY - 1, -bounds.minX + 1, bounds.maxY - bounds.minY + 2);
  }
  if (grid) {
    const unit = 1 / lens.zoom;
    const step = lens.zoom >= 6 ? 1 : 5;
    for (const [every, colour] of [[step, GRID_FAINT], [5 * step, GRID_STRONG]] as const) {
      ctx.strokeStyle = colour;
      ctx.lineWidth = unit;
      ctx.beginPath();
      for (let x = Math.ceil(bounds.minX / every) * every; x <= bounds.maxX; x += every) {
        ctx.moveTo(x, bounds.minY);
        ctx.lineTo(x, bounds.maxY);
      }
      for (let y = Math.ceil(bounds.minY / every) * every; y <= bounds.maxY; y += every) {
        ctx.moveTo(bounds.minX, y);
        ctx.lineTo(bounds.maxX, y);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function ZooView({ world, terrain, setTerrain, selected, setSelected, paused, setPaused }: ZooViewProps): React.JSX.Element {
  const session = useMemo(() => new ZooSession(world), [world]);
  const sky = useMemo(() => stillSky(world), [world]);
  const fauna = useMemo(emptyFauna, []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const litRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLCanvasElement>(null);
  const [filter, setFilter] = useState('');
  const [readout, setReadout] = useState<ZooReadout | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0);
  const [grid, setGrid] = useState(true);
  const [model, setModel] = useState(() => fromAddress('model') === '1');
  const gridRef = useRef(true);
  const [shading, setShading] = useState(true);
  const [tint, setTint] = useState(true);
  const [texture, setTexture] = useState(true);
  const [hour, setHour] = useState(HOURS[1]!);
  const [trees, setTreesState] = useState<TreeLook>(() => TREE_LOOKS.find((one) => one.key === (fromAddress('trees') ?? 'grown')) ?? TREE_LOOKS[1]!);
  const [season, setSeasonState] = useState<Season>(() => SEASONS.find((one) => one.key === fromAddress('season')) ?? SEASONS[1]!);
  const [density, setDensityState] = useState<Density>(() => DENSITIES.find((one) => one.key === fromAddress('forest')) ?? DENSITIES[1]!);
  const [stage, setStageState] = useState<string>(() => STAGES.find((one) => one === fromAddress('stage')) ?? 'mid');
  const [seeThrough, setSeeThroughState] = useState<SeeThroughMode>(() => SEE_THROUGH_MODES.find((one) => one.key === fromAddress('see')) ?? SEE_THROUGH_MODES[1]!);
  const lookRef = useRef({ shading: true, texture: true, hour: HOURS[1]!.hour, trees: trees.key, season: season.phase, density, seeThrough: seeThrough.key, stage });
  const setStage = (one: string): void => {
    writeAddress('stage', one);
    setStageState(one);
  };
  const setDensity = (one: Density): void => {
    writeAddress('forest', one.key);
    setDensityState(one);
  };
  const setSeeThrough = (one: SeeThroughMode): void => {
    writeAddress('see', one.key);
    setSeeThroughState(one);
  };
  const setTrees = (one: TreeLook): void => {
    writeAddress('trees', one.key);
    setTreesState(one);
  };
  const setSeason = (one: Season): void => {
    writeAddress('season', one.key);
    setSeasonState(one);
  };

  useEffect(() => {
    gridRef.current = grid;
    lookRef.current = { shading, texture, hour: hour.hour, trees: trees.key, season: season.phase, density, seeThrough: seeThrough.key, stage };
  }, [grid, shading, texture, hour, trees, season, density, seeThrough, stage]);

  useEffect(() => {
    const scenery = trees.key === 'none' ? ['props', 'shadows'] : [];
    (globalThis as { litSkip?: string[] }).litSkip = [...scenery, 'water', 'leaves', 'precipitation', 'clouds', 'fog', ...(tint ? [] : ['grade'])];
  }, [tint, trees]);

  useEffect(() => {
    session.paused = paused;
  }, [session, paused]);

  const choose = (entry: ZooEntry): void => {
    session.spawn(entry);
    setSelected(entry);
  };

  const chosen = useRef(selected);
  chosen.current = selected;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const lit = litRef.current;
    const cursor = cursorRef.current;
    const cursorCtx = cursor?.getContext('2d');
    if (!canvas || !ctx || !lit || !cursor || !cursorCtx) return;

    const litLayer: LitLayer | null = createLitLayer(lit);
    let viewport: Viewport = { width: canvas.clientWidth, height: canvas.clientHeight };
    let frameHandle = 0;
    let last = performance.now();
    let readoutAt = 0;
    let drag: { from: Vec2; moved: number } | null = null;
    let pointer: Vec2 | null = null;

    (window as unknown as { zoo: ZooSession }).zoo = session;
    const start = chosen.current;
    if (start) session.spawn(start);

    const ratio = (): number => Math.max(1, Math.floor(Math.min(2, window.devicePixelRatio || 1)));

    const resize = (): void => {
      viewport = { width: canvas.clientWidth, height: canvas.clientHeight };
      canvas.width = Math.round(viewport.width * ratio());
      canvas.height = Math.round(viewport.height * ratio());
    };

    const fit = (overlay: HTMLCanvasElement, frame: { width: number; height: number }): void => {
      if (overlay.width !== frame.width || overlay.height !== frame.height) {
        overlay.width = frame.width;
        overlay.height = frame.height;
      }
      overlay.style.width = `${frame.width * SCALE}px`;
      overlay.style.height = `${frame.height * SCALE}px`;
    };

    const step = (now: number): void => {
      try {
        draw(now);
      } catch (error) {
        setNote(String(error instanceof Error ? error.stack : error));
      }
    };

    const render = (now: number): void => {
      frameHandle = requestAnimationFrame(render);
      step(now);
    };

    const hiddenTimer = window.setInterval(() => {
      if (document.hidden) step(performance.now());
    }, 250);

    const draw = (now: number): void => {
      const seconds = Math.min(0.1, (now - last) / 1000);
      last = now;
      session.tick(seconds);
      session.advance(seconds);

      const frame = bufferFor(viewport.width, viewport.height);
      if (!frame) return;

      const time = session.now();
      const lensZoom = session.camera.zoom / SCALE;
      const lens = { centre: { x: Math.round(session.camera.centre.x * lensZoom) / lensZoom, y: Math.round(session.camera.centre.y * lensZoom) / lensZoom }, zoom: lensZoom };
      const pane = { width: frame.width, height: frame.height };

      drawStage(frame.ctx, terrain, lens, pane, gridRef.current, lookRef.current.texture);

      ctx.setTransform(ratio(), 0, 0, ratio(), 0, 0);
      present(ctx, frame);

      fit(lit, frame);
      litLayer?.setMammalAgents(session.agents());
      litLayer?.setHuman(session.human());
      litLayer?.setZoo(session.state ? { ...session.state, flat: !lookRef.current.shading } : null);
      const look = lookRef.current.trees;
      const here = session.readout();
      const length = chosen.current?.length ?? 1;
      const hole = lookRef.current.seeThrough === 'hole' && here ? [{ x: here.position.x, y: here.position.y, lift: length * 0.26, radius: Math.max(1.2, length * 1.1 + 0.8), simple: true }] : [];
      litLayer?.setScenery(look !== 'none' && session.state ? standAround(lookRef.current.density, session.state.cell, lookRef.current.stage) : null);
      const view = { centre: lens.centre, zoom: lens.zoom, width: frame.width, height: frame.height, time, ground: frame.ctx.canvas, people: null, shoals: null, fauna, fog: null, depth: 0, see: hole, ...(lookRef.current.seeThrough === 'silhouette' ? { xray: true } : {}) };
      const lighting = lightingFor(world, lens.centre, lookRef.current.hour, lookRef.current.season);
      litLayer?.draw(world, view, lighting, sky, 0);
      session.seen = litLayer?.probeZoo(world, view, lighting) ?? null;

      fit(cursor, frame);
      cursorCtx.setTransform(1, 0, 0, 1, 0, 0);
      cursorCtx.clearRect(0, 0, frame.width, frame.height);
      cursorCtx.save();
      applyCamera(cursorCtx, lens, pane);
      if (session.target && here?.travelling) {
        const unit = 1 / lens.zoom;
        cursorCtx.strokeStyle = '#e3dabb';
        cursorCtx.lineWidth = unit;
        cursorCtx.setLineDash([4 * unit, 4 * unit]);
        cursorCtx.beginPath();
        const from = session.seen ?? here.position;
        cursorCtx.moveTo(from.x, from.y);
        cursorCtx.lineTo(session.target.x, session.target.y);
        cursorCtx.stroke();
        cursorCtx.setLineDash([]);
        cursorCtx.strokeRect(session.target.x - 3 * unit, session.target.y - 3 * unit, 6 * unit, 6 * unit);
      }
      cursorCtx.restore();

      if (now - readoutAt > READOUT_SECONDS * 1000) {
        readoutAt = now;
        setReadout(here);
        setZoom(session.camera.zoom / SCALE);
        setNote(session.refused);
      }
    };

    const local = (event: PointerEvent | WheelEvent): Vec2 => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onPointerDown = (event: PointerEvent): void => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      const point = local(event);
      pointer = point;
      if (event.button === 2) {
        session.send(screenToWorld(point, session.camera, viewport));
        return;
      }
      if (event.button !== 0) return;
      drag = { from: point, moved: 0 };
      canvas.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent): void => {
      const point = local(event);
      const previous = pointer;
      pointer = point;
      if (!drag || !previous) return;
      drag.moved += Math.hypot(point.x - previous.x, point.y - previous.y);
      if (drag.moved > CLICK_SLOP) session.follow = false;
      session.camera = {
        zoom: session.camera.zoom,
        centre: {
          x: session.camera.centre.x - (point.x - previous.x) / session.camera.zoom,
          y: session.camera.centre.y - (point.y - previous.y) / session.camera.zoom,
        },
      };
    };

    const onPointerUp = (event: PointerEvent): void => {
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      const finished = drag;
      drag = null;
      if (!finished || finished.moved > CLICK_SLOP) return;
      const at = screenToWorld(finished.from, session.camera, viewport);
      litLayer?.throwRipple(at.x, at.y, session.now());
      session.startle(at);
    };

    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      session.camera = zoomAbout(session.camera, local(event), viewport, Math.exp(-event.deltaY * 0.001));
    };

    const onContextMenu = (event: Event): void => event.preventDefault();

    const typing = (event: KeyboardEvent): boolean => event.target instanceof HTMLInputElement && event.target.value !== '';

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code !== 'Space' || typing(event)) return;
      event.preventDefault();
      session.recentre();
    };

    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.code === 'Space' && !typing(event)) event.preventDefault();
    };

    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    frameHandle = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameHandle);
      window.clearInterval(hiddenTimer);
      litLayer?.dispose();
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [session, world, sky, fauna, terrain]);

  const wanted = filter.trim().toLowerCase();
  const matches = (entry: ZooEntry): boolean => wanted === '' || entry.name.toLowerCase().includes(wanted);
  const shown = ZOO.filter(matches);
  const migrated = (entry: ZooEntry): boolean => modelled(entry.key, entry.group) !== null;
  const done = shown.filter(migrated);
  const rest = shown.filter((entry) => !migrated(entry));
  const entryButton = (entry: ZooEntry): React.JSX.Element => (
    <button key={entry.life} className={entry === selected ? 'zoo-entry zoo-on' : 'zoo-entry'} onClick={() => choose(entry)}>
      {entry.name}
    </button>
  );

  return (
    <div className="zoo">
      <aside className="zoo-list">
        <input className="zoo-search" placeholder="search" value={filter} onChange={(event) => setFilter(event.target.value)} />
        <div className="zoo-pane">
          <h2 className="zoo-heading">migrated</h2>
          {done.map((entry) => entryButton(entry))}
        </div>
        <div className="zoo-pane">
          <h2 className="zoo-heading">not yet</h2>
          {GROUPS.map(({ group, title }) => {
            const entries = rest.filter((entry) => entry.group === group);
            if (entries.length === 0) return null;
            return (
              <section key={group}>
                <h2>{title}</h2>
                {entries.map((entry) => entryButton(entry))}
              </section>
            );
          })}
        </div>
      </aside>
      <main className="zoo-stage">
        <canvas ref={canvasRef} className="zoo-canvas" />
        <canvas ref={litRef} className="zoo-overlay" />
        <canvas ref={cursorRef} className="zoo-overlay" />
        <div className="zoo-bar">
          <button className="zoo-play" onClick={() => setPaused(!paused)}>{paused ? 'start' : 'pause'}</button>
          <span className="zoo-sep" />
          {TERRAINS.map((one) => (
            <button key={one.key} className={one === terrain ? 'zoo-tile zoo-on' : 'zoo-tile'} onClick={() => setTerrain(one)}>
              <span className="zoo-swatch" style={{ background: one.colour, ...(one.waterColour ? { backgroundImage: `linear-gradient(90deg, ${one.waterColour} 50%, ${one.colour} 50%)` } : {}) }} />
              {one.title}
            </button>
          ))}
          <span className="zoo-sep" />
          <button className={grid ? 'zoo-on' : ''} onClick={() => setGrid(!grid)}>grid</button>
          <button className={texture ? 'zoo-on' : ''} onClick={() => setTexture(!texture)}>texture</button>
          <span className="zoo-sep" />
          <button className={shading ? 'zoo-on' : ''} onClick={() => setShading(!shading)}>shading</button>
          <button className={tint ? 'zoo-on' : ''} onClick={() => setTint(!tint)}>night tint</button>
          <button className={model ? 'zoo-on' : ''} onClick={() => setModel(!model)}>3d</button>
          {HOURS.map((one) => (
            <button key={one.key} className={one === hour ? 'zoo-on' : ''} onClick={() => setHour(one)}>{one.title}</button>
          ))}
          <span className="zoo-sep" />
          {TREE_LOOKS.map((one) => (
            <button key={one.key} className={one === trees ? 'zoo-on' : ''} onClick={() => setTrees(one)}>{one.title}</button>
          ))}
          <span className="zoo-sep" />
          {SEASONS.map((one) => (
            <button key={one.key} className={one === season ? 'zoo-on' : ''} onClick={() => setSeason(one)}>{one.title}</button>
          ))}
          <span className="zoo-sep" />
          {DENSITIES.map((one) => (
            <button key={one.key} className={one === density ? 'zoo-on' : ''} onClick={() => setDensity(one)}>{one.title}</button>
          ))}
          <span className="zoo-sep" />
          {density.key === 'gallery' && STAGES.map((one) => (
            <button key={one} className={one === stage ? 'zoo-on' : ''} onClick={() => setStage(one)}>{one}</button>
          ))}
          <span className="zoo-sep" />
          {SEE_THROUGH_MODES.map((one) => (
            <button key={one.key} className={one === seeThrough ? 'zoo-on' : ''} onClick={() => setSeeThrough(one)}>{one.title}</button>
          ))}
        </div>
        {model && <Model3D species={selected ? modelled(selected.key, selected.group) : null} onClose={() => setModel(false)} />}
        <div className="zoo-readout">
          {readout ? (
            <>
              <strong>{readout.name}</strong> ({readout.group})
              <div>{readout.travelling ? `travelling, ${readout.remaining.toFixed(1)} m to go at ${readout.speed.toFixed(2)} m/s` : 'natural behaviour'}</div>
            </>
          ) : (
            <div>pick an animal</div>
          )}
          <div>zoom {zoom.toFixed(1)}{session.follow ? '' : ' (free camera)'}</div>
          {note && <div className="zoo-note">{note}</div>}
          <div className="zoo-help">right click: send it there. click: startle. drag: pan. wheel: zoom. space: recentre.</div>
        </div>
      </main>
    </div>
  );
}
