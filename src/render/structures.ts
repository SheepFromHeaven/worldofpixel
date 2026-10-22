import { PARCEL } from '../sim/terrain/parcels.ts';
import { CLAMP_ID, HEARTH_DESIGN_ID, PIT_FIRING_ID } from '../sim/designs.ts';
import type { Design, DesignId } from '../sim/types.ts';
import { TILT } from '../pixel/view.ts';
import { withAlpha } from './palette.ts';
import { SOURCES, drawTile, frameAt, tilePieces } from './sprites.ts';
import type { TilePiece, Tint } from './sprites.ts';

export interface StructureOptions {
  time: number;
  worker?: 'woman' | 'man';
  piece?: TilePiece;
  smoke?: Tint;
  fire?: number;
}

const BURN_CLIPS = ['burn-banked', 'burn', 'burn-roaring'] as const;

export interface GlowLight {
  color: string;
  level: number;
}

function drawPieces(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  options: StructureOptions,
): boolean {
  const source = SOURCES[name];
  if (!source) return false;

  const wanted = options.piece?.clip;
  const clips = wanted ? [wanted] : tilePieces(name).map((piece) => piece.clip ?? 'default');

  let drawn = false;
  for (const named of clips) {
    const clip = named === 'burn' && options.fire !== undefined
      ? BURN_CLIPS[Math.min(Math.max(0, options.fire), BURN_CLIPS.length - 1)] ?? named
      : named;
    if (clip === 'smoke' && !options.smoke) continue;
    const entry = source.clips.find((declared) => declared.name === clip);
    const step = entry && entry.frames > 1 ? frameAt(options.time, entry.frames, entry.fps) : 0;
    drawn = drawTile(ctx, name, x, y, clip, step, false, clip === 'smoke' ? options.smoke : undefined) || drawn;
  }
  return drawn;
}

const TILES: Readonly<Record<DesignId, string>> = {
  [HEARTH_DESIGN_ID]: 'hearth',
  [PIT_FIRING_ID]: 'pit-firing',
  [CLAMP_ID]: 'charcoal-clamp',
  well: 'well',
  digging: 'dig',
  woodcutter: 'woodcutter',
  'work-area': 'mini-slot',
  clearing: 'mini-slot',
};

export function structureTile(design: Design): string {
  return TILES[design.id] ?? 'works';
}

export const designRadius = (design: Design): number => {
  void design;
  return 1.1;
};

export function drawStructure(
  ctx: CanvasRenderingContext2D,
  design: Design,
  x: number,
  y: number,
  radius: number,
  options: StructureOptions,
): void {
  void radius;
  const tile = structureTile(design);
  const name = options.worker === 'man' ? 'work-man' : 'work';
  const work = options.worker ? SOURCES[tile]?.clips.find((clip) => clip.name === name) : undefined;
  if (work) {
    drawTile(ctx, tile, x, y, name, frameAt(options.time, work.frames, work.fps));
    return;
  }
  drawPieces(ctx, tile, x, y, options);
}

const CHAMBER = { x: -PARCEL * 0.03, y: PARCEL * 0.12 };

export function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  glow: GlowLight,
  time: number,
  part: 'ground' | 'chamber',
): void {
  if (glow.level <= 0) return;
  const breath = 0.9 + 0.08 * Math.sin(time * 4.3) + 0.04 * Math.sin(time * 11.7);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  if (part === 'ground') {
    const reach = PARCEL * (0.42 + 0.3 * glow.level);
    ctx.translate(x + CHAMBER.x, y + CHAMBER.y);
    ctx.scale(1, TILT);
    const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, reach);
    pool.addColorStop(0, withAlpha(glow.color, (0.12 + 0.16 * glow.level) * breath));
    pool.addColorStop(0.45, withAlpha(glow.color, (0.06 + 0.08 * glow.level) * breath));
    pool.addColorStop(1, withAlpha(glow.color, 0));
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.arc(0, 0, reach, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.translate(x + CHAMBER.x, y + CHAMBER.y);
  const mouth = PARCEL * (0.19 + 0.1 * glow.level);
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, mouth);
  core.addColorStop(0, withAlpha(glow.color, (0.4 + 0.24 * glow.level) * breath));
  core.addColorStop(1, withAlpha(glow.color, 0));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.ellipse(0, 0, mouth, mouth * TILT * 1.6, 0, 0, Math.PI * 2);
  ctx.fill();

  if (glow.level < 0.5) {
    ctx.restore();
    return;
  }
  const rise = PARCEL * 0.5 * glow.level;
  const lean = Math.sin(time * 1.7) * PARCEL * 0.06;
  const air = ctx.createLinearGradient(0, 0, lean, -rise);
  air.addColorStop(0, withAlpha(glow.color, 0.16 * glow.level * breath));
  air.addColorStop(1, withAlpha(glow.color, 0));
  ctx.fillStyle = air;
  ctx.beginPath();
  ctx.moveTo(-mouth * 0.7, 0);
  ctx.quadraticCurveTo(lean * 2 - mouth * 0.2, -rise * 0.6, lean, -rise);
  ctx.quadraticCurveTo(lean * 2 + mouth * 0.2, -rise * 0.6, mouth * 0.7, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
