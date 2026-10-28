import { MAMMALS_FROM_ZOOM } from '../render/lit/mammalPass.ts';
import { useEffect, useRef } from 'react';
import type { Viewport } from '../render/camera.ts';
import { applyCamera, screenToWorld, visibleBounds } from '../render/camera.ts';
import type { LitLayer } from '../render/lit/litLayer.ts';
import { createLitLayer } from '../render/lit/litLayer.ts';
import { CURSOR_SEE_THROUGH_FROM_ZOOM, seeThroughFoci } from './litTrees.ts';
import { drawPaper } from '../render/paper.ts';
import { bufferFor, present, SCALE } from '../render/screen.ts';
import { drawWorld } from '../render/worldLayer.ts';
import type { Vec2 } from '../sim/geometry.ts';
import { NOWHERE } from '../sim/grid.ts';
import { NOBODY } from '../sim/people/people.ts';
import { Water } from '../sim/terrain/hydrology.ts';
import { game } from './game.ts';
import { keys } from './controls.ts';
import { drawCloseUp, layoutFor, toFloor } from './closeUp.ts';
import { INK, PAPER } from '../render/palette.ts';
import { drawPeopleDots } from './peopleDraw.ts';
import { RadialMenuController } from './radialMenu.ts';
import { slicesFor } from './radialSlices.ts';
import { drawAlert, drawPersonMark, drawTileCursor } from './tileCursor.ts';

const CLICK_SLOP = 4;

const SHOT_WIDTH = 320;

const SHOT_QUALITY = 0.7;

function shotOf(ground: HTMLCanvasElement | OffscreenCanvas, lit: HTMLCanvasElement): string | null {
  if (ground.width === 0 || ground.height === 0) return null;
  const shot = document.createElement('canvas');
  shot.width = SHOT_WIDTH;
  shot.height = Math.max(1, Math.round((SHOT_WIDTH * ground.height) / ground.width));
  const ctx = shot.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(ground, 0, 0, shot.width, shot.height);
  if (lit.width > 0 && lit.height > 0) ctx.drawImage(lit, 0, 0, shot.width, shot.height);
  return shot.toDataURL('image/jpeg', SHOT_QUALITY);
}

const MAX_ANIMAL_RADIUS = 160;

