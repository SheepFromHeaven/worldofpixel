import type { Vec2 } from '../../sim/geometry.ts';
import type { FaunaMirror } from '../../modules/fauna/api.ts';
import type { Shoals } from '../../modules/fish/api.ts';
import type { HumanDraw, People } from '../../modules/people/api.ts';
import type { SkyView } from '../../modules/weather/api.ts';
import type { World } from '../../sim/world.ts';
import { levelFor, TEXEL } from '../terrainPixels.ts';
import { FaunaTexture } from './faunaTexture.ts';
import { createQuadGeometry } from './glHelpers.ts';
import type { Lighting } from './lighting.ts';
import '../../modules/client.ts';
import './corePasses.ts';
import { passDefs, stagesInOrder } from './passes.ts';
import type { Entry, Frame, PassDef, RenderContext, Stage } from './passes.ts';
import { PassTimer } from './passTimer.ts';
import { packPointLights } from './pointLightData.ts';
import type { SceneryProp } from './scenery.ts';
import { replacesTheScene } from './scenePass.ts';
import { WeatherDataTextures } from './weatherDataTextures.ts';
import type { MammalAgents } from './mammalAgents.ts';
import type { ZooState } from './zoo.ts';

export interface LitView {
  centre: Vec2;
  zoom: number;
  width: number;
  height: number;
  time: number;
  ground: HTMLCanvasElement | null;
  people: People | null;
  shoals: Shoals | null;
  fauna: FaunaMirror | null;
  fog: FogView | null;
  depth: number;
  see?: readonly SeeThrough[];
  xray?: boolean;
  ghost?: { sprite: string; x: number; y: number };
}

export interface SeeThrough {
  x: number;
  y: number;
  lift: number;
  radius: number;
  strength?: number;
  simple?: boolean;
}

export interface FogView {
  x: number;
  y: number;
  inner: number;
  edge: number;
}

export interface LitLayer {
  readonly showsFolk: boolean;
  draw(world: World, view: LitView, lighting: Lighting, sky: SkyView, viewMode: number): void;
  throwRipple(x: number, y: number, seconds: number): void;
  setZoos(states: readonly ZooState[], focus: ZooState | null): void;
  setMammalAgents(agents: MammalAgents | null): void;
  setHumans(people: readonly HumanDraw[]): void;
  setScenery(props: readonly SceneryProp[] | null): void;
  probeZoo(world: World, view: LitView, lighting: Lighting): Vec2 | null;
  dispose(): void;
}

export function createLitLayer(canvas: HTMLCanvasElement, groups: ReadonlySet<string> | null = null): LitLayer | null {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    depth: true,
    stencil: true,
    antialias: false,
  });
  if (!gl) return null;

  const quad = createQuadGeometry(gl);
  const timer = new PassTimer(gl);
  const skipped = (name: string): boolean => ((globalThis as { litSkip?: string[] }).litSkip ?? []).includes(name);
  const weather = new WeatherDataTextures(gl);

  const instances = new Map<string, unknown>();
  try {
    const context: RenderContext = { gl, quad, weather, fauna: new FaunaTexture(gl) };
    for (const def of passDefs()) instances.set(def.id, def.create(context));
  } catch (error) {
    console.warn('lit props unavailable:', error);
    return null;
  }

  let showsFolk = false;
  let zoos: readonly ZooState[] = [];
  let focus: ZooState | null = null;
  const hidden = (name: string, group: ZooState['group']): boolean => skipped(name) || (groups !== null && !groups.has(group)) || (zoos.length > 0 && !zoos.some((one) => one.group === group));
  const pinned = (group: ZooState['group'], pass: { zoo: ZooState | null }, run: () => void, once = false): void => {
    const list = zoos.filter((one) => one.group === group);
    if (list.length === 0) {
      pass.zoo = null;
      run();
      return;
    }
    for (const one of once ? list.slice(0, 1) : list) {
      pass.zoo = one;
      run();
    }
  };

  const feed = (id: string, value: unknown): void => {
    const def = passDefs().find((one) => one.id === id);
    def?.feed?.(instances.get(id), value);
  };

  const plan = new Map<Stage, { def: PassDef<unknown>; entry: Entry<unknown> }[]>();
  for (const stage of [...stagesInOrder(false), ...stagesInOrder(true)]) {
    if (plan.has(stage)) continue;
    const todo: { def: PassDef<unknown>; entry: Entry<unknown> }[] = [];
    for (const def of passDefs()) for (const entry of def.entries) if (entry.stage === stage) todo.push({ def, entry });
    plan.set(stage, todo.sort((a, b) => a.entry.order - b.entry.order));
  }
  const runStage = (stage: Stage, frame: Frame): void => {
    for (const { def, entry } of plan.get(stage) ?? []) {
      if (def.group ? hidden(def.skip, def.group) : skipped(def.skip)) continue;
      if (entry.skip !== undefined && skipped(entry.skip)) continue;
      if (entry.when && !entry.when(frame)) continue;
      const pass = instances.get(def.id);
      const pin = (draw: () => void): void => (def.group ? pinned(def.group, pass as { zoo: ZooState | null }, draw, entry.once === true) : draw());
      timer.time(entry.label, () => entry.run(pass, frame, pin));
    }
  };

  return {
    get showsFolk() {
      return showsFolk;
    },

    draw(world, view, lighting, sky, viewMode) {
      const replaced = replacesTheScene(viewMode);
      timer.time('weather textures', () => weather.update(world, sky, view.time, lighting));
      gl.viewport(0, 0, view.width, view.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
      gl.disable(gl.DEPTH_TEST);
      const frame: Frame = {
        world,
        view,
        lighting,
        sky,
        viewMode,
        mip: Math.round(Math.log2(levelFor(view.zoom).texel / TEXEL)),
        points: packPointLights(lighting),
        standing: false,
        skipped,
        time: (label, run) => timer.time(label, run),
        note: (label, value) => timer.note(label, value),
      };
      for (const stage of stagesInOrder(replaced)) runStage(stage, frame);
      if (!replaced) showsFolk = frame.standing && view.people !== null;
      timer.frame();
    },

    setScenery(props) {
      feed('scene', props);
    },

    setHumans(people) {
      feed('people', people);
    },

    setMammalAgents(agents) {
      feed('mammals', agents);
    },

    setZoos(states, focused) {
      zoos = states;
      focus = focused;
    },

    probeZoo(world, view, lighting) {
      if (!focus || focus.group === 'human') return null;
      const def = passDefs().find((one) => one.group === focus!.group);
      if (!def?.probe) return null;
      const pass = instances.get(def.id) as { zoo: ZooState | null };
      pass.zoo = focus;
      return def.probe(pass, world, view, lighting);
    },

    throwRipple(x, y, seconds) {
      for (const def of passDefs()) def.startle?.(instances.get(def.id), x, y, seconds);
    },

    dispose() {
      for (const def of passDefs()) def.dispose?.(instances.get(def.id));
    },
  };
}
