import { applyCamera } from '../render/camera.ts';
import { createLitLayer } from '../render/lit/litLayer.ts';
import { behaviourOf, poseFor } from '../animals/catalogue.ts';
import { statesOf } from '../animals/types.ts';
import { AGENT_FLOATS, packAgent } from '../render/lit/mammalAgents.ts';
import { bufferFor, SCALE } from '../render/screen.ts';
import { ANIMAL_VIEW_SHADERS } from '../render/lit/shaders/shaderSources.ts';
import { GROUP_BASE } from '../sim/fauna/life.ts';
import { BIRDS } from '../sim/birds/species.ts';
import { FISH } from '../sim/fish/species.ts';
import { Shoals } from '../sim/fish/shoals.ts';
import { fishInstances } from '../render/lit/fishInstances.ts';
import { MAMMALS } from '../sim/mammals/species.ts';
import type { ZooState } from '../render/lit/zoo.ts';
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
const stateParam = params.get('state') ?? '';
const idleState = stateParam !== '' && !['walk', 'run', 'climb', 'leap', 'burrow', 'rear', 'perch'].includes(stateParam);
const stationary = idleState || ['rear', 'perch'].includes(stateParam);
const idleSeconds = Number(params.get('seconds') ?? 7);
const pitchRadians = (Number(params.get('pitch') ?? (params.get('state') === 'climb' ? 90 : 0)) * Math.PI) / 180;
const heightMetres = Number(params.get('height') ?? 0);
const gifMode = params.get('gif') === '1';
const clockSeconds = Number(params.get('t') ?? 0);
const stageIndex = params.get('stage') === 'calf' ? 0 : params.get('stage') === 'juvenile' ? 1 : 2;

const state: Sheet = { ready: false, errors: [], animal: key, columns: [], rows: HEADINGS.map((one) => one.name), cell };
(window as unknown as { __sheet: Sheet }).__sheet = state;
window.addEventListener('error', (event) => state.errors.push(String(event.message)));
const consoleError = console.error.bind(console);
console.error = (...values: unknown[]): void => {
  state.errors.push(values.map(String).join(' '));
  consoleError(...values);
};

const consoleWarn = console.warn.bind(console);
console.warn = (...values: unknown[]): void => {
  state.errors.push(values.map(String).join(' '));
  consoleWarn(...values);
};

const fail = (message: string): never => {
  state.errors.push(message);
  state.ready = true;
  throw new Error(message);
};

const index = MAMMALS.findIndex((one) => one.key === key);
const bird = BIRDS.find((one) => one.key === key);
const fishIndex = FISH.findIndex((one) => one.key === key);
const fishSpecies = fishIndex >= 0 ? FISH[fishIndex]! : null;
if (index < 0 && !bird && !fishSpecies) fail(`no animal called ${key}`);
const species =
  index >= 0
    ? MAMMALS[index]!
    : bird
      ? { key, length: bird.length, legs: 1, tail: bird.tail, ears: 0, colour: bird.colour, accent: bird.accent, night: bird.night, day: bird.day }
      : { key, length: fishSpecies!.length, legs: 1, tail: 0.3, ears: 0, colour: [0.2, 0.3, 0.35] as const, accent: [0.2, 0.3, 0.35] as const, night: 1, day: 1 };
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

const texels = fishSpecies ? 16 * Math.max(0.16, species.length * 1.3) : 3 + 16 * species.length;
const viewTexels = BIRDS.some((one) => one.key === key) && ['fly', 'glide'].includes(stateParam) ? 34 : texels;
const zoom = TEXELS_PER_METRE * Math.max(1, Math.floor((BODY_SHARE * cell) / viewTexels));
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

const sinceOf = (phase: number): number => (idleState ? (phase / (Math.PI * 2)) * idleSeconds : (phase / (Math.PI * 2)) * 0.9);

const leftOf = (phase: number): number => (idleState ? idleSeconds - (phase / (Math.PI * 2)) * idleSeconds : 99);

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
  if (index < 0) return;
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
      travelled: pose.walking && !stationary ? (pose.phase / (Math.PI * 2)) * strideMetres() : 0,
      going: pose.walking && !stationary ? 1 : 0,
      state: pose.walking || stationary ? stateId : 0,
      height: heightMetres,
      pose: poseFor(key, pose.walking || stationary ? stateId : 0, species.length, species.legs, pose.walking ? (pose.phase / (Math.PI * 2)) * strideMetres() : 0, pose.walking || stationary, sinceOf(pose.phase), leftOf(pose.phase), pitchRadians),
      groupKey: 0.5,
      member: female ? 1 : 0,
      denX: at.x,
      denY: at.y,
      glance: 0,
    });
    agentCount += 1;
  });
});

