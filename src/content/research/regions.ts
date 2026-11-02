export interface RegionDef {
  readonly key: string;
  readonly label: string;
  readonly open: boolean;
}

export const REGIONS: readonly RegionDef[] = [
  { key: 'survival', label: 'survival', open: true },
  { key: 'community', label: 'community', open: false },
  { key: 'making', label: 'making', open: false },
  { key: 'wonder', label: 'wonder', open: false },
  { key: 'memory', label: 'memory', open: false },
];

export const regionIndex = (key: string): number => {
  const at = REGIONS.findIndex((region) => region.key === key);
  if (at < 0) throw new Error(`no research region ${key}`);
  return at;
};
