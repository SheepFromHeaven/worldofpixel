export function header(title: string): string {
  return `\n${'='.repeat(78)}\n${title}\n${'='.repeat(78)}`;
}

export function verdict(label: string, passed: boolean, detail: string): string {
  return `  ${passed ? 'PASS' : 'FAIL'}  ${label} — ${detail}`;
}
