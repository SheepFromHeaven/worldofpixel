import { CLOSE_UP_SCALE, FLOOR_PIXELS, HAND_SIZE, HAND_TILT, handShape, WRIST_RADIUS } from '../pixel/ground/closeUpMetrics.ts';
import type { Rgb } from '../render/lit/lighting.ts';
import { CLOSE_UP } from '../render/palette.ts';
import { drawWorld } from '../render/worldLayer.ts';
import type { Vec2 } from '../sim/geometry.ts';
import { ItemType, ITEM_NAMES } from '../sim/people/items.ts';
import { hash2 } from '../sim/rng.ts';
import type { Effect, Piece, Trial } from '../sim/discovery/trial.ts';
import { EFFECT_SECONDS, PieceState, SMOULDER_SECONDS } from '../sim/discovery/trial.ts';
import type { World } from '../sim/world.ts';
import { drawText, textWidth } from './pixelText.ts';

export { FLOOR_PIXELS };

const BUFFER_WIDTH = 250;

const BUFFER_HEIGHT = 190;

const OPEN_HAND = handShape(false);

const GRIP_HAND = handShape(true);

const ARM_TAPER = 1.45;

const ARM_REACH = 420;

const BACKGROUND_DIM = 0.78;

const NIGHT_SHARE = 0.85;

const GRAIN_ALPHA = 0.07;

const TORCH_HEAD = { x: Math.round(3.13 * CLOSE_UP_SCALE), y: Math.round(1.32 * CLOSE_UP_SCALE) };

const BAYER: readonly number[] = [0, 0.5, 0.75, 0.25];

const SPRITE_OF: Record<number, string> = {
  [ItemType.Flint]: 'piece.flint',
  [ItemType.Stone]: 'piece.stone',
  [ItemType.DryKindling]: 'piece.kindling',
  [ItemType.Branch]: 'piece.branch',
  [ItemType.HandAxe]: 'piece.axe',
  [ItemType.Torch]: 'piece.torch',
};

interface SheetSprite {
  name: string;
  x: number;
  y: number;
  size: number;
}

const sheet = new Image();
sheet.src = '/closeup/sheet.png';
const sprites = new Map<string, SheetSprite>();
void fetch('/closeup/sheet.json')
  .then((response) => response.json() as Promise<{ sprites: SheetSprite[] }>)
  .then((manifest) => {
    for (const sprite of manifest.sprites) sprites.set(sprite.name, sprite);
  })
  .catch(() => undefined);

export interface CloseUpLayout {
  scale: number;
  width: number;
  height: number;
  floor: Vec2;
}

export function layoutFor(clientWidth: number, clientHeight: number): CloseUpLayout {
  const scale = Math.max(1, Math.floor(Math.min(clientWidth / BUFFER_WIDTH, clientHeight / BUFFER_HEIGHT)));
  const width = Math.ceil(clientWidth / scale);
  const height = Math.ceil(clientHeight / scale);
  return { scale, width, height, floor: { x: Math.round(width / 2 - FLOOR_PIXELS / 2), y: Math.round(height * 0.42 - FLOOR_PIXELS / 2) } };
}

export const toFloor = (layout: CloseUpLayout, client: Vec2): Vec2 => ({
  x: (client.x / layout.scale - layout.floor.x) / FLOOR_PIXELS,
  y: (client.y / layout.scale - layout.floor.y) / FLOOR_PIXELS,
});

export interface CloseUpShade {
  gloom: number;
  tint: Rgb;
  time: number;
}

