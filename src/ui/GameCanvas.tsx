import { useEffect, useRef } from 'react';
import type { Viewport } from '../render/camera.ts';
import { applyCamera, screenToWorld, visibleBounds } from '../render/camera.ts';
import type { LitLayer } from '../render/lit/litLayer.ts';
import { createLitLayer } from '../render/lit/litLayer.ts';
import { drawPaper } from '../render/paper.ts';
import { bufferFor, present, SCALE } from '../render/screen.ts';
import { drawWorld } from '../render/worldLayer.ts';
import type { Vec2 } from '../sim/geometry.ts';
import { NOWHERE } from '../sim/grid.ts';
import { Water } from '../sim/terrain/hydrology.ts';
import { game } from './game.ts';
import { drawTileCursor } from './tileCursor.ts';

const CLICK_SLOP = 4;

export function GameCanvas(): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const litRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef<Vec2 | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const lit = litRef.current;
    const cursor = cursorRef.current;
    const cursorCtx = cursor?.getContext('2d');
    if (!canvas || !ctx || !lit || !cursor || !cursorCtx) return;

    const litLayer: LitLayer | null = createLitLayer(lit);
    let last = performance.now();
    let refreshed = last;

    if (import.meta.env.DEV) (window as unknown as { game: typeof game }).game = game;

    let frameHandle = 0;
    let viewport: Viewport = { width: canvas.clientWidth, height: canvas.clientHeight };
    let drag: { from: Vec2; moved: number } | null = null;

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
      hoverAt(pointerRef.current);
      game.advanceLight(Math.min(0.1, (now - last) / 1000));
      if (game.openedIndex !== NOWHERE && now - refreshed > 500) {
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
      litLayer?.draw(game.world, { centre: lens.centre, zoom: lens.zoom, width: frame.width, height: frame.height, time: game.playTime, ground: frame.ctx.canvas }, game.lightingAt(game.playTime), game.sky, game.viewMode);

      fitOverlay(cursor, frame);
      cursorCtx.setTransform(1, 0, 0, 1, 0, 0);
      cursorCtx.clearRect(0, 0, frame.width, frame.height);
      cursorCtx.save();
      applyCamera(cursorCtx, lens, pane);
      drawTileCursor(cursorCtx, game.world, game.hoveredIndex, game.openedIndex);
      cursorCtx.restore();
    };

    const localPoint = (event: PointerEvent | WheelEvent): Vec2 => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return;
      const point = localPoint(event);
      pointerRef.current = point;
      hoverAt(point);
      drag = { from: point, moved: 0 };
      canvas.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent): void => {
      const point = localPoint(event);
      const previous = pointerRef.current;
      pointerRef.current = point;
      if (!drag || !previous) return;

      drag.moved += Math.hypot(point.x - previous.x, point.y - previous.y);
      game.pan(point.x - previous.x, point.y - previous.y, viewport);
    };

    const onPointerUp = (event: PointerEvent): void => {
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      const finished = drag;
      drag = null;
      if (!finished || finished.moved > CLICK_SLOP) return;

      if (!game.reaches) return;
      const index = game.tileUnder(screenToWorld(finished.from, game.view, viewport));
      if (index === NOWHERE) {
        game.openTile(NOWHERE);
        return;
      }
      game.use(index);
      const wet = game.world.field.water[index] !== Water.None;
      if (wet) litLayer?.throwRipple(game.world.grid.x(game.world.grid.columnOf(index)), game.world.grid.y(game.world.grid.rowOf(index)), game.playTime);
      if (game.tool === 'look') game.openTile(index);
    };

    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      game.zoomAt(localPoint(event), viewport, Math.exp(-event.deltaY * 0.001));
    };

    const onPointerLeave = (): void => {
      pointerRef.current = null;
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        if (game.openedIndex !== NOWHERE) game.openTile(NOWHERE);
        else if (game.tool !== 'look') game.setTool('look');
      }
    };

    resize();
    game.fit(viewport);
    window.addEventListener('resize', resize);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    frameHandle = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameHandle);
      litLayer?.dispose();
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="se-canvas" />
      <canvas ref={litRef} className="se-overlay" />
      <canvas ref={cursorRef} className="se-overlay" />
    </>
  );
}
