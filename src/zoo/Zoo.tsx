import { useEffect, useMemo, useRef, useState } from 'react';
import { applyCamera, screenToWorld, visibleBounds, zoomAbout } from '../render/camera.ts';
import type { Viewport } from '../render/camera.ts';
import type { Lighting } from '../render/lit/lighting.ts';
import { skyAt } from '../render/lit/lighting.ts';
import type { LitLayer } from '../render/lit/litLayer.ts';
import { createLitLayer } from '../render/lit/litLayer.ts';
import { drawPaper } from '../render/paper.ts';
import { bufferFor, present, SCALE } from '../render/screen.ts';
import { drawWorld } from '../render/worldLayer.ts';
import { southernSeasonPhaseOf } from '../sim/astro.ts';
import type { CalendarMoment } from '../sim/calendar.ts';
import { placeOf } from '../sim/daylight.ts';
import type { Vec2 } from '../sim/geometry.ts';
import { seasonalStateForBothHemispheres } from '../sim/seasons/seasonalRegistry.ts';
import { World } from '../sim/world.ts';
import type { ZooEntry } from './catalogue.ts';
import { GROUPS, ZOO } from './catalogue.ts';
import { emptyFauna, stillSky } from './surroundings.ts';
import type { ZooReadout } from './zoo.ts';
import { ZooSession } from './zoo.ts';

const DEFAULT_SEED = 20250214;

const CLICK_SLOP = 4;

const READOUT_SECONDS = 0.25;

const DRIFT = 1.2;

const SUMMER = 0.3;

const NOON = 0.5;

const FULL_MOON = 0.5;

const seedFromAddress = (): number => {
  const given = Number(new URLSearchParams(window.location.search).get('seed'));
  return Number.isFinite(given) && given !== 0 ? given : DEFAULT_SEED;
};

const lightingFor = (world: World, centre: Vec2): Lighting => {
  const place = placeOf(world.grid, world.seed, centre);
  const moment: CalendarMoment = { timeOfDay: (((NOON - place.offset) % 1) + 1) % 1, seasonPhase: SUMMER, moonPhase: FULL_MOON, completedDays: 0 };
  const seasons = seasonalStateForBothHemispheres(SUMMER, southernSeasonPhaseOf(SUMMER));
  return {
    ...skyAt(moment, place),
    moment,
    seasonalShaderTable: seasons.shaderTable,
    fallingLeaves: seasons.fallingLeaves,
    blowingPetals: seasons.blowingPetals,
    leafLitter: seasons.leafLitter,
    drift: [world.field.prevailing * DRIFT, DRIFT * 0.25],
    wind: 1,
    points: [],
  };
};

export function Zoo(): React.JSX.Element {
  const seed = useMemo(seedFromAddress, []);
  const [world, setWorld] = useState<World | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const made = World.generate(seed);
      made.plants.phase = SUMMER;
      setWorld(made);
    }, 50);
    return () => window.clearTimeout(timer);
  }, [seed]);

  if (!world) return <div className="zoo-loading">building the ground (seed {seed})…</div>;
  return <ZooView world={world} />;
}