function ground(ctx: CanvasRenderingContext2D, world: World, trial: Trial, layout: CloseUpLayout, time: number): void {
  const { grid } = world;
  const corner = { x: grid.x(grid.columnOf(trial.tile)), y: grid.y(grid.rowOf(trial.tile)) };
  const centre = {
    x: corner.x + (layout.width / 2 - layout.floor.x) / FLOOR_PIXELS,
    y: corner.y + (layout.height / 2 - layout.floor.y) / FLOOR_PIXELS,
  };
  const half = { x: layout.width / (2 * FLOOR_PIXELS), y: layout.height / (2 * FLOOR_PIXELS) };
  ctx.save();
  ctx.translate(layout.width / 2, layout.height / 2);
  ctx.scale(FLOOR_PIXELS, FLOOR_PIXELS);
  ctx.translate(-centre.x, -centre.y);
  drawWorld(ctx, world, {
    bounds: { minX: centre.x - half.x, minY: centre.y - half.y, maxX: centre.x + half.x, maxY: centre.y + half.y },
    zoom: FLOOR_PIXELS,
    time,
  });
  ctx.restore();
}

let grainKey = '';
let grainCanvas: HTMLCanvasElement | null = null;

function grain(ctx: CanvasRenderingContext2D, trial: Trial, layout: CloseUpLayout): void {
  const key = `${trial.tile}:${layout.width}x${layout.height}`;
  if (!grainCanvas || key !== grainKey) {
    grainCanvas = document.createElement('canvas');
    grainCanvas.width = layout.width;
    grainCanvas.height = layout.height;
    const paint = grainCanvas.getContext('2d');
    if (!paint) return;
    const image = paint.createImageData(layout.width, layout.height);
    for (let y = 0; y < layout.height; y += 1) {
      for (let x = 0; x < layout.width; x += 1) {
        const roll = hash2(x, y, trial.tile);
        const at = (y * layout.width + x) * 4;
        const light = roll > 0.5;
        image.data[at] = light ? 255 : 0;
        image.data[at + 1] = light ? 255 : 0;
        image.data[at + 2] = light ? 255 : 0;
        image.data[at + 3] = Math.round(Math.abs(roll - 0.5) * 2 * GRAIN_ALPHA * 255);
      }
    }
    paint.putImageData(image, 0, 0);
    grainKey = key;
  }
  ctx.drawImage(grainCanvas, 0, 0);
}

function blit(ctx: CanvasRenderingContext2D, name: string, x: number, y: number): SheetSprite | null {
  const sprite = sprites.get(name);
  if (!sprite || !sheet.complete) return null;
  ctx.drawImage(sheet, sprite.x, sprite.y, sprite.size, sprite.size, Math.round(x - sprite.size / 2), Math.round(y - sprite.size / 2), sprite.size, sprite.size);
  return sprite;
}

const spriteOf = (piece: Piece): string => (piece.state === PieceState.Ash ? 'piece.ash' : (SPRITE_OF[piece.kind] ?? 'piece.stone'));

function embers(ctx: CanvasRenderingContext2D, x: number, y: number, piece: Piece, time: number): void {
  const urgency = 1 - Math.max(0, piece.timer) / SMOULDER_SECONDS;
  const beat = Math.floor(time * (3 + urgency * 9));
  for (let i = 0; i < 14; i += 1) {
    const dx = Math.round((hash2(i, piece.id, 3) - 0.5) * 30);
    const dy = Math.round((hash2(piece.id, i, 9) - 0.5) * 14);
    const glow = hash2(i, beat, piece.id);
    if (glow < 0.35) continue;
    ctx.fillStyle = CLOSE_UP.ember[Math.min(3, Math.floor(glow * 4))]!;
    ctx.fillRect(Math.round(x + dx), Math.round(y + dy), 2, 2);
  }
  smoke(ctx, x, y - 6, time, piece.id, 3);
}

function smoke(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, seed: number, count: number): void {
  for (let i = 0; i < count; i += 1) {
    const phase = (time * 0.6 + hash2(i, seed, 13)) % 1;
    const sway = Math.sin(time * 2 + i * 1.7) * 4 * phase;
    ctx.fillStyle = CLOSE_UP.smoke[Math.min(2, Math.floor(phase * 3))]!;
    ctx.fillRect(Math.round(x + sway + (i - count / 2) * 3), Math.round(y - phase * 34), 2, 2);
  }
}

