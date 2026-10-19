import { fieldFor, installField } from '../sim/worldfield.ts';
import type { WorldField } from '../sim/worldfield.ts';

/**
 * Has the world ready before anything asks for it.
 *
 * Working a world out takes seconds on a map this size, and every question the simulation asks
 * of it is synchronous and deep inside the tick — so the field cannot become a promise without
 * all of that becoming one too. Instead the one place that can afford to wait does the waiting:
 * the pass runs in a worker, the result is put straight into the memo, and by the time `game.ts`
 * is imported and builds its world the answer is already sitting there.
 *
 * If the worker cannot start — an old browser, a blocked module worker, a bundler that did not
 * emit it — the field is built here instead. That freezes the page for as long as the pass
 * takes, which is bad, and is still better than a game that does not open.
 */
export async function prepareWorld(seed: number): Promise<{ seconds: number; threaded: boolean }> {
  const started = performance.now();

  try {
    const field = await new Promise<WorldField>((resolve, reject) => {
      const worker = new Worker(new URL('./fieldWorker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<WorldField>) => {
        worker.terminate();
        resolve(event.data);
      };
      worker.onerror = (event) => {
        worker.terminate();
        reject(new Error(event.message || 'the world worker failed'));
      };
      worker.postMessage(seed);
    });

    installField(field);
    return { seconds: (performance.now() - started) / 1000, threaded: true };
  } catch {
    fieldFor(seed);
    return { seconds: (performance.now() - started) / 1000, threaded: false };
  }
}
