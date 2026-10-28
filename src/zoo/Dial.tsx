import { useEffect, useRef } from 'react';
import { DIAL_HEIGHT, DIAL_WIDTH } from '../ui/dayDial.ts';
import { PixelText } from '../ui/pixel/Pixel.tsx';

const SCALE = 2;

const CENTRE = { x: DIAL_WIDTH / 2, y: 24 };

const WHEEL_TURNS_PER_PIXEL = 0.0004;

const TAU = Math.PI * 2;

const wrap = (value: number): number => ((value % 1) + 1) % 1;

interface DialProps {
  value: number;
  label: string;
  title: string;
  paint: (ctx: CanvasRenderingContext2D, value: number) => void;
  onChange: (value: number) => void;
}

export function Dial({ value, label, title, paint, onChange }: DialProps): React.JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef({ value, onChange });
  live.current = { value, onChange };

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (ctx) paint(ctx, value);
  }, [value, paint]);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let last: number | null = null;

    const angleOf = (event: PointerEvent): number => {
      const rect = element.getBoundingClientRect();
      return Math.atan2(event.clientY - rect.top - CENTRE.y * SCALE, event.clientX - rect.left - CENTRE.x * SCALE);
    };

    const onDown = (event: PointerEvent): void => {
      element.setPointerCapture(event.pointerId);
      last = angleOf(event);
    };

    const onMove = (event: PointerEvent): void => {
      if (last === null) return;
      const now = angleOf(event);
      let turn = now - last;
      if (turn > Math.PI) turn -= TAU;
      if (turn < -Math.PI) turn += TAU;
      last = now;
      live.current.onChange(wrap(live.current.value + turn / TAU));
    };

    const onUp = (event: PointerEvent): void => {
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
      last = null;
    };

    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      live.current.onChange(wrap(live.current.value + event.deltaY * WHEEL_TURNS_PER_PIXEL));
    };

    element.addEventListener('pointerdown', onDown);
    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerup', onUp);
    element.addEventListener('pointercancel', onUp);
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('pointercancel', onUp);
      element.removeEventListener('wheel', onWheel);
    };
  }, []);

  return (
    <div className="zoo-disc" title={title}>
      <canvas ref={canvas} width={DIAL_WIDTH} height={DIAL_HEIGHT} style={{ width: DIAL_WIDTH * SCALE, height: DIAL_HEIGHT * SCALE }} />
      <PixelText>{label}</PixelText>
    </div>
  );
}
