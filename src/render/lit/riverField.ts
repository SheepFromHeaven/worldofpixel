import { Aqua, FASTEST_FLOW } from '../../sim/aquatic.ts';
import { riverFlowTable } from '../../sim/terrain/riverFlow.ts';
import { riverWidths } from '../../sim/terrain/riverWidth.ts';
import { reachesIn } from '../../sim/terrain/worldfield.ts';
import type { World } from '../../sim/world.ts';
import { hash } from '../groundSprites.ts';
import { setTextureFiltering } from './glHelpers.ts';
import type { LitView } from './litLayer.ts';

export const FIELD_SIZE = 1024;
export const FIELD_TEXELS_PER_METRE = 4;
export const FIELD_METRES = FIELD_SIZE / FIELD_TEXELS_PER_METRE;

const SNAP_METRES = 16;
const CELL_TEXELS = 16;
const CELLS = FIELD_SIZE / CELL_TEXELS;
const BUDGET_MILLISECONDS = 4;
const COVER_MARGIN_METRES = 10;
const FAR_METRES = 1.2;
const WIDTH_SWELL = 1.35;

const ROCK_CELL = 2.4;
const ROCK_STEP = 0.12;
const PLANT_SPACING = 1.8;
const FALL_FROM = 50;
const FALL_FULL = 75;

const WAKING: ReadonlySet<number> = new Set([Aqua.Reeds, Aqua.Lily, Aqua.Weed]);

interface Candidate {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  widthStart: number;
  widthEnd: number;
  speedStart: number;
  speedEnd: number;
  dropStart: number;
  dropEnd: number;
}

interface Build {
  seed: number;
  x0: number;
  y0: number;
  flow: Uint8Array;
  rocks: Uint8Array;
  cells: (Candidate[] | undefined)[];
  nextRow: number;
  obstacles: boolean;
}

const smooth = (low: number, high: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - low) / (high - low)));
  return t * t * (3 - 2 * t);
};

function startBuild(world: World, x0: number, y0: number): Build {
  const { segments } = world.field.rivers;
  const widths = riverWidths(segments);
  const table = riverFlowTable(segments, world.field.height, world.grid);
  const cells: (Candidate[] | undefined)[] = new Array(CELLS * CELLS);
  const cellMetres = CELL_TEXELS / FIELD_TEXELS_PER_METRE;

  const bounds = { minX: x0 - 6, minY: y0 - 6, maxX: x0 + FIELD_METRES + 6, maxY: y0 + FIELD_METRES + 6 };
  for (const segment of reachesIn(world.field, bounds)) {
    const [widthStart, widthEnd] = widths.get(segment) ?? [segment.half, segment.half];
    const index = table.indexOf.get(segment);
    if (index === undefined) continue;
    const candidate: Candidate = {
      ax: segment.ax,
      ay: segment.ay,
      bx: segment.bx,
      by: segment.by,
      widthStart,
      widthEnd,
      speedStart: table.speed[index * 2]!,
      speedEnd: table.speed[index * 2 + 1]!,
      dropStart: table.drop[index * 2]!,
      dropEnd: table.drop[index * 2 + 1]!,
    };
    const reach = Math.max(widthStart, widthEnd) * WIDTH_SWELL + FAR_METRES;
    const firstColumn = Math.max(0, Math.floor((Math.min(segment.ax, segment.bx) - reach - x0) / cellMetres));
    const lastColumn = Math.min(CELLS - 1, Math.floor((Math.max(segment.ax, segment.bx) + reach - x0) / cellMetres));
    const firstRow = Math.max(0, Math.floor((Math.min(segment.ay, segment.by) - reach - y0) / cellMetres));
    const lastRow = Math.min(CELLS - 1, Math.floor((Math.max(segment.ay, segment.by) + reach - y0) / cellMetres));
    for (let row = firstRow; row <= lastRow; row += 1) {
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        const at = row * CELLS + column;
        (cells[at] ??= []).push(candidate);
      }
    }
  }
  return {
    seed: world.seed,
    x0,
    y0,
    flow: new Uint8Array(FIELD_SIZE * FIELD_SIZE * 4),
    rocks: new Uint8Array(FIELD_SIZE * FIELD_SIZE * 4),
    cells,
    nextRow: 0,
    obstacles: false,
  };
}

