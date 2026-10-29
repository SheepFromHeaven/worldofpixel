import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const option = (name: string, fallback: string): string => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? (args[at + 1] ?? fallback) : fallback;
};

const out = option('out', join(tmpdir(), 'mind.png'));
const search = option('query', 't=200');
const port = Number(option('port', '5874'));
const page = option('page', 'mind-sheet.html');

const CHROMES = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'];
const chrome = CHROMES.find((path): path is string => path !== undefined && existsSync(path));
if (!chrome) throw new Error('no Chrome found, set CHROME');

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const until = async <T>(what: string, seconds: number, probe: () => Promise<T | null | undefined | false>): Promise<T> => {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    try {
      const got = await probe();
      if (got) return got;
    } catch {
      // not ready
    }
    await sleep(300);
  }
  throw new Error(`timed out waiting for ${what}`);
};

const children: ChildProcess[] = [];
const profile = mkdtempSync(join(tmpdir(), 'mind-sheet-'));
const cleanup = (): void => {
  for (const child of children) if (child.pid !== undefined && child.exitCode === null) child.kill('SIGKILL');
  rmSync(profile, { recursive: true, force: true });
};

const main = async (): Promise<void> => {
  children.push(spawn('npx', ['vite', '--port', String(port), '--strictPort'], { cwd: process.cwd(), stdio: 'ignore' }));
  const base = `http://localhost:${port}`;
  await until('the dev server', 60, async () => (await fetch(`${base}/${page}`)).ok);
  const debugging = 9400 + Math.floor(Math.random() * 400);
  children.push(spawn(chrome, ['--headless=new', `--remote-debugging-port=${debugging}`, `--user-data-dir=${profile}`, '--no-first-run', '--window-size=1300,900', 'about:blank'], { stdio: 'ignore' }));
  const target = await until('the browser', 30, async () => {
    const list = (await (await fetch(`http://127.0.0.1:${debugging}/json`)).json()) as { type: string; webSocketDebuggerUrl: string }[];
    return list.find((one) => one.type === 'page');
  });
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise<void>((resolve) => (socket.onopen = () => resolve()));
  let counter = 0;
  const waiting = new Map<number, (message: { result?: { result?: { value?: unknown }; data?: string }; error?: { message: string } }) => void>();
  socket.onmessage = (event) => {
    const message = JSON.parse(String(event.data)) as { id?: number; result?: { result?: { value?: unknown }; data?: string } };
    if (message.id !== undefined) waiting.get(message.id)?.(message);
  };
  const send = (method: string, params: object = {}): Promise<{ result?: { value?: unknown }; data?: string }> =>
    new Promise((resolve) => {
      const id = ++counter;
      waiting.set(id, (message) => resolve({ ...(message.result?.result ? { result: message.result.result } : {}), ...(message.result?.data ? { data: message.result.data } : {}) }));
      socket.send(JSON.stringify({ id, method, params }));
    });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1300, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${base}/${page}?${search}` });
  const read = async (expression: string): Promise<unknown> => JSON.parse(String((await send('Runtime.evaluate', { expression: `JSON.stringify(${expression})`, returnByValue: true })).result?.value ?? 'null'));
  if (page === 'mind-sheet.html') await until('the sheet', 240, async () => (await read('window.__mind?.ready ?? false')) === true);
  else await sleep(4000);
  if (page === 'mind-sheet.html') console.log(JSON.stringify(await read('window.__mind')));
  if (process.env.CLICK) {
    await send('Runtime.evaluate', { expression: `document.querySelector('[aria-label="${process.env.CLICK}"]')?.closest('button')?.click()` });
    await sleep(500);
  }
  if (process.env.WHEEL) {
    const [wx, wy, delta] = process.env.WHEEL.split(',').map(Number) as [number, number, number];
    await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: wx, y: wy, deltaX: 0, deltaY: delta });
    await sleep(300);
  }
  const drag = process.env.DRAG;
  if (drag) {
    const [x0, y0, x1, y1] = drag.split(',').map(Number) as [number, number, number, number];
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0 });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x1, y: y1, buttons: 1 });
    if (process.env.RELEASE) await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y1, button: 'left', clickCount: 1 });
    await sleep(Number(process.env.HOLD ?? 500));
  }
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(out, Buffer.from(shot.data ?? '', 'base64'));
  console.log(await read('localStorage.getItem("mind-layout")'));
  console.log(`wrote ${out}`);
  socket.close();
};

main()
  .then(() => {
    cleanup();
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    cleanup();
    process.exit(1);
  });
