import type { LevelResult, Logger } from './harness.ts';
import { runLevel1 } from './level1.ts';
import { runLevel2 } from './level2.ts';
import { runLevel3 } from './level3.ts';
import { runLevel4 } from './level4.ts';
import { runLevel14 } from './level14.ts';
import { runLevel15 } from './level15.ts';
import { runLevel16 } from './level16.ts';
import { runLevel17 } from './level17.ts';
import { runLevel18 } from './level18.ts';
import { runLevel19 } from './level19.ts';
import { verdict } from './render.ts';

export type { LevelResult, Logger } from './harness.ts';

export function runAllLevels(log: Logger): LevelResult[] {
  const levels = [runLevel1, runLevel2, runLevel3, runLevel4, runLevel14, runLevel15, runLevel16, runLevel17, runLevel18, runLevel19];
  const results = levels.map((level) => level(log));
  log('');
  for (const result of results) log(verdict(result.title, result.passed, result.detail));
  return results;
}
