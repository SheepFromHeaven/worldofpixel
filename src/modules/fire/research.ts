import { at, from, goal, research, thing } from '../../content/research/definition.ts';

export const SPARK = research('spark', 'spark', at(5), from(['flint', 'flint'], 'Spark', 'Flint struck on flint throws a bright spark.'));

export const EMBER = research('ember', 'ember', at(6), from(['spark', 'kindling'], 'Ember', 'A spark that lands in dry fibre smoulders.', { spend: ['dryKindling'] }));

export const FLAME = research('flame', 'flame', at(7), goal(), from(['ember', 'branch'], 'Fire', 'A branch laid to an ember catches, and a flame can be carried.', { spend: ['branch'], make: ['burningBranch'] }));

export const COOKED = research('cooked', 'cooked', at(17), thing('roast'), from(['flame', 'egg'], 'Cooked food', 'An egg held to the flame is better for it.', { spend: ['egg'], make: ['roast'] }));

export const RESEARCH_ENTRIES = [SPARK, EMBER, FLAME, COOKED];