export function GameCanvas(): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const litRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLCanvasElement>(null);
  const closeRef = useRef<HTMLCanvasElement>(null);
  const fpsRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<Vec2 | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const lit = litRef.current;
    const cursor = cursorRef.current;
    const cursorCtx = cursor?.getContext('2d');
    const close = closeRef.current;
    const fps = fpsRef.current;
    const closeCtx = close?.getContext('2d');
    if (!canvas || !ctx || !lit || !cursor || !cursorCtx || !close || !closeCtx || !fps) return;
    let closePointer: Vec2 | null = null;

    const litLayer: LitLayer | null = createLitLayer(lit);
    const radial = new RadialMenuController();
    let last = performance.now();
    let refreshed = last;
    let counted = last;
    let frames = 0;

    if (import.meta.env.DEV) (window as unknown as { game: typeof game }).game = game;
    (window as unknown as { se: unknown }).se = {
      view: () => game.debugView(),
      load: (view: string | object) => game.loadView(typeof view === 'string' ? view : JSON.stringify(view)),
      skip: (hours: number) => game.skip(hours),
    };

    let frameHandle = 0;
    let viewport: Viewport = { width: canvas.clientWidth, height: canvas.clientHeight };
    let drag: { from: Vec2; moved: number } | null = null;
    let radialHeld = false;

    const inBuffer = (point: Vec2): Vec2 => ({ x: point.x / SCALE, y: point.y / SCALE });

    const openRadial = (point: Vec2): void => {
      if (!game.reaches) return;
      const index = game.tileUnder(screenToWorld(point, game.view, viewport));
      if (index === NOWHERE) return;
      if (!radial.open(inBuffer(point), index, slicesFor(game, index))) return;
      game.hoveredIndex = index;
      game.publish();
    };

    const releaseRadial = (point: Vec2): void => {
      if (!radialHeld) return;
      radialHeld = false;
      radial.release(inBuffer(point));
    };

    const deviceRatio = (): number =>
      Math.max(1, Math.floor(Math.min(2, window.devicePixelRatio || 1)));

    const resize = (): void => {
      const ratio = deviceRatio();
      viewport = { width: canvas.clientWidth, height: canvas.clientHeight };
      canvas.width = Math.round(viewport.width * ratio);
      canvas.height = Math.round(viewport.height * ratio);
    };

    const hoverAt = (point: Vec2 | null): void => {
      const found =
        point && game.reaches ? game.tileUnder(screenToWorld(point, game.view, viewport)) : NOWHERE;
      if (found === game.hoveredIndex) return;
      game.hoveredIndex = found;
      game.publish();
    };

    const fitOverlay = (overlay: HTMLCanvasElement, frame: { width: number; height: number }): void => {
      if (overlay.width !== frame.width || overlay.height !== frame.height) {
        overlay.width = frame.width;
        overlay.height = frame.height;
      }
      overlay.style.width = `${frame.width * SCALE}px`;
      overlay.style.height = `${frame.height * SCALE}px`;
    };

    const render = (now: number): void => {
      frameHandle = requestAnimationFrame(render);
      frames += 1;
      if (now - counted >= 500) {
        fps.textContent = `${Math.round((frames * 1000) / (now - counted))} fps`;
        counted = now;
        frames = 0;
      }
      if (!radial.isOpen) hoverAt(pointerRef.current);
      game.advance(Math.min(0.1, (now - last) / 1000));
      if ((game.openedIndex !== NOWHERE || game.selectedPerson !== NOBODY || game.selectedStructure !== NOWHERE) && now - refreshed > 300) {
        refreshed = now;
        game.publish();
      }
      last = now;

      const frame = bufferFor(viewport.width, viewport.height);
      if (!frame) return;

      const lens = { centre: game.camera.centre, zoom: game.zoom / SCALE };
      const pane = { width: frame.width, height: frame.height };

      drawPaper(frame.ctx, pane.width, pane.height);

      frame.ctx.save();
      applyCamera(frame.ctx, lens, pane);
      const bounds = visibleBounds(lens, pane);
      drawWorld(frame.ctx, game.world, { bounds, zoom: lens.zoom, time: game.playTime });
      frame.ctx.restore();

      const ratio = deviceRatio();
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      present(ctx, frame);

      fitOverlay(lit, frame);
      game.watch(lens.centre, lens.zoom < MAMMALS_FROM_ZOOM ? 0 : Math.min(MAX_ANIMAL_RADIUS, 0.6 * Math.hypot(frame.width, frame.height) / lens.zoom + 24));
      litLayer?.setMammalAgents(game.mammalAgents());
      const pointer = pointerRef.current;
      const lensPoint = pointer && !radial.isOpen && lens.zoom > CURSOR_SEE_THROUGH_FROM_ZOOM ? screenToWorld(pointer, game.view, viewport) : null;
      litLayer?.draw(game.world, { centre: lens.centre, zoom: lens.zoom, width: frame.width, height: frame.height, time: game.playTime, ground: frame.ctx.canvas, people: game.people, shoals: game.shoals, fauna: game.fauna, fog: game.fogView(), depth: game.depth, see: seeThroughFoci(game.people, game.selectedPerson, lensPoint, lens.zoom) }, game.lightingAt(game.playTime), game.sky, game.shownView);

      if (game.saveDue) {
        game.shot = shotOf(frame.ctx.canvas, lit);
        game.save();
      }

      fitOverlay(cursor, frame);
      cursorCtx.setTransform(1, 0, 0, 1, 0, 0);
      cursorCtx.clearRect(0, 0, frame.width, frame.height);
      cursorCtx.save();
      applyCamera(cursorCtx, lens, pane);
      if (game.viewMode === 0 && !litLayer?.showsFolk) drawPeopleDots(cursorCtx, game.people, lens.zoom);
      drawTileCursor(cursorCtx, game.world, game.tool !== null && !radial.isOpen ? game.hoveredIndex : NOWHERE, game.openedIndex);
      if (game.selectedStructure !== NOWHERE) {
        const at = game.world.grid.centre(game.selectedStructure);
        drawPersonMark(cursorCtx, at.x, at.y);
      }
      if (game.selectedPerson !== NOBODY) drawPersonMark(cursorCtx, game.people.posX[game.selectedPerson]!, game.people.posY[game.selectedPerson]!);
      if (game.viewMode === 0) {
        for (let person = 0; person < game.people.count; person += 1) {
          if (game.isAlarmed(person)) drawAlert(cursorCtx, game.people.posX[person]!, game.people.posY[person]!, game.playTime);
        }
      }
      cursorCtx.restore();

      if (game.viewMode === 0) radial.draw(cursorCtx);

      const trial = game.trial;
      close.style.display = trial ? 'block' : 'none';
      if (trial) {
        const layout = layoutFor(close.clientWidth, close.clientHeight);
        if (close.width !== layout.width || close.height !== layout.height) {
          close.width = layout.width;
          close.height = layout.height;
        }
        const light = game.lightingAt(game.playTime);
        drawCloseUp(closeCtx, game.world, trial, layout, closePointer, { gloom: light.gloom, tint: light.tint, time: game.playTime });
      }
    };

    const closePoint = (event: PointerEvent): Vec2 => {
      const rect = close.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onClosePointerMove = (event: PointerEvent): void => {
      closePointer = closePoint(event);
    };

    const onClosePointerDown = (event: PointerEvent): void => {
      const trial = game.trial;
      if (!trial) return;
      closePointer = closePoint(event);
      if (event.button === 2) {
        game.leaveTrial();
        return;
      }
      if (event.button !== 0) return;
      const at = toFloor(layoutFor(close.clientWidth, close.clientHeight), closePointer);
      const target = trial.pieceAt(at.x, at.y);
      if (trial.held) {
        if (target) trial.act(target);
        else trial.drop(at.x, at.y);
      } else if (target) trial.pick(target);
    };

    const onClosePointerLeave = (): void => {
      closePointer = null;
    };

    const localPoint = (event: PointerEvent | WheelEvent): Vec2 => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onPointerDown = (event: PointerEvent): void => {
      const point = localPoint(event);
      pointerRef.current = point;

      if (event.button === 2) {
        openRadial(point);
        radialHeld = radial.isOpen;
        if (radialHeld) canvas.setPointerCapture(event.pointerId);
        return;
      }
      if (event.button !== 0) return;
      if (radial.isOpen) {
        radial.click(inBuffer(point));
        return;
      }
      hoverAt(point);
      drag = { from: point, moved: 0 };
      canvas.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent): void => {
      const point = localPoint(event);
      const previous = pointerRef.current;
      pointerRef.current = point;
      if (radial.isOpen) {
        radial.move(inBuffer(point));
        return;
      }
      if (!drag || !previous) return;

      drag.moved += Math.hypot(point.x - previous.x, point.y - previous.y);
      game.pan(point.x - previous.x, point.y - previous.y, viewport);
    };

    const onPointerUp = (event: PointerEvent): void => {
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (event.button === 2) {
        releaseRadial(localPoint(event));
        return;
      }
      const finished = drag;
      drag = null;
      if (!finished || finished.moved > CLICK_SLOP) return;

      if (!game.reaches) return;
      const point = screenToWorld(finished.from, game.view, viewport);
      if (game.tool === null) {
        game.selectAt(point);
        game.startle(point);
        const under = game.tileUnder(point);
        if (under !== NOWHERE && game.world.field.water[under] !== Water.None) litLayer?.throwRipple(point.x, point.y, game.playTime);
        return;
      }
      const index = game.tileUnder(point);
      if (index === NOWHERE) {
        game.openTile(NOWHERE);
        return;
      }
      game.use(index);
      const wet = game.world.field.water[index] !== Water.None;
      if (wet) game.startle({ x: game.world.grid.x(game.world.grid.columnOf(index)), y: game.world.grid.y(game.world.grid.rowOf(index)) });
      if (wet) litLayer?.throwRipple(game.world.grid.x(game.world.grid.columnOf(index)), game.world.grid.y(game.world.grid.rowOf(index)), game.playTime);
    };

    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      radial.close();
      radialHeld = false;
      game.zoomAt(localPoint(event), viewport, Math.exp(-event.deltaY * 0.001));
    };

    const onPointerLeave = (): void => {
      pointerRef.current = null;
    };

    const onContextMenu = (event: Event): void => event.preventDefault();

    resize();
    game.fit(viewport);
    window.addEventListener('resize', resize);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);
    close.addEventListener('pointermove', onClosePointerMove);
    close.addEventListener('pointerdown', onClosePointerDown);
    close.addEventListener('pointerleave', onClosePointerLeave);
    close.addEventListener('contextmenu', onContextMenu);
    const unhandle = [
      keys.on('radial', (phase) => {
        if (phase === 'release') {
          releaseRadial(pointerRef.current ?? { x: 0, y: 0 });
          return true;
        }
        if (!pointerRef.current || radial.isOpen) return false;
        openRadial(pointerRef.current);
        radialHeld = radial.isOpen;
        return radialHeld;
      }),
      keys.on('cancel', (phase) => {
        if (phase !== 'press' || !game.trial) return false;
        game.leaveTrial();
        return true;
      }),
      keys.on('cancel', (phase) => {
        if (phase !== 'press' || !radial.isOpen) return false;
        radial.close();
        radialHeld = false;
        return true;
      }),
    ];
    const detach = keys.attach(window);
    const onLeave = (): void => game.save();
    window.addEventListener('pagehide', onLeave);
    document.addEventListener('visibilitychange', onLeave);
    frameHandle = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameHandle);
      litLayer?.dispose();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pagehide', onLeave);
      document.removeEventListener('visibilitychange', onLeave);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      close.removeEventListener('pointermove', onClosePointerMove);
      close.removeEventListener('pointerdown', onClosePointerDown);
      close.removeEventListener('pointerleave', onClosePointerLeave);
      close.removeEventListener('contextmenu', onContextMenu);
      for (const off of unhandle) off();
      detach();
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="se-canvas" />
      <canvas ref={litRef} className="se-overlay" />
      <canvas ref={cursorRef} className="se-overlay" />
      <canvas ref={closeRef} className="se-closeup" />
      <div ref={fpsRef} style={{ position: 'fixed', left: 8, bottom: 8, padding: '2px 6px', font: '12px monospace', color: PAPER, background: INK, pointerEvents: 'none', zIndex: 10 }} />
    </>
  );
}
