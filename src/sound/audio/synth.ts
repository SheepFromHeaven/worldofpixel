import { hertz } from '../music/theory.ts';
import type { Patch } from '../music/types.ts';

/**
 * One note, built out of oscillators and torn down again when it has finished sounding.
 *
 * A voice per note rather than a pool of them kept running: the Web Audio graph is cheap to
 * build and the alternative is a stealing policy, which is a lot of machinery for a soundtrack
 * that never plays more than a dozen notes at once. Everything is scheduled against the audio
 * clock — `at` is a time on `ctx.currentTime`, never "now" — because the main thread stutters
 * whenever a chunk of ground is baked, and a tune that followed the main thread would stutter
 * with it.
 *
 * The corner of the filter follows the note (`tracking`), or a patch tuned on middle C comes
 * out muffled two octaves down and shrill two octaves up: one voice, not three.
 */

export type Bus = {
  readonly ctx: BaseAudioContext;
  /** Where a voice's dry signal goes. */
  readonly dry: GainNode;
  /** The send into the echo. */
  readonly echo: GainNode;
  readonly master: GainNode;
};

/**
 * One playback's worth of the bus, so stopping it can actually stop it.
 *
 * A note is handed to the audio clock before it sounds and goes on ringing through its release
 * afterwards — a pad's is two and a half seconds — so a transport that merely stops *scheduling*
 * leaves the old piece sounding over the new one. There is nothing to cancel a scheduled voice
 * with once it is in the graph, so each playback gets its own pair of gains and is faded out
 * through them: everything already in flight goes quiet together, and the echo it has already
 * fed into the delay rings away on its own, which is what a room does.
 */
export type Channel = Bus & { readonly fade: (over: number) => void };

export function openChannel(bus: Bus): Channel {
  const dry = bus.ctx.createGain();
  const echo = bus.ctx.createGain();
  dry.connect(bus.dry);
  echo.connect(bus.echo);

  const fade = (over: number): void => {
    const now = bus.ctx.currentTime;
    for (const node of [dry, echo]) {
      node.gain.cancelScheduledValues(now);
      node.gain.setValueAtTime(node.gain.value, now);
      node.gain.linearRampToValueAtTime(0, now + over);
    }
    window.setTimeout(
      () => {
        dry.disconnect();
        echo.disconnect();
      },
      (over + 0.2) * 1000,
    );
  };

  return { ctx: bus.ctx, dry, echo, master: bus.master, fade };
}

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

/** Two seconds of it, looped. Long enough that the loop is not heard as a pitch. */
function noise(ctx: BaseAudioContext): AudioBuffer {
  const held = noiseBuffers.get(ctx);
  if (held) return held;

  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let rolled = 0;
  for (let index = 0; index < data.length; index += 1) {
    const white = Math.random() * 2 - 1;
    rolled = (rolled + white * 0.4) * 0.92;
    // Mostly white, with a little of the darker noise under it. Every voice that uses this
    // puts a band filter in front of it, so the source has to carry energy everywhere the band
    // might sit: rolled off towards brown — which it was — a hi-hat at twelve kilohertz is
    // filtering a part of the spectrum that is not there, and comes out silent.
    data[index] = white * 0.7 + rolled * 1.2;
  }

  noiseBuffers.set(ctx, buffer);
  return buffer;
}

/** Where the curve stops being a straight line. */
const KNEE = 0.6;
const CURVE_POINTS = 2048;

export function softClip(): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(CURVE_POINTS * Float32Array.BYTES_PER_ELEMENT));
  for (let index = 0; index < CURVE_POINTS; index += 1) {
    const x = (index / (CURVE_POINTS - 1)) * 4 - 2;
    const over = Math.abs(x) - KNEE;
    curve[index] =
      over <= 0 ? x : Math.sign(x) * (KNEE + (1 - KNEE) * Math.tanh(over / (1 - KNEE)));
  }
  return curve;
}

/**
 * The master chain: everything dry, plus a delay that feeds itself.
 *
 * The echo is one send for the whole piece rather than a delay per voice — a room is a property
 * of the room, and twenty copies of it are twenty times the work for a sound that is muddier.
 */
export function createBus(
  ctx: BaseAudioContext,
  destination: AudioNode = ctx.destination,
): Bus {
  const master = ctx.createGain();
  master.gain.value = 1;

  /*
   * The whole mix is trimmed before the master, because a piece with eight voices sounding at
   * once has eight times the headroom of the one note a patch is tuned on. Left at full it
   * clipped on the bars where the pad, the bells and the melody land together — and a limiter
   * is not the answer to that: it is there for the one chord that slips through, not to be
   * leant on for forty seconds at a time.
   */
  const mix = ctx.createGain();
  mix.gain.value = 0.36;
  mix.connect(master);

  /*
   * The last thing before the speakers, and the only thing that actually guarantees anything.
   *
   * A compressor has no lookahead, so however short its attack a kick's first millisecond goes
   * straight past it — which is where the few clipped samples in every drum piece came from.
   * Everything under `KNEE` passes through untouched and anything above it rounds off towards
   * one, so a transient saturates the way it would on tape instead of being sliced flat. The
   * alternative was trimming each piece until its loudest single sample fitted, which made the
   * pieces with drums in them quieter than the ones without.
   */
  const shaper = ctx.createWaveShaper();
  shaper.curve = softClip();
  shaper.oversample = '4x';

  // Catches the one moment a pad swell and a bell land together; it is not there to squash.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -12;
  limiter.knee.value = 18;
  limiter.ratio.value = 4;
  limiter.attack.value = 0.004;
  limiter.release.value = 0.3;

  const dry = ctx.createGain();
  const echo = ctx.createGain();

  const delay = ctx.createDelay(2);
  delay.delayTime.value = 0.36;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.34;
  // The repeats darken as they go, which is what a room does and what keeps them out of the way.
  const damp = ctx.createBiquadFilter();
  damp.type = 'lowpass';
  damp.frequency.value = 1800;

  echo.connect(delay);
  delay.connect(damp);
  damp.connect(feedback);
  feedback.connect(delay);
  damp.connect(mix);
  dry.connect(mix);
  master.connect(limiter);
  limiter.connect(shaper);
  shaper.connect(destination);

  return { ctx, dry, echo, master };
}

