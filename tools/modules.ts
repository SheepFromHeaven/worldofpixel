import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { write as writeContent } from './content.ts';

const ROOT = resolve(import.meta.dirname, '..', 'src', 'modules');
const OUT = join(ROOT, 'manifest.generated.ts');
const CLIENT_OUT = join(ROOT, 'client.manifest.generated.ts');
const LAYERS_OUT = join(ROOT, 'layers.manifest.generated.ts');
const LIVES_OUT = join(ROOT, 'lives.manifest.generated.ts');

export const manifest = (): string => {
  const names = readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(ROOT, entry.name, 'module.ts')))
    .map((entry) => entry.name)
    .sort();
  return [
    ...names.map((name) => `import * as ${name} from './${name}/module.ts';`),
    '',
    `export const MODULE_EXPORTS: readonly Record<string, unknown>[] = [${names.join(', ')}];`,
    '',
  ].join('\n');
};

const sideEffects = (file: string): string => {
  const names = readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(ROOT, entry.name, file)))
    .map((entry) => entry.name)
    .sort();
  return names.length === 0 ? 'export {};\n' : `${names.map((name) => `import './${name}/${file}';`).join('\n')}\n`;
};

export const clientManifest = (): string => sideEffects('client.ts');

export const layersManifest = (): string => sideEffects('layer.ts');

export const livesManifest = (): string => {
  const names = readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(ROOT, entry.name, 'biology.ts')))
    .map((entry) => entry.name)
    .sort();
  return [
    "import type { Biology } from './fauna/vocabulary.ts';",
    ...names.map((name) => `import { BIOLOGY as ${name} } from './${name}/biology.ts';`),
    '',
    `export const BIOLOGIES: readonly Biology[] = [${names.join(', ')}];`,
    '',
  ].join('\n');
};

const put = (path: string, next: string): boolean => {
  if (existsSync(path) && readFileSync(path, 'utf8') === next) return false;
  writeFileSync(path, next);
  return true;
};

export const write = (): boolean => {
  writeContent();
  const client = put(CLIENT_OUT, clientManifest());
  const layers = put(LAYERS_OUT, layersManifest());
  const lives = put(LIVES_OUT, livesManifest());
  return put(OUT, manifest()) || client || layers || lives;
};

if (import.meta.url === `file://${process.argv[1]}`) console.log(write() ? 'modules manifest written' : 'modules manifest up to date');
