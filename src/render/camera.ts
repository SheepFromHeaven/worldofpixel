import type { Bounds, Vec2 } from '../sim/geometry.ts';
import { WORLD_EXTENT, WORLD_MARGIN } from '../sim/terrain.ts';

export interface Viewport {
  width: number;
  height: number;
}

/** World → screen: `screen = (world - centre) * zoom + viewport/2`. */
export interface Camera {
  centre: Vec2;
  zoom: number;
}

/**
 * Zoom is screen pixels per world unit. The range spans the whole world to a parcel filling a
 * thumb.
 *
 * The far end is set by the pixel rather than by taste: the sharpest rung of the ground is a
 * thirty-second of a parcel, and the drawn zoom holds its texels at two or three buffer pixels,
 * so beyond about four times that there is nothing left to reveal — only the same pixels, wider.
 */
export const ZOOM_RANGE = { min: 0.7, max: 68 } as const;

/** Everything there is to look at: the world and the sea drawn around it. */
export function drawnBounds(): Bounds {
  return {
    minX: -WORLD_MARGIN,
    minY: -WORLD_MARGIN,
    maxX: WORLD_EXTENT.width + WORLD_MARGIN,
    maxY: WORLD_EXTENT.height + WORLD_MARGIN,
  };
}

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));

/**
 * Keep the view on the map. The camera is held so the visible rectangle stays inside the drawn
 * area, and the zoom floor is whatever makes that area fill the window — without it you can pull
 * back or pan off onto bare paper, where the land simply stops but anything drawn live on top of
 * it does not.
 */
/**
 * The scale the map is actually drawn at.
 *
 * The same as the camera's, deliberately: zooming has to be fluid. Snapping this to a whole
 * number of buffer pixels per texel does make every texel on screen exactly one size, and it
 * was tried — but it turns the wheel into a ladder of about fourteen steps across the range,
 * and the stepping is worse to live with than the unevenness it cures.
 */
export function viewZoom(camera: Camera): number {
  return camera.zoom;
}

export function clampCamera(camera: Camera, viewport?: Viewport): Camera {
  const bounds = drawnBounds();
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const floor = viewport ? Math.max(viewport.width / width, viewport.height / height) : 0;
  const lowest = Math.max(ZOOM_RANGE.min, floor);

  const zoom = clamp(camera.zoom, lowest, ZOOM_RANGE.max);

  if (!viewport) return { zoom, centre: camera.centre };

  const halfWidth = viewport.width / (2 * zoom);
  const halfHeight = viewport.height / (2 * zoom);
  return {
    zoom,
    centre: {
      x: clamp(camera.centre.x, bounds.minX + halfWidth, bounds.maxX - halfWidth),
      y: clamp(camera.centre.y, bounds.minY + halfHeight, bounds.maxY - halfHeight),
    },
  };
}

/** Takes a camera already at its drawn zoom — `game.view`, never `game.camera`. */
export function applyCamera(ctx: CanvasRenderingContext2D, camera: Camera, viewport: Viewport): void {
  ctx.translate(viewport.width / 2, viewport.height / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.centre.x, -camera.centre.y);
}

export function screenToWorld(point: Vec2, camera: Camera, viewport: Viewport): Vec2 {
  return {
    x: (point.x - viewport.width / 2) / camera.zoom + camera.centre.x,
    y: (point.y - viewport.height / 2) / camera.zoom + camera.centre.y,
  };
}

export function visibleBounds(camera: Camera, viewport: Viewport): Bounds {
  const halfWidth = viewport.width / (2 * camera.zoom);
  const halfHeight = viewport.height / (2 * camera.zoom);
  return {
    minX: camera.centre.x - halfWidth,
    minY: camera.centre.y - halfHeight,
    maxX: camera.centre.x + halfWidth,
    maxY: camera.centre.y + halfHeight,
  };
}

/** Zoom about a point on screen, so whatever is under the cursor stays under it. */
export function zoomAbout(camera: Camera, screen: Vec2, viewport: Viewport, factor: number): Camera {
  const anchor = screenToWorld(screen, camera, viewport);
  const zoomed = clampCamera({ centre: camera.centre, zoom: camera.zoom * factor }, viewport);
  const after = screenToWorld(screen, zoomed, viewport);
  return clampCamera(
    {
      zoom: zoomed.zoom,
      centre: {
        x: zoomed.centre.x + (anchor.x - after.x),
        y: zoomed.centre.y + (anchor.y - after.y),
      },
    },
    viewport,
  );
}

export const fitWorld = (viewport: Viewport): Camera =>
  clampCamera(
    {
      centre: { x: WORLD_EXTENT.width / 2, y: WORLD_EXTENT.height / 2 },
      zoom: Math.min(viewport.width / WORLD_EXTENT.width, viewport.height / WORLD_EXTENT.height),
    },
    viewport,
  );