/**
 * The pitch envelope, as a curve: start high, slide to the note.
 *
 * Exponential, because pitch is heard that way — a linear slide through two octaves spends most
 * of its time in the top one and reads as a chirp rather than a thump. Written out here rather
 * than left to the ramp alone so the wiki can draw the same curve the voice follows.
 */
export function fallAt(patch: Patch, settled: number, seconds: number, ceiling = Infinity): number {
  if (patch.drop <= 0 || patch.dropTime <= 0) return settled;
  const from = Math.min(ceiling, settled * 2 ** (patch.drop / 1200));
  const through = Math.max(0, Math.min(1, seconds / patch.dropTime));
  return from * (Math.max(1, settled) / from) ** through;
}

function fall(
  param: AudioParam,
  settled: number,
  patch: Patch,
  at: number,
  sampleRate: number,
): void {
  if (patch.drop <= 0 || patch.dropTime <= 0) return;
  param.setValueAtTime(fallAt(patch, settled, 0, sampleRate / 2 - 100), at);
  param.exponentialRampToValueAtTime(Math.max(1, settled), at + patch.dropTime);
}

export function playVoice(
  bus: Bus,
  patch: Patch,
  pitch: number,
  velocity: number,
  at: number,
  duration: number,
): void {
  const { ctx } = bus;
  const level = ctx.createGain();
  level.gain.value = 0;

  const filter = ctx.createBiquadFilter();
  filter.type = patch.wave === 'noise' ? 'bandpass' : 'lowpass';
  filter.frequency.value = Math.max(
    40,
    Math.min(ctx.sampleRate / 2 - 100, patch.cutoff * 2 ** ((patch.tracking * (pitch - 60)) / 12)),
  );
  filter.Q.value = Math.max(0.0001, patch.resonance);
  filter.connect(level);

  const sources: AudioScheduledSourceNode[] = [];

  if (patch.wave === 'noise') {
    const source = ctx.createBufferSource();
    source.buffer = noise(ctx);
    source.loop = true;
    // Noise has no pitch, so the note picks where the band sits instead.
    const band = Math.max(80, Math.min(16000, hertz(pitch) * 8));
    filter.frequency.value = band;
    fall(filter.frequency, band, patch, at, ctx.sampleRate);
    source.connect(filter);
    source.start(at);
    sources.push(source);
  } else {
    for (const side of [-0.5, 0.5]) {
      const osc = ctx.createOscillator();
      osc.type = patch.wave;
      osc.frequency.value = hertz(pitch);
      fall(osc.frequency, hertz(pitch), patch, at, ctx.sampleRate);
      osc.detune.value = patch.spread * side;
      osc.connect(filter);
      osc.start(at);
      sources.push(osc);

      if (patch.vibrato > 0 && patch.vibratoRate > 0) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = patch.vibratoRate;
        const depth = ctx.createGain();
        depth.gain.value = patch.vibrato;
        lfo.connect(depth);
        depth.connect(osc.detune);
        lfo.start(at);
        sources.push(lfo);
      }
    }
  }

  const peak = Math.max(0.0001, patch.gain * velocity);
  const sustain = peak * patch.sustain;
  const attack = at + patch.attack;
  const decayed = attack + patch.decay;
  // A note shorter than its own attack is released from wherever the swell had got to, not from
  // the peak it never reached — otherwise a staccato pad is louder than a held one.
  const off = Math.max(at + duration, at + 0.02);
  const end = off + patch.release;

  level.gain.setValueAtTime(0, at);
  if (off <= attack) {
    level.gain.linearRampToValueAtTime(peak * ((off - at) / Math.max(0.001, patch.attack)), off);
  } else {
    level.gain.linearRampToValueAtTime(peak, attack);
    if (off <= decayed) {
      const through = (off - attack) / Math.max(0.001, patch.decay);
      level.gain.linearRampToValueAtTime(peak + (sustain - peak) * through, off);
    } else {
      level.gain.linearRampToValueAtTime(sustain, decayed);
      level.gain.setValueAtTime(sustain, off);
    }
  }
  level.gain.linearRampToValueAtTime(0, end);

  level.connect(bus.dry);
  if (patch.echo > 0) {
    const send = ctx.createGain();
    send.gain.value = patch.echo;
    level.connect(send);
    send.connect(bus.echo);
  }

  for (const source of sources) source.stop(end + 0.05);
  // One source owns the teardown; the rest fall away with it.
  const first = sources[0];
  if (first) first.onended = (): void => level.disconnect();
}
