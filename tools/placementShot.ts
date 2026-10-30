import { buildableIdOf } from '../src/content/buildables.ts';
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

const out = option('out', join(tmpdir(), 'placement'));
const station = option('station', 'bed');
const port = Number(option('port', '5875'));

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
const profile = mkdtempSync(join(tmpdir(), 'placement-'));
const cleanup = (): void => {
  for (const child of children) if (child.pid !== undefined && child.exitCode === null) child.kill('SIGKILL');
  rmSync(profile, { recursive: true, force: true });
};

const main = async (): Promise<void> => {
  children.push(spawn('npx', ['vite', '--port', String(port), '--strictPort'], { cwd: process.cwd(), stdio: 'ignore' }));
  const base = `http://localhost:${port}`;
  await until('the dev server', 60, async () => (await fetch(`${base}/`)).ok);
  const debugging = 9400 + Math.floor(Math.random() * 400);
  children.push(spawn(chrome, ['--headless=new', `--remote-debugging-port=${debugging}`, `--user-data-dir=${profile}`, '--no-first-run', '--window-size=1300,900', ...(process.env.SOFTWARE || process.platform !== 'darwin' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=metal', '--ignore-gpu-blocklist']), 'about:blank'], { stdio: 'ignore' }));
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
  const read = async (expression: string): Promise<unknown> => {
    const got = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return got.result?.value;
  };
  const press = (title: string): Promise<unknown> => read(`(() => { const b = [...document.querySelectorAll('button')].find((one) => one.title === ${JSON.stringify(title)} || one.textContent?.trim() === ${JSON.stringify(title)}); b?.click(); return Boolean(b); })()`);
  await send('Page.enable');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1300, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${base}/` });
  await sleep(3000);
  for (const title of ['play', 'create world', 'discover', 'create']) {
    await until(`the ${title} button`, 40, async () => press(title));
    await sleep(800);
  }
  await until('the game', 240, async () => (await read(`Boolean(window.game?.world)`)) === true);
  await sleep(4000);
  await read(`Promise.resolve(window).then((m) => { window.game.arm(${JSON.stringify(station)}); })`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 650, y: 450 });
  await read(`(() => { const g = window.game; const w = g.world; const s = w.structures; const def = g.placing.station; const from = g.tileUnder(g.camera.centre); for (let r = 0; r < 400; r += 1) for (let dx = -r; dx <= r; dx += 1) for (const dy of [-r, r]) { const t = w.grid.at(w.grid.columnOf(from) + dx, w.grid.rowOf(from) + dy); if (t >= 0 && [0, 1, 2, 3].every((k) => s.fits(def, t, k)) && w.tile(t).cover === 0) { g.camera = { centre: w.grid.centre(t), zoom: g.camera.zoom }; return true; } } return false; })()`);
  await read(`Promise.resolve(window).then((m) => { for (let step = 0; step < 6; step += 1) window.game.zoomAt({ x: 650, y: 450 }, { width: 1300, height: 900 }, 2.5); })`);
  await read(`window.__seen = []; for (const t of ['pointermove','mousemove','keydown']) window.addEventListener(t, (e) => window.__seen.push(t + ':' + (e.clientX ?? e.code)), true); true`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 651, y: 450 });
  await sleep(1500);
  for (let turn = 0; turn < 4; turn += 1) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 651 + turn, y: 450 });
    await sleep(500);
    const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 450, y: 300, width: 400, height: 300, scale: 1 } });
    writeFileSync(`${out}-${turn}.png`, Buffer.from(shot.data ?? '', 'base64'));
    console.log(`turn ${turn}`, JSON.stringify(await read(`Promise.resolve(window).then((m) => ({ placing: window.game.placing?.station.key, turn: window.game.placing?.turn, hovered: window.game.hoveredIndex, zoom: window.game.zoom, seen: window.__seen.slice(-4), reaches: window.game.reaches, fits: window.game.fitAt(window.game.hoveredIndex).map((c) => c.reason) }))`)));
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyR', key: 'r', windowsVirtualKeyCode: 82 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyR', key: 'r', windowsVirtualKeyCode: 82 });
  }
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 652, y: 450, button: 'left', clickCount: 1 });
  for (let step = 1; step <= 6; step += 1) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 652 + step * 14, y: 450, buttons: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 736, y: 450, button: 'left', clickCount: 1 });
  await sleep(1500);
  const plans = await read(`window.game.world.structures.plans.length`);
  await read(`(() => { const g = window.game; const w = g.world; const s = w.structures; const c = g.tileUnder(g.camera.centre); for (let dx = -3; dx <= 3; dx += 1) { s.raise(w.grid.at(w.grid.columnOf(c) + dx, w.grid.rowOf(c) - 1), ${buildableIdOf('floor')}); s.raise(w.grid.at(w.grid.columnOf(c) + dx, w.grid.rowOf(c) - 2), ${buildableIdOf('wall')}); } return true; })()`);
  await sleep(1200);
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 450, y: 300, width: 400, height: 300, scale: 1 } });
  writeFileSync(`${out}-placed.png`, Buffer.from(shot.data ?? '', 'base64'));
  console.log('plans after the drag', plans);
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
