import { writeFileSync } from 'node:fs';
import type { Ramp } from '../pixel/color.ts';
import { bayer } from '../pixel/field.ts';
import type { Grid } from '../pixel/grid.ts';
import type { Decal } from '../pixel/ground/decals.ts';
import { stepOf } from '../pixel/ground/decals.ts';
import { DECALS, MASKS } from '../pixel/ground/index.ts';
import { PRIORITY } from '../pixel/ground/masks.ts';
import { hash } from '../pixel/ground/periodic.ts';
import type { Steps } from '../pixel/ground/steps.ts';
import type { Material } from '../pixel/ground/textures.ts';
import { MATERIALS, TEXTURE, TEXTURES } from '../pixel/ground/textures.ts';
import { encodePng } from '../pixel/png.ts';
import type { Sprite } from '../pixel/sprite.ts';
import { clipsOf } from '../pixel/sprite.ts';
import { hearth } from '../pixel/sprites/hearth.ts';
import { townHuts, townStone, townVillage } from '../pixel/sprites/townMark.ts';
import { villagerMan, villagerWoman } from '../pixel/sprites/villager.ts';
import { well } from '../pixel/sprites/well.ts';
import { fontSheet } from '../pixel/ui/font.ts';
import { BOX, FIRST_CODE, FONT_COLS, GLYPH, foldToFont } from '../pixel/ui/metrics.ts';
import { provideGroundSprites } from '../render/groundSprites.ts';
import { BIOME_RAMPS, INK, MARK_HALO, PATH } from '../render/palette.ts';
import { LEVELS, texelsIn } from '../render/terrainPixels.ts';
import { Biome } from '../sim/types.ts';
import { generateWorld } from '../sim/worldgen.ts';
import { groundFromSource } from './groundSource.ts';

const MATERIAL_RAMPS: Record<Material, Ramp> = {
  meadow: BIOME_RAMPS[Biome.Meadow],
  forest: BIOME_RAMPS[Biome.Forest],
  highland: BIOME_RAMPS[Biome.Highland],
  marsh: BIOME_RAMPS[Biome.Marsh],
  tundra: BIOME_RAMPS[Biome.Tundra],
  desert: BIOME_RAMPS[Biome.Desert],
  path: PATH,
};

class Sheet {
  readonly pixels: Uint8Array;
  clip: [number, number] = [-Infinity, Infinity];

  constructor(readonly width: number, readonly height: number) {
    this.pixels = new Uint8Array(width * height * 4).fill(0xf4);
  }

  put(x: number, y: number, color: number, scale: number): void {
    if (y < this.clip[0] || y >= this.clip[1]) return;
    for (let dy = 0; dy < scale; dy += 1) {
      for (let dx = 0; dx < scale; dx += 1) {
        const px = x * scale + dx;
        const py = y * scale + dy;
        if (px < 0 || py < 0 || px >= this.width || py >= this.height) continue;
        const at = (py * this.width + px) * 4;
        const alpha = (color & 0xff) / 255;
        for (let channel = 0; channel < 3; channel += 1) {
          const value = (color >>> (24 - channel * 8)) & 0xff;
          this.pixels[at + channel] = Math.round(this.pixels[at + channel]! * (1 - alpha) + value * alpha);
        }
        this.pixels[at + 3] = 0xff;
      }
    }
  }
}

function ground(sheet: Sheet, steps: Steps, ramp: Ramp, left: number, top: number, width: number, height: number, scale: number): void {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) sheet.put(left + x, top + y, ramp[steps.get(x, y)]!, scale);
  }
}

function decal(sheet: Sheet, item: Decal, ramp: Ramp, footX: number, footY: number, scale: number): void {
  for (let y = 0; y < item.height; y += 1) {
    for (let x = 0; x < item.width; x += 1) {
      const cell = item.cells[y * item.width + x]!;
      if (cell === 0) continue;
      const step = stepOf(cell);
      sheet.put(footX - item.foot.x + x, footY - item.foot.y + y, step >= 0 ? (ramp[step]! | 0xff) >>> 0 : cell, scale);
    }
  }
}

function sprite(sheet: Sheet, grid: Grid, left: number, top: number, scale: number): void {
  for (let y = 0; y < grid.size; y += 1) {
    for (let x = 0; x < grid.size; x += 1) {
      const cell = grid.cells[y * grid.size + x]!;
      if ((cell & 0xff) !== 0) sheet.put(left + x, top + y, cell, scale);
    }
  }
}

