import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const usage = `usage: npm run shot -- [options] [steps...]

options:
  --out file.png       where the last picture goes (default /tmp/shot.png)
  --size 1440x900      the viewport
  --scale 1            device pixel ratio (2 for a retina picture)
  --clip x,y,w,h       crop every picture to this box
  --url http://...     use a dev server that is already running
  --port 5876          port of the dev server this starts
  --serve              keep a dev server, Chrome and the page alive; later calls reuse them (Ctrl-C ends it)
  --stop               end a session started with --serve
  --fresh              in a session, reload the page to the menu first

steps, run in order:
  menu                 the main menu
  game[:mode[:seed]]   start a new world (mode settle or discover, default settle) and wait for it
  click:<name>         click a button by its title, aria-label or text
  key:<Code>           press a key (KeyboardEvent.code: Escape, KeyE, Space, Tab ...)
  move:x,y             move the pointer
  left:x,y             left click
  right:x,y            right click (the radial menu)
  wheel:x,y,delta      scroll
  view:<json>          se.load(...) a view copied with the copy view button
  eval:<js>            run JavaScript in the page (window.game is the Game)
  wait:<ms>            wait
  shot:<file.png>      take a picture now
With no steps it opens a game in settle mode and takes one picture.`;

interface Options {
  out: string;
  width: number;
  height: number;
  scale: number;
  clip: { x: number; y: number; width: number; height: number } | null;
  url: string | null;
  port: number;
  serve: boolean;
  stop: boolean;
  fresh: boolean;
  steps: string[];
}

const SESSION = join(tmpdir(), 'se-shot-session.json');

interface Session {
  base: string;
  debugging: number;
  pids: number[];
}

const parse = (argv: readonly string[]): Options => {
  const options: Options = { out: '/tmp/shot.png', width: 1440, height: 900, scale: 1, clip: null, url: null, port: 5876, serve: false, stop: false, fresh: false, steps: [] };
  for (let at = 0; at < argv.length; at += 1) {
    const arg = argv[at]!;
    const value = (): string => {
      const next = argv[++at];
      if (next === undefined) throw new Error(`${arg} needs a value\n${usage}`);
      return next;
    };
    if (arg === '--out') options.out = value();
    else if (arg === '--size') {
      const [w, h] = value().split('x').map(Number);
      options.width = w ?? options.width;
      options.height = h ?? options.height;
    } else if (arg === '--scale') options.scale = Number(value());
    else if (arg === '--clip') {
      const [x, y, width, height] = value().split(',').map(Number) as [number, number, number, number];
      options.clip = { x, y, width, height };
    } else if (arg === '--url') options.url = value().replace(/\/$/, '');
    else if (arg === '--port') options.port = Number(value());
    else if (arg === '--serve') options.serve = true;
    else if (arg === '--stop') options.stop = true;
    else if (arg === '--fresh') options.fresh = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(usage);
      process.exit(0);
    } else if (arg.startsWith('--')) throw new Error(`unknown option ${arg}\n${usage}`);
    else options.steps.push(arg);
  }
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
    await sleep(250);
  }
  throw new Error(`timed out waiting for ${what}`);
};

const children: ChildProcess[] = [];

const killGroup = (pid: number): void => {
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // gone
    }
  }
};
const scratch: string[] = [];

const cleanup = (): void => {
  for (const child of children) if (child.pid !== undefined) killGroup(child.pid);
  for (const path of scratch) rmSync(path, { recursive: true, force: true });
};

interface Reply {
  result?: { value?: unknown; description?: string };
  exceptionDetails?: { text: string; exception?: { description?: string } };
  data?: string;
}

interface Cdp {
  send(method: string, params?: object): Promise<Reply>;
  errors: string[];
  close(): void;
}

const connect = async (port: number): Promise<Cdp> => {
  const target = await until('the browser', 30, async () => {
    const list = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()) as { type: string; url: string; webSocketDebuggerUrl: string }[];
    return list.find((one) => one.type === 'page');
  });
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise<void>((resolve, reject) => {
    socket.onopen = () => resolve();
    socket.onerror = () => reject(new Error('the browser connection failed'));
  });
  let counter = 0;
  const errors: string[] = [];
  const waiting = new Map<number, (message: { result?: Reply; error?: { message: string } }) => void>();
  socket.onmessage = (event) => {
    const message = JSON.parse(String(event.data)) as { id?: number; method?: string; params?: { type?: string; args?: { value?: unknown; description?: string }[]; exceptionDetails?: { text: string; exception?: { description?: string } } }; result?: Reply; error?: { message: string } };
    if (message.id !== undefined) waiting.get(message.id)?.(message);
    else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params?.exceptionDetails?.exception?.description ?? message.params?.exceptionDetails?.text ?? 'exception');
    else if (message.method === 'Runtime.consoleAPICalled' && message.params?.type === 'error') errors.push((message.params.args ?? []).map((arg) => String(arg.value ?? arg.description ?? '')).join(' '));
  };
  return {
    send: (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = ++counter;
        waiting.set(id, (message) => {
          waiting.delete(id);
          if (message.error) reject(new Error(`${method}: ${message.error.message}`));
          else resolve(message.result ?? {});
        });
        socket.send(JSON.stringify({ id, method, params }));
      }),
    errors,
    close: () => socket.close(),
  };
};

