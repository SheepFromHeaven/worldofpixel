import type { Camera, Viewport } from '../render/camera.ts';
import { clampCamera, fitWorld, zoomAbout } from '../render/camera.ts';
import type { FogView } from '../render/lit/litLayer.ts';
import type { Vec2 } from '../sim/geometry.ts';
import { FRONTIER } from '../sim/frontier.ts';
import { FIRE_PADDING_PIXELS, LOCKED_MIN_ZOOM, OPEN_ZOOM } from './gameTuning.ts';
import type { Game } from './game.ts';

export function fit(game: Game, viewport: Viewport): void {
  game.viewport = viewport;
  open(game);
  game.publish();
}

export function reframe(game: Game, viewport: Viewport): void {
  game.viewport = viewport;
  game.camera = held(game, game.camera, viewport);
}

export function open(game: Game): void {
  const viewport = game.viewport;
  if (!viewport) return;

  const first =
    game.restoredCamera ??
    (game.mode === 'discover'
      ? fitWorld(viewport)
      : {
          centre: game.replica.spot,
          zoom: game.free ? OPEN_ZOOM : Math.max(OPEN_ZOOM, LOCKED_MIN_ZOOM),
        });
  game.restoredCamera = null;
  game.camera = held(game, first, viewport);
}

export function held(game: Game, camera: Camera, viewport: Viewport): Camera {
  const floor = game.zoomFloor;
  const bounded = clampCamera({ centre: camera.centre, zoom: Math.max(camera.zoom, floor) }, viewport);
  if (!game.free) return { zoom: bounded.zoom, centre: tetheredCentre(game, bounded.centre) };
  const fire = nearestFire(game, bounded.centre);
  if (!game.free || !fire) return bounded;

  const reachX = Math.max(FRONTIER.fogOpened, (viewport.width / 2 - FIRE_PADDING_PIXELS) / bounded.zoom);
  const reachY = Math.max(FRONTIER.fogOpened, (viewport.height / 2 - FIRE_PADDING_PIXELS) / bounded.zoom);
  return {
    zoom: bounded.zoom,
    centre: {
      x: Math.min(fire.x + reachX, Math.max(fire.x - reachX, bounded.centre.x)),
      y: Math.min(fire.y + reachY, Math.max(fire.y - reachY, bounded.centre.y)),
    },
  };
}

export function tetheredCentre(game: Game, centre: Vec2): Vec2 {
  const { spot } = game.replica;
  const away = Math.hypot(centre.x - spot.x, centre.y - spot.y);
  if (away <= FRONTIER.panTiles) return centre;
  const pull = FRONTIER.panTiles / away;
  return { x: spot.x + (centre.x - spot.x) * pull, y: spot.y + (centre.y - spot.y) * pull };
}

export function nearestFire(game: Game, from: Vec2): Vec2 | null {
  const { grid } = game.world;
  const { fires, embers } = game.world.structures;
  let found: Vec2 | null = null;
  let least = Infinity;
  for (const tile of [...fires, ...embers]) {
    const at = grid.centre(tile);
    const away = Math.hypot(at.x - from.x, at.y - from.y);
    if (away < least) {
      least = away;
      found = at;
    }
  }
  return found;
}

export function fogView(game: Game): FogView | null {
  if (game.mode === 'discover') return null;
  if (!game.free && game.fogLift <= 0) return { x: game.replica.spot.x, y: game.replica.spot.y, inner: FRONTIER.fogClear, edge: FRONTIER.fogEdge };
  const eased = game.fogLift * game.fogLift;
  return {
    x: game.replica.spot.x,
    y: game.replica.spot.y,
    inner: FRONTIER.fogClear + eased * (FRONTIER.fogOpened - FRONTIER.fogClear),
    edge: FRONTIER.fogEdge + eased * (FRONTIER.fogOpenedEdge - FRONTIER.fogEdge),
  };
}

export function pan(game: Game, dx: number, dy: number, viewport: Viewport): void {
  game.camera = held(game, 
    {
      zoom: game.camera.zoom,
      centre: {
        x: game.camera.centre.x - dx / game.zoom,
        y: game.camera.centre.y - dy / game.zoom,
      },
    },
    viewport,
  );
}

export function zoomAt(game: Game, screen: Vec2, viewport: Viewport, factor: number): void {
  game.camera = held(game, zoomAbout(game.camera, screen, viewport, Math.max(factor, game.zoomFloor / game.camera.zoom)), viewport);
  game.publish();
}

export function showWorld(game: Game, viewport: Viewport): void {
  game.camera = fitWorld(viewport);
  game.publish();
}
