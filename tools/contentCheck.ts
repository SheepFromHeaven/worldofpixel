import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { KINDS, write } from './content.ts';

write();
const root = resolve(process.cwd(), 'src/content');
for (const { kind, defs } of KINDS) {
  const manifest = readFileSync(resolve(root, kind, 'manifest.generated.ts'), 'utf8');
  const count = (manifest.match(/^import \w+ from /gm) ?? []).length;
  console.log(`${kind}: ${count} registered (${defs})`);
}
console.log('content: manifests regenerated from the folders');
