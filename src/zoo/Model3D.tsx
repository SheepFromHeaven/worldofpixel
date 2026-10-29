import { useEffect, useRef, useState } from 'react';
import { behaviourOf, recordOf } from '../animals/catalogue.ts';
import { draftOf } from '../animals/types.ts';
import { ANIMAL_SHADERS } from '../animals/registry.ts';
import { paceOf, statesOf } from '../animals/types.ts';
import { ANIMAL_VIEW_SHADERS } from '../render/lit/shaders/shaderSources.ts';
import { MAMMALS } from '../sim/mammals/species.ts';
import { createModelRenderer } from './modelRenderer.ts';
import type { ModelRenderer } from './modelRenderer.ts';

const DISTANCE_PER_LENGTH = 2.4;

const MIN_PITCH = -0.2;

const MAX_PITCH = 1.45;

const ORBIT_PER_PIXEL = 0.01;

const ZOOM_PER_WHEEL = 0.001;

export interface Modelled {
  key: string;
  name: string;
  length: number;
  legs: number;
  tail: number;
  ears: number;
  speed: number;
  colour: readonly [number, number, number];
  accent: readonly [number, number, number];
}

interface Model3DProps {
  species: Modelled | null;
  onClose: () => void;
}

export function Model3D({ species, onClose }: Model3DProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fragmentOf = species ? (ANIMAL_VIEW_SHADERS[species.key] ?? '') : '';
  const speciesRef = useRef(species);
  speciesRef.current = species;
  const view = useRef({ yaw: 0.9, pitch: 0.35, zoom: 1, spin: true, walk: true, state: 0, speed: 1, stride: 1 });
  const [spin, setSpin] = useState(true);
  const [walk, setWalk] = useState(true);
  const [state, setState] = useState(0);
  const names = species ? statesOf(behaviourOf(species.key)) : [];
  const [stride, setStride] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    view.current.spin = spin;
    view.current.walk = walk;
  }, [spin, walk]);

  useEffect(() => {
    view.current.state = state;
  }, [state]);

  useEffect(() => {
    setState(0);
  }, [species?.key]);

  useEffect(() => {
    if (!species) return;
    const behaviour = behaviourOf(species.key);
    const name = statesOf(behaviour)[state] ?? '';
    const model = ANIMAL_SHADERS.find((shaders) => shaders.key === species.key)?.model;
    const next = {
      speed: Math.round(species.speed * paceOf(behaviour, name) * 100) / 100,
      stride: model?.states?.[name]?.stride ?? model?.gait.stride ?? 1,
    };
    view.current.speed = next.speed;
    view.current.stride = next.stride;
    setStride(next.stride);
  }, [species?.key, state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || fragmentOf === '') return;
    const gl = canvas.getContext('webgl2');
    if (!gl) {
      setError('WebGL2 is not available');
      return;
    }
    let renderer: ModelRenderer;
    try {
      renderer = createModelRenderer(gl, fragmentOf);
    } catch (failure) {
      setError(String(failure));
      return;
    }

    let handle = 0;
    let last = performance.now();
    let clock = 0;
    let phase = 0;
    let travel = 0;
    const draw = (now: number): void => {
      handle = requestAnimationFrame(draw);
      const seconds = Math.min(0.1, (now - last) / 1000);
      last = now;
      const state = view.current;
      const one = speciesRef.current;
      if (!one) return;
      const ratio = window.devicePixelRatio || 1;
      const width = Math.round(canvas.clientWidth * ratio);
      const height = Math.round(canvas.clientHeight * ratio);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      if (state.spin) state.yaw += seconds * 0.5;
      clock += seconds;
      const metres = state.walk ? state.speed * seconds : 0;
      travel += metres;
      phase += (metres / Math.max(0.0001, 0.55 * one.length * (0.5 + 0.5 * one.legs) * state.stride)) * Math.PI * 2;
      renderer.draw(
        { x: 0, y: 0, width, height },
        {
          yaw: state.yaw,
          pitch: state.pitch,
          distance: DISTANCE_PER_LENGTH * one.length * state.zoom,
          body: [one.length, one.legs, one.tail, one.ears],
          colour: one.colour,
          accent: one.accent,
          time: clock,
          phase,
          travel,
          pose: state.walk ? (behaviourOf(one.key)?.hooks.pose?.({ state: statesOf(behaviourOf(one.key))[state.state] ?? '', phase, going: true, since: clock % 4, left: 4 - (clock % 4), pitch: 0 }) ?? []) : [],
          walk: state.walk,
          state: state.state,
        },
      );
    };
    handle = requestAnimationFrame(draw);

    let dragging = false;
    let x = 0;
    let y = 0;
    const onDown = (event: PointerEvent): void => {
      dragging = true;
      x = event.clientX;
      y = event.clientY;
      view.current.spin = false;
      setSpin(false);
      canvas.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent): void => {
      if (!dragging) return;
      const state = view.current;
      state.yaw -= (event.clientX - x) * ORBIT_PER_PIXEL;
      state.pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, state.pitch + (event.clientY - y) * ORBIT_PER_PIXEL));
      x = event.clientX;
      y = event.clientY;
    };
    const onUp = (): void => {
      dragging = false;
    };
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      view.current.zoom = Math.min(3, Math.max(0.25, view.current.zoom * Math.exp(event.deltaY * ZOOM_PER_WHEEL)));
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      cancelAnimationFrame(handle);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      renderer.dispose();
    };
  }, [fragmentOf]);

  return (
    <div className="zoo-model">
      <div className="zoo-model-bar">
        <strong>{species ? `${species.name} 3d` : '3d'}</strong>
        <span className="zoo-sep" />
        <button className={spin ? 'zoo-on' : ''} onClick={() => setSpin(!spin)}>spin</button>
        <button className={walk ? 'zoo-on' : ''} onClick={() => setWalk(!walk)}>walk</button>
        {names.length > 1 && <span className="zoo-sep" />}
        {names.length > 1 && names.map((name, index) => (
          <button key={name} className={state === index ? 'zoo-on' : ''} onClick={() => { setState(index); setWalk(true); }}>{name}</button>
        ))}
        <span className="zoo-sep" />
        <label>stride {stride.toFixed(2)} <input type="range" min="0.3" max="8" step="0.05" value={stride} onChange={(event) => { const value = Number(event.target.value); setStride(value); view.current.stride = value; }} /></label>
        <button onClick={onClose}>close</button>
      </div>
      <canvas ref={canvasRef} className="zoo-model-canvas" />
      {error && <div className="zoo-note">{error}</div>}
      {!species && <div className="zoo-model-empty">only the aardvark and the gorilla have a 3d model</div>}
    </div>
  );
}

export const modelled = (key: string, group: string): Modelled | null => {
  if (!(key in ANIMAL_VIEW_SHADERS)) return null;
  if (group === 'mammal') return MAMMALS.find((one) => one.key === key) ?? null;
  const record = recordOf(key);
  if (!record) return null;
  if (record.group === 'insect' || record.group === 'home') return null;
  if (record.group === 'bird') return { key, name: record.config.name, length: record.config.length, legs: 1, tail: record.config.tail ?? 0.3, ears: 0.2, speed: record.behaviour.habits.speed, colour: record.texture.colour, accent: record.texture.accent };
  if (record.group === 'fish') return { key, name: record.config.name, length: record.config.length, legs: 1, tail: 0.3, ears: 0, speed: record.behaviour.habits.beat * 0.1, colour: [0.2, 0.3, 0.35], accent: [0.2, 0.3, 0.35] };
  const draft = draftOf(record);
  return { key, name: draft.name, length: draft.length, legs: draft.legs ?? 1, tail: draft.tail ?? 0.3, ears: draft.ears ?? 0.2, speed: draft.speed, colour: draft.colour, accent: draft.accent ?? draft.colour };
};
