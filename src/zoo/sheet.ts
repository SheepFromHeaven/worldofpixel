import { applyCamera } from '../render/camera.ts';
import { createLitLayer } from '../render/lit/litLayer.ts';
import { behaviourOf, poseFor } from '../animals/catalogue.ts';
import { statesOf } from '../animals/types.ts';
import { AGENT_FLOATS, packAgent } from '../render/lit/mammalAgents.ts';
import { bufferFor, SCALE } from '../render/screen.ts';
import { ANIMAL_VIEW_SHADERS } from '../render/lit/shaders/shaderSources.ts';
import { GROUP_BASE } from '../sim/fauna/life.ts';
import { MAMMALS } from '../sim/mammals/species.ts';
import { createModelRenderer } from './modelRenderer.ts';
import { stageWorld, TERRAINS } from './stage.ts';
import { emptyFauna, lightingFor, stillSky } from './surroundings.ts';

const ALL_HEADINGS: readonly { name: string; x: number; y: number }[] = [
  { name: 'E', x: 1, y: 0 },
  { name: 'SE', x: Math.SQRT1_2, y: Math.SQRT1_2 },
  { name: 'S', x: 0, y: 1 },
  { name: 'SW', x: -Math.SQRT1_2, y: Math.SQRT1_2 },
  { name: 'W', x: -1, y: 0 },
  { name: 'NW', x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
  { name: 'N', x: 0, y: -1 },
  { name: 'NE', x: Math.SQRT1_2, y: -Math.SQRT1_2 },
];

const wanted = new URLSearchParams(window.location.search).get('headings');

const HEADINGS = wanted ? ALL_HEADINGS.filter((one) => wanted.split(',').includes(one.name)) : ALL_HEADINGS;

const TEXELS_PER_METRE = 16;

const BODY_SHARE = 0.62;

const FOOT_DROP = 0.12;

const HEADER_PIXELS = 14;

const LABEL_WIDTH_PIXELS = 20;

const VIEW_PITCH = 0.41;

const VIEW_DISTANCE_PER_LENGTH = 2.7;

const READY_FRAMES = 24;

const HOURS: Readonly<Record<string, number>> = { dawn: 0.27, noon: 0.5, dusk: 0.73, night: 0 };

interface Sheet {
  ready: boolean;
  errors: string[];
  animal: string;
  columns: string[];
  rows: string[];
  cell: number;
}

const params = new URLSearchParams(window.location.search);
const key = params.get('animal') ?? '';
const cell = Number(params.get('cell') ?? 96);
const walks = Number(params.get('phases') ?? 4);
const stateName = params.get('state') ?? '';
const hourName = params.get('hour') ?? 'auto';
const female = params.get('sex') === 'female';
const heightMetres = Number(params.get('height') ?? 0);
const gifMode = params.get('gif') === '1';
const stageIndex = params.get('stage') === 'calf' ? 0 : params.get('stage') === 'juvenile' ? 1 : 2;

const state: Sheet = { ready: false, errors: [], animal: key, columns: [], rows: HEADINGS.map((one) => one.name), cell };
(window as unknown as { __sheet: Sheet }).__sheet = state;
window.addEventListener('error', (event) => state.errors.push(String(event.message)));
const consoleError = console.error.bind(console);
console.error = (...values: unknown[]): void => {
  state.errors.push(values.map(String).join(' '));
  consoleError(...values);
};

const fail = (message: string): never => {
  state.errors.push(message);
  state.ready = true;
  throw new Error(message);
};

const index = MAMMALS.findIndex((one) => one.key === key);
if (index < 0) fail(`no mammal called ${key}`);
const species = MAMMALS[index]!;
const stateNames = statesOf(behaviourOf(species.key));
const stateId = stateName === '' ? 0 : stateNames.indexOf(stateName);
if (stateId < 0) fail(`${species.key} has no state '${stateName}', it has: ${stateNames.join(', ')}`);
const view3d = params.get('view') === '2d' ? undefined : ANIMAL_VIEW_SHADERS[key];

const poses: { name: string; walking: boolean; phase: number }[] = gifMode ? [] : [{ name: 'stand', walking: false, phase: 0 }];
for (let step = 0; step < walks; step += 1) poses.push({ name: `walk ${Math.round((step / walks) * 360)}`, walking: true, phase: (step / walks) * Math.PI * 2 });
const columnCount = poses.length * (view3d ? 2 : 1);
state.columns = poses.flatMap((pose) => (view3d ? [`${pose.name} 2d`, `${pose.name} 3d`] : [`${pose.name} 2d`]));

const headerPixels = gifMode ? 0 : HEADER_PIXELS;
const labelPixels = gifMode ? 0 : LABEL_WIDTH_PIXELS;

const host = document.getElementById('sheet')!;
const widthPixels = labelPixels * SCALE + columnCount * cell * SCALE;
const heightPixels = (headerPixels + HEADINGS.length * cell) * SCALE;
host.style.width = `${widthPixels}px`;
host.style.height = `${heightPixels}px`;

const texels = 3 + 16 * species.length;
const zoom = TEXELS_PER_METRE * Math.max(1, Math.floor((BODY_SHARE * cell) / texels));
const stage = stageWorld(TERRAINS[0]!, 1);
const sky = stillSky(stage);
const fauna = emptyFauna();
const hour = hourName === 'auto' ? (species.night > species.day ? HOURS.night! : HOURS.noon!) : (HOURS[hourName] ?? Number(hourName));
(globalThis as { litSkip?: string[] }).litSkip = ['props', 'shadows', 'water', 'leaves', 'precipitation', 'clouds', 'fog', 'grade'];

const ground = document.createElement('canvas');
const lit = document.createElement('canvas');
const model = document.createElement('canvas');
for (const layer of [ground, lit, model]) host.appendChild(layer);
ground.style.width = lit.style.width = model.style.width = `${widthPixels}px`;
ground.style.height = lit.style.height = model.style.height = `${heightPixels}px`;
model.width = widthPixels;
model.height = heightPixels;

const label = (text: string, left: number, top: number): void => {
  const element = document.createElement('div');
  element.className = 'label';
  element.textContent = text;
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
  host.appendChild(element);
};

if (!gifMode) {
  state.columns.forEach((name, column) => label(name, (LABEL_WIDTH_PIXELS + column * cell) * SCALE + 2, 0));
  HEADINGS.forEach((one, row) => label(one.name, 2, (HEADER_PIXELS + row * cell) * SCALE + 2));
}

const litLayer = createLitLayer(lit);
if (!litLayer) fail('the lit layer could not start');
const gl = view3d ? model.getContext('webgl2') : null;
if (view3d && !gl) fail('WebGL2 is not available');
const renderer = view3d && gl ? createModelRenderer(gl, view3d) : null;

const frame = bufferFor(widthPixels, heightPixels)!;
lit.width = frame.width;
lit.height = frame.height;
const pane = { width: frame.width, height: frame.height };
const lens = { centre: { x: 0, y: 0 }, zoom };

const cellOrigin = (column: number, row: number): { x: number; y: number } => ({ x: labelPixels + column * cell, y: headerPixels + row * cell });

const toWorld = (px: number, py: number): { x: number; y: number } => ({ x: (px - pane.width / 2) / zoom, y: (py - pane.height / 2) / zoom });

const strideMetres = (): number => Math.max(2, 0.55 * texels * (0.5 + 0.5 * species.legs)) / TEXELS_PER_METRE;

const sinceOf = (phase: number): number => (phase / (Math.PI * 2)) * 0.9;

const hashOf = (a: number, b: number): number => {
  let x = ((a * 0.1031) % 1 + 1) % 1;
  let y = ((b * 0.1031) % 1 + 1) % 1;
  let z = x;
  const dot = x * (y + 33.33) + y * (z + 33.33) + z * (x + 33.33);
  x += dot;
  y += dot;
  z += dot;
  return (((x + y) * z) % 1 + 1) % 1;
};

const sheetKey = (): number => {
  const base = ((((GROUP_BASE.mammal + index) * 0.6180339887) % 1) + 1) % 1;
  for (let step = 0; step < 400; step += 1) {
    const candidate = (base + step * 0.0137) % 1;
    const draw = hashOf(candidate, 9.9);
    if (female ? draw >= 0.45 : draw < 0.2) return candidate;
  }
  return base;
};

const agents = new Float32Array(AGENT_FLOATS * HEADINGS.length * poses.length);
let agentCount = 0;
HEADINGS.forEach((heading, row) => {
  poses.forEach((pose, pair) => {
    const origin = cellOrigin(pair * (view3d ? 2 : 1), row);
    const at = toWorld(origin.x + cell / 2, origin.y + cell * (0.5 + FOOT_DROP));
    packAgent(agents, agentCount, {
      x: at.x,
      y: at.y,
      dirX: heading.x,
      dirY: heading.y,
      species: index,
      stage: stageIndex,
      key: sheetKey(),
      travelled: pose.walking ? (pose.phase / (Math.PI * 2)) * strideMetres() : 0,
      going: pose.walking ? 1 : 0,
      state: pose.walking ? stateId : 0,
      height: heightMetres,
      pose: poseFor(key, pose.walking ? stateId : 0, species.length, species.legs, pose.walking ? (pose.phase / (Math.PI * 2)) * strideMetres() : 0, pose.walking, sinceOf(pose.phase), 99),
      groupKey: 0.5,
      member: female ? 1 : 0,
      denX: at.x,
      denY: at.y,
      glance: 0,
    });
    agentCount += 1;
  });
});

const paintGround = (): void => {
  const context = frame.ctx;
  context.save();
  context.fillStyle = TERRAINS[0]!.colour;
  context.fillRect(0, 0, pane.width, pane.height);
  applyCamera(context, lens, pane);
  context.lineWidth = 1 / zoom;
  context.strokeStyle = 'rgba(0,0,0,0.07)';
  const bounds = { minX: -pane.width / 2 / zoom, maxX: pane.width / 2 / zoom, minY: -pane.height / 2 / zoom, maxY: pane.height / 2 / zoom };
  context.beginPath();
  for (let x = Math.ceil(bounds.minX); x <= bounds.maxX; x += 1) {
    context.moveTo(x, bounds.minY);
    context.lineTo(x, bounds.maxY);
  }
  for (let y = Math.ceil(bounds.minY); y <= bounds.maxY; y += 1) {
    context.moveTo(bounds.minX, y);
    context.lineTo(bounds.maxX, y);
  }
  context.stroke();
  context.restore();
  ground.width = widthPixels;
  ground.height = heightPixels;
  const out = ground.getContext('2d')!;
  out.imageSmoothingEnabled = false;
  out.drawImage(frame.ctx.canvas, 0, 0, frame.width * SCALE, frame.height * SCALE);
};

let frames = 0;
const draw = (): void => {
  try {
    paintGround();
    litLayer!.setZoos([], null);
    litLayer!.setScenery(null);
    litLayer!.setMammalAgents({ count: agentCount, data: agents, isolated: true });
    const view = { centre: lens.centre, zoom, width: pane.width, height: pane.height, time: 0, ground: frame.ctx.canvas, people: null, shoals: null, fauna, fog: null, depth: 0, see: [] };
    litLayer!.draw(stage, view, lightingFor(stage, lens.centre, hour, 0.3), sky, 0);
    if (renderer && gl) {
      gl.clearColor(0, 0, 0, 0);
      gl.disable(gl.SCISSOR_TEST);
      gl.viewport(0, 0, model.width, model.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      HEADINGS.forEach((heading, row) => {
        poses.forEach((pose, pair) => {
          const origin = cellOrigin(pair * 2 + 1, row);
          renderer.draw(
            { x: origin.x * SCALE, y: model.height - (origin.y + cell) * SCALE, width: cell * SCALE, height: cell * SCALE },
            {
              yaw: Math.atan2(heading.x, heading.y),
              pitch: VIEW_PITCH,
              distance: VIEW_DISTANCE_PER_LENGTH * species.length,
              body: [species.length, species.legs, species.tail, species.ears],
              colour: species.colour,
              accent: species.accent,
              time: 0,
              phase: pose.phase,
              walk: pose.walking,
              state: stateId,
              pose: pose.walking ? (behaviourOf(key)?.hooks.pose?.({ state: stateNames[stateId] ?? '', phase: pose.phase, going: true, since: sinceOf(pose.phase), left: 99 }) ?? []) : [],
            },
          );
        });
      });
    }
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
