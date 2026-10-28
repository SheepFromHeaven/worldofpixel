export const FLOATS_PER_INSTANCE = 12;

export interface InstanceTraits {
  canopy: boolean;
  bend: boolean;
  emit: boolean;
  hides?: boolean;
  rimmed?: boolean;
  focus?: boolean;
  season: number;
}

export const flagsOf = (traits: InstanceTraits): number =>
  (traits.canopy ? 1 : 0) + (traits.bend ? 2 : 0) + (traits.emit ? 4 : 0) + (traits.hides ? 8 : 0) + (traits.rimmed ? 16 : 0) + (traits.focus || traits.rimmed ? 32 : 0) + traits.season * 64;
export const PLACEMENT_BLOCK_TILES = 32;
export const PLACEMENT_BLOCK_CACHE_SIZE = 3000;
export const VIEW_MARGIN_TILES = 4;
export const POINT_LIGHT_HEIGHT = 1.2;
export const PROP_DEPTH_RANGE = 96;
export const LIFTED_DEPTH_PER_TILE = 1;
export const STEM_FLAG = 4096;
export const LAYERED_FLAG = 8192;
export const SUBMERGED_FLAG = 16384;
export const SEE_THROUGH_FOCI = 4;
export const SEE_THROUGH_GAIN = 1.25;
export const SEE_THROUGH_LEAF_BAND = 0.6;
export const SEE_THROUGH_REVEAL_BIAS = 0.4;
export const SEE_THROUGH_WOOD_BAND = 0.7;
export const SEE_THROUGH_OUTER = 1.3;
export const SEE_THROUGH_DEPTH = 1.8;
export const SEE_THROUGH_RISE_BAND = 0.5;
export const UNDERLAY = 0;
export const SORTED_WITH_PROPS = 1;
export const CANOPY_HIDE_FROM_ZOOM = 20;
export const CANOPY_HIDE_TO_ZOOM = 30;
export const GROUND_MARKS_FROM_ZOOM = 10;
export const CLOUD_BODIES_FROM_ZOOM = 4;
export const CLOUD_BODIES_GONE_BY_ZOOM = 14;
export const CLOUD_HEIGHT_TILES = 40;
export const MAX_VISIBLE_BOLTS = 12;
export const BOLT_LIFETIME_SECONDS = 1.6;

export const LOW_MARK_HEIGHT = 1.3;
export const TALL_MARK_HEIGHT = 3.2;

export const LOW_MARK_SHADOWS_FROM_ZOOM = 22;
export const STRATA_VIEW_MODE = 7;
export const TORCH_FLAME_LIFT_TILES = 0.95;
