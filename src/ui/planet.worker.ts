import type { PlanetRun } from './planetLoop.ts';
import { runPlanet } from './planetLoop.ts';

type Message = { canvas: OffscreenCanvas } | { share: number };

let run: PlanetRun | null = null;

self.onmessage = (event: MessageEvent<Message>) => {
  const message = event.data;
  if ('canvas' in message) {
    const ctx = message.canvas.getContext('2d');
    if (ctx) run = runPlanet(ctx);
  } else {
    run?.target(message.share);
  }
};
