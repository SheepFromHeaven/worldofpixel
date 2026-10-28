import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { behaviourOf } from '../src/animals/catalogue.ts';
import { statesOf } from '../src/animals/types.ts';
import { MAMMALS } from '../src/sim/mammals/species.ts';

interface Options {
  key: string;
  out: string;
  cell: number;
  phases: number;
  hour: string;
  state: string;
  sex: string;
  stage: string;
  headings: string;
  only2d: boolean;
  url: string | null;
  port: number;
}

const usage = 'usage: npm run animal -- <key> [--out file.png] [--cell 96] [--phases 4] [--hour auto|noon|night|dawn|dusk] [--state <one of the animal states>] [--sex male|female] [--stage adult|juvenile|calf] [--headings E,N] [--2d] [--url http://localhost:5173] [--port 5873]; on a Mac it renders on the GPU (seconds), SOFTWARE=1 forces swiftshader (minutes)';

const parse = (argv: readonly string[]): Options => {
  const options: Options = { key: '', out: '', cell: 96, phases: 4, hour: 'auto', state: '', sex: 'male', stage: 'adult', headings: '', only2d: false, url: null, port: 5873 };
  for (let at = 0; at < argv.length; at += 1) {
    const arg = argv[at]!;
    const value = (): string => {
      const next = argv[++at];
      if (next === undefined) throw new Error(`${arg} needs a value\n${usage}`);
      return next;
    };
    if (arg === '--out') options.out = value();
    else if (arg === '--cell') options.cell = Number(value());
    else if (arg === '--phases') options.phases = Number(value());
    else if (arg === '--hour') options.hour = value();
    else if (arg === '--state') options.state = value();
    else if (arg === '--sex') options.sex = value();
    else if (arg === '--stage') options.stage = value();
    else if (arg === '--headings') options.headings = value();
    else if (arg === '--2d') options.only2d = true;
    else if (arg === '--url') options.url = value().replace(/\/$/, '');
    else if (arg === '--port') options.port = Number(value());
    else if (arg.startsWith('--')) throw new Error(`unknown option ${arg}\n${usage}`);
    else options.key = arg;
  }
  if (options.key === '') throw new Error(usage);
  if (options.out === '') options.out = join(tmpdir(), `animal-${options.key}.png`);
  return options;
};

const CHROMES = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];

const chromePath = (): string => {
  const found = CHROMES.find((path): path is string => path !== undefined && existsSync(path));
  if (!found) throw new Error('no Chrome found, set CHROME to its path');
  return found;
};

const sleep = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));

const until = async <T>(what: string, seconds: number, probe: () => Promise<T | null | undefined | false>): Promise<T> => {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    try {
      const got = await probe();
      if (got) return got;
    } catch {
      // not ready yet
    }
    await sleep(300);
  }
  throw new Error(`timed out waiting for ${what}`);
};

const children: ChildProcess[] = [];
const scratch: string[] = [];

const cleanup = (): void => {
  for (const child of children) if (child.pid !== undefined && child.exitCode === null) child.kill('SIGKILL');
  for (const path of scratch) rmSync(path, { recursive: true, force: true });
};

interface Cdp {
  send(method: string, params?: object): Promise<{ result?: { value?: unknown }; data?: string }>;
  close(): void;
}

const connect = async (port: number): Promise<Cdp> => {
  const target = await until('the browser', 30, async () => {
    const list = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()) as { type: string; webSocketDebuggerUrl: string }[];
    return list.find((one) => one.type === 'page');
  });
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise<void>((resolve, reject) => {
    socket.onopen = () => resolve();
    socket.onerror = () => reject(new Error('the browser connection failed'));
  });
  let counter = 0;
  const waiting = new Map<number, (message: { result?: { result?: { value?: unknown }; data?: string }; error?: { message: string } }) => void>();
  socket.onmessage = (event) => {
    const message = JSON.parse(String(event.data)) as { id?: number; result?: { result?: { value?: unknown }; data?: string }; error?: { message: string } };
    if (message.id !== undefined) waiting.get(message.id)?.(message);
  };
  return {
    send: (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = ++counter;
        waiting.set(id, (message) => {
          if (message.error) reject(new Error(`${method}: ${message.error.message}`));
          else resolve({ ...(message.result?.result ? { result: message.result.result } : {}), ...(message.result?.data ? { data: message.result.data } : {}) });
        });
        socket.send(JSON.stringify({ id, method, params }));
      }),
    close: () => socket.close(),
  };
};