const firstTexture = (material: Material): Steps => TEXTURES.find((t) => t.material === material)!.draw();
const homeOf = (item: Decal): Material => (Object.keys(item.density) as Material[])[0]!;

function textures(out: string): void {
  const scale = 2;
  const tile = TEXTURE * 2;
  const columns = 6;
  const cell = tile + 4;
  const sheet = new Sheet(columns * cell * scale, Math.ceil(TEXTURES.length / columns) * cell * scale);
  for (const [index, texture] of TEXTURES.entries()) {
    const steps = texture.draw();
    ground(sheet, steps, MATERIAL_RAMPS[texture.material], (index % columns) * cell, Math.floor(index / columns) * cell, tile, tile, scale);
  }
  writeFileSync(out, encodePng(sheet.pixels, sheet.width, sheet.height));
}

function decals(out: string): void {
  const scale = 4;
  const cell = 64;
  const columns = 9;
  const sheet = new Sheet(columns * cell * scale, Math.ceil(DECALS.length / columns) * cell * scale);
  const floors = new Map(MATERIALS.map((m) => [m, firstTexture(m)]));
  for (const [index, item] of DECALS.entries()) {
    const home = homeOf(item);
    const left = (index % columns) * cell;
    const top = Math.floor(index / columns) * cell;
    ground(sheet, floors.get(home)!, MATERIAL_RAMPS[home], left + 1, top + 1, cell - 2, cell - 2, scale);
    decal(sheet, item, MATERIAL_RAMPS[home], left + cell / 2, top + Math.min(cell - 6, cell / 2 + item.height / 2), scale);
    console.log(`${index}\t${item.name}\t${item.width}x${item.height}`);
  }
  writeFileSync(out, encodePng(sheet.pixels, sheet.width, sheet.height));
}

function scene(out: string): void {
  const scale = 3;
  const width = 256;
  const height = 128;
  const shown: Material[] = ['meadow', 'forest', 'highland', 'marsh', 'tundra', 'desert'];
  const sheet = new Sheet(width * scale, shown.length * (height + 4) * scale);
  const area = (width * height) / (32 * 32);

  for (const [row, material] of shown.entries()) {
    const top = row * (height + 4);
    sheet.clip = [top, top + height];
    const ramp = MATERIAL_RAMPS[material];
    ground(sheet, firstTexture(material), ramp, 0, top, width, height, scale);

    const placed: { y: number; draw: () => void }[] = [];
    for (const [index, item] of DECALS.entries()) {
      const density = item.density[material] ?? 0;
      if (density === 0) continue;
      const count = Math.floor(density * area + hash(index, row, 9));
      for (let n = 0; n < count; n += 1) {
        const x = Math.floor(hash(index, n, row * 7 + 1) * width);
        const y = top + Math.floor(hash(index, n, row * 7 + 2) * height);
        placed.push({ y, draw: () => decal(sheet, item, ramp, x, y, scale) });
      }
    }
    const tiles: [Grid, number, number][] = [
      [villagerWoman.draw(villagerWoman.lights, 'idle', 0), 20, top + height - 30],
      [villagerMan.draw(villagerMan.lights, 'walk', 1), 104, top + height - 24],
      [well.draw(well.lights, 'default', 0), 40, top + height - 44],
      [hearth.draw(hearth.lights, 'burn', 0), 80, top + height - 30],
    ];
    for (const [grid, left, at] of tiles) placed.push({ y: at + grid.size, draw: () => sprite(sheet, grid, left, at, scale) });
    placed.sort((a, b) => a.y - b.y);
    for (const thing of placed) thing.draw();
  }
  writeFileSync(out, encodePng(sheet.pixels, sheet.width, sheet.height));
}

function packed(css: string): number {
  const n = Number.parseInt(css.slice(1), 16);
  return (((n << 8) >>> 0) | 0xff) >>> 0;
}

function label(sheet: Sheet, text: string, cx: number, top: number, scale: number): void {
  const font = fontSheet();
  const line = foldToFont(text);
  const left = cx - Math.round((line.length * BOX.w) / 2);

  const glyphs: [number, number][] = [];
  [...line].forEach((character, index) => {
    const slot = (character.codePointAt(0) ?? 32) - FIRST_CODE;
    const col = (slot % FONT_COLS) * BOX.w;
    const row = Math.floor(slot / FONT_COLS) * BOX.h;
    for (let y = 0; y < BOX.h; y += 1) {
      for (let x = 0; x < GLYPH.w; x += 1) {
        if ((font.cells[(row + y) * font.size + col + x]! & 0xff) !== 0) {
          glyphs.push([left + index * BOX.w + x, top + y]);
        }
      }
    }
  });

  for (const [x, y] of glyphs) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) sheet.put(x + dx, y + dy, packed(MARK_HALO), scale);
    }
  }
  for (const [x, y] of glyphs) sheet.put(x, y, packed(INK), scale);
}

