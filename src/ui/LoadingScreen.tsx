import { useEffect, useRef, useState } from 'react';
import '../sim/terrain/windowedInstall.ts';
import { buildFieldStaged } from '../sim/terrain/worldfield.ts';
import type { FieldProgress } from '../sim/terrain/worldfield.ts';
import type { Launch } from './launch.ts';
import { launchWith } from './launch.ts';
import { PixelBody, PixelHeading, PixelText } from './pixel/Pixel.tsx';
import { messageFor, PLANET_HEIGHT, PLANET_WIDTH } from './planet.ts';
import type { PlanetRun } from './planetLoop.ts';
import { runPlanet } from './planetLoop.ts';

const painted = (): Promise<void> =>
  new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));

const SETTLING_SHARE = 0.97;

const CATCH_UP_PER_SECOND = 2.5;

export function LoadingScreen({
  launch,
  onReady,
}: {
  launch: Launch;
  onReady: (app: React.ComponentType) => void;
}): React.JSX.Element {
  const holderRef = useRef<HTMLDivElement>(null);
  const planetRef = useRef<PlanetRun | null>(null);
  const target = useRef(0);
  const [share, setShare] = useState(0);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const show = async (progress: FieldProgress): Promise<void> => {
      if (cancelled) return;
      target.current = progress.share;
      planetRef.current?.target(progress.share);
      setShare(progress.share);
      await painted();
    };

    const run = async (): Promise<void> => {
      await painted();
      launchWith(launch);
      await buildFieldStaged(launch.seed, show);
      if (cancelled) return;
      target.current = SETTLING_SHARE;
      planetRef.current?.target(SETTLING_SHARE);
      setShare(SETTLING_SHARE);
      await painted();
      if (cancelled) return;
      const { App } = await import('./App.tsx');
      if (!cancelled) onReady(App);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [launch, onReady]);

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'se-loading-planet';
    canvas.width = PLANET_WIDTH;
    canvas.height = PLANET_HEIGHT;
    holder.append(canvas);

    let worker: Worker | null = null;
    try {
      if (typeof Worker !== 'undefined' && 'transferControlToOffscreen' in canvas) {
        worker = new Worker(new URL('./planet.worker.ts', import.meta.url), { type: 'module' });
        const offscreen = canvas.transferControlToOffscreen();
        worker.postMessage({ canvas: offscreen }, [offscreen]);
        const sent = worker;
        planetRef.current = { target: (share) => sent.postMessage({ share }), stop: () => sent.terminate() };
      }
    } catch {
      worker?.terminate();
      worker = null;
    }
    if (!worker) {
      const fallback = document.createElement('canvas');
      fallback.className = canvas.className;
      fallback.width = PLANET_WIDTH;
      fallback.height = PLANET_HEIGHT;
      canvas.replaceWith(fallback);
      const ctx = fallback.getContext('2d');
      if (ctx) planetRef.current = runPlanet(ctx);
    }
    planetRef.current?.target(target.current);

    let last = performance.now();
    let current = 0;
    let frame = 0;
    const tick = (now: number): void => {
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      current += (target.current - current) * (1 - Math.exp(-dt * CATCH_UP_PER_SECOND));
      setShown((before) => (Math.round(before * 100) === Math.round(current * 100) ? before : current));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      planetRef.current?.stop();
      planetRef.current = null;
      holder.replaceChildren();
    };
  }, []);

  return (
    <main className="se-loading">
      <PixelHeading>{`building seed ${launch.seed}`}</PixelHeading>
      <div ref={holderRef} className="se-loading-holder" />
      <div className="se-loading-bar" role="progressbar" aria-valuenow={Math.round(shown * 100)}>
        <div className="se-loading-fill" style={{ transform: `scaleX(${share})` }} />
      </div>
      <div className="se-loading-line">
        <PixelBody>{messageFor(share)}</PixelBody>
        <PixelText>{`${Math.round(shown * 100)}%`}</PixelText>
      </div>
    </main>
  );
}
