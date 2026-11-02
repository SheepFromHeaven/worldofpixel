import type { SkyView } from '../../modules/weather/api.ts';
import type { Vec2 } from '../../sim/geometry.ts';
import type { World } from '../../sim/world.ts';
import type { FaunaTexture } from './faunaTexture.ts';
import type { QuadGeometry } from './glHelpers.ts';
import type { Lighting } from './lighting.ts';
import type { LitView } from './litLayer.ts';
import type { PointLightData } from './pointLightData.ts';
import type { WeatherDataTextures } from './weatherDataTextures.ts';
import type { ZooState } from './zoo.ts';

export type Stage = 'ground' | 'water' | 'light' | 'underlay' | 'props' | 'sorted' | 'cut' | 'overlay' | 'map' | 'veil' | 'replace';

const SCENE_STAGES: readonly Stage[] = ['ground', 'water', 'light', 'underlay', 'props', 'sorted', 'cut', 'overlay', 'map', 'veil'];

const REPLACED_STAGES: readonly Stage[] = ['replace', 'veil'];

export interface RenderContext {
  readonly gl: WebGL2RenderingContext;
  readonly quad: QuadGeometry;
  readonly weather: WeatherDataTextures;
  readonly fauna: FaunaTexture;
}

export interface Frame {
  readonly world: World;
  readonly view: LitView;
  readonly lighting: Lighting;
  readonly sky: SkyView;
  readonly viewMode: number;
  readonly mip: number;
  readonly points: PointLightData;
  standing: boolean;
  skipped(name: string): boolean;
  time<T>(label: string, run: () => T): T;
  note(label: string, value: number): void;
}

export type Pin = (draw: () => void) => void;

export interface Entry<T> {
  readonly stage: Stage;
  readonly order: number;
  readonly label: string;
  readonly once?: boolean;
  readonly skip?: string;
  when?(frame: Frame): boolean;
  run(pass: T, frame: Frame, pin: Pin): void;
}

export interface PassDef<T> {
  readonly id: string;
  readonly skip: string;
  readonly group?: ZooState['group'];
  readonly entries: readonly Entry<T>[];
  create(context: RenderContext): T;
  startle?(pass: T, x: number, y: number, seconds: number): void;
  probe?(pass: T, world: World, view: LitView, lighting: Lighting): Vec2 | null;
  feed?(pass: T, value: unknown): void;
  dispose?(pass: T): void;
}

export interface GroupPass {
  zoo: ZooState | null;
  prepare(world: World, view: LitView): void;
  draw(world: World, view: LitView, lighting: Lighting, layer: number): void;
  startle(x: number, y: number, seconds: number): void;
  probe(world: World, view: LitView, lighting: Lighting): Vec2 | null;
}

const DEFS: PassDef<never>[] = [];

export const registerPass = <T>(def: PassDef<T>): void => {
  if (DEFS.some((one) => one.id === def.id)) throw new Error(`two render passes are called ${def.id}`);
  DEFS.push(def as unknown as PassDef<never>);
};

export const passDefs = (): readonly PassDef<unknown>[] => DEFS as unknown as readonly PassDef<unknown>[];

export const stagesInOrder = (replaced: boolean): readonly Stage[] => (replaced ? REPLACED_STAGES : SCENE_STAGES);
