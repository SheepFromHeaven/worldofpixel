import type { Calendar } from './calendar.ts';

const SPEED_STEPS = 3;

export class Clock {
  speed = 1;
  playTime = 0;
  private resume = 1;
  private before = 0;
  private holding = false;
  private readonly listeners = new Set<() => void>();

  constructor(readonly calendar: Calendar) {}

  get held(): boolean {
    return this.holding;
  }

  get saved(): number {
    return this.holding ? this.before : this.speed;
  }

  carry(speed: number, playTime: number): void {
    this.speed = speed;
    this.playTime = playTime;
    this.resume = speed > 0 ? speed : 1;
  }

  set(speed: number): boolean {
    if (this.holding) return false;
    if (speed > 0) this.resume = speed;
    this.speed = speed;
    return true;
  }

  toggle(): boolean {
    return this.set(this.speed > 0 ? 0 : this.resume);
  }

  cycle(): boolean {
    return this.set((this.speed % SPEED_STEPS) + 1);
  }

  hold(): void {
    if (this.holding) return;
    this.holding = true;
    this.before = this.speed > 0 ? this.speed : this.resume;
    this.speed = 0;
  }

  release(): void {
    this.holding = false;
    this.set(this.before);
  }

  onChange(listener: () => void): void {
    this.listeners.add(listener);
  }

  changed(): void {
    for (const listener of this.listeners) listener();
  }
}