function ZooView({ world }: { world: World }): React.JSX.Element {
  const session = useMemo(() => new ZooSession(world), [world]);
  const sky = useMemo(() => stillSky(world), [world]);
  const fauna = useMemo(emptyFauna, []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const litRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLCanvasElement>(null);
  const [selected, setSelected] = useState<ZooEntry | null>(null);
  const [filter, setFilter] = useState('');
  const [readout, setReadout] = useState<ZooReadout | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [plants, setPlants] = useState(false);

  useEffect(() => {
    (globalThis as { litSkip?: string[] }).litSkip = plants ? [] : ['props', 'shadows'];
  }, [plants]);

  const choose = (entry: ZooEntry): void => {
    session.spawn(entry);
    setSelected(entry);
  };

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
    const start = ZOO[0];
    if (start) choose(start);

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
      const lens = { centre: session.camera.centre, zoom: session.camera.zoom / SCALE };
      const pane = { width: frame.width, height: frame.height };

      drawPaper(frame.ctx, pane.width, pane.height);
      frame.ctx.save();
      applyCamera(frame.ctx, lens, pane);
      drawWorld(frame.ctx, world, { bounds: visibleBounds(lens, pane), zoom: lens.zoom, time });
      frame.ctx.restore();

      ctx.setTransform(ratio(), 0, 0, ratio(), 0, 0);
      present(ctx, frame);

      fit(lit, frame);
      litLayer?.setZoo(session.state);
      const view = { centre: lens.centre, zoom: lens.zoom, width: frame.width, height: frame.height, time, ground: frame.ctx.canvas, people: null, shoals: null, fauna, fog: null, depth: 0 };
      const lighting = lightingFor(world, lens.centre);
      litLayer?.draw(world, view, lighting, sky, 0);
      session.seen = litLayer?.probeZoo(world, view, lighting) ?? null;

      fit(cursor, frame);
      cursorCtx.setTransform(1, 0, 0, 1, 0, 0);
      cursorCtx.clearRect(0, 0, frame.width, frame.height);
      cursorCtx.save();
      applyCamera(cursorCtx, lens, pane);
      const here = session.readout();
      if (session.target && here?.travelling) {
        const unit = 1 / lens.zoom;
        cursorCtx.strokeStyle = '#e3dabb';
        cursorCtx.lineWidth = unit;
        cursorCtx.setLineDash([4 * unit, 4 * unit]);
        cursorCtx.beginPath();
        cursorCtx.moveTo(here.position.x, here.position.y);
        cursorCtx.lineTo(session.target.x, session.target.y);
        cursorCtx.stroke();
        cursorCtx.setLineDash([]);
        cursorCtx.strokeRect(session.target.x - 3 * unit, session.target.y - 3 * unit, 6 * unit, 6 * unit);
      }
      cursorCtx.restore();

      if (now - readoutAt > READOUT_SECONDS * 1000) {
        readoutAt = now;
        setReadout(here);
        setNote(session.refused);
      }
    };

    const local = (event: PointerEvent | WheelEvent): Vec2 => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onPointerDown = (event: PointerEvent): void => {
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
    };

    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      session.camera = zoomAbout(session.camera, local(event), viewport, Math.exp(-event.deltaY * 0.001));
    };

    const onContextMenu = (event: Event): void => event.preventDefault();

    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);
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
    };
  }, [session, world, sky, fauna]);

  const wanted = filter.trim().toLowerCase();
  const matches = (entry: ZooEntry): boolean => wanted === '' || entry.name.toLowerCase().includes(wanted);

  return (
    <div className="zoo">
      <aside className="zoo-list">
        <input className="zoo-search" placeholder="search" value={filter} onChange={(event) => setFilter(event.target.value)} />
        {GROUPS.map(({ group, title }) => {
          const entries = ZOO.filter((entry) => entry.group === group && matches(entry));
          if (entries.length === 0) return null;
          return (
            <section key={group}>
              <h2>{title}</h2>
              {entries.map((entry) => (
                <button key={entry.life} className={entry === selected ? 'zoo-entry zoo-on' : 'zoo-entry'} onClick={() => choose(entry)}>
                  {entry.name}
                </button>
              ))}
            </section>
          );
        })}
      </aside>
      <main className="zoo-stage">
        <canvas ref={canvasRef} className="zoo-canvas" />
        <canvas ref={litRef} className="zoo-overlay" />
        <canvas ref={cursorRef} className="zoo-overlay" />
        <div className="zoo-bar">
          <button onClick={() => session.elsewhere()}>elsewhere</button>
          <button className={plants ? 'zoo-on' : ''} onClick={() => setPlants(!plants)}>plants</button>
          <button className={paused ? 'zoo-on' : ''} onClick={() => { session.paused = !session.paused; setPaused(session.paused); }}>pause</button>
        </div>
        <div className="zoo-readout">
          {readout ? (
            <>
              <strong>{readout.name}</strong> ({readout.group})
              <div>{readout.travelling ? `travelling, ${readout.remaining.toFixed(1)} m to go at ${readout.speed.toFixed(2)} m/s` : 'natural behaviour'}</div>
            </>
          ) : (
            <div>pick an animal</div>
          )}
          {note && <div className="zoo-note">{note}</div>}
          <div className="zoo-help">right click: send it there. click: startle. drag: pan. wheel: zoom.</div>
        </div>
      </main>
    </div>
  );
}
