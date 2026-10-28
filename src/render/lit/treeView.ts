export interface BandRule {
  belowHeight: number;
  bands: number;
}

export const TREE_VIEW = {
  k: 0.75,
  needleArts: ['pine', 'snowpine', 'spruce', 'cypress'] as readonly string[],
  broadleafBands: [
    { belowHeight: 3, bands: 1 },
    { belowHeight: 12, bands: 2 },
    { belowHeight: Infinity, bands: 3 },
  ] as readonly BandRule[],
  needleBands: [
    { belowHeight: 3, bands: 2 },
    { belowHeight: 8, bands: 4 },
    { belowHeight: 16, bands: 5 },
    { belowHeight: Infinity, bands: 7 },
  ] as readonly BandRule[],
  broadleafTrunk: 0.75,
  broadleafRoundness: 1,
  broadleafBandRise: 0.55,
  broadleafBandShrink: 0.25,
  needleTrunk: 1.1,
  needleCrown: 2.6,
  needleTopScale: 0.22,
  needleTierOverlap: 1.5,
  needleSkirt: 0.14,
  needleCore: 0.2,
  needleCoreShade: 0.38,
  trunkWidth: 1.25,
  sideDark: 0.5,
  sideLight: 0.88,
  lowLight: 0.72,
  underTier: 0.6,
  trunkIntoCrown: 0.55,
};

export const bandsFor = (rules: readonly BandRule[], height: number): number =>
  rules.find((rule) => height < rule.belowHeight)?.bands ?? 1;
