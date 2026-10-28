import { broadleaf, makeBroadleaf } from './broadleaf.ts';

export const BIRCH = broadleaf({
  stretch: 1.35,
  trunkHeight: 0.55,
  trunkRadius: 0.075,
  trunkLean: 0.1,
  primaries: 5,
  primaryLength: 0.8,
  primaryWidth: 0.6,
  primarySpread: [0.3, 0.7],
  wander: 0.35,
  upward: 0.45,
  sag: 0.22,
  sideAngle: [0.5, 0.9],
  forkAngle: [0.3, 0.65],
  childLength: [0.6, 0.75],
  childWidth: 0.65,
  taper: 0.45,
  tuft: 0.085,
  tuftFlat: 0.9,
  hang: 0.2,
  cluster: 8,
  clusterSpread: 0.11,
  skipped: 0.06,
  ragged: 0.4,
  holes: 0.12,
  clump: 0.5,
  envelope: 0.45,
  bark: 0.9,
});

export const CHESTNUT = broadleaf({
  stretch: 1,
  trunkHeight: 0.7,
  trunkRadius: 0.15,
  primaries: 6,
  primaryLength: 0.75,
  primarySpread: [0.6, 1],
  tuft: 0.12,
  cluster: 9,
  clusterSpread: 0.14,
  skipped: 0.03,
  holes: 0.05,
  clump: 0.5,
  envelope: 0.7,
});

export const APPLE = broadleaf({
  stretch: 0.95,
  trunkHeight: 0.85,
  trunkRadius: 0.14,
  trunkWander: 0.25,
  primaries: 4,
  primaryLength: 0.75,
  primarySpread: [0.85, 1.25],
  tuft: 0.13,
  cluster: 8,
  skipped: 0.08,
  holes: 0.1,
  clump: 0.5,
  envelope: 0.6,
  depthByAge: [
    { below: 0.3, depth: 1 },
    { below: Infinity, depth: 2 },
  ],
});

export const OLIVE = broadleaf({
  stretch: 0.95,
  trunkHeight: 0.7,
  trunkRadius: 0.16,
  trunkWander: 0.4,
  trunkLean: 0.2,
  primaries: 5,
  primaryLength: 0.8,
  primarySpread: [0.6, 1.1],
  wander: 0.6,
  tuft: 0.08,
  cluster: 6,
  skipped: 0.3,
  ragged: 0.4,
  holes: 0.25,
  clump: 0.5,
  envelope: 0.5,
});

export const FIG = broadleaf({
  stretch: 0.95,
  trunkHeight: 0.7,
  trunkRadius: 0.2,
  buttress: 5,
  primaries: 5,
  primaryLength: 0.85,
  primarySpread: [0.7, 1.1],
  tuft: 0.13,
  cluster: 9,
  envelope: 0.7,
});

export const JUNGLE = broadleaf({
  stretch: 1.15,
  trunkHeight: 0.95,
  trunkRadius: 0.11,
  buttress: 4,
  primaries: 5,
  primaryLength: 0.8,
  primarySpread: [0.5, 0.95],
  upward: 0.3,
  tuft: 0.13,
  cluster: 9,
  envelope: 0.7,
});

export const KAPOK = broadleaf({
  stretch: 1.15,
  trunkHeight: 1.5,
  trunkRadius: 0.1,
  buttress: 6,
  buttressHeight: 0.6,
  primaries: 7,
  primaryLength: 0.75,
  primarySpread: [1, 1.3],
  upward: 0.05,
  tuft: 0.13,
  tuftFlat: 0.5,
  cluster: 9,
  skipped: 0.05,
  envelope: 0.6,
});

export const WILLOW = broadleaf({
  stretch: 1.1,
  trunkHeight: 0.6,
  trunkRadius: 0.16,
  trunkLean: 0.18,
  primaries: 5,
  primaryLength: 0.75,
  primarySpread: [0.8, 1.2],
  wander: 0.3,
  upward: 0.35,
  sag: 0.75,
  tuft: 0.06,
  tuftFlat: 3.2,
  hang: 1.4,
  cluster: 10,
  clusterSpread: 0.12,
  skipped: 0.02,
  ragged: 0.5,
  holes: 0.06,
  clump: 0.15,
  envelope: 0.2,
});

export const ACACIA = broadleaf({
  stretch: 1,
  trunkHeight: 1.6,
  trunkRadius: 0.075,
  trunkLean: 0.1,
  trunkWander: 0.2,
  primaries: 4,
  primaryLength: 0.75,
  primarySpread: [0.9, 1.25],
  wander: 0.25,
  upward: 0,
  sag: -0.02,
  forkAngle: [0.5, 0.9],
  childLength: [0.6, 0.7],
  tuft: 0.19,
  tuftFlat: 0.22,
  cluster: 12,
  clusterSpread: 0.15,
  skipped: 0,
  topTuft: 0,
  holes: 0.08,
  clump: 0.45,
  envelope: 0.25,
  depthByAge: [
    { below: 0.3, depth: 1 },
    { below: Infinity, depth: 2 },
  ],
});

export const BAOBAB = broadleaf({
  stretch: 1,
  trunkHeight: 0.8,
  trunkRadius: 0.27,
  trunkTaper: [0.97, 0.88, 0.7],
  primaries: 7,
  primaryWidth: 0.5,
  primaryLength: 0.8,
  primarySpread: [0.55, 1],
  childWidth: 0.7,
  tuft: 0.085,
  cluster: 5,
  skipped: 0.2,
  holes: 0.2,
  envelope: 0.5,
});

export const SNAG = broadleaf({
  stretch: 1,
  trunkHeight: 1.1,
  trunkRadius: 0.13,
  primaries: 4,
  primarySpread: [0.5, 1],
  primaryLength: 0.9,
  wander: 0.55,
  upward: 0.35,
  sag: 0.1,
  leafless: true,
  topTuft: 0,
  bark: 0.3,
});

export const growBirch = makeBroadleaf(BIRCH);
export const growChestnut = makeBroadleaf(CHESTNUT);
export const growApple = makeBroadleaf(APPLE);
export const growOlive = makeBroadleaf(OLIVE);
export const growFig = makeBroadleaf(FIG);
export const growJungle = makeBroadleaf(JUNGLE);
export const growKapok = makeBroadleaf(KAPOK);
export const growWillow = makeBroadleaf(WILLOW);
export const growAcacia = makeBroadleaf(ACACIA);
export const growBaobab = makeBroadleaf(BAOBAB);
export const growSnag = makeBroadleaf(SNAG);
