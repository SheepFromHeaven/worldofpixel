import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { groundFromSheets } from '../src/render/groundSprites.ts';
import type { GroundSprites, Manifest, Sheet } from '../src/render/groundSprites.ts';
import { decodePng } from './gif.ts';

export function groundFromBaked(): GroundSprites {
  const folder = join(import.meta.dirname, '..', 'public', 'ground');
  const manifest = JSON.parse(readFileSync(join(folder, 'ground.json'), 'utf8')) as Manifest;
  const sheet = (name: string): Sheet => decodePng(readFileSync(join(folder, `${name}.png`)));
  return groundFromSheets(manifest, sheet('textures'), sheet('masks'), sheet('decals'));
}
