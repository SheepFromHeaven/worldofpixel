import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { magnify } from '../pixel/grid.ts';
import { encodePng } from '../pixel/png.ts';
import { SPRITES } from '../pixel/sprites/index.ts';
import { clipsOf, totalFrames } from '../pixel/sprite.ts';
import { SOURCES } from '../render/sprites.ts';

/** The size a frame ships at; the magnification follows from the sprite's own grid. */
const TILE = 1024;

/**
 * The widest a strip may be. Browsers refuse to decode an image much past this, and a villager
 * walking eight ways is sixty-odd frames — at the full magnification, an image sixty-seven
 * thousand pixels wide that would never load. A strip that would run past it is baked at a
 * smaller magnification instead, halving so the renderer's reduction back to the grid stays
 * exact; it reads the frame size off the image, so it needs telling nothing.
 */
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

  // Every clip's frames laid end to end in one strip, in the order the clips are declared: one
  // file, one decode, and no chance of a sprite's frames drifting out of step on disk. The
  // renderer finds a clip by counting the frames of the ones before it.
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

  // The renderer keeps its own table of what is in each strip, because it cannot import the
  // authoring code without carrying it into the game bundle. Two statements of one fact drift,
  // and the symptom here would be silent: every clip playing some other clip's frames. So the
  // bake refuses when they disagree — which is the moment someone adds a clip and would
  // otherwise forget the second place.
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

  // The same rule for the pieces, which the painter sorts the drawing by. The geometry is here —
  // a stone's foot is the row it was stamped on — and the renderer keeps a copy of the answer, so
  // the bake prints the line to paste rather than leaving a drawing sorted at the wrong distance.
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
