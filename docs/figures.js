import * as Model from './model.js';

/**
 * Every figure on the page, drawn on the game's own pixel buffer in the game's own palette.
 *
 * The curves are not illustrations: each one is sampled from `model.js`, so a figure and the
 * design it argues for cannot drift apart. `pixel/core.js`, `pixel/art.js` and `pixel/scenes.js`
 * are loaded as classic scripts before this one and leave `Buf`, `P`, `icon` and `MOCK` on the
 * global scope.
 */

const UI = {
  pane: P.earthD,
  face: P.ink2,
  rail: P.earth2,
  text: P.bone,
  dim: P.bone2,
  ink: P.ink,
};

function panel(b, x, y, w, h, title) {
  b.rect(x, y, w, h, UI.ink);
  b.rect(x + 1, y + 1, w - 2, h - 2, UI.pane);
  if (title !== undefined) {
    b.rect(x + 1, y + 1, w - 2, 9, UI.rail);
    text(b, x + 3, y + 3, title, UI.text);
  }
}

/* A 3x5 bitmap face, so a figure can label itself without reaching for the DOM. */
const GLYPHS = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '101111111111101', O: '010101101101010',
  P: '110101110100100', Q: '010101101111011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101011', V: '101101101010010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100110101010', 7: '111001010010010', 8: '010101010101010',
  9: '010101011001110', '.': '000000000000010', ',': '000000000010100', '-': '000000111000000', '+': '000010111010000',
  '%': '101001010100101', ':': '000010000010000', '/': '001001010100100', '>': '100010001010100', '<': '001010100010001',
  '?': '110001010000010', '!': '010010010000010', '=': '000111000111000', '(': '001010010010001', ')': '100010010010100',
  ' ': '000000000000000', "'": '010010000000000', '*': '000101010101000',
};
function text(b, x, y, s, c, spacing = 1) {
  let cx = x;
  for (const ch of String(s).toUpperCase()) {
    const g = GLYPHS[ch];
    if (g) for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === '1') b.px(cx + i, y + j, c);
    cx += 4 + (spacing - 1);
  }
  return cx;
}
const textW = (s, spacing = 1) => String(s).length * (4 + spacing - 1) - (spacing - 1) - 1;

function slider(b, x, y, w, v, c = P.ember2, label) {
  b.rect(x, y + 2, w, 3, P.earthD);
  b.rect(x, y + 2, w, 1, UI.ink);
  const k = Math.round(x + clamp(v) * (w - 3));
  b.rect(x, y + 2, k - x, 3, lit(c, 0.6));
  b.rect(k, y, 3, 7, c);
  b.rect(k, y, 1, 7, lit(c, 1.3));
  if (label) text(b, x + w + 4, y + 1, label, UI.dim);
}

function chart(b, x, y, w, h, opts) {
  b.rect(x, y, w, h, UI.ink);
  b.rect(x + 1, y + 1, w - 2, h - 2, P.earthD);
  const X = (u) => x + 2 + u * (w - 5);
  const Y = (v) => y + h - 3 - clamp(v) * (h - 6);
  for (const band of opts.bands || []) {
    const x0 = X(band.a), x1 = X(band.b);
    b.brect(x0, y + 2, Math.max(1, x1 - x0), h - 4, band.c || P.bad, band.alpha ?? 0.22);
  }
  for (const line of opts.lines || []) {
    let px = null, py = null;
    for (let i = 0; i <= opts.samples; i++) {
      const u = i / opts.samples;
      const v = line.f(u);
      if (v === null) {
        px = null;
        continue;
      }
      const cx = X(u), cy = Y(v);
      if (px !== null) b.line(px, py, cx, cy, line.c);
      else b.px(cx, cy, line.c);
      px = cx;
      py = cy;
    }
  }
  for (const m of opts.marks || []) {
    const cx = X(m.u), cy = Y(m.v);
    b.rect(cx - 1, y + 2, 1, h - 4, mix(m.c || P.bone, UI.ink, 0.45));
    b.rect(cx - 2, cy - 2, 4, 4, UI.ink);
    b.rect(cx - 1, cy - 1, 2, 2, m.c || P.bone);
    if (m.label) text(b, Math.min(cx + 4, x + w - textW(m.label) - 3), Math.max(y + 3, cy - 9), m.label, m.c || P.bone);
  }
  return { X, Y };
}

/* ---------------------------------------------------------------- the rig */

