import { createHash } from 'node:crypto';
import { buildField } from '../src/sim/terrain/worldfield.ts';

const seed = Number(process.env.SEED ?? 20250214);
const field = buildField(seed);
const hash = (a: ArrayBufferView): string => createHash('sha1').update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)).digest('hex').slice(0, 10);
console.log(`seed ${seed} ${field.grid.columns}x${field.grid.rows}`, Object.fromEntries(['height', 'water', 'temperature', 'wet', 'flux', 'biome', 'wind'].map((k) => [k, hash((field as never)[k])])), 'rivers', field.rivers.count, field.rivers.segments.length);