const STAGES: readonly [Sprite, string][] = [
  [hearth, 'Eskwick'],
  [townHuts, 'Brynmor'],
  [townVillage, 'Holt'],
  [townStone, 'Caerleon'],
];

function mark(out: string): void {
  provideGroundSprites(groundFromSource());
  const world = generateWorld(20261017);
  const scale = 4;
  const width = 180;
  const height = 60;
  const rungs = [7, 4];
  const sheet = new Sheet(width * scale, rungs.length * (height + 4) * scale);

  for (const [row, rung] of rungs.entries()) {
    const level = LEVELS[rung]!;
    const top = row * (height + 4);
    sheet.clip = [top, top + height];
    const fromX = Math.round(430 / level.texel);
    const fromY = Math.round(320 / level.texel);
    const texels = texelsIn(world, level.spacing, level.texel, fromX, fromY, width, height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) sheet.put(x, top + y, texels[y * width + x]!, scale);
    }

    STAGES.forEach(([stage, name], index) => {
      const grid = stage.draw(stage.lights, clipsOf(stage)[0]!.name, 0);
      const cx = 24 + index * 44;
      const cy = top + 26;
      sprite(sheet, grid, cx - grid.size / 2, cy - grid.size / 2, scale);
      label(sheet, name, cx, cy + grid.size / 2 - 1, scale);
    });
  }

  writeFileSync(out, encodePng(sheet.pixels, sheet.width, sheet.height));
}

function seams(out: string): void {
  const scale = 3;
  const span = 192;
  const spacing = 32;
  const fade = spacing * 0.38;
  const shown: Material[] = ['meadow', 'forest', 'highland', 'marsh', 'tundra', 'desert'];
  const across = span / spacing + 2;
  const sites: { x: number; y: number; material: Material }[] = [];
  for (let row = -1; row < across; row += 1) {
    for (let column = -1; column < across; column += 1) {
      sites.push({
        x: (column + 0.2 + hash(column, row, 1) * 0.6) * spacing,
        y: (row + 0.2 + hash(column, row, 2) * 0.6) * spacing,
        material: shown[Math.floor(hash(Math.floor(column / 2), Math.floor(row / 2), 3) * shown.length)]!,
      });
    }
  }
  const floors = new Map(MATERIALS.map((m) => [m, firstTexture(m)]));
  const masks = new Map(MASKS.map((m) => [m.material, m.cells]));
  const rank = (m: Material): number => PRIORITY.indexOf(m);
  const sheet = new Sheet((span * 2 + 8) * scale, span * scale);

  for (let y = 0; y < span; y += 1) {
    for (let x = 0; x < span; x += 1) {
      let first = sites[0]!;
      let second = sites[0]!;
      let d1 = Infinity;
      let d2 = Infinity;
      for (const site of sites) {
        const d = Math.hypot(site.x - x - 0.5, site.y - y - 0.5);
        if (d < d1) {
          d2 = d1;
          second = first;
          d1 = d;
          first = site;
        } else if (d < d2) {
          d2 = d;
          second = site;
        }
      }
      const strength = Math.max(0, 0.5 - (d2 - d1) / 2 / fade);

      const dithered = second.material !== first.material && strength > bayer(x, y) ? second.material : first.material;

      let masked = first.material;
      if (second.material !== first.material) {
        const high = rank(first.material) < rank(second.material) ? first.material : second.material;
        const reach = high === second.material ? strength : 1 - strength;
        const low = high === first.material ? second.material : first.material;
        masked = masks.get(high)![(y % TEXTURE) * TEXTURE + (x % TEXTURE)]! < reach * 255 ? high : low;
      }

      for (const [side, material] of [[0, dithered], [1, masked]] as const) {
        sheet.put(side * (span + 8) + x, y, MATERIAL_RAMPS[material][floors.get(material)!.get(x, y)]!, scale);
      }
    }
  }
  writeFileSync(out, encodePng(sheet.pixels, sheet.width, sheet.height));
}

const mode = process.argv[2] ?? 'scene';
const out = process.argv[3] ?? `/tmp/ground-${mode}.png`;
({ textures, decals, scene, seams, mark })[mode as 'textures']?.(out);
console.log(`${mode} -> ${out}`);
