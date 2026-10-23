import { isWater } from '../sim/terrain/worldfield.ts';
import type { Biome } from '../sim/types.ts';
import { Cover, FADE_SWEEPS, WEAR_FULL, World } from '../sim/world.ts';
import type { LevelResult, Logger } from './harness.ts';
import { check, TEST_SEED } from './harness.ts';
import { header } from './render.ts';

export function runLevel4(log: Logger): LevelResult {
  log(header('LEVEL 4 — The tile: what stands on it, what it remembers, and the handle that says so'));

  const world = World.generate(TEST_SEED);

  let wetBare = true;
  let standing = 0;
  for (let i = 0; i < world.count; i += 7) {
    const covered = world.cover[i]! !== Cover.Bare;
    if (covered) standing += 1;
    if (covered && isWater(world.biome[i]! as Biome)) wetBare = false;
  }
  log(`    ${standing} of ${Math.ceil(world.count / 7)} sampled tiles carry something`);

  const dry = world.biome.findIndex((_, i) => !isWater(world.biome[i]! as Biome));
  const tile = world.tile(dry);

  const centreHolds = world.grid.atPoint(tile.centre) === tile.index;
  const readsBack = tile.biome === world.biome[dry] && tile.elevation === world.field.height[dry];
  const sidesExist = tile.sides.length === 4 && tile.around.length === 8;
  const sidesAgree = tile.sides.every((side) => Math.abs(side.column - tile.column) + Math.abs(side.row - tile.row) === 1);

  const grown = world.tile(world.cover.findIndex((kind) => kind !== Cover.Bare));
  const stampBefore = world.stampOver(grown.bounds);
  grown.clear();
  const cleared = grown.cover === Cover.Bare;
  const stamped = world.stampOver(grown.bounds) !== stampBefore;

  tile.tread(1000);
  const capped = tile.wear === WEAR_FULL;
  for (let sweep = FADE_SWEEPS(world.count); sweep > 0; sweep -= 1) world.fade();
  const faded = tile.wear === WEAR_FULL - 1;

  const stand = world.cover.findIndex((kind) => kind === Cover.Tree);
  const stampThen = world.stampOver(world.grid.bounds(stand));
  const felled = world.fell(stand) && world.cover[stand] === Cover.Fallen && world.stampOver(world.grid.bounds(stand)) !== stampThen;
  const once = !world.fell(stand);

  const windReads = tile.wind === world.wind[tile.index];

  const writesThrough = world.wear[tile.index] === tile.wear;

  const held = [
    check(log, 'nothing grows with its foot in water', wetBare),
    check(log, 'something stands on the land', standing > 0),
    check(log, 'a handle reads straight off the arrays', readsBack),
    check(log, 'a handle writes straight to the arrays', writesThrough),
    check(log, 'a handle reads the wind off its array', windReads),
    check(log, 'a felled tree lies where it stood, once, and stamps the ground', felled && once),
    check(log, 'a tile is where its handle says it is', centreHolds),
    check(log, 'a tile has four sides and eight neighbours', sidesExist && sidesAgree),
    check(log, 'clearing a tile leaves it bare', cleared),
    check(log, 'clearing a tile stamps the ground under it', stamped),
    check(log, 'wear stops at full', capped),
    check(log, 'wear grows back', faded),
  ];

  const passed = held.every(Boolean);
  return {
    title: 'the tile',
    passed,
    detail: passed ? 'the handle and the array are one thing' : 'the handle and the array disagree',
  };
}
