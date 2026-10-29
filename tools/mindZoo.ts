import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = process.argv[2] ?? join(tmpdir(), 'mind-zoo.png');
const wait = Number(process.argv[3] ?? 30);
const port = 5875;
const chrome = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((path): path is string => path !== undefined && existsSync(path));
if (!chrome) throw new Error('no Chrome');
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const until = async <T>(what: string, seconds: number, probe: () => Promise<T | null | undefined | false>): Promise<T> => {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    try {
      const got = await probe();
      if (got) return got;
    } catch {
      // wait
    }
    await sleep(300);
  }
  throw new Error(`timed out waiting for ${what}`);
};
const children: ChildProcess[] = [];
const profile = mkdtempSync(join(tmpdir(), 'mind-zoo-'));

const main = async (): Promise<void> => {
  children.push(spawn('npx', ['vite', '--port', String(port), '--strictPort'], { cwd: process.cwd(), stdio: 'ignore' }));
  const base = `http://localhost:${port}`;
  await until('vite', 60, async () => (await fetch(`${base}/zoo.html`)).ok);
  const debugging = 9400 + Math.floor(Math.random() * 400);
  children.push(spawn(chrome, ['--headless=new', `--remote-debugging-port=${debugging}`, `--user-data-dir=${profile}`, '--no-first-run', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1400,900', 'about:blank'], { stdio: 'ignore' }));
  const target = await until('browser', 30, async () => ((await (await fetch(`http://127.0.0.1:${debugging}/json`)).json()) as { type: string; webSocketDebuggerUrl: string }[]).find((one) => one.type === 'page'));
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise<void>((resolve) => (socket.onopen = () => resolve()));
  let counter = 0;
  const errors: string[] = [];
  const waiting = new Map<number, (message: { result?: { result?: { value?: unknown }; data?: string } }) => void>();
  socket.onmessage = (event) => {
    const message = JSON.parse(String(event.data)) as { id?: number; method?: string; params?: { exceptionDetails?: { exception?: { description?: string }; text?: string } }; result?: { result?: { value?: unknown }; data?: string } };
    if (message.id !== undefined) waiting.get(message.id)?.(message);
    else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params?.exceptionDetails?.exception?.description ?? message.params?.exceptionDetails?.text ?? 'error');
  };
  const send = (method: string, params: object = {}): Promise<{ result?: { value?: unknown }; data?: string }> =>
    new Promise((resolve) => {
      const id = ++counter;
      waiting.set(id, (message) => resolve({ ...(message.result?.result ? { result: message.result.result } : {}), ...(message.result?.data ? { data: message.result.data } : {}) }));
      socket.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression: string): Promise<unknown> => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value;
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${base}/zoo.html?terrain=meadow&hour=0.5` });
  await until('zoo', 120, async () => (await evaluate('typeof window.zoo !== "undefined"')) === true);
  await sleep(1500);
  console.log(
    await evaluate(`(async () => {
      const { ZOO } = await import('/src/zoo/catalogue.ts');
      const human = ZOO.find((one) => one.key === 'human');
      const c = zoo.camera.centre;
      zoo.add(human, { x: c.x, y: c.y }, true);
      zoo.add(human, { x: c.x + 1.5, y: c.y + 0.5 }, true);
      const w = zoo.world ?? null;
      return JSON.stringify({ placed: zoo.count, centre: c });
    })()`),
  );
  await sleep(2500);
  const buttons = await evaluate(`[...document.querySelectorAll('.zoo-tools button')].map((b) => b.title).join(' | ')`);
  console.log(buttons);
  await evaluate(`(() => { const b = [...document.querySelectorAll('.zoo-tools button')].find((x) => x.title.startsWith('mind')); b?.click(); return !!b; })()`);
  await sleep(2000);
  console.log('stage', await evaluate('typeof window.stage'));
  console.log(
    await evaluate(`(async () => {
      const { ItemType } = await import('/src/sim/people/items.ts');
      const s = window.stage;
      if (!s) return 'no stage';
      const g = s.world.grid;
      const here = g.atPoint({ x: s.people.posX[0], y: s.people.posY[0] });
      let n = 0;
      for (const [kind, count] of [[ItemType.Flint, 3], [ItemType.Stone, 2], [ItemType.DryKindling, 2], [ItemType.Branch, 3]]) {
        for (let k = 0; k < count; k += 1) { s.world.items.add(g.at(g.columnOf(here) + 2 + (n % 5), g.rowOf(here) + 2 + Math.floor(n / 5)), kind); n += 1; }
      }
      return 'items ' + n;
    })()`),
  );
  await sleep(6000);
  await evaluate(`(() => { const b = [...document.querySelectorAll('.se-mind .se-tile')].find((x) => x.textContent); return 1; })()`);
  await evaluate(`(() => { const s = window.stage; s.apply({ kind: 'wonder', a: 0, b: 0 }); return s.mind.hypotheses.length; })()`);
  await sleep(wait * 1000);
  console.log(await evaluate(`JSON.stringify({ known: Array.from(window.stage.mind.known), hyp: window.stage.mind.hypotheses.map((h) => [h.state, h.note]), states: [0, 1].map((p) => [window.stage.people.state[p], window.stage.people.wonder[p]]) })`));
  if (process.env.CLOSE) await evaluate(`document.querySelector('.se-mind .se-tile')?.click()`);
  await sleep(300);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(out, Buffer.from(shot.data ?? '', 'base64'));
  console.log(`wrote ${out}`);
  console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
  socket.close();
};

main()
  .then(() => {
    for (const child of children) child.kill('SIGKILL');
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    for (const child of children) child.kill('SIGKILL');
    process.exit(1);
  });
