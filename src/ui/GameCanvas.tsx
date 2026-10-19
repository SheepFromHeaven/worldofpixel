import { useEffect, useRef } from 'react';
import { applyCamera, screenToWorld, visibleBounds } from '../render/camera.ts';
import { SCALE, bufferFor, present } from '../render/screen.ts';
import { tileFits } from '../render/sprites.ts';
import type { Viewport } from '../render/camera.ts';
import { drawBuildingInterior } from '../render/interiorLayer.ts';
import { drawSettlementStats } from '../render/statsLayer.ts';
import { drawPaper } from '../render/paper.ts';
import { drawTowns } from '../render/townLayer.ts';
import { describeParcel, drawWorld } from '../render/worldLayer.ts';
import { drawLandYields } from '../render/yieldLayer.ts';
import { labelOf, radiusOf } from '../sim/buildings.ts';
import { distance } from '../sim/geometry.ts';
import type { Vec2 } from '../sim/geometry.ts';
import { parcelOf } from '../sim/parcels.ts';
import { HEARTH_DESIGN } from '../sim/designs.ts';
import { game } from './game.ts';

/**
 * Holding this keeps what is in hand after it is raised, so a row of sheds is one key and a run
 * of clicks. Without it a raised building ends the build: a tool that stays in hand turns every
 * stray click on the ground into a shed nobody asked for, which is the more expensive mistake —
 * and there is no longer an Inspect button to put it down with.
 */
const chaining = (event: PointerEvent): boolean => event.shiftKey;

/** A press that moves less than this is a click, not a drag. */
const CLICK_SLOP = 4;
/** Clicks land within this multiple of a building's drawn radius. */
const PICK_SLACK = 1.4;

function pickBuilding(point: Vec2): string | null {
  let best: { id: string; gap: number } | null = null;

  for (const settlement of game.world.settlements.values()) {
    for (const building of settlement.buildings.values()) {
      const gap = distance(point, building.position);
      if (gap <= radiusOf(building) * PICK_SLACK && (!best || gap < best.gap)) {
        best = { id: building.id, gap };
      }
    }
  }

  return best?.id ?? null;
}

/** How close to a town's fire a click counts as a click on the town, in screen pixels. */
const MARK_PIXELS = 34;

function updateHover(point: Vec2 | null): void {
  if (!point) {
    game.hoveredParcelId = null;
    game.hoveredBuildingId = null;
    game.hoveredLabel = null;
    game.hoverAction = 'none';
    return;
  }

  if (game.detail() !== 'fine') {
    const town = game.settlementMarkAt(point, MARK_PIXELS / game.zoom);
    game.hoveredParcelId = null;
    game.hoveredBuildingId = null;
    game.hoverAction = 'none';
    game.hoveredLabel = town ? `${town.name} — click to read the ledger` : null;
    return;
  }

  const parcelId = game.parcelUnder(point);
  const buildingId = pickBuilding(point);
  const check = game.toolCheck(parcelId, buildingId);
  const settlement = game.townAt(point);
  const onDirt = Boolean(settlement?.roads.has(parcelId));

  game.hoveredParcelId = parcelId;
  game.hoveredBuildingId = buildingId;
  game.hoverAction = !check.ok
    ? 'none'
    : game.tool === 'inspect'
      ? 'open'
      : game.tool === 'hearth'
        ? 'found'
        : game.tool === 'road'
          ? buildingId
            ? 'link'
            : onDirt
              ? 'lift'
              : 'pave'
          : game.tool === 'raze'
            ? buildingId
              ? 'raze'
              : 'lift'
            : 'build';

  const building = buildingId ? game.buildingById(buildingId) : undefined;
  const ground = describeParcel(parcelOf(game.world.seed, parcelId));
  game.hoveredLabel = building
    ? `${labelOf(building)} — ${building.state.toLowerCase()}${check.reason ? ` · ${check.reason}` : ''}`
    : `${ground}${check.reason ? ` · ${check.reason}` : ''}`;
}

