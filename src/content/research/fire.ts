import { from, goal, research, thing } from './definition.ts';

export const SPARK = research('spark', 'spark', from(['flint', 'flint'], 'Spark', 'Flint struck on flint throws a bright spark.'));

export const EMBER = research('ember', 'ember', from(['spark', 'kindling'], 'Ember', 'A spark that lands in dry kindling smoulders.', { spend: ['dryKindling'] }));

export const FLAME = research('flame', 'flame', goal(), from(['ember', 'branch'], 'Fire', 'A branch laid to an ember catches, and a flame can be carried.', { spend: ['branch'], make: ['burningBranch'] }));

export const COOKED = research('cooked', 'cooked', thing('roast'), from(['flame', 'egg'], 'Cooked food', 'An egg held to the flame is better for it.', { spend: ['egg'], make: ['roast'] }));
