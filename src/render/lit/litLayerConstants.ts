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

export const LOW_MARK_SHADOWS_FROM_ZOOM = 22;
export const STRATA_VIEW_MODE = 7;