export function GameCanvas(): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef<Vec2 | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let frameHandle = 0;
    let viewport: Viewport = { width: canvas.clientWidth, height: canvas.clientHeight };
    let drag: { from: Vec2; moved: number; painting: boolean; laying: boolean } | null = null;
    const painted = new Set<string>();

    // Whole device pixels only. At 1.5 the buffer's pixels land on fractions of a physical one
    // and the grid the whole look rests on stops being square.
    const deviceRatio = (): number => Math.max(1, Math.floor(Math.min(2, window.devicePixelRatio || 1)));

    const resize = (): void => {
      const ratio = deviceRatio();
      viewport = { width: canvas.clientWidth, height: canvas.clientHeight };
      canvas.width = Math.round(viewport.width * ratio);
      canvas.height = Math.round(viewport.height * ratio);
    };

    const render = (now: number): void => {
      frameHandle = requestAnimationFrame(render);
      game.advance(now);

      const seconds = now / 1000;
      const before = `${game.hoveredParcelId}|${game.hoveredBuildingId}|${game.hoveredLabel}`;
      updateHover(pointerRef.current ? screenToWorld(pointerRef.current, game.view, viewport) : null);
      if (`${game.hoveredParcelId}|${game.hoveredBuildingId}|${game.hoveredLabel}` !== before) {
        game.publish();
      }

      // The world is drawn small and blown up. Everything inside the buffer works in buffer
      // pixels, so the camera and the viewport are both divided down to match.
      const frame = bufferFor(viewport.width, viewport.height);
      if (!frame) return;

      const lens = { centre: game.camera.centre, zoom: game.zoom / SCALE };
      const pane = { width: frame.width, height: frame.height };

      drawPaper(frame.ctx, pane.width, pane.height);

      frame.ctx.save();
      applyCamera(frame.ctx, lens, pane);
      const bounds = visibleBounds(lens, pane);
      drawWorld(frame.ctx, game.world, { bounds, zoom: lens.zoom, time: seconds });

      const landWork = game.heldLandWork();
      if (landWork && game.detail() === 'fine') {
        drawLandYields(frame.ctx, game.world, { bounds, zoom: lens.zoom, held: landWork.item });
      }

      // The whole town is only drawn where the eye can resolve it. Further out it is one mark
      // on the map and the ledger says what is happening inside — which is also what keeps a
      // world of settlements from costing a frame each. The hearth's own tile decides where
      // that line falls: the town is drawn exactly as long as the buildings in it can be.
      if (tileFits('hearth', lens.zoom)) {
        drawTowns(frame.ctx, game.world, {
          time: seconds,
          zoom: lens.zoom,
          carrierPositions: game.carrierPositions(now),
          tool: game.tool,
          hoveredParcelId: game.hoveredParcelId,
          hoveredBuildingId: game.hoveredBuildingId,
          hoverAction: game.hoverAction,
          ghost: game.tool === 'hearth' ? HEARTH_DESIGN : (game.heldDesign() ?? null),
          ghostInputs: game.ghostInputs(),
        });
      }
      frame.ctx.restore();

      const ratio = deviceRatio();
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      present(ctx, frame);

      // The panels stay at the window's own resolution. They are mostly words, and words read
      // at a third the pixels are just words you cannot read.
      const openId = game.openBuildingId;
      if (openId) {
        const building = game.buildingById(openId);
        if (building) {
          drawBuildingInterior(ctx, building, viewport, seconds, game.tickFraction(now));
        }
      }

      const openTown = game.openSettlementId;
      if (openTown) {
        const settlement = game.world.settlements.get(openTown);
        if (settlement) drawSettlementStats(ctx, settlement, viewport, seconds);
      }
    };

    const localPoint = (event: PointerEvent | WheelEvent): Vec2 => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const paintUnder = (): void => {
      if (!drag?.painting || !game.hoveredParcelId) return;
      if (painted.has(game.hoveredParcelId)) return;
      painted.add(game.hoveredParcelId);
      game.paintRoad(game.hoveredParcelId, drag.laying);
    };

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return;
      const point = localPoint(event);
      pointerRef.current = point;
      updateHover(screenToWorld(point, game.view, viewport));

      const settlement = game.hoveredParcelId
        ? game.townAt(parcelOf(game.world.seed, game.hoveredParcelId).site)
        : undefined;
      // A press on a building is the one-click link, not the start of a paint stroke.
      const painting =
        game.tool === 'road' &&
        game.hoveredParcelId !== null &&
        game.hoveredBuildingId === null &&
        settlement !== undefined;

      painted.clear();
      drag = {
        from: point,
        moved: 0,
        painting,
        // The first parcel decides the whole stroke: starting on dirt erases, starting off it lays.
        laying: painting ? !settlement?.roads.has(game.hoveredParcelId ?? '') : false,
      };
      canvas.setPointerCapture(event.pointerId);
      if (painting) paintUnder();
    };

    const onPointerMove = (event: PointerEvent): void => {
      const point = localPoint(event);
      const previous = pointerRef.current;
      pointerRef.current = point;
      if (!drag || !previous) return;

      drag.moved += Math.hypot(point.x - previous.x, point.y - previous.y);
      if (drag.painting) {
        updateHover(screenToWorld(point, game.view, viewport));
        paintUnder();
      } else {
        game.pan(point.x - previous.x, point.y - previous.y, viewport);
      }
    };

    const onPointerUp = (event: PointerEvent): void => {
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      const finished = drag;
      drag = null;
      if (!finished || finished.painting || finished.moved > CLICK_SLOP) return;

      // A press that did not move is a click: act on whatever the tool is pointing at.
      if (game.openBuildingId) {
        game.hideBuilding();
        return;
      }
      if (game.openSettlementId) {
        game.showSettlement(null);
        return;
      }
      if (game.detail() !== 'fine') {
        const world = screenToWorld(finished.from, game.view, viewport);
        const town = game.settlementMarkAt(world, MARK_PIXELS / game.zoom);
        if (town) game.showSettlement(town.id);
        return;
      }
      if (game.hoverAction === 'open' && game.hoveredBuildingId) {
        game.showBuilding(game.hoveredBuildingId);
      } else if (game.hoverAction === 'found' && game.hoveredParcelId) {
        if (game.found(game.hoveredParcelId) && !chaining(event)) game.setTool('inspect');
      } else if (game.hoverAction === 'build' && game.hoveredParcelId) {
        if (game.build(game.hoveredParcelId) && !chaining(event)) game.setTool('inspect');
      } else if (game.hoverAction === 'raze' && game.hoveredBuildingId) {
        game.razeBuilding(game.hoveredBuildingId);
      } else if (game.hoverAction === 'lift' && game.hoveredParcelId) {
        game.paintRoad(game.hoveredParcelId, false);
      } else if (game.hoverAction === 'link' && game.hoveredBuildingId) {
        game.connect(game.hoveredBuildingId);
      } else if (game.hoveredBuildingId) {
        // Whatever is in hand, a click on a building that the tool has nothing to say about
        // opens it. Having to put the tool down first to look inside is one step too many.
        game.showBuilding(game.hoveredBuildingId);
      }
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
        if (game.designerOpen) game.closeDesigner();
        else if (game.openBuildingId) game.hideBuilding();
        else if (game.openSettlementId) game.showSettlement(null);
        else if (game.tool !== 'inspect') game.setTool('inspect');
      } else if (event.key === ' ') {
        event.preventDefault();
        game.setPlaying(!game.playing);
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

  return <canvas ref={canvasRef} className="se-canvas" />;
}
