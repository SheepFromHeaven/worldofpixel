import type { LevelResult, Logger } from './harness.ts';
import { runLevel1 } from './level1.ts';
import { runLevel10 } from './level10.ts';
import { runLevel11 } from './level11.ts';
import { runLevel12 } from './level12.ts';
import { runLevel14 } from './level14.ts';
import { runLevel15 } from './level15.ts';
import { runLevel16 } from './level16.ts';
import { runLevel17 } from './level17.ts';
import { runLevel18 } from './level18.ts';
import { runLevel19 } from './level19.ts';
import { runLevel20 } from './level20.ts';
import { runLevel3 } from './level3.ts';
import { runLevel4 } from './level4.ts';
import { runLevel5 } from './level5.ts';
import { runLevel6 } from './level6.ts';
import { runLevel7 } from './level7.ts';
import { runLevel8 } from './level8.ts';
import { runLevel9 } from './level9.ts';
import { verdict } from './render.ts';

export type { Harness,LevelResult,Logger } from './harness.ts';

export function runAllLevels(log: Logger): LevelResult[] {
  const levels = [runLevel1, runLevel3, runLevel4, runLevel5, runLevel6, runLevel7, runLevel8, runLevel9, runLevel10, runLevel11, runLevel12, runLevel14, runLevel15, runLevel16, runLevel17, runLevel18, runLevel19, runLevel20];
  const results = levels.map((level) => level(log));
  log('');
  for (const result of results) log(verdict(result.title, result.passed, result.detail));
  return results;
}
