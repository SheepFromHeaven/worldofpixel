import { seasonalKindIndexForSprite } from '../src/sim/seasons/seasonalRegistry.ts';
import { LIT_PROPS } from '../src/pixel/ground/index.ts';

export const SHEET = 1024;
const GAP = 2;

export interface PackedSheet {
  width: number;
  height: number;
  albedo: Uint8Array;
  normals: Uint8Array;
  props: {
    name: string;
    x: number;
    y: number;
    size: number;
    foot: { x: number; y: number };
    density: unknown;
    height: number;
    sway: number;
    canopy: boolean;
    bend: boolean;
    grain: unknown;
    emit: boolean;
    hides: boolean;
    torchShadow: boolean;
    season: number;
  }[];
}

export function packSheet(): PackedSheet {
  const order = [...LIT_PROPS.keys()].sort((a, b) => LIT_PROPS[b]!.size - LIT_PROPS[a]!.size || a - b);
  const placed = new Map<number, { x: number; y: number }>();
  let shelfX = 0;
  let shelfY = 0;
  let shelfHeight = 0;
  for (const index of order) {
    const tree = LIT_PROPS[index]!;
    if (shelfX + tree.size > SHEET) {
      shelfY += shelfHeight + GAP;
      shelfX = 0;
      shelfHeight = 0;
    }
    placed.set(index, { x: shelfX, y: shelfY });
    shelfX += tree.size + GAP;
    shelfHeight = Math.max(shelfHeight, tree.size);
  }
  const height = shelfY + shelfHeight;

  const albedo = new Uint8Array(SHEET * height * 4);
  const normals = new Uint8Array(SHEET * height * 4);

  const fill = { r: 0, g: 0, b: 0, n: 0 };
  for (const tree of LIT_PROPS) {
    for (let at = 0; at < tree.size * tree.size; at += 1) {
      if (tree.albedo[at * 4 + 3] === 0) continue;
      fill.r += tree.albedo[at * 4]!;
      fill.g += tree.albedo[at * 4 + 1]!;
      fill.b += tree.albedo[at * 4 + 2]!;
      fill.n += 1;
    }
  }
  const mean = [Math.round(fill.r / fill.n), Math.round(fill.g / fill.n), Math.round(fill.b / fill.n)];

  for (let at = 0; at < SHEET * height; at += 1) {
    albedo[at * 4] = mean[0]!;
    albedo[at * 4 + 1] = mean[1]!;
    albedo[at * 4 + 2] = mean[2]!;
    normals[at * 4] = 128;
    normals[at * 4 + 1] = 128;
    normals[at * 4 + 3] = 0xff;
  }

  for (const [index, tree] of LIT_PROPS.entries()) {
    const at = placed.get(index)!;
    for (let y = 0; y < tree.size; y += 1) {
      for (let x = 0; x < tree.size; x += 1) {
        const from = (y * tree.size + x) * 4;
        const to = ((at.y + y) * SHEET + at.x + x) * 4;
        if (tree.albedo[from + 3] === 0) continue;
        for (let c = 0; c < 4; c += 1) {
          albedo[to + c] = tree.albedo[from + c]!;
          normals[to + c] = tree.normals[from + c]!;
        }
      }
    }
  }

  return {
    width: SHEET,
    height,
    albedo,
    normals,
    props: LIT_PROPS.map((tree, index) => ({
      name: tree.name,
      ...placed.get(index)!,
      size: tree.size,
      foot: tree.foot,
      density: tree.density,
      height: tree.height,
      sway: tree.sway,
      canopy: tree.canopy,
      bend: tree.bend,
      grain: tree.grain ?? [],
      emit: tree.emit ?? false,
      hides: tree.hides ?? false,
      torchShadow: tree.torchShadow ?? false,
      season: seasonalKindIndexForSprite(tree.name),
    })),
  };
}