const main = async (): Promise<number> => {
  const options = parse(process.argv.slice(2));
  if (!MAMMALS.some((one) => one.key === options.key)) {
    const near = MAMMALS.filter((one) => one.key.includes(options.key) || options.key.includes(one.key)).map((one) => one.key);
    throw new Error(`no mammal called ${options.key}${near.length ? `, did you mean ${near.join(', ')}?` : ''}`);
  }
  const states = statesOf(behaviourOf(options.key));
  if (options.state !== '' && !states.includes(options.state)) throw new Error(`${options.key} has no state '${options.state}', it has: ${states.join(', ')}`);
  let base = options.url;
  if (!base) {
    const vite = spawn('npx', ['vite', '--port', String(options.port), '--strictPort'], { cwd: process.cwd(), stdio: 'ignore' });
    children.push(vite);
    base = `http://localhost:${options.port}`;
  }
  const page = `${base}/animal-sheet.html?animal=${encodeURIComponent(options.key)}&cell=${options.cell}&phases=${options.phases}&hour=${encodeURIComponent(options.hour)}&state=${encodeURIComponent(options.state)}&sex=${options.sex}&stage=${options.stage}${options.headings ? `&headings=${options.headings}` : ''}${options.only2d ? '&view=2d' : ''}`;
  await until('the dev server', 60, async () => (await fetch(`${base}/animal-sheet.html`)).ok);

  const profile = mkdtempSync(join(tmpdir(), 'animal-sheet-'));
  scratch.push(profile);
  const debugging = 9400 + Math.floor(Math.random() * 400);
  children.push(
    spawn(chromePath(), ['--headless=new', `--remote-debugging-port=${debugging}`, `--user-data-dir=${profile}`, '--no-first-run', ...(process.env.SOFTWARE || process.platform !== 'darwin' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=metal', '--ignore-gpu-blocklist']), '--window-size=12000,3000', 'about:blank'], { stdio: 'ignore' }),
  );
  const cdp = await connect(debugging);
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 12000, height: 3000, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: page });

  const read = async <T>(expression: string): Promise<T> => (await cdp.send('Runtime.evaluate', { expression: `JSON.stringify(${expression})`, returnByValue: true })).result?.value as T;
  await until('the sheet to draw', 180, async () => JSON.parse((await read<string>('window.__sheet?.ready ?? false')) ?? 'false') === true);
  const sheet = JSON.parse((await read<string>('window.__sheet')) ?? 'null') as { errors: string[]; columns: string[]; rows: string[]; cell: number };
  const box = JSON.parse((await read<string>('(() => { const r = document.getElementById("sheet").getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()')) ?? 'null') as { x: number; y: number; width: number; height: number };
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { ...box, scale: 1 } });
  writeFileSync(options.out, Buffer.from(shot.data ?? '', 'base64'));
  cdp.close();

  console.log(`${options.key}: ${sheet.rows.length} headings x ${sheet.columns.length} columns (${sheet.columns.join(', ')})`);
  console.log(`wrote ${options.out} (${box.width}x${box.height})`);
  if (sheet.errors.length > 0) {
    console.error(`${sheet.errors.length} error(s):\n${sheet.errors.join('\n')}`);
    return 1;
  }
  return 0;
};

main()
  .then((code) => {
    cleanup();
    process.exit(code);
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    cleanup();
    process.exit(1);
  });
