import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { write as writeContent } from './content.ts';

const ROOT = resolve(import.meta.dirname, '..', 'src', 'modules');
const OUT = join(ROOT, 'manifest.generated.ts');
const CLIENT_OUT = join(ROOT, 'client.manifest.generated.ts');

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

export const clientManifest = (): string => {
  const names = readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(ROOT, entry.name, 'client.ts')))
    .map((entry) => entry.name)
    .sort();
  return `${names.map((name) => `import './${name}/client.ts';`).join('\n')}\n`;
};

const put = (path: string, next: string): boolean => {
  if (existsSync(path) && readFileSync(path, 'utf8') === next) return false;
  writeFileSync(path, next);
  return true;
};

export const write = (): boolean => {
  writeContent();
  const client = put(CLIENT_OUT, clientManifest());
  return put(OUT, manifest()) || client;
};

if (import.meta.url === `file://${process.argv[1]}`) console.log(write() ? 'modules manifest written' : 'modules manifest up to date');
