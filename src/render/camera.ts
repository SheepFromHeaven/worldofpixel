import type { Bounds, Vec2 } from '../sim/geometry.ts';
import { CAMERA_MARGIN, WORLD_EXTENT } from '../sim/terrain/terrain.ts';

export interface Viewport {
  width: number;
  height: number;
}

export interface Camera {
  centre: Vec2;
  zoom: number;
}

export const ZOOM_RANGE = { min: 0.5, max: 160 } as const;

export function drawnBounds(): Bounds {
  return {
    minX: -CAMERA_MARGIN,
    minY: -CAMERA_MARGIN,
    maxX: WORLD_EXTENT.width + CAMERA_MARGIN,
    maxY: WORLD_EXTENT.height + CAMERA_MARGIN,
  };
}

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));

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