const startServer = (port: number): ChildProcess => spawn('npx', ['vite', '--port', String(port), '--strictPort'], { cwd: process.cwd(), stdio: 'ignore', detached: true });

const startChrome = (debugging: number, profile: string, options: Options): ChildProcess =>
  spawn(
    chromePath(),
    [
      '--headless=new',
      `--remote-debugging-port=${debugging}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--autoplay-policy=no-user-gesture-required',
      ...(process.env.SOFTWARE || process.platform !== 'darwin' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=metal', '--ignore-gpu-blocklist']),
      `--window-size=${options.width},${options.height}`,
      'about:blank',
    ],
    { stdio: 'ignore', detached: true },
  );

const readSession = (): Session | null => {
  if (!existsSync(SESSION)) return null;
  try {
    return JSON.parse(readFileSync(SESSION, 'utf8')) as Session;
  } catch {
    return null;
  }
};

const alive = async (session: Session): Promise<boolean> => {
  try {
    await fetch(`http://127.0.0.1:${session.debugging}/json/version`);
    return true;
  } catch {
    return false;
  }
};

const stopSession = (session: Session): void => {
  for (const pid of session.pids) killGroup(pid);
  rmSync(SESSION, { force: true });
};

const point = (text: string): number[] => text.split(',').map(Number);

const run = async (cdp: Cdp, base: string, options: Options, navigate: boolean): Promise<void> => {
  const evaluate = async (expression: string): Promise<unknown> => {
    const got = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (got.exceptionDetails) throw new Error(got.exceptionDetails.exception?.description ?? got.exceptionDetails.text);
    return got.result?.value;
  };
  const press = (name: string): Promise<unknown> =>
    evaluate(
      `(() => { const name = ${JSON.stringify(name)}; const all = [...document.querySelectorAll('button, [role="button"], [title], [aria-label]')]; const hit = all.find((one) => one.getAttribute('title') === name || one.getAttribute('aria-label') === name) ?? all.find((one) => one.textContent?.trim() === name); const target = hit?.closest('button, [role="button"]') ?? hit; if (!target) return false; target.click(); return true; })()`,
    );
  const mouse = async (type: string, x: number, y: number, button: 'left' | 'right' | 'none' = 'none'): Promise<void> => {
    await cdp.send('Input.dispatchMouseEvent', { type, x, y, button, buttons: button === 'left' ? 1 : button === 'right' ? 2 : 0, clickCount: button === 'none' ? 0 : 1 });
  };
  const click = async (x: number, y: number, button: 'left' | 'right'): Promise<void> => {
    await mouse('mouseMoved', x, y);
    await mouse('mousePressed', x, y, button);
    await sleep(60);
    await mouse('mouseReleased', x, y, button);
  };
  const KEYS: Record<string, [string, number]> = { Escape: ['Escape', 27], Space: [' ', 32], Tab: ['Tab', 9], Enter: ['Enter', 13], Period: ['.', 190], Comma: [',', 188], PageUp: ['PageUp', 33], PageDown: ['PageDown', 34] };
  const key = async (code: string): Promise<void> => {
    const [text, keyCode] = KEYS[code] ?? (code.startsWith('Key') ? [code.slice(3).toLowerCase(), code.charCodeAt(3)] : code.startsWith('Digit') ? [code.slice(5), code.charCodeAt(5)] : [code, 0]);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: text, windowsVirtualKeyCode: keyCode });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: text, windowsVirtualKeyCode: keyCode });
  };
  const capture = async (file: string): Promise<void> => {
    await evaluate('new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))');
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, ...(options.clip ? { clip: { ...options.clip, scale: 1 } } : {}) });
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(shot.data ?? '', 'base64'));
    console.log(`wrote ${file}`);
  };
  const toMenu = async (): Promise<void> => {
    await cdp.send('Page.navigate', { url: `${base}/` });
    await until('the menu', 60, async () => (await evaluate(`document.readyState === 'complete' && Boolean([...document.querySelectorAll('button, [title]')].find((one) => one.getAttribute('title') === 'play' || one.textContent?.trim() === 'play'))`)) === true);
    await sleep(300);
  };
  const toGame = async (mode: string, seed: string): Promise<void> => {
    await toMenu();
    for (const name of ['play', 'create world', mode]) {
      await until(`the ${name} button`, 30, async () => press(name));
      await sleep(250);
    }
    if (seed !== '') {
      await evaluate(`(() => { const box = document.querySelector('.se-seedbox'); box.focus(); box.select(); return true; })()`);
      await cdp.send('Input.insertText', { text: seed });
    }
    await until('the create button', 30, async () => press('create'));
    await until('the world', 300, async () => (await evaluate('Boolean(window.game?.world)')) === true);
    await sleep(2500);
  };

  await cdp.send('Emulation.setDeviceMetricsOverride', { width: options.width, height: options.height, deviceScaleFactor: options.scale, mobile: false });
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  const steps = options.steps.length > 0 ? options.steps : navigate ? ['game'] : [];
  if (navigate && !['menu', 'game'].includes(steps[0]?.split(':')[0] ?? '')) await toMenu();
  for (const step of steps) {
    const colon = step.indexOf(':');
    const verb = colon < 0 ? step : step.slice(0, colon);
    const arg = colon < 0 ? '' : step.slice(colon + 1);
    if (verb === 'menu') await toMenu();
    else if (verb === 'game') {
      const [mode, seed] = arg.split(':');
      await toGame(mode || 'settle', seed ?? '');
    } else if (verb === 'click') {
      if (!(await press(arg))) throw new Error(`no button called '${arg}'`);
      await sleep(300);
    } else if (verb === 'key') {
      await key(arg);
      await sleep(200);
    } else if (verb === 'move') {
      const [x, y] = point(arg) as [number, number];
      await mouse('mouseMoved', x, y);
      await sleep(200);
    } else if (verb === 'left' || verb === 'right') {
      const [x, y] = point(arg) as [number, number];
      await click(x, y, verb);
      await sleep(300);
    } else if (verb === 'wheel') {
      const [x, y, delta] = point(arg) as [number, number, number];
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: delta });
      await sleep(300);
    } else if (verb === 'view') {
      await evaluate(`window.se.load(${JSON.stringify(arg)})`);
      await sleep(1500);
    } else if (verb === 'eval') {
      const value = await evaluate(arg);
      if (value !== undefined) console.log(typeof value === 'string' ? value : JSON.stringify(value));
    } else if (verb === 'wait') await sleep(Number(arg));
    else if (verb === 'shot') await capture(arg || options.out);
    else throw new Error(`unknown step '${step}'\n${usage}`);
  }
  if (!steps.at(-1)?.startsWith('shot')) await capture(options.out);
};

