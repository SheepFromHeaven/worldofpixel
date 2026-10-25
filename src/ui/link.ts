import type { Frame, FromSim, Start, ToSim, WireEvent } from '../sim/link/protocol.ts';
import { Replica } from '../sim/link/replica.ts';
import type { Command, SimState } from '../sim/simulation.ts';

export type Message = { kind: 'frame'; frame: Frame } | { kind: 'event'; event: WireEvent };

export interface Link {
  readonly replica: Replica;
  latest: SimState | null;
  send(command: Command): void;
  subscribe(listener: (message: Message) => void): () => void;
  snapshot(): void;
  carry(): Start['carry'];
  close(): void;
}

export function connect(start: Start): Promise<Link> {
  const worker = new Worker(new URL('../sim/link/sim.worker.ts', import.meta.url), { type: 'module' });
  const post = (message: ToSim): void => worker.postMessage(message);

  return new Promise((resolve) => {
    const listeners = new Set<(message: Message) => void>();
    let link: Link | null = null;

    worker.onmessage = (event: MessageEvent<FromSim>) => {
      const message = event.data;
      const now = performance.now();
      if (message.kind === 'hello') {
        const replica = new Replica(message.hello, now);
        link = {
          replica,
          latest: null,
          send: (command) => post({ kind: 'command', command }),
          subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
          },
          snapshot: () => post({ kind: 'snapshot' }),
          carry: () => ({ calendar: replica.calendar.state(), speed: replica.speed, playTime: replica.playTime }),
          close: () => worker.terminate(),
        };
        resolve(link);
      } else if (!link) {
        return;
      } else if (message.kind === 'frame') {
        link.replica.apply(message.frame, now);
        for (const listener of listeners) listener({ kind: 'frame', frame: message.frame });
      } else if (message.kind === 'event') {
        for (const listener of listeners) listener({ kind: 'event', event: message.event });
      } else {
        link.latest = message.state;
      }
    };

    post({ kind: 'start', start });
  });
}
