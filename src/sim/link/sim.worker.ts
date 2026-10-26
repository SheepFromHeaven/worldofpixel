import type { SimHost } from './host.ts';
import type { FromSim, ToSim } from './protocol.ts';

interface Scope {
  onmessage: ((event: MessageEvent<ToSim>) => void) | null;
  postMessage(message: FromSim, transfer: ArrayBuffer[]): void;
}

const scope = globalThis as unknown as Scope;

const TICK_MILLISECONDS = 1000 / 30;
const LONGEST_STEP_SECONDS = 0.1;
const SNAPSHOT_SECONDS = 5;

let host: SimHost | null = null;

scope.onmessage = (event) => {
  const message = event.data;
  if (message.kind !== 'start') return;
  (globalThis as { __worldScale?: number }).__worldScale = message.start.size;
  void boot(message.start);
};

async function boot(start: Extract<ToSim, { kind: 'start' }>['start']): Promise<void> {
  const [{ SimHost: Host }, { framePayload, helloPayload }] = await Promise.all([import('./host.ts'), import('./transfer.ts')]);

  const send = (message: FromSim): void => {
    if (message.kind === 'frame') scope.postMessage(message, framePayload(message.frame));
    else if (message.kind === 'hello') scope.postMessage(message, helloPayload(message.hello));
    else scope.postMessage(message, []);
  };

  host = new Host(start, send);
  send({ kind: 'hello', hello: host.hello() });
  let last = performance.now();
  let sinceSnapshot = 0;
  setInterval(() => {
    const now = performance.now();
    const seconds = Math.min(LONGEST_STEP_SECONDS, (now - last) / 1000);
    last = now;
    host!.step(seconds);
    sinceSnapshot += seconds;
    if (sinceSnapshot >= SNAPSHOT_SECONDS) {
      sinceSnapshot = 0;
      send({ kind: 'snapshot', state: host!.snapshot() });
    }
  }, TICK_MILLISECONDS);

  scope.onmessage = (event) => {
    const message = event.data;
    if (message.kind === 'command') host?.command(message.command);
    else if (message.kind === 'snapshot' && host) send({ kind: 'snapshot', state: host.snapshot() });
  };
}