const main = async (): Promise<number> => {
  const options = parse(process.argv.slice(2));
  const existing = readSession();

  if (options.stop) {
    if (existing) stopSession(existing);
    console.log(existing ? 'session stopped' : 'no session');
    return 0;
  }

  if (options.serve) {
    if (existing && (await alive(existing))) {
      console.log(`a session is already running at ${existing.base}, --stop it first`);
      return 1;
    }
    const base = options.url ?? `http://localhost:${options.port}`;
    const pids: number[] = [];
    if (!options.url) {
      const vite = startServer(options.port);
      pids.push(vite.pid!);
    }
    await until('the dev server', 60, async () => (await fetch(`${base}/`)).ok);
    const profile = join(tmpdir(), 'se-shot-profile');
    rmSync(profile, { recursive: true, force: true });
    const debugging = 9300 + Math.floor(Math.random() * 90);
    const chrome = startChrome(debugging, profile, options);
    pids.push(chrome.pid!);
    writeFileSync(SESSION, JSON.stringify({ base, debugging, pids } satisfies Session));
    const cdp = await connect(debugging);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await run(cdp, base, options, true);
    cdp.close();
    console.log(`session running at ${base}, Chrome on ${debugging}; npm run shot -- <steps> reuses it, npm run shot -- --stop ends it`);
    const end = (): void => {
      stopSession({ base, debugging, pids });
      process.exit(0);
    };
    process.on('SIGINT', end);
    process.on('SIGTERM', end);
    await new Promise(() => undefined);
    return 0;
  }

  if (existing && (await alive(existing))) {
    const cdp = await connect(existing.debugging);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await run(cdp, existing.base, options, options.fresh);
    cdp.close();
    if (cdp.errors.length > 0) console.error(`${cdp.errors.length} page error(s):\n${cdp.errors.join('\n')}`);
    return cdp.errors.length > 0 ? 1 : 0;
  }
  if (existing) rmSync(SESSION, { force: true });

  const base = options.url ?? `http://localhost:${options.port}`;
  if (!options.url) children.push(startServer(options.port));
  await until('the dev server', 60, async () => (await fetch(`${base}/`)).ok);
  const profile = join(tmpdir(), `se-shot-${process.pid}`);
  scratch.push(profile);
  const debugging = 9400 + Math.floor(Math.random() * 400);
  children.push(startChrome(debugging, profile, options));
  const cdp = await connect(debugging);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await run(cdp, base, options, true);
  cdp.close();
  if (cdp.errors.length > 0) console.error(`${cdp.errors.length} page error(s):\n${cdp.errors.join('\n')}`);
  return cdp.errors.length > 0 ? 1 : 0;
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
