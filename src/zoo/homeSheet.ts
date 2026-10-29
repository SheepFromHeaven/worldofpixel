import { createLitLayer } from '../render/lit/litLayer.ts';
import { bufferFor, SCALE } from '../render/screen.ts';
import { HomeKind } from '../sim/homes/homes.ts';
import { stageWorld, TERRAINS } from './stage.ts';
import { emptyFauna, lightingFor, stillSky } from './surroundings.ts';

const params = new URLSearchParams(window.location.search);
const PROGRESS = (params.get('progress') ?? '0.1,0.3,0.5,0.7,1').split(',').map(Number);
const ENTRANCES = (params.get('entrances') ?? '1,3,6').split(',').map(Number);
const PATCH = 4;
const ZOOM = Number(params.get('zoom') ?? 40);
const READY_FRAMES = 30;

interface Sheet {
  ready: boolean;
  errors: string[];
  animal: string;
  columns: string[];
  rows: string[];
  cell: number;
}

const state: Sheet = { ready: false, errors: [], animal: 'homes', columns: PROGRESS.map((value) => `built ${value}`), rows: ENTRANCES.map((value) => `${value} entrances`), cell: PATCH * ZOOM };
(window as unknown as { __sheet: Sheet }).__sheet = state;
window.addEventListener('error', (event) => state.errors.push(String(event.message)));
const consoleError = console.error.bind(console);
console.error = (...values: unknown[]): void => {
  state.errors.push(values.map(String).join(' '));
  consoleError(...values);
};

const stage = stageWorld(TERRAINS.find((one) => one.key === 'meadow')!, 1);
const lighting = lightingFor(stage, { x: 0, y: 0 }, 0.5, 0.45);
const now = lighting.moment.completedDays + lighting.moment.timeOfDay;
const columns = PROGRESS.length;
const rows = ENTRANCES.length;
PROGRESS.forEach((progress, c) => {
  ENTRANCES.forEach((entrances, r) => {
    const x = (c - columns / 2 + 0.5) * PATCH;
    const y = (r - rows / 2 + 0.5) * PATCH;
    stage.homes.add(HomeKind.Burrow, 30, x, y, now - progress * 1, 1, entrances);
  });
});

const widthPixels = columns * PATCH * ZOOM;
const heightPixels = rows * PATCH * ZOOM;
const host = document.getElementById('sheet')!;
host.style.width = `${widthPixels * SCALE}px`;
host.style.height = `${heightPixels * SCALE}px`;
const ground = document.createElement('canvas');
const lit = document.createElement('canvas');
host.appendChild(ground);
host.appendChild(lit);
for (const layer of [ground, lit]) {
  layer.style.width = `${widthPixels * SCALE}px`;
  layer.style.height = `${heightPixels * SCALE}px`;
}
const frame = bufferFor(widthPixels, heightPixels)!;
lit.width = frame.width;
lit.height = frame.height;
(globalThis as { litSkip?: string[] }).litSkip = ['props', 'shadows', 'water', 'leaves', 'precipitation', 'clouds', 'fog', 'grade'];
const litLayer = createLitLayer(lit);
if (!litLayer) throw new Error('the lit layer could not start');
const sky = stillSky(stage);
const fauna = emptyFauna();

PROGRESS.forEach((value, c) => {
  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = `built ${value}`;
  label.style.left = `${c * PATCH * ZOOM * SCALE + 4}px`;
  label.style.top = '2px';
  host.appendChild(label);
});
ENTRANCES.forEach((value, r) => {
  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = `${value} entrances`;
  label.style.left = '4px';
  label.style.top = `${r * PATCH * ZOOM * SCALE + 22}px`;
  host.appendChild(label);
});

let frames = 0;
const draw = (): void => {
  try {
    const context = frame.ctx;
    context.save();
    context.fillStyle = '#7f9a50';
    context.fillRect(0, 0, frame.width, frame.height);
    context.restore();
    ground.width = widthPixels * SCALE;
    ground.height = heightPixels * SCALE;
    const out = ground.getContext('2d')!;
    out.imageSmoothingEnabled = false;
    out.drawImage(frame.ctx.canvas, 0, 0, frame.width * SCALE, frame.height * SCALE);
    litLayer.setZoos([], null);
    litLayer.setScenery(null);
    litLayer.setMammalAgents({ count: 0, data: new Float32Array(0), isolated: true });
    const view = { centre: { x: 0, y: 0 }, zoom: ZOOM, width: frame.width, height: frame.height, time: 2, ground: frame.ctx.canvas, people: null, shoals: null, fauna, fog: null, depth: 0, see: [] };
    litLayer.draw(stage, view, lighting, sky, 0);
    frames += 1;
    if (frames >= READY_FRAMES) state.ready = true;
  } catch (error) {
    state.errors.push(String(error instanceof Error ? error.stack : error));
    state.ready = true;
    return;
  }
  requestAnimationFrame(draw);
};
requestAnimationFrame(draw);