function flames(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, seed: number, size: number): void {
  const frame = Math.floor(time * 10);
  for (let i = 0; i < size * 3; i += 1) {
    const life = (hash2(i, frame, seed) + time * 1.4) % 1;
    const dx = (hash2(i, seed, 21) - 0.5) * size * 1.4 * (1 - life * 0.6);
    const dy = -life * size * 2;
    ctx.fillStyle = CLOSE_UP.flame[Math.min(3, Math.floor((1 - life) * 4))]!;
    ctx.fillRect(Math.round(x + dx), Math.round(y + dy), 2, 2);
  }
}

function effect(ctx: CanvasRenderingContext2D, fx: Effect, at: Vec2, time: number): void {
  const age = (time - fx.at) / EFFECT_SECONDS;
  if (age < 0 || age > 1) return;
  const burst = (count: number, reach: number, colours: readonly string[], fall: number, size: number): void => {
    for (let i = 0; i < count; i += 1) {
      const angle = hash2(i, fx.seed, 1) * Math.PI * 2;
      const speed = 0.4 + hash2(fx.seed, i, 2) * 0.6;
      const r = reach * speed * age;
      const x = at.x + Math.cos(angle) * r;
      const y = at.y + Math.sin(angle) * r * 0.7 + fall * age * age;
      ctx.fillStyle = colours[Math.min(colours.length - 1, Math.floor(age * colours.length))]!;
      ctx.fillRect(Math.round(x), Math.round(y), size, size);
    }
  };
  if (fx.kind === 'spray') burst(26, 46, CLOSE_UP.spark, 18, 1);
  else if (fx.kind === 'sparks') burst(10, 30, CLOSE_UP.spark, 14, 1);
  else if (fx.kind === 'chip') {
    burst(5, 16, CLOSE_UP.spark, 8, 1);
    burst(4, 10, [CLOSE_UP.flake], 6, 2);
  } else if (fx.kind === 'dust' || fx.kind === 'thunk') burst(fx.kind === 'dust' ? 10 : 5, 14, CLOSE_UP.dust, -4, 2);
  else if (fx.kind === 'smoke' || fx.kind === 'snuff') burst(8, 12, CLOSE_UP.smoke, -18, 2);
  else if (fx.kind === 'flare') burst(18, 22, CLOSE_UP.flame.slice().reverse(), -16, 2);
}

