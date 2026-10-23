export type Logger = (line: string) => void;

export interface LevelResult {
  title: string;
  passed: boolean;
  detail: string;
}

export const TEST_SEED = 20_260_123;

export function check(
  log: Logger,
  claim: string,
  held: boolean,
  detail = '',
): boolean {
  log(`    ${held ? 'ok  ' : 'BAD '} ${claim}${detail ? ` — ${detail}` : ''}`);
  return held;
}
