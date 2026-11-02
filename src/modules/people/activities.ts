import type { TileIndex } from '../../sim/grid.ts';
import type { People } from './people.ts';

export interface RestContext {
  readonly sheltering: boolean;
}

export interface Activity {
  readonly id: string;
  readonly busy?: readonly number[];
  readonly rest?: { readonly priority: number; choose(people: People, person: number, context: RestContext): boolean };
  readonly arrives?: { readonly task: number; begin(people: People, person: number, tile: TileIndex): boolean };
  readonly carried?: { before?(people: People, person: number, here: TileIndex): boolean; after?(people: People, person: number, here: TileIndex): boolean };
  readonly pickedUp?: { readonly priority: number; run(people: People, person: number): boolean };
  readonly finishes?: { readonly state: number; readonly when?: (people: People, person: number) => boolean; finish(people: People, person: number): boolean };
}

const REGISTERED = new Map<string, Activity>();

let ladder: readonly NonNullable<Activity['rest']>[] | null = null;
let busy: ReadonlySet<number> | null = null;

export const registerActivity = (activity: Activity): void => {
  if (REGISTERED.has(activity.id)) throw new Error(`two activities are called ${activity.id}`);
  REGISTERED.set(activity.id, activity);
  ladder = null;
  busy = null;
};

export const restLadder = (): readonly NonNullable<Activity['rest']>[] => {
  ladder ??= [...REGISTERED.values()]
    .flatMap((activity) => (activity.rest ? [activity.rest] : []))
    .sort((a, b) => a.priority - b.priority);
  return ladder;
};

export const isBusy = (state: number): boolean => {
  busy ??= new Set([...REGISTERED.values()].flatMap((activity) => activity.busy ?? []));
  return busy.has(state);
};

export const arrival = (task: number): NonNullable<Activity['arrives']> | undefined => {
  for (const activity of REGISTERED.values()) if (activity.arrives?.task === task) return activity.arrives;
  return undefined;
};

export const finisher = (people: People, person: number, state: number): NonNullable<Activity['finishes']> | undefined => {
  for (const activity of REGISTERED.values()) {
    const finishes = activity.finishes;
    if (finishes?.state === state && (!finishes.when || finishes.when(people, person))) return finishes;
  }
  return undefined;
};

export const carriedHooks = (): readonly NonNullable<Activity['carried']>[] => [...REGISTERED.values()].flatMap((activity) => (activity.carried ? [activity.carried] : []));

export const pickedUpHooks = (): readonly NonNullable<Activity['pickedUp']>[] =>
  [...REGISTERED.values()].flatMap((activity) => (activity.pickedUp ? [activity.pickedUp] : [])).sort((a, b) => a.priority - b.priority);
