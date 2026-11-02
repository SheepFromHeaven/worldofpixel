import { createBus, openChannel, playVoice } from './synth.ts';
import type { Bus, Channel } from './synth.ts';
import { secondsPerBeat, songBeats } from '../music/types.ts';
import type { Song } from '../music/types.ts';

/**
 * The transport: a song, a clock and a window of lookahead.
 *
 * Notes are handed to the audio clock a quarter of a second before they sound, in steps of a
 * sixteenth of a beat, which is the standard shape of this and for the standard reason — a
 * `setTimeout` per note is at the mercy of whatever the main thread is doing, and the main
 * thread here bakes chunks of ground. Within a step each note is still scheduled at its own
 * exact time, so the window costs nothing in accuracy.
 *
 * The scheduler re-reads the song on every step rather than flattening it once, which is what
 * lets the composer move a note while the piece is playing and hear it on the next bar.
 */

const LOOKAHEAD = 0.25;
const INTERVAL = 50;
const STEP = 1 / 16;

/** How long a cut takes: short enough to read as a stop, long enough not to click. */
const CUT = 0.08;

export class Player {
  readonly bus: Bus;

  private song: Song | null = null;
  private timer: number | null = null;
  /** Beats scheduled up to. */
  private cursor = 0;
  /** When the cursor's beat falls, on the audio clock. */
  private nextTime = 0;
  private running = false;

  /** Whether the piece starts again by itself, or hands back to whoever queued it. */
  loop = false;
  onEnd: (() => void) | null = null;

  /** The voices sounding now. Replaced whenever the playing has to be cut short. */
  private channel: Channel;

  constructor(private readonly ctx: AudioContext) {
    this.bus = createBus(ctx);
    this.channel = openChannel(this.bus);
  }

  get playing(): boolean {
    return this.running;
  }

  get current(): Song | null {
    return this.song;
  }

  /** Where the playhead actually is: the cursor, less whatever has been scheduled ahead of it. */
  get beat(): number {
    if (!this.running || !this.song) return this.cursor;
    const ahead = (this.nextTime - this.ctx.currentTime) / secondsPerBeat(this.song.tempo);
    return Math.max(0, this.cursor - ahead);
  }

  /** Lets the audio clock run: a context built outside a click starts suspended. */
  wake(): void {
    void this.ctx.resume();
  }

  setVolume(volume: number, over = 0.25): void {
    const gain = this.bus.master.gain;
    gain.cancelScheduledValues(this.ctx.currentTime);
    gain.setValueAtTime(Math.max(0.0001, gain.value), this.ctx.currentTime);
    gain.linearRampToValueAtTime(Math.max(0.0001, volume), this.ctx.currentTime + over);
  }

  /** A different piece starts from the top; the same one carries on where it was. */
  setSong(song: Song | null): void {
    const changed = song?.name !== this.song?.name;
    this.song = song;
    if (changed && this.running) this.play(0);
  }

  play(from = 0): void {
    if (!this.song) return;
    void this.ctx.resume();
    // Whatever was sounding is not this; starting one piece stops the other.
    this.silence();

    this.cursor = from;
    // A beat of grace, so the first notes are scheduled rather than already late.
    this.nextTime = this.ctx.currentTime + 0.1;
    this.running = true;

    if (this.timer === null) {
      this.timer = window.setInterval(() => this.tick(), INTERVAL);
    }
    this.tick();
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Stops scheduling *and* cuts what is already sounding.
   *
   * `stop` is the end of a piece, where the last chord is meant to ring out; this is a hand on
   * the strings.
   */
  silence(over = CUT): void {
    this.stop();
    this.channel.fade(over);
    this.channel = openChannel(this.bus);
  }

  /** Silences, and leaves the playhead where it was rather than at the top. */
  pause(): void {
    const at = this.beat;
    this.silence();
    this.cursor = at;
  }

  seek(beat: number): void {
    if (this.running) this.play(beat);
    else this.cursor = beat;
  }

  private tick(): void {
    const song = this.song;
    if (!song || !this.running) return;

    const length = songBeats(song);
    const perBeat = secondsPerBeat(song.tempo);

    while (this.nextTime < this.ctx.currentTime + LOOKAHEAD) {
      this.schedule(song, this.cursor, Math.min(this.cursor + STEP, length), this.nextTime);

      const step = Math.min(STEP, length - this.cursor);
      this.cursor += step;
      this.nextTime += step * perBeat;

      if (this.cursor >= length - 1e-9) {
        if (!this.loop) {
          // The tail of the last notes is still sounding; only the scheduling is over.
          this.stop();
          this.cursor = 0;
          this.onEnd?.();
          return;
        }
        this.cursor = 0;
      }
    }
  }

  private schedule(song: Song, from: number, to: number, at: number): void {
    const perBeat = secondsPerBeat(song.tempo);

    for (const track of song.tracks) {
      if (track.muted || track.gain <= 0) continue;
      for (const note of track.notes) {
        if (note.at < from || note.at >= to) continue;
        playVoice(
          this.channel,
          track.patch,
          note.pitch,
          note.velocity * track.gain,
          at + (note.at - from) * perBeat,
          note.length * perBeat,
        );
      }
    }
  }
}