function bakeRow(build: Build, row: number): void {
  const y = build.y0 + (row + 0.5) / FIELD_TEXELS_PER_METRE;
  const cellRow = Math.floor(row / CELL_TEXELS) * CELLS;

  for (let column = 0; column < FIELD_SIZE; column += 1) {
    const list = build.cells[cellRow + Math.floor(column / CELL_TEXELS)];
    if (!list) continue;
    const x = build.x0 + (column + 0.5) / FIELD_TEXELS_PER_METRE;

    let best = Infinity;
    let bestWidth = 1;
    let bestFall = 0;
    let bestAlong = 0;
    let weights = 0;
    let flowX = 0;
    let flowY = 0;

    for (const reach of list) {
      const dx = reach.bx - reach.ax;
      const dy = reach.by - reach.ay;
      const length = dx * dx + dy * dy;
      const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - reach.ax) * dx + (y - reach.ay) * dy) / length));
      const gap = Math.hypot(reach.ax + dx * t - x, reach.ay + dy * t - y);
      const width = reach.widthStart + (reach.widthEnd - reach.widthStart) * t;
      const signed = gap - width;
      if (signed > FAR_METRES) continue;

      const ratio = gap / width;
      const speed = (reach.speedStart + (reach.speedEnd - reach.speedStart) * t) * (0.45 + 0.55 * Math.max(0, 1 - ratio * ratio));
      const weight = Math.exp(-Math.max(0, signed) * 2.5);
      const norm = Math.sqrt(length) || 1;
      flowX += (dx / norm) * speed * weight;
      flowY += (dy / norm) * speed * weight;
      weights += weight;

      if (signed < best) {
        best = signed;
        bestWidth = width;
        bestAlong = t;
        bestFall = smooth(FALL_FROM, FALL_FULL, reach.dropStart + (reach.dropEnd - reach.dropStart) * t);
      }
    }
    if (weights === 0) continue;

    const ratio = (best + bestWidth) / bestWidth;
    const size = 0.35 + 0.65 * smooth(0.3, 3, bestWidth);
    const depth = (1 - smooth(0.55, 1.4, ratio)) * size;
    if (depth <= 0) continue;

    const at = (row * FIELD_SIZE + column) * 4;
    const scale = 1 / (weights * FASTEST_FLOW);
    build.flow[at] = Math.round((0.5 + 0.5 * Math.max(-1, Math.min(1, flowX * scale))) * 255);
    build.flow[at + 1] = Math.round((0.5 + 0.5 * Math.max(-1, Math.min(1, flowY * scale))) * 255);
    build.flow[at + 2] = Math.round(depth * 255);
    build.flow[at + 3] = Math.round(255 * bestFall * (0.3 + 0.7 * bestAlong * bestAlong) * (best < 0.2 ? 1 : 0));
  }
}

function flowAt(build: Build, x: number, y: number): { x: number; y: number; depth: number } | null {
  const column = Math.floor((x - build.x0) * FIELD_TEXELS_PER_METRE);
  const row = Math.floor((y - build.y0) * FIELD_TEXELS_PER_METRE);
  if (column < 0 || row < 0 || column >= FIELD_SIZE || row >= FIELD_SIZE) return null;
  const at = (row * FIELD_SIZE + column) * 4;
  return {
    x: (build.flow[at]! / 255) * 2 - 1,
    y: (build.flow[at + 1]! / 255) * 2 - 1,
    depth: build.flow[at + 2]! / 255,
  };
}