const KILN_SECTION = (b, x, y, T, starved, t) => {
  const g = glowOfBuf(T);
  for (let j = 0; j < 54; j++) {
    const hw = 26 - Math.pow(j / 54, 2.2) * 6;
    b.rect(x - hw, y - j, hw * 2, 1, j > 46 ? P.earth : P.earth3);
  }
  b.rect(x - 19, y - 46, 38, 44, P.char);
  const heat = clamp((T - 300) / 900);
  for (let j = 0; j < 42; j++)
    for (let i = -18; i < 18; i++) {
      const u = 1 - j / 42;
      const n = hash2(i, j, 2);
      if (n > 0.35 + u * 0.3) continue;
      b.px(x + i, y - 3 - j, mix(P.char2, g, clamp(heat * (0.45 + u * 0.75) + (n - 0.2))));
    }
  for (let r = 0; r < 3; r++)
    for (let k = 0; k < 4; k++) {
      const px = x - 14 + k * 9 + (r % 2) * 4, py = y - 12 - r * 10;
      b.ell(px, py, 3.4, 4, mix(P.clay, g, heat * 0.8));
      b.rect(px - 2, py - 6, 4, 2, mix(P.clay, g, heat * 0.7));
    }
  b.rect(x - 7, y - 2, 14, 10, P.char);
  flames(b, x, y + 6, 6, 4 + heat * 16, t);
  b.rect(x - 6, y - 57, 12, 11, P.earth2);
  b.rect(x - 4, y - 57, 8, 11, P.char);
  for (let k = 0; k < 6; k++) {
    const ph = (t * 0.55 + k / 6) % 1;
    const c = starved ? P.smokeY : T > 700 ? P.smokeB : P.smoke;
    b.bell(x + ph * 12 - 2, y - 60 - ph * 30, 2 + ph * 5, (2 + ph * 5) * 0.8, c, (starved ? 0.62 : 0.3) * (1 - ph));
  }
};
const glowOfBuf = (T) => {
  const g = Model.glowOf(T);
  return C(g.hex);
};

/**
 * Ware worth keeping out of one kiln setting — the thing the player is really choosing between,
 * and the thing the town measures by watching the store fill.
 *
 * Counted by worth rather than by head: below ceramic change nothing is a pot at all, and a soft
 * pot leaks and breaks often enough to be worth about half a hard one. Without that weighting the
 * three settings come out at the same rate and the choice looks like no choice.
 */
const WORTH = { raw: 0, soft: 0.45, good: 1, hard: 1.15 };
function potRun(damper) {
  const f = Model.fire({ ...Model.RIGS.updraft.build, fuel: 'charcoal', damper, fuelRate: 1.2 });
  const c = Model.clay({ temper: 0.2, dryRate: 0.3, rampLow: 0.25, ramp573: 0.25, peak: f.T, hold: 20 });
  const grade = f.T < 600 ? 'raw' : c.grade;
  return { T: f.T, grade, rate: (6 * (1 - c.loss) * WORTH[grade]) / 1.2 };
}

/* ------------------------------------------------------------ the hand

 * The controls, drawn the way the game draws everything else.
 *
 * No sliders, no percentages, no panels with title bars. A setting is a picture of the state you
 * are choosing, scratched on the same sandstone the ledger is cut into, and the thing itself is
 * the readout. These helpers are the whole vocabulary.
 */

/** The town's writing surface. Sandstone while it is a fire and a few works. */
function slab(b, x, y, w, h) {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const n = hash2(x + i, y + j, 11);
      b.px(x + i, y + j, n > 0.88 ? P.sandL : n < 0.14 ? P.sand2 : P.sand);
    }
  for (let i = 0; i < w; i++) {
    b.px(x + i, y, lit(P.sand2, 0.8));
    b.px(x + i, y + h - 1, P.sandL);
  }
}

/** Incised, not printed: the groove is cut dark and its far wall catches the top-left sun. */
function scratch(b, x0, y0, x1, y1) {
  b.line(x0, y0, x1, y1, lit(P.sand2, 0.62));
  b.line(x0 + 1, y0 + 1, x1 + 1, y1 + 1, P.sandL);
}

/** A choice is circled, the way anyone would circle one. */
function circled(b, x, y, w, h) {
  const pts = [];
  for (let a = 0; a < 46; a++) {
    const t = (a / 46) * Math.PI * 2;
    pts.push([x + w / 2 + Math.cos(t) * (w / 2 + 1), y + h / 2 + Math.sin(t) * (h / 2 + 1)]);
  }
  pts.forEach(([px, py], i) => {
    if (i % 5 === 4) return;
    b.px(px, py, lit(P.sand2, 0.55));
    b.px(px + 1, py + 1, P.sandL);
  });
}

/** Counting before counting: four scratches and one laid across them. */
function tally(b, x, y, n, h = 7) {
  let cx = x;
  for (let i = 0; i < n; i++) {
    const g = i % 5;
    if (g === 4) {
      scratch(b, cx - 11, y + h, cx - 1, y);
      cx += 5;
    } else {
      scratch(b, cx, y, cx, y + h);
      cx += 3;
    }
  }
  return cx;
}

