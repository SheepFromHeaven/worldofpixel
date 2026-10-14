import { runAllLevels } from './levels.ts';

const results = runAllLevels((line) => console.log(line));
const failed = results.filter((result) => !result.passed);

console.log('');
console.log(`${results.length - failed.length}/${results.length} levels verified`);

process.exitCode = failed.length === 0 ? 0 : 1;
