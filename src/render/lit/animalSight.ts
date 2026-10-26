export const SIGHT_BIGGEST_METRES = 5;
export const SIGHT_NEAREST_ZOOM = 8;
export const SIGHT_FARTHEST_ZOOM = 48;
export const SIGHT_FADE_LEVELS = 0.75;

export const seenFromZoom = (lengthMetres: number): number =>
  Math.min(
    SIGHT_FARTHEST_ZOOM,
    Math.max(SIGHT_NEAREST_ZOOM, SIGHT_NEAREST_ZOOM * Math.sqrt(SIGHT_BIGGEST_METRES / Math.max(lengthMetres, 0.001))),
  );

export const nearestSeenZoom = (lengths: readonly number[]): number =>
  Math.min(...lengths.map(seenFromZoom)) / 2 ** SIGHT_FADE_LEVELS;