/** A fire at one of its bankings. The control and the readout are the same drawing. */
function fireState(b, cx, by, level, t, dim = false) {
  const heat = [0.18, 0.6, 1][level];
  const bed = dim ? mix(P.char, P.sand, 0.45) : P.char;
  b.ell(cx, by, 12, 3.5, bed);
  for (let i = -11; i <= 11; i += 2) {
    const g = Math.sin(t * 5 + i + level) * 0.5 + 0.5;
    const c = level === 0 ? (g > 0.6 ? P.ember : P.glowR) : g > 0.5 ? P.flame : P.ember2;
    b.px(cx + i, by - 1 + (hash2(i, level, 3) > 0.5 ? 1 : 0), dim ? mix(c, P.sand, 0.5) : c);
  }
  const h = 4 + heat * 19;
  for (let i = -Math.round(2 + heat * 5); i <= Math.round(2 + heat * 5); i++) {
    const hh = h * (1 - Math.abs(i) / (3 + heat * 6)) * (0.72 + 0.28 * Math.sin(t * 8 + i * 1.4 + level));
    for (let yy = 0; yy < hh; yy++) {
      const u = yy / Math.max(1, hh);
      let c = level === 2 ? (u < 0.5 ? P.flameW : u < 0.82 ? P.flame : P.ember2)
        : level === 1 ? (u < 0.3 ? P.flame : u < 0.75 ? P.ember2 : P.ember)
        : u < 0.5 ? P.ember : P.glowR;
      b.px(cx + i + Math.sin(t * 6 + yy * 0.5) * u * 1.2, by - 2 - yy, dim ? mix(c, P.sand, 0.55) : c);
    }
  }
}

/** Stock as the stuff itself, with a scratch where the player wants it to stop. */
function shelfRow(b, x, y, w, item, have, cap, markAt) {
  b.rect(x, y + 11, w, 1, P.wood2);
  const step = Math.max(5, Math.floor(w / cap));
  for (let i = 0; i < cap; i++) {
    const ix = x + i * step;
    if (i < have) b.blit(icon(item), ix - 2, y - 1, false, P.sand, 0.1);
    else b.px(ix + 3, y + 10, mix(P.wood2, P.sand, 0.5));
  }
  if (markAt !== undefined) scratch(b, x + markAt * step, y - 3, x + markAt * step, y + 13);
}

