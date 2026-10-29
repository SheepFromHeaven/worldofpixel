import { NEURONS } from '../sim/mind/neurons.ts';

export interface Place {
  angle: number;
  ring: number;
}

const KEY = 'mind-layout';

export const overrides = new Map<string, Place>();

try {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Place>;
  for (const [id, place] of Object.entries(saved)) if (NEURONS.some((neuron) => neuron.id === id)) overrides.set(id, place);
} catch {
  overrides.clear();
}

export const placeOf = (index: number): Place => {
  const neuron = NEURONS[index]!;
  return overrides.get(neuron.id) ?? { angle: neuron.angle, ring: neuron.ring };
};

const persist = (): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(overrides)));
  } catch {
    return;
  }
};

export function setPlace(index: number, place: Place): void {
  overrides.set(NEURONS[index]!.id, { angle: Math.round(place.angle) % 360, ring: Math.round(place.ring * 20) / 20 });
}

export const savePlaces = persist;

export function resetPlaces(): void {
  overrides.clear();
  persist();
}

export function layoutText(): string {
  const rows = NEURONS.map((neuron, index) => {
    const place = placeOf(index);
    return `  ${neuron.id}: { angle: ${place.angle}, ring: ${place.ring} },`;
  });
  return `export const LAYOUT: Readonly<Record<string, { angle: number; ring: number }>> = {\n${rows.join('\n')}\n};\n`;
}
