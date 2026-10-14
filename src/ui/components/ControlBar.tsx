import { Channel } from '../../engine/types.ts';
import type { EngineBridge } from '../EngineBridge.ts';
import { useClock } from '../simStore.ts';

export type CanvasView = 'workshop' | 'world';

export function ControlBar({
  bridge,
  view,
  onView,
}: {
  bridge: EngineBridge | null;
  view: CanvasView;
  onView: (view: CanvasView) => void;
}) {
  const clock = useClock();

  const addNode = () => {
    if (!bridge) return;
    const id = bridge.nextNodeId();
    void bridge.createNode({
      id,
      label: `Combine Node #${id.split('-')[1] ?? ''}`,
      inputs: [{ channel: Channel.Solid }, { channel: Channel.Fluid }],
      bufferCapacity: 12,
      position: { x: 0, y: 420 },
    });
  };

  return (
    <header className="ec-bar">
      <div className="ec-bar-brand">
        <span className="ec-bar-logo" />
        Element Circuit
      </div>

      <div className="ec-bar-controls">
        <button
          className={clock.running ? 'ec-btn ec-btn-active' : 'ec-btn'}
          onClick={() => bridge?.toggle()}
          disabled={!bridge}
        >
          {clock.running ? '❚❚ Pause' : '▶ Play'}
        </button>
        <button
          className="ec-btn"
          onClick={() => bridge?.step()}
          disabled={!bridge || clock.running}
        >
          ⇥ Step
        </button>
        <button className="ec-btn" onClick={addNode} disabled={!bridge}>
          + Combine Node
        </button>
      </div>

      <div className="ec-bar-views">
        <button
          className={view === 'workshop' ? 'ec-btn ec-btn-active' : 'ec-btn'}
          onClick={() => onView('workshop')}
        >
          Workshop
        </button>
        <button
          className={view === 'world' ? 'ec-btn ec-btn-active' : 'ec-btn'}
          onClick={() => onView('world')}
        >
          World
        </button>
      </div>

      <div className="ec-bar-readout">
        <span className="ec-bar-tick">tick {String(clock.tick).padStart(4, '0')}</span>
        <span className="ec-bar-rate">{clock.ticksPerSecond} ticks/sec</span>
      </div>
    </header>
  );
}
