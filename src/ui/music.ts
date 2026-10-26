import { Player } from '../audio/player.ts';
import { SONGS } from '../music/songs/index.ts';

/**
 * The soundtrack, as the game sees it: on or off, and how loud.
 *
 * Two things make this more than a call to `play`. A browser will not let a page make a sound
 * before the player has touched it, so the audio graph cannot exist until the first click —
 * which is why nothing here is built until `ensure`, and why a game that remembers the music
 * was on waits for any click at all before starting it. And a loop that never stops is a loop
 * that gets switched off: the pieces are played one after another with a rest between them, so
 * the town is quiet for a while before the music comes back.
 */

const KEY = 'scribble-empire/music';
const REST_SECONDS = 20;

type Settings = { on: boolean; volume: number };

const DEFAULTS: Settings = { on: true, volume: 0.7 };

function read(): Settings {
  try {
    const text = window.localStorage.getItem(KEY);
    if (!text) return DEFAULTS;
    const saved = JSON.parse(text) as Partial<Settings>;
    return {
      on: typeof saved.on === 'boolean' ? saved.on : DEFAULTS.on,
      volume:
        typeof saved.volume === 'number' ? Math.max(0, Math.min(1, saved.volume)) : DEFAULTS.volume,
    };
  } catch {
    return DEFAULTS;
  }
}

function write(settings: Settings): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Private browsing refuses to keep it. The music still plays; it just forgets by morning.
  }
}

export type MusicState = Settings & { playing: string | null };

class Soundtrack {
  private settings = read();
  private player: Player | null = null;
  private next = 0;
  private resting: number | null = null;
  private snapshot: MusicState = { ...this.settings, playing: null };
  private wired = false;
  private readonly listeners = new Set<() => void>();

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): MusicState => this.snapshot;

  /**
   * Starts the music if it was left on, the moment the player touches anything.
   *
   * Once: a listener that kept firing would restart the piece on every click, and the gesture
   * only has to be spent once to unlock the audio clock.
   */
  armed(): void {
    // The shell is mounted again every time a world is opened; the listener is wanted once.
    if (this.wired || !this.settings.on) return;
    this.wired = true;
    const wake = (): void => {
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
      if (this.settings.on) this.begin();
    };
    window.addEventListener('pointerdown', wake, { once: true });
    window.addEventListener('keydown', wake, { once: true });
  }

  setOn(on: boolean): void {
    this.settings = { ...this.settings, on };
    write(this.settings);
    if (on) this.begin();
    else this.silence();
    this.publish();
  }

  setVolume(volume: number): void {
    this.settings = { ...this.settings, volume: Math.max(0, Math.min(1, volume)) };
    write(this.settings);
    this.player?.setVolume(this.settings.volume, 0.08);
    this.publish();
  }

  /** The next piece now, rather than waiting out the one that is playing. */
  skip(): void {
    if (this.settings.on) this.begin();
  }

  private begin(): void {
    const player = this.ensure();
    if (this.resting !== null) {
      window.clearTimeout(this.resting);
      this.resting = null;
    }

    const song = SONGS[this.next % SONGS.length];
    if (!song) return;
    this.next += 1;

    player.setVolume(this.settings.volume, 0.5);
    player.setSong(song);
    player.play(0);
    this.publish();
  }

  private silence(): void {
    if (this.resting !== null) {
      window.clearTimeout(this.resting);
      this.resting = null;
    }
    // Over half a second rather than cut: switching the music off is not a piece ending.
    this.player?.silence(0.6);
    this.publish();
  }

  private ensure(): Player {
    if (this.player) return this.player;

    const player = new Player(new AudioContext());
    player.onEnd = (): void => {
      this.publish();
      this.resting = window.setTimeout(() => {
        this.resting = null;
        if (this.settings.on) this.begin();
      }, REST_SECONDS * 1000);
    };

    this.player = player;
    return player;
  }

  private publish(): void {
    const playing = this.player?.playing ? (this.player.current?.name ?? null) : null;
    this.snapshot = { ...this.settings, playing };
    for (const listener of this.listeners) listener();
  }
}

export const music = new Soundtrack();