const shoals = new Shoals();
if (fishSpecies) {
  const bigView = { centre: { x: 0, y: 0 }, zoom: 10, width: 2000, height: 2000, time: clockSeconds, ground: null, people: null, shoals: null, fauna, fog: null, depth: 0, see: [] };
  HEADINGS.forEach((heading, row) => {
    poses.forEach((_, pair) => {
      const origin = cellOrigin(pair * (view3d ? 2 : 1), row);
      const at = toWorld(origin.x + cell / 2, origin.y + cell / 2);
      const slot = shoals.n;
      const angle = Math.atan2(heading.y, heading.x);
      const probe = new Shoals();
      probe.n = slot + 1;
      probe.species[slot] = fishIndex + 1;
      probe.heading[slot] = angle;
      probe.size[slot] = 1;
      probe.depth[slot] = 20;
      const seen = fishInstances(probe, bigView, 1).data;
      shoals.n = slot + 1;
      shoals.species[slot] = fishIndex + 1;
      shoals.heading[slot] = angle;
      shoals.size[slot] = 1;
      shoals.depth[slot] = 20;
      shoals.posX[slot] = at.x - (seen[0] ?? 0);
      shoals.posY[slot] = at.y - (seen[1] ?? 0);
    });
  });
}

const birdIndex = BIRDS.findIndex((one) => one.key === key);
const birdZoos: ZooState[] = [];
const birdTargets: { x: number; y: number; heading: { x: number; y: number } }[] = [];
const legsAt = (at: { x: number; y: number }, heading: { x: number; y: number }, flying: boolean): ZooState['legs'] =>
  flying ? [{ from: { x: at.x - heading.x * 50, y: at.y - heading.y * 50 }, to: { x: at.x + heading.x * 50, y: at.y + heading.y * 50 }, start: clockSeconds - 1000, end: clockSeconds + 1000 }] : [];
if (birdIndex >= 0) {
  HEADINGS.forEach((heading, row) => {
    poses.forEach((_, pair) => {
      const origin = cellOrigin(pair * 2, row);
      const at = toWorld(origin.x + cell / 2, origin.y + cell * (0.5 + FOOT_DROP));
      birdTargets.push({ ...at, heading });
      birdZoos.push({
        group: 'bird',
        species: birdIndex,
        home: at,
        cell: { x: 0, y: 0 },
        flat: false,
        legs: [],
      });
    });
  });
}

const paintGround = (): void => {
  const context = frame.ctx;
  context.save();
  context.fillStyle = fishSpecies ? '#3a6f9c' : TERRAINS[0]!.colour;
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
    litLayer!.setZoos(birdZoos, null);
    litLayer!.setScenery(null);
    litLayer!.setMammalAgents({ count: agentCount, data: agents, isolated: true });
    const view = { centre: lens.centre, zoom, width: pane.width, height: pane.height, time: clockSeconds, ground: frame.ctx.canvas, people: null, shoals: fishSpecies ? shoals : null, fauna, fog: null, depth: 0, see: [] };
    const lighting = lightingFor(stage, lens.centre, hour, 0.3);
    litLayer!.draw(stage, view, lighting, sky, 0);
    if (birdZoos.length > 0 && frames >= 6 && frames < 12) {
      birdZoos.forEach((one, at) => {
        litLayer!.setZoos(birdZoos, one);
        const seen = litLayer!.probeZoo(stage, view, lighting);
        const target = birdTargets[at]!;
        if (seen) one.home = { x: one.home.x + target.x - seen.x, y: one.home.y + target.y - seen.y };
        one.legs = legsAt(one.home, target.heading, ['fly', 'glide'].includes(stateParam));
      });
      litLayer!.setZoos(birdZoos, null);
    }
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
              pose: pose.walking ? (behaviourOf(key)?.hooks.pose?.({ state: stateNames[stateId] ?? '', phase: pose.phase, going: true, since: sinceOf(pose.phase), left: 99, pitch: pitchRadians }) ?? []) : [],
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
