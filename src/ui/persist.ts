import type { GameMode } from './launch.ts';
import type { CalendarState } from '../sim/calendar.ts';
import type { PeopleState } from '../sim/people/people.ts';
import type { WorldState } from '../sim/world.ts';

export interface SaveData {
  version: number;
  slot: string;
  seed: number;
  size?: number;
  mode: GameMode;
  savedAt?: number;
  calendar: CalendarState;
  speed: number;
  playTime: number;
  camera: { x: number; y: number; zoom: number };
  achievements: string[];
  people: PeopleState;
  world: WorldState;
}

const VERSION = 1;

const KEY = 'scribble-empire.slot.';

const INDEX = 'scribble-empire.slots';

const storage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

export function newSlot(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 0xffff).toString(36)}`;
}

export function readSave(slot: string): SaveData | null {
  const store = storage();
  if (!store) return null;
  try {
    const text = store.getItem(KEY + slot);
    if (!text) return null;
    const data = JSON.parse(text) as SaveData;
    return data.version === VERSION && data.slot === slot ? data : null;
  } catch {
    return null;
  }
}

export interface SaveSummary {
  slot: string;
  seed: number;
  size?: number;
  mode: GameMode;
  days: number;
  savedAt: number;
  shot: string | null;
}

const SHOT = 'scribble-empire.shot.';

const META = 'scribble-empire.slotmeta';

const readMeta = (store: Storage): Record<string, SaveSummary> => {
  try {
    return JSON.parse(store.getItem(META) ?? '{}') as Record<string, SaveSummary>;
  } catch {
    return {};
  }
};

const readIndex = (store: Storage): string[] => {
  try {
    return JSON.parse(store.getItem(INDEX) ?? '[]') as string[];
  } catch {
    return [];
  }
};

export function writeSave(data: Omit<SaveData, 'version'>, shot: string | null): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(KEY + data.slot, JSON.stringify({ ...data, version: VERSION }));
    const order = [data.slot, ...readIndex(store).filter((slot) => slot !== data.slot)];
    const meta = readMeta(store);
    meta[data.slot] = {
      slot: data.slot,
      seed: data.seed,
      size: data.size ?? 1,
      mode: data.mode,
      days: data.calendar.elapsedDays,
      savedAt: data.savedAt ?? 0,
      shot: null,
    };
    if (shot) store.setItem(SHOT + data.slot, shot);
    store.setItem(INDEX, JSON.stringify(order));
    store.setItem(META, JSON.stringify(meta));
    return true;
  } catch {
    return false;
  }
}

export function savedGames(): SaveSummary[] {
  const store = storage();
  if (!store) return [];
  const meta = readMeta(store);
  const found: SaveSummary[] = [];
  for (const slot of readIndex(store)) {
    const summary = meta[slot];
    if (summary) found.push({ ...summary, shot: store.getItem(SHOT + slot) });
  }
  return found.sort((a, b) => b.savedAt - a.savedAt);
}

export function forgetSave(slot: string): void {
  const store = storage();
  if (!store) return;
  store.removeItem(KEY + slot);
  store.removeItem(SHOT + slot);
  store.setItem(INDEX, JSON.stringify(readIndex(store).filter((kept) => kept !== slot)));
  const meta = readMeta(store);
  delete meta[slot];
  store.setItem(META, JSON.stringify(meta));
}
