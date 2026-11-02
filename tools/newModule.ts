import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { write } from './modules.ts';

const ROOT = resolve(import.meta.dirname, '..', 'src', 'modules');

const [name, ...flags] = process.argv.slice(2);
if (!name || !/^[a-z][a-zA-Z0-9]*$/.test(name)) throw new Error('usage: npm run modules:new -- <name> [--client] [--research] [--item] [--station] [--block]');

const folder = join(ROOT, name);
if (existsSync(folder)) throw new Error(`${name} already exists`);
mkdirSync(folder, { recursive: true });

const orders = readdirSync(ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(ROOT, entry.name, 'module.ts')))
  .length;
const order = 400 + orders;
const Pascal = name[0]!.toUpperCase() + name.slice(1);

const files: Record<string, string> = {
  'api.ts': `import { capability } from '../../sim/kernel/kernel.ts';\n\nexport interface ${Pascal} {\n  readonly ready: boolean;\n}\n\nexport const ${name.toUpperCase()} = capability<${Pascal}>('${name}');\n`,
  'module.ts': `import { ${name.toUpperCase()} } from './api.ts';\nimport { provide, system } from '../../sim/kernel/kernel.ts';\nimport { defineModule } from '../../sim/kernel/module.ts';\n\nconst ${name} = system({\n  id: '${name}',\n  needs: {},\n  create: () => ({ provides: [provide(${name.toUpperCase()}, { ready: true })] }),\n});\n\nexport const ${name}Module = defineModule('${name}', [${name}], { order: ${order} });\n`,
};

if (flags.includes('--client')) files['client.ts'] = `import { registerDrawable } from '../clientSlots.ts';\nimport { ${name}Drawable } from './draw.ts';\n\nregisterDrawable(${name}Drawable);\n`;
if (flags.includes('--client')) files['draw.ts'] = `import type { Drawable } from '../clientSlots.ts';\n\nexport const ${name}Drawable: Drawable = {\n  id: '${name}',\n  order: 50,\n  draw() {},\n};\n`;
if (flags.includes('--research')) files['research.ts'] = `import { at, research } from '../../content/research/definition.ts';\n\nexport const ${name.toUpperCase()}_NOTE = research('${name}', '${name}', at(${1000 + orders}));\n\nexport const RESEARCH_ENTRIES = [${name.toUpperCase()}_NOTE];\n`;

for (const [file, text] of Object.entries(files)) writeFileSync(join(folder, file), text);

const content = (kind: string, make: string, imports: string, body: string): void => {
  const dir = join(folder, 'content', kind, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.ts'), `import { ${imports} } from '../../../../../content/${kind}/definition.ts';\n\nexport const ${name} = ${make}('${name}', '${Pascal}'${body});\n\nexport const order = ${1000 + orders};\n\nexport default ${name};\n`);
};
if (flags.includes('--item')) {
  const dir = join(folder, 'content', 'items', name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.ts'), `import { item, stackable } from '../../../../../content/items/definition.ts';\n\nexport const ${name} = item('${name}', '${name}', '${name}', stackable({ size: 8 }));\n\nexport const order = ${1000 + orders};\n\nexport default ${name};\n`);
}
if (flags.includes('--station')) content('stations', 'station', 'station, footprint', `, 'structure.${name}', footprint([[0, 0]])`);

write();
console.log(`modules/${name} created (order ${order}); run npm run typecheck`);
