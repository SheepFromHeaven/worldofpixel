import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');

const STORE = join(ROOT, 'node_modules', '.cache', 'wiki.json');

const SPECIFIER = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|import\s*['"]([^'"]+)['"]/g;

const DATA = [join(ROOT, 'public', 'props', 'props.json')];

export const sourcesOf = (entry: string): string[] => {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    if (!/\.(ts|tsx|js)$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(SPECIFIER)) {
      const specifier = (match[1] ?? match[2] ?? match[3] ?? '').split('?')[0]!;
      if (specifier.startsWith('.')) queue.push(resolve(dirname(file), specifier));
    }
  }
  return [...seen].sort();
};

export const fingerprint = (entry: string, extra: string): string => {
  const hash = createHash('sha1');
  for (const file of [...sourcesOf(entry), ...DATA.filter(existsSync)]) hash.update(file).update(readFileSync(file));
  return hash.update(extra).digest('hex');
};

export const readCache = (): Record<string, string> => {
  try {
    return JSON.parse(readFileSync(STORE, 'utf8')) as Record<string, string>;
  } catch {
    return {};
  }
};

export const writeCache = (cache: Record<string, string>): void => {
  mkdirSync(dirname(STORE), { recursive: true });
  writeFileSync(STORE, JSON.stringify(cache, null, 1));
};
