import type { Wander, WanderContext } from '../../animals/types.ts';
import type { System } from '../kernel/kernel.ts';
import type { Offers } from '../offers.ts';
import type { EmitterSource } from '../sources/emitters.ts';

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
  readonly systems: readonly System[];
  readonly listings: readonly Listing[];
  readonly offers: readonly Offers[];
  readonly emitters: readonly EmitterSource[];
  readonly kind: Kind | null;
}

export const defineModule = (id: string, systems: readonly System[], extras: { listings?: readonly Listing[]; offers?: readonly Offers[]; emitters?: readonly EmitterSource[]; kind?: Kind } = {}): SimModule => ({ id, systems, listings: extras.listings ?? [], offers: extras.offers ?? [], emitters: extras.emitters ?? [], kind: extras.kind ?? null });