function stamp(build: Build, x: number, y: number, value: number): void {
  const fx = (x - build.x0) * FIELD_TEXELS_PER_METRE - 0.5;
  const fy = (y - build.y0) * FIELD_TEXELS_PER_METRE - 0.5;
  const column = Math.floor(fx);
  const row = Math.floor(fy);
  const u = fx - column;
  const v = fy - row;
  for (let dy = 0; dy <= 1; dy += 1) {
    for (let dx = 0; dx <= 1; dx += 1) {
      const c = column + dx;
      const r = row + dy;
      if (c < 0 || r < 0 || c >= FIELD_SIZE || r >= FIELD_SIZE) continue;
      const weight = (dx === 0 ? 1 - u : u) * (dy === 0 ? 1 - v : v);
      const at = (r * FIELD_SIZE + c) * 4 + 3;
      const next = Math.round(255 * value * Math.min(1, weight * 1.7));
      if (next > build.flow[at]!) build.flow[at] = next;
    }
  }
}

function wake(build: Build, x: number, y: number, radius: number, length: number, salt: number): void {
  let px = x;
  let py = y;
  const steps = Math.floor(length / ROCK_STEP);
  stamp(build, x, y, 0.9);
  for (let k = 1; k < steps; k += 1) {
    const here = flowAt(build, px, py);
    if (!here || here.depth < 0.15) return;
    const speed = Math.hypot(here.x, here.y);
    if (speed < 0.02) return;
    const dx = here.x / speed;
    const dy = here.y / speed;
    px += dx * ROCK_STEP;
    py += dy * ROCK_STEP;
    const travelled = k * ROCK_STEP;
    const spread = radius * 0.9 + 0.17 * travelled;
    const fade = 1 - travelled / length;
    const sideX = -dy;
    const sideY = dx;
    if (hash(k, salt, 17) > 0.35) {
      stamp(build, px + sideX * spread, py + sideY * spread, 0.85 * fade);
      stamp(build, px - sideX * spread, py - sideY * spread, 0.85 * fade);
    }
    if (k % 4 === 0) {
      const lateral = (hash(k, salt, 29) - 0.5) * spread;
      stamp(build, px + sideX * lateral, py + sideY * lateral, 0.55 * fade);
    }
  }
}

function plantRocks(build: Build, world: World): void {
  const cx0 = Math.floor(build.x0 / ROCK_CELL);
  const cy0 = Math.floor(build.y0 / ROCK_CELL);
  const count = Math.ceil(FIELD_METRES / ROCK_CELL);

  for (let cy = cy0; cy < cy0 + count; cy += 1) {
    for (let cx = cx0; cx < cx0 + count; cx += 1) {
      const x = (cx + 0.2 + 0.6 * hash(cx, cy, 3)) * ROCK_CELL;
      const y = (cy + 0.2 + 0.6 * hash(cx, cy, 7)) * ROCK_CELL;
      const here = flowAt(build, x, y);
      if (!here || here.depth < 0.55) continue;
      const speed = Math.hypot(here.x, here.y) * FASTEST_FLOW;
      const density = 0.03 + 0.21 * smooth(0.3, 1.3, speed);
      if (hash(cx, cy, 11) > density) continue;
      const radius = 0.3 + 0.32 * hash(cx, cy, 5);

      const first = {
        column: Math.floor((x - radius - build.x0) * FIELD_TEXELS_PER_METRE) - 1,
        row: Math.floor((y - radius - build.y0) * FIELD_TEXELS_PER_METRE) - 1,
      };
      const span = Math.ceil(radius * 2 * FIELD_TEXELS_PER_METRE) + 3;
      for (let row = first.row; row < first.row + span; row += 1) {
        for (let column = first.column; column < first.column + span; column += 1) {
          if (column < 0 || row < 0 || column >= FIELD_SIZE || row >= FIELD_SIZE) continue;
          const tx = build.x0 + (column + 0.5) / FIELD_TEXELS_PER_METRE;
          const ty = build.y0 + (row + 0.5) / FIELD_TEXELS_PER_METRE;
          const d = Math.hypot(tx - x, ty - y) / radius;
          if (d >= 1.15) continue;
          const dome = Math.sqrt(Math.max(0, 1 - d * d / 1.3));
          const at = (row * FIELD_SIZE + column) * 4;
          build.rocks[at] = Math.max(build.rocks[at]!, Math.round(255 * dome));
        }
      }
      wake(build, x + (here.x / (Math.hypot(here.x, here.y) || 1)) * radius, y + (here.y / (Math.hypot(here.x, here.y) || 1)) * radius, radius, 2.4 + 7 * radius, cx * 31 + cy);
    }
  }

  const { grid } = world;
  const taken = new Set<string>();
  const firstColumn = Math.max(0, Math.floor((build.x0 - grid.minX) / grid.spacing));
  const lastColumn = Math.min(grid.columns - 1, Math.ceil((build.x0 + FIELD_METRES - grid.minX) / grid.spacing));
  const firstRow = Math.max(0, Math.floor((build.y0 - grid.minY) / grid.spacing));
  const lastRow = Math.min(grid.rows - 1, Math.ceil((build.y0 + FIELD_METRES - grid.minY) / grid.spacing));
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const tile = row * grid.columns + column;
      if (!WAKING.has(world.aqua[tile]!)) continue;
      const x = grid.x(column) + (hash(column, row, 71) - 0.5) * 0.6;
      const y = grid.y(row) + (hash(column, row, 73) - 0.5) * 0.6;
      const here = flowAt(build, x, y);
      if (!here || here.depth < 0.3 || Math.hypot(here.x, here.y) * FASTEST_FLOW < 0.2) continue;
      const key = `${Math.floor(x / PLANT_SPACING)},${Math.floor(y / PLANT_SPACING)}`;
      if (taken.has(key)) continue;
      taken.add(key);
      wake(build, x, y, 0.14, 1.9, column * 37 + row);
    }
  }
}

