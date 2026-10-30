import type { SkyView } from '../../modules/weather/api.ts';
import type { Vec2 } from '../../sim/geometry.ts';
import type { World } from '../../sim/world.ts';
import type { FaunaTexture } from './faunaTexture.ts';
import type { QuadGeometry } from './glHelpers.ts';
import type { Lighting } from './lighting.ts';
import type { LitView } from './litLayer.ts';
import type { HumanDraw } from './humanPass.ts';
import type { WeatherDataTextures } from './weatherDataTextures.ts';
import type { ZooState } from './zoo.ts';

export type Stage = 'water' | 'underlay' | 'sorted' | 'overlay';

const STAGE_ORDER: readonly Stage[] = ['water', 'underlay', 'sorted', 'overlay'];

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
  readonly standing: boolean;
  readonly mip: number;
  readonly humans: readonly HumanDraw[];
}

export type Pin = (draw: () => void) => void;

export interface Entry<T> {
  readonly stage: Stage;
  readonly order: number;
  readonly label: string;
  readonly once?: boolean;
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

export const stagesInOrder = (): readonly Stage[] => STAGE_ORDER;
