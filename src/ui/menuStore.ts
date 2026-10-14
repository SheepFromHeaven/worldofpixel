import { useSyncExternalStore } from 'react';

export type MenuTarget =
  | { kind: 'root' }
  | { kind: 'node'; id: string }
  | { kind: 'connection'; id: string };

export interface MenuState {
  /** Pixels inside the canvas container, for placing the menu itself. */
  screen: { x: number; y: number };
  /** Area coordinates, for placing a node where the click landed. */
  area: { x: number; y: number };
  target: MenuTarget;
}

type Listener = () => void;

class MenuStore {
  private state: MenuState | null = null;
  private listeners = new Set<Listener>();

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  get = (): MenuState | null => this.state;

  open(state: MenuState): void {
    this.state = state;
    this.emit();
  }

  close(): void {
    if (!this.state) return;
    this.state = null;
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

export const menuStore = new MenuStore();

export function useMenu(): MenuState | null {
  return useSyncExternalStore(menuStore.subscribe, menuStore.get);
}