export class RiverField {
  readonly flowTexture: WebGLTexture;
  readonly rockTexture: WebGLTexture;
  readonly rect = { x: 0, y: 0, size: FIELD_METRES };
  private ready = false;
  private build: Build | null = null;
  private seed = -1;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.flowTexture = gl.createTexture()!;
    this.rockTexture = gl.createTexture()!;
    for (const texture of [this.flowTexture, this.rockTexture]) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      setTextureFiltering(gl, texture, gl.LINEAR);
    }
  }

  update(world: World, view: LitView): boolean {
    if (this.seed !== world.seed) {
      this.seed = world.seed;
      this.ready = false;
      this.build = null;
    }

    const halfWidth = view.width / view.zoom / 2;
    const halfHeight = view.height / view.zoom / 2;
    if (Math.max(halfWidth, halfHeight) + COVER_MARGIN_METRES > FIELD_METRES / 2) return false;

    const covered =
      this.ready &&
      view.centre.x - halfWidth > this.rect.x + COVER_MARGIN_METRES &&
      view.centre.x + halfWidth < this.rect.x + FIELD_METRES - COVER_MARGIN_METRES &&
      view.centre.y - halfHeight > this.rect.y + COVER_MARGIN_METRES &&
      view.centre.y + halfHeight < this.rect.y + FIELD_METRES - COVER_MARGIN_METRES;

    if (!covered && !this.build) {
      this.build = startBuild(
        world,
        Math.floor((view.centre.x - FIELD_METRES / 2) / SNAP_METRES) * SNAP_METRES,
        Math.floor((view.centre.y - FIELD_METRES / 2) / SNAP_METRES) * SNAP_METRES,
      );
    }

    if (this.build) this.advance(world, this.build);
    return this.ready;
  }

  private advance(world: World, build: Build): void {
    const started = performance.now();
    while (build.nextRow < FIELD_SIZE && performance.now() - started < BUDGET_MILLISECONDS) {
      bakeRow(build, build.nextRow);
      build.nextRow += 1;
    }
    if (build.nextRow < FIELD_SIZE) return;

    if (!build.obstacles) {
      plantRocks(build, world);
      build.obstacles = true;
    }
    this.upload(build);
    this.build = null;
  }

  private upload(build: Build): void {
    const { gl } = this;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    for (const [texture, data] of [[this.flowTexture, build.flow], [this.rockTexture, build.rocks]] as const) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, FIELD_SIZE, FIELD_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      setTextureFiltering(gl, texture, gl.LINEAR);
    }
    this.rect.x = build.x0;
    this.rect.y = build.y0;
    this.ready = true;
  }
}
