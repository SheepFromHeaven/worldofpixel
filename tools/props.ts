import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { encodePng } from '../src/pixel/png.ts';
import { packSheet } from './propSheet.ts';

const directory = resolve(process.cwd(), 'public/props');
mkdirSync(directory, { recursive: true });

const sheet = packSheet();
const manifest = { sheet: { width: sheet.width, height: sheet.height }, props: sheet.props };

writeFileSync(resolve(directory, 'albedo.png'), encodePng(sheet.albedo, sheet.width, sheet.height));
writeFileSync(resolve(directory, 'normals.png'), encodePng(sheet.normals, sheet.width, sheet.height));
writeFileSync(resolve(directory, 'props.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`props: ${sheet.props.length} packed -> ${sheet.width}x${sheet.height}`);