function arm(ctx: CanvasRenderingContext2D, wrist: Vec2, layout: CloseUpLayout): void {
  const down = { x: -Math.sin(HAND_TILT), y: Math.cos(HAND_TILT) };
  const side = { x: -down.y, y: down.x };
  const light = { x: -0.6, y: -0.75 };
  const far = { x: wrist.x + down.x * ARM_REACH, y: wrist.y + down.y * ARM_REACH };
  const widest = WRIST_RADIUS * ARM_TAPER;
  const left = Math.floor(Math.min(wrist.x, far.x) - widest - 1);
  const right = Math.ceil(Math.max(wrist.x, far.x) + widest + 1);
  const top = Math.floor(wrist.y - widest);
  const bottom = layout.height;
  for (let y = Math.max(0, top); y < bottom; y += 1) {
    for (let x = Math.max(0, left); x < Math.min(layout.width, right); x += 1) {
      const along = (x - wrist.x) * down.x + (y - wrist.y) * down.y;
      if (along < -2) continue;
      const across = (x - wrist.x) * side.x + (y - wrist.y) * side.y;
      const radius = WRIST_RADIUS * (1 + (ARM_TAPER - 1) * Math.min(1, Math.max(0, along) / 120));
      const reach = Math.abs(across) / radius;
      if (reach > 1) continue;
      if (reach > 1 - 1.2 / radius) {
        ctx.fillStyle = CLOSE_UP.ink;
        ctx.fillRect(x, y, 1, 1);
        continue;
      }
      const facing = Math.sign(across) * reach;
      const value = 2.6 + 1.5 * facing * (side.x * light.x + side.y * light.y) - reach * reach * 0.8;
      const band = Math.floor(value + BAYER[(x & 1) + (y & 1) * 2]! * 0.6);
      ctx.fillStyle = CLOSE_UP.skin[Math.max(1, Math.min(4, band))]!;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function hint(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, strong: boolean): void {
  drawText(ctx, text, Math.round(x - textWidth(text) / 2), Math.round(y), strong ? CLOSE_UP.hint : CLOSE_UP.hintDim, CLOSE_UP.hintShade);
}

export function drawCloseUp(
  ctx: CanvasRenderingContext2D,
  world: World,
  trial: Trial,
  layout: CloseUpLayout,
  pointer: Vec2 | null,
  shade: CloseUpShade,
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = CLOSE_UP.ink;
  ctx.fillRect(0, 0, layout.width, layout.height);
  ground(ctx, world, trial, layout, shade.time);
  grain(ctx, trial, layout);
  ctx.fillStyle = `rgba(0, 0, 0, ${1 - BACKGROUND_DIM})`;
  ctx.fillRect(0, 0, layout.width, layout.height);

  const { floor } = layout;
  const screen = (piece: Piece): Vec2 => ({ x: floor.x + piece.x * FLOOR_PIXELS, y: floor.y + piece.y * FLOOR_PIXELS });

  const ordered = [...trial.lying].sort((a, b) => a.y - b.y);
  for (const piece of ordered) {
    const at = screen(piece);
    blit(ctx, spriteOf(piece), at.x, at.y);
    if (piece.state === PieceState.Smouldering) embers(ctx, at.x, at.y, piece, trial.time);
    if (piece.state === PieceState.Burning) {
      flames(ctx, at.x, at.y, trial.time, piece.id, 16);
      smoke(ctx, at.x, at.y - 28, trial.time, piece.id, 6);
    }
    if (piece.kind === ItemType.Torch) flames(ctx, at.x + TORCH_HEAD.x, at.y + TORCH_HEAD.y, trial.time, piece.id, 5);
  }

  for (const fx of trial.effects) effect(ctx, fx, { x: floor.x + fx.x * FLOOR_PIXELS, y: floor.y + fx.y * FLOOR_PIXELS }, trial.time);

  const tip = pointer ? { x: Math.round(pointer.x / layout.scale), y: Math.round(pointer.y / layout.scale) } : null;
  const held = trial.held;
  if (tip) {
    const shape = held ? GRIP_HAND : OPEN_HAND;
    const corner = { x: tip.x - Math.round(shape.tip.x), y: tip.y - Math.round(shape.tip.y) };
    arm(ctx, { x: corner.x + shape.wrist.x, y: corner.y + shape.wrist.y }, layout);
    if (held) {
      const hold = { x: corner.x + Math.round(shape.hold.x), y: corner.y + Math.round(shape.hold.y) };
      blit(ctx, spriteOf(held), hold.x, hold.y);
      if (held.kind === ItemType.Torch) flames(ctx, hold.x + TORCH_HEAD.x, hold.y + TORCH_HEAD.y, trial.time, held.id, 5);
    }
    blit(ctx, held ? 'hand.grip' : 'hand.open', corner.x + HAND_SIZE / 2, corner.y + HAND_SIZE / 2);
  }

  if (shade.gloom > 0.01) {
    const [r, g, b] = shade.tint;
    ctx.fillStyle = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${shade.gloom * NIGHT_SHARE})`;
    ctx.fillRect(0, 0, layout.width, layout.height);
  }

  drawText(ctx, 'esc or right click to leave', 6, 6, CLOSE_UP.hintDim, CLOSE_UP.hintShade);
  if (!pointer || !tip) return;
  const onFloor = toFloor(layout, pointer);
  const target = trial.pieceAt(onFloor.x, onFloor.y);
  if (target && held) hint(ctx, trial.verbFor(target) ?? '', tip.x, tip.y - 30, true);
  else if (target) hint(ctx, target.state === PieceState.Ash ? 'ash' : (ITEM_NAMES[target.kind] ?? ''), tip.x, tip.y - 30, false);
}
