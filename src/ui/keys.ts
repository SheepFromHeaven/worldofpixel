export const ACTIONS = ['cancel', 'togglePause', 'cycleSpeed', 'radial', 'deeper', 'shallower'] as const;

export type Action = (typeof ACTIONS)[number];

export type KeyPhase = 'press' | 'release';

export type KeyHandler = (phase: KeyPhase) => boolean | void;

export const DEFAULT_KEYS: Readonly<Record<Action, readonly string[]>> = {
  cancel: ['Escape'],
  togglePause: ['Space'],
  cycleSpeed: ['Tab'],
  radial: ['KeyE'],
  deeper: ['Period', 'PageDown'],
  shallower: ['Comma', 'PageUp'],
};

function typing(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

export class KeyController {
  private readonly codes = new Map<Action, string[]>();
  private readonly handlers = new Map<Action, KeyHandler[]>();
  private readonly held = new Set<string>();

  constructor(defaults: Readonly<Record<Action, readonly string[]>> = DEFAULT_KEYS) {
    for (const action of ACTIONS) this.codes.set(action, [...defaults[action]]);
  }

  codesFor(action: Action): readonly string[] {
    return this.codes.get(action) ?? [];
  }

  actionFor(code: string): Action | undefined {
    return ACTIONS.find((action) => this.codesFor(action).includes(code));
  }

  rebind(action: Action, ...codes: string[]): void {
    for (const other of ACTIONS) {
      const kept = this.codesFor(other).filter((code) => !codes.includes(code));
      this.codes.set(other, other === action ? [...codes] : kept);
    }
  }

  bind(action: Action, ...codes: string[]): void {
    this.rebind(action, ...this.codesFor(action), ...codes);
  }

  unbind(action: Action): void {
    this.codes.set(action, []);
  }

  on(action: Action, handler: KeyHandler): () => void {
    const list = this.handlers.get(action) ?? [];
    list.push(handler);
    this.handlers.set(action, list);
    return () => {
      const at = list.indexOf(handler);
      if (at >= 0) list.splice(at, 1);
    };
  }

  attach(target: Window): () => void {
    const down = (event: KeyboardEvent): void => this.dispatch(event, 'press');
    const up = (event: KeyboardEvent): void => this.dispatch(event, 'release');
    target.addEventListener('keydown', down);
    target.addEventListener('keyup', up);
    return () => {
      target.removeEventListener('keydown', down);
      target.removeEventListener('keyup', up);
    };
  }

  private dispatch(event: KeyboardEvent, phase: KeyPhase): void {
    if (typing(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;

    const action = this.actionFor(event.code);
    if (!action) return;
    event.preventDefault();

    if (phase === 'press') {
      if (event.repeat || this.held.has(event.code)) return;
      this.held.add(event.code);
    } else if (!this.held.delete(event.code)) {
      return;
    }

    const list = this.handlers.get(action) ?? [];
    for (let at = list.length - 1; at >= 0; at -= 1) if (list[at]!(phase) === true) return;
  }
}