const FIG = {
  /** The hero: one rig, its knobs, and the readout they produce. */
  /**
   * The hero, redrawn: the kiln is the readout and the strip below is the control. No slider,
   * no numbers, no panel — you pick the fire you want and the fire becomes it.
   */
  /**
   * The hero, redrawn. The kiln is the readout; the strip below is the control. You pick the
   * fire you want and the kiln becomes it. No slider, no number, no panel with a title bar.
   */
  rig(b, t) {
    b.clear(UI.pane);
    const bank = Math.floor(t * 0.28) % 3;
    const damper = Model.HEAT_SETTINGS.ordinal[bank].damper;
    const out = Model.fire({ ...Model.RIGS.updraft.build, fuel: 'charcoal', damper, fuelRate: 1.2 });
    const run = potRun(damper);

    for (let y = 0; y < 86; y++)
      for (let x = 0; x < b.w; x++) {
        const n = hash2(x, y, 6);
        b.px(x, y, n > 0.9 ? P.earth2 : n < 0.1 ? P.earth : P.earthD);
      }
    KILN_SECTION(b, 70, 82, out.T, out.starved, t);

    slab(b, 0, 86, b.w, b.h - 86);
    for (let i = 0; i < 3; i++) {
      const cx = 28 + i * 46;
      fireState(b, cx, 122, i, t, i !== bank);
      if (i === bank) circled(b, cx - 19, 96, 38, 28);
    }
    scratch(b, 158, 90, 158, b.h - 4);
    // what actually came out, which is the only readout there is
    if (run.grade === 'raw') {
      for (let i = 0; i < 3; i++) b.blit(icon('clay'), 168 + i * 16, 98, false, P.sand, 0.12);
      b.line(172, 102, 198, 124, P.bad, 2);
      b.line(198, 102, 172, 124, P.bad, 2);
    } else {
      const made = Math.max(1, Math.round(run.rate));
      for (let i = 0; i < made; i++) b.blit(icon('pot'), 168 + (i % 4) * 16, 96, false, P.sand, run.grade === 'soft' ? 0.5 : 0.1);
      tally(b, 172, 114, Math.round(run.rate * 2), 8);
    }
  },

  /** Why air is a knob with a best setting rather than one to open wide. */
  airPeak(b, t) {
    b.clear(UI.pane);
    const build = Model.RIGS.updraft.build;
    const at = (u) => Model.fire({ ...build, fuel: 'charcoal', damper: 0.08 + u * 0.92, fuelRate: 1.2 });
    let peak = { T: 0, u: 0 };
    for (let i = 0; i <= 60; i++) {
      const u = i / 60, o = at(u);
      if (!o.starved && o.T > peak.T) peak = { T: o.T, u };
    }
    let starvedTo = 0;
    for (let i = 0; i <= 60; i++) if (at(i / 60).starved) starvedTo = i / 60;

    const cursor = (Math.sin(t * 0.6) * 0.5 + 0.5);
    const now = at(cursor);
    const c = chart(b, 4, 12, b.w - 8, 86, {
      samples: 60,
      bands: [{ a: 0, b: starvedTo, c: P.warn, alpha: 0.18 }],
      lines: [{ f: (u) => at(u).T / 1250, c: P.ember2 }],
      marks: [
        { u: peak.u, v: peak.T / 1250, c: P.flame, label: peak.T + 'C' },
        { u: cursor, v: now.T / 1250, c: P.water },
      ],
    });
    text(b, 4, 4, 'chamber heat against damper, charcoal at 1.2/min', UI.dim);
    text(b, 6, 102, 'starved', P.warn);
    text(b, 6, 110, 'unburnt fuel', UI.dim);
    const lbl = now.starved ? 'smoking' : cursor > peak.u ? 'cold air chilling it' : 'clean';
    text(b, b.w - textW(lbl) - 6, 102, lbl, now.starved ? P.warn : cursor > peak.u ? P.water : P.good);
    text(b, b.w - textW(now.T + 'c at ' + Math.round((0.08 + cursor * 0.92) * 100) + '%') - 6, 110,
      now.T + 'c at ' + Math.round((0.08 + cursor * 0.92) * 100) + '%', UI.text);
  },

  /** The ladder of rigs, each one's ceiling against what the chapter needs. */
  ladder(b, t) {
    b.clear(UI.pane);
    const keys = Object.keys(Model.RIGS);
    const needs = [
      { T: 600, label: 'ceramic' },
      { T: 900, label: 'brick, lime' },
      { T: 1150, label: 'stoneware' },
    ];
    const top = 1300, y0 = 14, y1 = b.h - 16;
    const Y = (T) => y1 - (clamp(T / top) * (y1 - y0));
    for (const n of needs) {
      const y = Y(n.T);
      for (let x = 4; x < b.w - 4; x += 3) b.px(x, y, P.bone2);
      text(b, 6, y - 7, n.label + ' ' + n.T, UI.dim);
    }
    const w = Math.floor((b.w - 16) / keys.length);
    keys.forEach((k, i) => {
      const rig = Model.RIGS[k];
      const e = Model.envelopeOf(rig);
      const x = 8 + i * w;
      const bw = w - 10;
      b.rect(x, Y(e.T), bw, y1 - Y(e.T), UI.ink);
      for (let yy = Y(e.T) + 1; yy < y1; yy++) {
        const T = top * (y1 - yy) / (y1 - y0);
        b.rect(x + 1, yy, bw - 2, 1, glowOfBuf(T));
      }
      b.rect(x, Y(e.T), bw, 2, P.bone);
      text(b, x, Y(e.T) - 8, e.T + 'c', UI.text);
      const words = rig.label.split(' ');
      words.forEach((wd, j) => text(b, x, y1 + 3 + j * 6, wd, UI.dim));
      text(b, x, y1 + 3 + words.length * 6, e.fuel, P.ember2);
    });
    text(b, 4, 4, 'what each rig can reach, at its best setting', UI.dim);
  },

  /** The charcoal trade: let air in for quality, keep it out for yield. */
  clampCurve(b, t) {
    b.clear(UI.pane);
    const at = (u) => Model.char({ vent: 0.03 + u * 0.75, wood: 5 });
    let goodFrom = 1;
    for (let i = 60; i >= 0; i--) if (at(i / 60).grade !== 'brands') goodFrom = i / 60;
    const cursor = (Math.sin(t * 0.55) * 0.5 + 0.5);
    const now = at(cursor);
    chart(b, 4, 12, b.w - 8, 82, {
      samples: 60,
      bands: [{ a: 0, b: goodFrom, c: P.warn, alpha: 0.16 }],
      lines: [
        { f: (u) => at(u).charcoal / 2.2, c: P.ember2 },
        { f: (u) => at(u).carbon, c: P.water },
      ],
      marks: [{ u: cursor, v: at(cursor).carbon, c: P.bone }],
    });
    text(b, 4, 4, 'charcoal clamp: one knob, two things that disagree', UI.dim);
    text(b, 6, 98, 'yield', P.ember2);
    text(b, 44, 98, 'carbon', P.water);
    text(b, 6, 108, 'brands: too cool for a kiln', P.warn);
    const s = now.charcoal + ' from 5, ' + now.grade + ', ' + now.smoke + ' smoke';
    text(b, b.w - textW(s) - 6, 108, s, UI.text);
  },

  /** A trial sweep: one parameter, five small batches, five rows in the book. */
  sweep(b, t) {
    b.clear(UI.pane);
    const N = 5;
    const cycle = (t * 0.22) % (N + 2.2);
    const done = clamp(Math.floor(cycle), 0, N);
    text(b, 4, 4, 'trial: charcoal clamp, sweep vent 0.05 to 0.55, five steps', UI.dim);

    for (let i = 0; i < N; i++) {
      const x = 8 + i * 34;
      const vent = 0.05 + (i / (N - 1)) * 0.5;
      const r = Model.char({ vent, wood: 1 });
      const running = i === done && cycle % 1 < 1;
      const burnt = i < done;
      b.rect(x, 36, 28, 2, P.earth2);
      for (let j = 0; j < 16; j++) {
        const hw = 13 * Math.sqrt(Math.max(0, 1 - Math.pow(j / 16, 2)));
        b.rect(Math.round(x + 14 - hw), 36 - j, Math.round(hw * 2), 1, burnt ? P.char2 : P.earth3);
      }
      if (running || burnt)
        for (let k = 0; k < 4; k++) {
          const ph = (t * 0.7 + k / 4 + i * 0.2) % 1;
          const sc = r.smoke === 'white' ? P.lime : r.smoke === 'yellow' ? P.smokeY : P.smokeB;
          b.bell(x + 14 + ph * 6, 20 - ph * 16, 1.5 + ph * 3.5, (1.5 + ph * 3.5) * 0.8, sc, 0.5 * (1 - ph) * (running ? 1 : 0.35));
        }
      b.rect(x + 2, 40, 24, 2, i <= done ? P.ember : P.earth2);
      text(b, x + 2, 44, vent.toFixed(2), i <= done ? UI.text : UI.dim);
    }

    panel(b, 4, 54, b.w - 8, b.h - 58, 'the book');
    const cols = ['vent', 'heat', 'got', 'grade'];
    cols.forEach((c, i) => text(b, 10 + i * 56, 66, c, UI.dim));
    for (let i = 0; i < done; i++) {
      const vent = 0.05 + (i / (N - 1)) * 0.5;
      const r = Model.char({ vent, wood: 1 });
      const y = 74 + i * 9;
      const row = [vent.toFixed(2), r.T + 'c', r.charcoal.toFixed(1), r.grade];
      row.forEach((v, k) => text(b, 10 + k * 56, y, v, k === 3 ? (r.grade === 'brands' ? P.warn : P.good) : UI.text));
    }
    if (done >= N) {
      const y = 74 + N * 9 + 2;
      b.rect(8, y - 2, b.w - 16, 1, P.earth2);
      text(b, 10, y + 2, 'vent 0.42 is the cheapest that is not brands', P.flame);
    }
  },

  /** You cannot tune what you cannot see. Instruments narrow the band. */
  instruments(b, t) {
    b.clear(UI.pane);
    const real = 940;
    const stages = [
      { name: 'the eye', sub: 'glow colour', lo: 900, hi: 1050, step: 14 },
      { name: 'test ring', sub: 'shrinkage', lo: 900, hi: 975, step: 20 },
      { name: 'cone', sub: 'bends, or does not', lo: 930, hi: 945, step: 25 },
    ];
    const which = Math.floor((t * 0.35) % 3);
    text(b, 4, 4, 'the same firing, read three ways', UI.dim);
    stages.forEach((s, i) => {
      const y = 16 + i * 36;
      const on = i === which;
      b.rect(4, y, b.w - 8, 32, on ? P.earthD : UI.pane);
      if (on) b.rect(4, y, 2, 32, P.ember);
      text(b, 10, y + 4, s.name, on ? UI.text : UI.dim);
      text(b, 10, y + 12, s.sub, UI.dim);
      text(b, 10, y + 22, 'step ' + s.step, UI.dim);
      const x0 = 96, w = b.w - 104;
      const X = (T) => x0 + clamp((T - 500) / 760) * w;
      b.rect(x0, y + 12, w, 7, UI.ink);
      for (let x = 0; x < w; x++) {
        const T = 500 + (x / w) * 760;
        b.rect(x0 + x, y + 13, 1, 5, mix(glowOfBuf(T), UI.ink, on ? 0 : 0.6));
      }
      b.rect(X(s.lo), y + 10, 1, 11, P.bone);
      b.rect(X(s.hi), y + 10, 1, 11, P.bone);
      b.brect(X(s.lo), y + 12, Math.max(1, X(s.hi) - X(s.lo)), 7, P.bone, 0.3);
      if (on) {
        b.rect(X(real) - 1, y + 8, 3, 15, UI.ink);
        b.rect(X(real), y + 9, 1, 13, P.flame);
        const lbl = 'know it to ' + (s.hi - s.lo) + 'c';
        text(b, x0, y + 23, lbl, P.flame);
      }
    });
  },

  /** One rig, several methods, priority and a stock target each. */
  /**
   * The queue, as it would really be kept: what each method makes, and a scratch on the shelf
   * where the town wants it to stop. The fire burns beside the one being worked.
   */
  /**
   * The queue as it would really be kept: what each method makes, and a scratch on the shelf
   * where the town wants it to stop. The fire burns beside the one being worked.
   */
  queue(b, t) {
    b.clear(UI.pane);
    slab(b, 0, 0, b.w, b.h);
    const charcoal = Math.max(0, 6 - Math.floor((t * 0.4) % 11));
    const rows = [
      { item: 'quicklime', need: 'charcoal', have: 10, cap: 10, mark: 10 },
      { item: 'brick', need: 'charcoal', have: 5, cap: 11, mark: 9 },
      { item: 'gbrick', need: 'wood', have: 5, cap: 11, mark: 11 },
    ];
    const short = (r) => r.need === 'charcoal' && charcoal <= 0;
    const done = (r) => r.have >= r.mark;
    const active = rows.findIndex((r) => !short(r) && !done(r));

    rows.forEach((r, i) => {
      const y = 12 + i * 32;
      b.blit(icon(r.item), 8, y, false, P.sand, done(r) ? 0.45 : 0.1);
      if (i === active) {
        circled(b, 6, y - 2, 16, 16);
        fireState(b, 36, y + 16, 1, t);
      } else if (short(r) && !done(r)) {
        b.blit(icon(r.need), 30, y, false, P.sand, 0.55);
        b.line(31, y + 1, 41, y + 11, P.bad);
        b.line(41, y + 1, 31, y + 11, P.bad);
      }
      shelfRow(b, 54, y, b.w - 62, r.item, r.have, r.cap, r.mark);
    });

    scratch(b, 6, b.h - 16, b.w - 8, b.h - 16);
    for (let i = 0; i < 6; i++) b.blit(icon('charcoal'), 10 + i * 17, b.h - 14, false, P.sand, i < charcoal ? 0.1 : 0.76);
  },

  /** A firing is a schedule, and two places in it break ware. */
  schedule(b, t) {
    b.clear(UI.pane);
    const good = (u) => (u < 0.18 ? 60 + u * 780 : u < 0.3 ? 200 + (u - 0.18) * 2600 : u < 0.46 ? 512 + (u - 0.3) * 760 : u < 0.72 ? 634 + (u - 0.46) * 1250 : u < 0.86 ? 960 : 960 - (u - 0.86) * 4200);
    const bad = (u) => (u < 0.12 ? 60 + u * 4200 : u < 0.6 ? 564 + (u - 0.12) * 850 : u < 0.78 ? 972 : 972 - (u - 0.78) * 7000);
    const top = 1100;
    const ph = (t * 0.1) % 1;
    const c = chart(b, 4, 14, b.w - 8, 84, {
      samples: 70,
      lines: [
        { f: (u) => bad(u) / top, c: P.bad },
        { f: (u) => good(u) / top, c: P.good },
      ],
      marks: [],
    });
    for (const z of [{ lo: 100, hi: 200, n: 'steam' }, { lo: 560, hi: 590, n: '573 quartz' }]) {
      const y0 = c.Y(z.hi / top), y1 = c.Y(z.lo / top);
      b.brect(6, y0, b.w - 13, Math.max(2, y1 - y0), P.warn, 0.3);
      text(b, b.w - textW(z.n) - 8, y0 - 6, z.n, P.warn);
    }
    const bx = c.X(ph);
    b.rect(bx, 15, 1, 82, mix(P.bone, UI.ink, 0.5));
    b.rect(bx - 1, c.Y(good(ph) / top) - 1, 3, 3, P.good);
    b.rect(bx - 1, c.Y(bad(ph) / top) - 1, 3, 3, P.bad);
    text(b, 4, 4, 'two firings of the same ware', UI.dim);
    text(b, 6, 102, 'slow through both: 7% lost', P.good);
    text(b, 6, 111, 'straight up: 61% lost', P.bad);
    const g = Model.clay({ temper: 0.2, dryRate: 0.3, rampLow: 0.2, ramp573: 0.2, peak: 960, hold: 35 });
    const bd = Model.clay({ temper: 0.2, dryRate: 0.3, rampLow: 0.95, ramp573: 0.95, peak: 960, hold: 35 });
    const s = 'hard ' + Math.round(g.hardness * 100) + '%  vs  ' + Math.round(bd.hardness * 100) + '%';
    text(b, b.w - textW(s) - 6, 111, s, UI.dim);
  },

  /** Knapping, with the clock taken off: four values and a fracture. */
  knap(b, t) {
    b.clear(UI.pane);
    const names = ['hard', 'soft', 'antler'];
    const which = Math.floor((t * 0.3) % 3);
    const hammer = names[which];
    const r = Model.knap({ hammer, angle: 72, force: 0.6, setback: 0.4, prepared: true });
    b.rect(0, 0, 150, b.h, P.earthD);
    const sub = new Buf(160, 96);
    MOCK.knap(sub, t);
    for (let y = 0; y < Math.min(b.h, 96); y++)
      for (let x = 0; x < 150; x++) b.d[y * b.w + x] = sub.d[y * 160 + x + 5];
    panel(b, 152, 2, b.w - 156, b.h - 4, 'blow');
    let y = 14;
    const row = (k, v, c) => {
      text(b, 156, y, k, UI.dim);
      text(b, 156, y + 7, v, c || UI.text);
      y += 15;
    };
    row('hammer', Model.HAMMERS[hammer].label.split(' ')[0], P.ember2);
    row('platform', '72 deg');
    row('setback', '0.4');
    row('force', '0.6');
    b.rect(156, y + 1, b.w - 162, 1, P.earth2);
    y += 5;
    row('flake', r.grade, r.grade === 'fine' ? P.good : r.grade === 'good' ? P.flame : P.warn);
    row('from core', String(r.fromOneCore), r.fromOneCore > 3 ? P.good : P.warn);
    row('edge', r.edgeLife + ' cuts');
  },


  /** A knob is only as fine as the instrument that reads it. */
  /**
   * A knob is only as fine as the instrument that reads it — and the control has to coarsen with
   * it. Three settings you can see, then notches on a stick, then a scale worth scratching.
   */
  /**
   * A knob is only as fine as the instrument that reads it, and the control has to coarsen with
   * it. Three fires you can see, then notches on a stick, then a scale worth scratching.
   */
  knobStages(b, t) {
    b.clear(UI.pane);
    const W = Math.floor(b.w / 3);
    const pick = Math.floor(t * 0.4);
    slab(b, 0, 0, b.w, b.h);
    for (const x of [W, W * 2]) scratch(b, x, 4, x, b.h - 4);

    const ware = (r, x, y) => {
      if (r.grade === 'raw') {
        b.blit(icon('clay'), x, y, false, P.sand, 0.12);
        b.line(x + 1, y + 1, x + 11, y + 11, P.bad);
        b.line(x + 11, y + 1, x + 1, y + 11, P.bad);
        return;
      }
      for (let i = 0; i < Math.max(1, Math.round(r.rate)); i++)
        b.blit(icon('pot'), x + (i % 4) * 15, y, false, P.sand, r.grade === 'soft' ? 0.5 : 0.1);
    };

    const ord = Model.HEAT_SETTINGS.ordinal;
    const chosen = pick % 3;
    ord.forEach((s, i) => {
      const cx = 16 + i * 25;
      fireState(b, cx, 52, i, t, i !== chosen);
      if (i === chosen) circled(b, cx - 12, 28, 24, 27);
    });
    ware(potRun(ord[chosen].damper), 6, 64);
    tally(b, 10, 84, Math.round(potRun(ord[chosen].damper).rate * 2), 8);

    const notches = Model.HEAT_SETTINGS.graded;
    const n = pick % notches.length;
    b.rect(W + 12, 14, 11, 70, P.wood4);
    b.rect(W + 12, 14, 3, 70, P.woodL);
    b.rect(W + 20, 14, 3, 70, P.wood2);
    notches.forEach((s, i) => {
      const y = 20 + i * 9;
      b.rect(W + 12, y, 11, 2, P.wood2);
      b.px(W + 12, y + 2, P.wood3);
    });
    b.rect(W + 8, 19 + n * 9, 19, 4, P.rock2);
    b.rect(W + 8, 19 + n * 9, 19, 1, P.rock3);
    ware(potRun(notches[n].damper), W + 32, 24);
    tally(b, W + 32, 84, Math.round(potRun(notches[n].damper).rate * 2), 8);

    const x0 = W * 2 + 10, w = W - 22, base = 80, top = 16;
    scratch(b, x0, top, x0, base);
    scratch(b, x0, base, x0 + w, base);
    for (let i = 0; i <= 4; i++) scratch(b, x0 - 3, base - (i / 4) * (base - top), x0, base - (i / 4) * (base - top));
    let px = null, py = null;
    for (let i = 0; i <= 34; i++) {
      const d = 0.2 + (i / 34) * 0.79;
      const cx = x0 + (i / 34) * w, cy = base - (potRun(d).rate / 5) * (base - top);
      if (px !== null) {
        b.line(px, py, cx, cy, lit(P.sand2, 0.5));
        b.line(px + 1, py + 1, cx + 1, cy + 1, P.sandL);
      }
      px = cx;
      py = cy;
    }
    const cur = 0.2 + (Math.sin(t * 0.7) * 0.5 + 0.5) * 0.79;
    const cy = base - (potRun(cur).rate / 5) * (base - top);
    const cxx = x0 + ((cur - 0.2) / 0.79) * w;
    for (let yy = cy; yy < base; yy += 3) b.px(cxx, yy, mix(P.sand2, P.ember, 0.5));
    teardrop(b, cxx, cy - 4, 7, 11, P.clayG, true);
    b.rect(cxx - 3, cy - 1, 6, 2, P.lime2);
  },

  /** Early on a setting is not predicted but measured, by running it and waiting. */
  /**
   * Nothing is predicted. The rig runs, the days are scratched up, and the belief is drawn as
   * how many pots the town is sure of plus how many it is only hoping for.
   */
  /**
   * Nothing is predicted. The rig runs, the days are scratched up as they come, and what the
   * town believes is drawn as the pots it is sure of plus the ones it is only hoping for.
   */
  measuring(b, t) {
    b.clear(UI.pane);
    slab(b, 0, 0, b.w, b.h);
    const truth = potRun(0.6).rate;
    const runs = 3 + Math.floor((t * 0.4) % 6);
    const o = Model.observe(truth, runs, 'ordinal');

    for (let d = 0; d < Math.min(runs, 6); d++) {
      const y = 8 + d * 11;
      b.ell(10, y + 4, 3, 3, P.char2);
      const got = Math.max(1, Math.round(truth * (0.62 + hash2(d, 7, 2) * 0.76)));
      tally(b, 20, y, got, 7);
    }

    const sureTo = Math.max(1, Math.floor(o.lo));
    const hopeTo = Math.max(sureTo + 1, Math.ceil(o.hi));
    const by = b.h - 16;
    scratch(b, 6, by - 10, b.w - 8, by - 10);
    for (let i = 0; i < hopeTo; i++) {
      const x = 8 + i * 17;
      if (x > b.w - 18) break;
      b.blit(icon('pot'), x, by - 6, false, P.sand, i < sureTo ? 0.1 : 0.74);
      if (i >= sureTo) for (let k = 0; k < 12; k += 3) b.px(x + 6, by - 5 + k, mix(P.sand2, P.sand, 0.35));
    }
  },

  /** The bottom of the pyramid, as hours out of a day. */
  needs(b, t) {
    b.clear(UI.pane);
    const parts = [
      ['water', P.water], ['food', P.grass2], ['prep', P.fibre2],
      ['fuel', P.ember], ['rest', P.cloth4], ['work', P.flame],
    ];
    text(b, 4, 4, 'where a waking day goes', UI.dim);
    const keys = Object.keys(Model.DAYS);
    keys.forEach((k, i) => {
      const d = Model.day(Model.DAYS[k]);
      const y = 16 + i * 32;
      text(b, 4, y, Model.DAYS[k].label, UI.text);
      let x = 4;
      const w = b.w - 74;
      for (const [name, c] of parts) {
        const seg = Math.round(d.shares[name] * w);
        b.rect(x, y + 9, seg, 12, c);
        b.rect(x, y + 9, seg, 1, lit(c, 1.25));
        if (seg > 13) text(b, x + 2, y + 13, String(Math.round(d.shares[name] * 100)), name === 'work' ? P.ink : UI.ink);
        x += seg;
      }
      b.rect(4, y + 21, w, 1, UI.ink);
      text(b, b.w - 66, y + 9, d.surplusHours.toFixed(0) + ' hrs', P.flame);
      text(b, b.w - 66, y + 17, 'to spare', UI.dim);
    });
    let lx = 4;
    for (const [name, c] of parts) {
      b.rect(lx, b.h - 9, 5, 5, c);
      lx = text(b, lx + 7, b.h - 9, name, UI.dim) + 3;
    }
  },

  /** The same control, before and after. Left is a settings screen; right is a place. */
  chrome(b, t) {
    b.clear(UI.pane);
    const half = Math.floor(b.w / 2);
    const bank = Math.floor(t * 0.28) % 3;
    const damper = Model.HEAT_SETTINGS.ordinal[bank].damper;
    const out = Model.fire({ ...Model.RIGS.updraft.build, fuel: 'charcoal', damper, fuelRate: 1.2 });

    b.rect(0, 0, half - 3, b.h, P.ink2);
    panel(b, 6, 8, half - 16, 44, 'heat');
    slider(b, 12, 26, 62, damper, P.water);
    text(b, 80, 27, Math.round(damper * 100) + '%', UI.text);
    text(b, 12, 38, 'output 4.3/hr', UI.dim);
    b.rect(12, 58, half - 28, 9, UI.ink);
    b.rect(13, 59, Math.round(clamp(out.T / 1250) * (half - 30)), 7, P.ember);
    text(b, 12, 72, out.T + ' c', UI.text);
    for (let i = 0; i < 3; i++) text(b, 12, 86 + i * 9, ['charge  1.2/min', 'fuel    charcoal', 'damper  ' + Math.round(damper * 100) + '%'][i], UI.dim);

    b.rect(half - 3, 0, 3, b.h, P.ink);
    for (let y = 0; y < 62; y++)
      for (let x = half; x < b.w; x++) {
        const n = hash2(x, y, 6);
        b.px(x, y, n > 0.9 ? P.earth2 : n < 0.1 ? P.earth : P.earthD);
      }
    KILN_SECTION(b, half + 56, 60, out.T, out.starved, t);
    slab(b, half, 62, b.w - half, b.h - 62);
    for (let i = 0; i < 3; i++) {
      const cx = half + 24 + i * 38;
      fireState(b, cx, 112, i, t, i !== bank);
      if (i === bank) circled(b, cx - 16, 74, 32, 26);
    }
  },

  /** The town the whole thing runs in. */
  map(b, t) {
    heroMap(b, t);
  },
  floor(b, t) {
    heroFloor(b, t);
  },
  clamp(b, t) {
    MOCK.clamp(b, t);
  },
  kiln(b, t) {
    MOCK.kiln(b, t);
  },
  pitfire(b, t) {
    MOCK.pitfire(b, t);
  },
  ribbon(b, t) {
    MOCK.ribbon(b, t);
  },
  grind(b, t) {
    MOCK.grind(b, t);
  },
  mould(b, t) {
    MOCK.mould(b, t);
  },
  slake(b, t) {
    MOCK.slake(b, t);
  },
  coil(b, t) {
    MOCK.coil(b, t);
  },
  house(b, t) {
    MOCK.house(b, t);
  },
};

export { FIG, text, textW, panel, chart, slider };
