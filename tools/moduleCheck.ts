import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, resolve, sep } from 'node:path';

const SRC = resolve(import.meta.dirname, '..', 'src');
const MODULES = join(SRC, 'modules');
const IMPORT = /from\s+['"](\.{1,2}\/[^'"]+)['"]|import\(\s*['"](\.{1,2}\/[^'"]+)['"]/g;

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.tsx?$/.test(name) ? [path] : [];
  });

const moduleOf = (file: string): string | null => {
  const rel = file.startsWith(MODULES + sep) ? file.slice(MODULES.length + 1).split(sep) : [];
  return rel.length > 1 ? rel[0]! : null;
};

const strict = process.argv.includes('--strict');
const across: string[] = [];
const outside = new Map<string, number>();
const reaches: string[] = [];
const OPEN = /[\\/](api|shared|client|clientSlots|index|module|vocabulary)\.ts$|generated\.ts$/;

for (const file of walk(SRC)) {
  const owner = moduleOf(file);
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(IMPORT)) {
    const target = normalize(join(dirname(file), (match[1] ?? match[2])!));
    const other = moduleOf(target);
    if (!other || other === owner) continue;
    const viaApi = OPEN.test(target);
    if (owner) {
      if (!viaApi && !/[\\/]module\.ts$/.test(target)) across.push(`${owner} -> ${other}: ${file.slice(SRC.length + 1)} imports ${target.slice(SRC.length + 1)}`);
    } else if (!viaApi && !file.startsWith(MODULES) && !/generated\.ts$/.test(file)) {
      const area = file.slice(SRC.length + 1).split(sep)[0]!;
      outside.set(area, (outside.get(area) ?? 0) + 1);
      reaches.push(`${file.slice(SRC.length + 1)} imports ${target.slice(SRC.length + 1)}`);
    }
  }
}

console.log(`module to module imports that skip api.ts: ${across.length}`);
if (process.argv.includes('--list')) for (const line of across) console.log(`  ${line}`);
if (process.argv.includes('--list')) for (const line of reaches) console.log(`  outside: ${line}`);
console.log('outside code reaching into modules, by area:', Object.fromEntries(outside));
if (strict && (across.length > 0 || outside.size > 0)) process.exit(1);
