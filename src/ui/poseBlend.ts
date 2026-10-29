import type { Pose } from '../animals/types.ts';

export const BLEND_SECONDS = 0.45;

interface Held {
  identity: number;
  state: number;
  from: Pose;
  last: Pose;
  at: number;
  seen: number;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

export class PoseBlender {
  private held = new Map<number, Held>();
  private sweep = 0;

  begin(): void {
    this.sweep += 1;
  }

  blend(slot: number, identity: number, state: number, target: Pose, now: number): Pose {
    let entry = this.held.get(slot);
    if (!entry || entry.identity !== identity) {
      entry = { identity, state, from: target, last: target, at: -Infinity, seen: this.sweep };
      this.held.set(slot, entry);
    }
    entry.seen = this.sweep;
    if (entry.state !== state) {
      entry.state = state;
      entry.from = entry.last;
      entry.at = now;
    }
    const t = (now - entry.at) / BLEND_SECONDS;
    if (t >= 1) {
      entry.last = target;
      return target;
    }
    const k = smooth(Math.max(0, t));
    const out: Pose = [
      entry.from[0] + (target[0] - entry.from[0]) * k,
      entry.from[1] + (target[1] - entry.from[1]) * k,
      entry.from[2] + (target[2] - entry.from[2]) * k,
      entry.from[3] + (target[3] - entry.from[3]) * k,
    ];
    entry.last = out;
    return out;
  }

  end(): void {
    for (const [slot, entry] of this.held) if (entry.seen !== this.sweep) this.held.delete(slot);
  }
}
