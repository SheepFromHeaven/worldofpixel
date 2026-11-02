import type { StationDef } from './definition.ts';
import { STATION_DEFS } from './manifest.generated.ts';

export const STATIONS: readonly StationDef[] = STATION_DEFS;

export const stationOf = (id: number): StationDef | undefined => STATIONS[id - 1];

export const stationIdOf = (key: string): number => {
  const at = STATIONS.findIndex((def) => def.key === key);
  if (at < 0) throw new Error(`no station called ${key}`);
  return at + 1;
};
