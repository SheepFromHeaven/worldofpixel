import { fieldFor, installField } from '../sim/terrain/worldfield.ts';
import type { WorldField } from '../sim/terrain/worldfield.ts';

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
