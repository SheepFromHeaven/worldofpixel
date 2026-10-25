import { useEffect, useRef, useState } from 'react';
import { buildFieldStaged } from '../sim/terrain/worldfield.ts';
import type { FieldProgress } from '../sim/terrain/worldfield.ts';
import type { Launch } from './launch.ts';
import { launchWith } from './launch.ts';
import { PixelBody, PixelHeading } from './pixel/Pixel.tsx';
import { drawPreview, PREVIEW_WIDTH, previewHeight } from './worldPreview.ts';

const painted = (): Promise<void> =>
  new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));

const SETTLING = { label: 'settling the ground and sky', share: 0.97 };

export function LoadingScreen({
  launch,
  onReady,
}: {
  launch: Launch;
  onReady: (app: React.ComponentType) => void;
}): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState({ label: 'surveying', share: 0 });
  const [height, setHeight] = useState(Math.round((PREVIEW_WIDTH * 1408) / 2048));

  useEffect(() => {
    let cancelled = false;

    const show = async (progress: FieldProgress): Promise<void> => {
      if (cancelled) return;
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        setHeight(previewHeight(progress.grid));
        if (canvasRef.current && canvasRef.current.height !== previewHeight(progress.grid)) {
          canvasRef.current.height = previewHeight(progress.grid);
        }
        drawPreview(ctx, progress);
      }
      setStage({ label: progress.label, share: progress.share });
      await painted();
    };

    const run = async (): Promise<void> => {
      await painted();
      await buildFieldStaged(launch.seed, show);
      if (cancelled) return;
      setStage(SETTLING);
      await painted();
      if (cancelled) return;
      launchWith(launch);
      const { App } = await import('./App.tsx');
      if (!cancelled) onReady(App);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [launch, onReady]);

  return (
    <main className="se-loading">
      <PixelHeading>{`building seed ${launch.seed}`}</PixelHeading>
      <canvas ref={canvasRef} className="se-loading-map" width={PREVIEW_WIDTH} height={height} />
      <div className="se-loading-bar" role="progressbar" aria-valuenow={Math.round(stage.share * 100)}>
        <div className="se-loading-fill" style={{ width: `${stage.share * 100}%` }} />
      </div>
      <PixelBody>{stage.label}</PixelBody>
    </main>
  );
}
