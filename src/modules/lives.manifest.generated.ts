import type { Biology } from './fauna/vocabulary.ts';
import { BIOLOGY as amphibians } from './amphibians/biology.ts';
import { BIOLOGY as birds } from './birds/biology.ts';
import { BIOLOGY as insects } from './insects/biology.ts';
import { BIOLOGY as mammals } from './mammals/biology.ts';
import { BIOLOGY as reptiles } from './reptiles/biology.ts';

export const BIOLOGIES: readonly Biology[] = [amphibians, birds, insects, mammals, reptiles];
