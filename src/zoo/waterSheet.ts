import { createLitLayer } from '../render/lit/litLayer.ts';
import { bufferFor, SCALE } from '../render/screen.ts';
import { FISH } from '../sim/fish/species.ts';
import { Shoals } from '../sim/fish/shoals.ts';
import { stageWorld, TERRAINS } from './stage.ts';
import { emptyFauna, lightingFor, stillSky } from './surroundings.ts';

const params = new URLSearchParams(window.location.search);
const SILT = (params.get('silt') ?? '0,0.33,0.66,1').split(',').map(Number);
const BLOOM = (params.get('bloom') ?? '0,0.5,1').split(',').map(Number);
const METRES = Number(params.get('metres') ?? 1.5);
const PATCH = Number(params.get('patch') ?? 8);
const FISH_KEY = params.get('fish') ?? '';
const ZOOM = Number(params.get('zoom') ?? 20);
const READY_FRAMES = 40;

interface Sheet {
  ready: boolean;
  errors: string[];
  animal: string;
  columns: string[];
  rows: string[];
  cell: number;
}

const state: Sheet = { ready: false, errors: [], animal: 'water', columns: SILT.map((value) => `silt ${value}`), rows: BLOOM.map((value) => `bloom ${value}`), cell: PATCH * ZOOM };
(window as unknown as { __sheet: Sheet }).__sheet = state;
window.addEventListener('error', (event) => state.errors.push(String(event.message)));
const consoleError = console.error.bind(console);
console.error = (...values: unknown[]): void => {
  state.errors.push(values.map(String).join(' '));
  consoleError(...values);
};

const stage = stageWorld(TERRAINS.find((one) => one.key === 'lake')!, 1);
for (let tile = 0; tile < stage.grid.count; tile += 1) stage.depth[tile] = Math.round(METRES * 10);
const columns = SILT.length;
const rows = BLOOM.length;
for (let row = 0; row < stage.grid.rows; row += 1) {
  for (let column = 0; column < stage.grid.columns; column += 1) {
    const x = stage.grid.x(column);
    const y = stage.grid.y(row);
    const c = Math.min(columns - 1, Math.max(0, Math.floor((x + (columns * PATCH) / 2) / PATCH)));
    const r = Math.min(rows - 1, Math.max(0, Math.floor((y + (rows * PATCH) / 2) / PATCH)));
    const tile = row * stage.grid.columns + column;
    stage.silt[tile] = Math.round(SILT[c]! * 255);
    stage.bloom[tile] = Math.round(BLOOM[r]! * 255);
  }
}

const shoals = new Shoals();
const fishAt = FISH.findIndex((one) => one.key === FISH_KEY);
if (fishAt >= 0) {
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < columns; c += 1) {
      const slot = shoals.n;
      shoals.n = slot + 1;
      shoals.species[slot] = fishAt + 1;
      shoals.heading[slot] = 0.4 + 0.5 * slot;
      shoals.size[slot] = 12;
      shoals.depth[slot] = Math.round(METRES * 10);
      shoals.posX[slot] = (c - columns / 2 + 0.5) * PATCH;
      shoals.posY[slot] = (r - rows / 2 + 0.5) * PATCH;
    }
  }
}

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
(globalThis as { litSkip?: string[] }).litSkip = ['props', 'shadows', 'leaves', 'precipitation', 'clouds', 'fog', 'grade'];
const litLayer = createLitLayer(lit);
if (!litLayer) throw new Error('the lit layer could not start');
const sky = stillSky(stage);
const fauna = emptyFauna();
const lens = { centre: { x: 0, y: 0 }, zoom: ZOOM };

SILT.forEach((value, c) => {
  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = `silt ${value}`;
  label.style.left = `${c * PATCH * ZOOM * SCALE + 4}px`;
  label.style.top = '2px';
  host.appendChild(label);
});
BLOOM.forEach((value, r) => {
  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = `bloom ${value}`;
  label.style.left = '4px';
  label.style.top = `${r * PATCH * ZOOM * SCALE + 22}px`;
  host.appendChild(label);
});

let frames = 0;
const draw = (): void => {
  try {
    const context = frame.ctx;
    context.save();
    context.fillStyle = '#3a6f9c';
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
    const view = { centre: lens.centre, zoom: ZOOM / SCALE, width: frame.width, height: frame.height, time: Number(params.get('t') ?? 2), ground: frame.ctx.canvas, people: null, shoals: fishAt >= 0 ? shoals : null, fauna, fog: null, depth: 0, see: [] };
    litLayer.draw(stage, view, lightingFor(stage, lens.centre, 0.5, 0.45), sky, 0);
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
