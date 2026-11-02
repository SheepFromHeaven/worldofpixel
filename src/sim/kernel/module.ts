import type { Wander, WanderContext } from '../../content/animals/kit/types.ts';
import type { System } from './kernel.ts';
import type { Offers } from '../offers.ts';
import type { EmitterSource } from '../../modules/fire/api.ts';

export type ZooGroup = 'insect' | 'amphibian' | 'reptile' | 'bird' | 'mammal' | 'human';

export interface Listing {
  group: ZooGroup;
  index: number;
  key: string;
  name: string;
  life: number;
  speed: number;
  reach: number;
  rest: number;
  roams: boolean;
  restless: boolean;
  radius: number;
  length: number;
  bound: boolean;
  wander?: (context: WanderContext) => Wander | null;
}

export interface Kind {
  readonly group: ZooGroup;
  readonly title: string;
}

export interface SimModule {
  readonly id: string;
  readonly order: number;
  readonly heavy: boolean;
  readonly stage: boolean;
  readonly optional: boolean;
  readonly systems: readonly System[];
  readonly listings: readonly Listing[];
  readonly offers: readonly Offers[];
  readonly emitters: readonly EmitterSource[];
  readonly kind: Kind | null;
}

export interface ModuleExtras {
  order?: number;
  heavy?: boolean;
  stage?: boolean;
  optional?: boolean;
  listings?: readonly Listing[];
  offers?: readonly Offers[];
  emitters?: readonly EmitterSource[];
  kind?: Kind;
}

export const defineModule = (id: string, systems: readonly System[], extras: ModuleExtras = {}): SimModule => ({
  id,
  order: extras.order ?? 500,
  heavy: extras.heavy ?? false,
  stage: extras.stage ?? false,
  optional: extras.optional ?? false,
  systems,
  listings: extras.listings ?? [],
  offers: extras.offers ?? [],
  emitters: extras.emitters ?? [],
  kind: extras.kind ?? null,
});
