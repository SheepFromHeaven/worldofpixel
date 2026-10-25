import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { magnify } from '../src/pixel/grid.ts';
import { encodePng } from '../src/pixel/png.ts';
import { clipsOf, totalFrames } from '../src/pixel/sprite.ts';
import { SPRITES } from '../src/pixel/sprites/index.ts';
import { SOURCES } from '../src/render/sprites.ts';

const TILE = 1024;

const MAX_STRIP = 16384;

const directory = resolve(process.cwd(), 'public/tiles');
mkdirSync(directory, { recursive: true });

for (const sprite of SPRITES) {
  if (TILE % sprite.cells !== 0) {
    throw new Error(`${sprite.name}: ${sprite.cells} cells do not divide a ${TILE}px tile`);
  }

  const clips = clipsOf(sprite);
  const frames = totalFrames(clips);
  let scale = TILE / sprite.cells;
  while (scale > 1 && frames * sprite.cells * scale > MAX_STRIP) scale /= 2;
  const frameSize = sprite.cells * scale;

  const strip = new Uint8Array(frameSize * frames * frameSize * 4);
  let at = 0;
  for (const clip of clips) {
    for (let frame = 0; frame < clip.frames; frame += 1) {
      const pixels = magnify(sprite.draw(sprite.lights, clip.name, frame), scale);
      for (let y = 0; y < frameSize; y += 1) {
        const from = y * frameSize * 4;
        strip.set(pixels.subarray(from, from + frameSize * 4), (y * frameSize * frames + at * frameSize) * 4);
      }
      at += 1;
    }
  }

  const declared = SOURCES[sprite.name];
  if (!declared) {
    throw new Error(`${sprite.name}: no entry in render/sprites.ts — the game cannot load it`);
  }
  if (declared.cells !== sprite.cells) {
    throw new Error(
      `${sprite.name}: authored at ${sprite.cells} cells, render/sprites.ts says ${declared.cells}`,
    );
  }
  const mine = clips.map((clip) => `${clip.name}:${clip.frames}`).join(' ');
  const theirs = declared.clips.map((clip) => `${clip.name}:${clip.frames}`).join(' ');
  if (mine !== theirs) {
    throw new Error(`${sprite.name}: clips are "${mine}" but render/sprites.ts says "${theirs}"`);
  }

  const feet = (sprite.pieces ?? []).map((piece) => `${piece.clip}:${piece.foot}`).join(' ');
  const copied = (declared.pieces ?? []).map((piece) => `${piece.clip}:${piece.foot}`).join(' ');
  if (feet !== copied) {
    const line = (sprite.pieces ?? [])
      .map((piece) => `{ clip: '${piece.clip}', foot: ${piece.foot} }`)
      .join(', ');
    throw new Error(
      `${sprite.name}: pieces are "${feet}" but render/sprites.ts says "${copied}"\n` +
      `  pieces: [${line}],`,
    );
  }

  const path = resolve(directory, `${sprite.name}.png`);
  writeFileSync(path, encodePng(strip, frameSize * frames, frameSize));
  console.log(
    `${sprite.name}: ${sprite.cells}x${sprite.cells} at ${scale}x -> ${frameSize * frames}x${frameSize}  ` +
    clips.map((clip) => `${clip.name}:${clip.frames}`).join(' '),
  );
}
