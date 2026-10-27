import { paintPlanet, Planet, PLANET_HEIGHT, PLANET_WIDTH } from './planet.ts';

type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const FALLBACK_FRAME_MS = 33;

export interface PlanetRun {
  target: (share: number) => void;
  stop: () => void;
}

export function runPlanet(ctx: Context): PlanetRun {
  const planet = new Planet();
  const image = ctx.createImageData(PLANET_WIDTH, PLANET_HEIGHT);
  const started = performance.now();
  let last = started;
  let frame = 0;
  let stopped = false;

  const next = (draw: (now: number) => void): number =>
    typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame(draw)
      : (setTimeout(() => draw(performance.now()), FALLBACK_FRAME_MS) as unknown as number);

  const tick = (now: number): void => {
    if (stopped) return;
    planet.step((now - last) / 1000);
    last = now;
    paintPlanet(image.data, planet.state, (now - started) / 1000);
    ctx.putImageData(image, 0, 0);
    frame = next(tick);
  };

  frame = next(tick);

  return {
    target: (share) => planet.target(share),
    stop: () => {
      stopped = true;
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
    },
  };
}
