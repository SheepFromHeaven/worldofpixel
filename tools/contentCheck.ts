import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), 'src/content');
let failed = 0;

for (const kind of ['items', 'buildings']) {
  const directory = resolve(root, kind);
  const index = readFileSync(resolve(directory, 'index.ts'), 'utf8');
  const art = readFileSync(resolve(directory, 'art.ts'), 'utf8');
  for (const entry of readdirSync(directory)) {
    if (!statSync(resolve(directory, entry)).isDirectory()) continue;
    const problems: string[] = [];
    if (!existsSync(resolve(directory, entry, 'index.ts'))) problems.push('no index.ts');
    else if (!index.includes(`'./${entry}/index.ts'`)) problems.push('not in index.ts');
    if (existsSync(resolve(directory, entry, 'art.ts')) && !art.includes(`'./${entry}/art.ts'`)) problems.push('art.ts not in art.ts');
    if (problems.length > 0) {
      failed += 1;
      console.log(`${kind}/${entry}: ${problems.join(', ')}`);
    }
  }
}
console.log(failed === 0 ? 'content: every folder is registered' : `content: ${failed} folder(s) need registering`);
process.exit(failed === 0 ? 0 : 1);
