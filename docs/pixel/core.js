'use strict';

const HEX = {
  ink: '#1b1420', ink2: '#2d2330', night: '#141a2e',
  bone: '#efe4cc', bone2: '#d4c3a0', paper: '#f6efdf',
  ember: '#d4502a', ember2: '#ef8a38', flame: '#ffcf55', flameW: '#fff4b8', glowR: '#8a2a1a',
  earth: '#7a5236', earth2: '#57391f', earth3: '#9d6d46', earthD: '#3e2817',
  mud: '#6a4a32', mudW: '#4a3222', mudL: '#8a6446',
  clay: '#a87a5c', clayL: '#c49676', clayG: '#8f8a7c', clayF: '#c2603a', clayF2: '#9c4a2b',
  grass: '#5d8a3a', grass2: '#76a34a', grass3: '#476d2d', grassD: '#33521f', grassY: '#9ab25a',
  forest: '#2e5a2c', forestD: '#1d3b1f', leaf: '#4b7d37', leafL: '#6a9a45',
  rock: '#8b8984', rock2: '#696864', rock3: '#aaa79d', rockD: '#4c4b49',
  flint: '#39404e', flintL: '#56617a', flintH: '#7d8aa3', cortex: '#d7cfba', cortex2: '#b9b09a',
  water: '#3a7ea4', water2: '#2b6386', waterL: '#68aecd', foam: '#cfe8ef', waterD: '#1f4b68',
  sand: '#d8bf88', sand2: '#bfa26a', sandL: '#ead6a6',
  marsh: '#5a7046', marsh2: '#47593a', reed: '#a8994f', reedD: '#7f7438',
  wood: '#8a5c33', wood2: '#663f22', woodL: '#b6844d', wood3: '#e2c18f', wood4: '#c9a06a',
  char: '#2a1c16', char2: '#46302a', ash: '#8f8b86', ashL: '#bdb8b1',
  fibre: '#c8b46a', fibre2: '#a6924c', fibreL: '#e1d08c',
  skin: '#d79e68', skin2: '#ae7646', skin3: '#8d5a36', hair: '#3a2416', hair2: '#6b3f1f',
  cloth1: '#9b4a39', cloth2: '#4e6a88', cloth3: '#7e7a3b', cloth4: '#6c4e79', cloth5: '#b38545',
  lime: '#eeede4', lime2: '#cdccc1', lime3: '#a9a89e',
  smoke: '#bdb6ad', smokeY: '#c9b98c', smokeB: '#9fb0c4',
  good: '#7fb050', bad: '#cf4a3a', warn: '#e0a640', mark: '#f2e7c9',
};

function C(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0;
}
const P = {};
for (const k in HEX) P[k] = C(HEX[k]);

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rgbOf = (c) => [c & 255, (c >>> 8) & 255, (c >>> 16) & 255];
const pack = (r, g, b) =>
  (0xff000000 | ((clamp(b, 0, 255) | 0) << 16) | ((clamp(g, 0, 255) | 0) << 8) | (clamp(r, 0, 255) | 0)) >>> 0;
function mix(a, b, t) {
  const A = rgbOf(a), B = rgbOf(b);
  return pack(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
function lit(c, f) {
  const A = rgbOf(c);
  return pack(A[0] * f, A[1] * f, A[2] * f);
}
const cssOf = (c) => {
  const [r, g, b] = rgbOf(c);
  return `rgb(${r},${g},${b})`;
};

function hash2(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, y, s = 0) {
  return vnoise(x, y, s) * 0.55 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.15;
}
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

class Buf {
  constructor(w, h, canvas) {
    this.w = w;
    this.h = h;
    if (canvas) {
      canvas.width = w;
      canvas.height = h;
      this.ctx = canvas.getContext('2d');
      this.img = this.ctx.createImageData(w, h);
      this.d = new Uint32Array(this.img.data.buffer);
    } else {
      this.d = new Uint32Array(w * h);
    }
  }
  present() {
    this.ctx.putImageData(this.img, 0, 0);
  }
  clear(c) {
    this.d.fill(c);
  }
  px(x, y, c) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c;
  }
  get(x, y) {
    x = Math.floor(x);
    y = Math.floor(y);
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : 0;
  }
  bl(x, y, c, a) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
    const i = y * this.w + x;
    this.d[i] = a >= 1 ? c : mix(this.d[i], c, a);
  }
  rect(x, y, w, h, c) {
    x = Math.floor(x);
    y = Math.floor(y);
    w = Math.floor(w);
    h = Math.floor(h);
    const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(this.w, x + w), y1 = Math.min(this.h, y + h);
    if (x1 <= x0) return;
    for (let j = y0; j < y1; j++) this.d.fill(c, j * this.w + x0, j * this.w + x1);
  }
  brect(x, y, w, h, c, a) {
    for (let j = Math.floor(y); j < y + h; j++) for (let i = Math.floor(x); i < x + w; i++) this.bl(i, j, c, a);
  }
  ell(cx, cy, rx, ry, c) {
    rx = Math.max(rx, 0.5);
    ry = Math.max(ry, 0.5);
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const dy = (y + 0.5 - cy) / ry;
      if (dy * dy > 1) continue;
      const hw = rx * Math.sqrt(1 - dy * dy);
      this.rect(Math.round(cx - hw), y, Math.round(cx + hw) - Math.round(cx - hw), 1, c);
    }
  }
  bell(cx, cy, rx, ry, c, a) {
    rx = Math.max(rx, 0.5);
    ry = Math.max(ry, 0.5);
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const dy = (y + 0.5 - cy) / ry;
      if (dy * dy > 1) continue;
      const hw = rx * Math.sqrt(1 - dy * dy);
      for (let x = Math.round(cx - hw); x < Math.round(cx + hw); x++) this.bl(x, y, c, a);
    }
  }
  line(x0, y0, x1, y1, c, wdt = 1) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 2000; n++) {
      if (wdt <= 1) this.px(x0, y0, c);
      else this.rect(x0 - (wdt >> 1), y0 - (wdt >> 1), wdt, wdt, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  blit(s, x, y, flip = false, tint = 0, ta = 0) {
    x = Math.round(x);
    y = Math.round(y);
    for (let j = 0; j < s.h; j++) {
      const yy = y + j;
      if (yy < 0 || yy >= this.h) continue;
      for (let i = 0; i < s.w; i++) {
        const v = s.d[j * s.w + (flip ? s.w - 1 - i : i)];
        if (!v) continue;
        const xx = x + i;
        if (xx < 0 || xx >= this.w) continue;
        this.d[yy * this.w + xx] = ta ? mix(v, tint, ta) : v;
      }
    }
  }
  shade(x, y, w, h, f) {
    for (let j = Math.max(0, y); j < Math.min(this.h, y + h); j++)
      for (let i = Math.max(0, x); i < Math.min(this.w, x + w); i++) {
        const k = j * this.w + i;
        this.d[k] = lit(this.d[k], f);
      }
  }
}

function spr(w, h, fn) {
  const b = new Buf(w, h);
  fn(b);
  return b;
}
function shadeSpr(b, up = 1.16, down = 0.76) {
  const src = b.d.slice();
  const at = (x, y) => (x < 0 || y < 0 || x >= b.w || y >= b.h ? 0 : src[y * b.w + x]);
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const v = src[y * b.w + x];
      if (!v) continue;
      if (!at(x + 1, y) || !at(x, y + 1)) b.d[y * b.w + x] = lit(v, down);
      else if (!at(x - 1, y) || !at(x, y - 1)) b.d[y * b.w + x] = lit(v, up);
    }
  return b;
}
function outline(b, c = P.ink) {
  const src = b.d.slice();
  const at = (x, y) => (x < 0 || y < 0 || x >= b.w || y >= b.h ? 0 : src[y * b.w + x]);
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      if (src[y * b.w + x]) continue;
      if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) b.d[y * b.w + x] = c;
    }
  return b;
}
const finish = (b) => outline(shadeSpr(b));

function sprToCanvas(s, scale) {
  const c = document.createElement('canvas');
  c.width = s.w;
  c.height = s.h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(s.w, s.h);
  new Uint32Array(img.data.buffer).set(s.d);
  ctx.putImageData(img, 0, 0);
  if (!scale || scale === 1) return c;
  const o = document.createElement('canvas');
  o.width = s.w * scale;
  o.height = s.h * scale;
  const octx = o.getContext('2d');
  octx.imageSmoothingEnabled = false;
  octx.drawImage(c, 0, 0, o.width, o.height);
  return o;
}

const Sfx = {
  ctx: null,
  on: true,
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) {
      this.ctx = null;
    }
  },
  ok() {
    return this.on && this.ctx && this.ctx.state !== 'closed';
  },
  noise(dur = 0.08, freq = 1200, q = 1, gain = 0.4, type = 'bandpass') {
    if (!this.ok()) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5, dur + 0.05);
  },
  tone(freq = 440, dur = 0.12, type = 'square', gain = 0.12, slide = 0, delay = 0) {
    if (!this.ok()) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  },
  knock(p = 1) {
    this.noise(0.07, 900 + p * 1400, 2.5, 0.5);
    this.tone(180 + p * 120, 0.06, 'triangle', 0.18, -80);
  },
  crack() {
    this.noise(0.18, 600, 0.8, 0.6);
    this.tone(90, 0.2, 'sawtooth', 0.12, -40);
  },
  crackle() {
    this.noise(0.03, 2500 + Math.random() * 2000, 4, 0.15);
  },
  whoosh(d = 0.3) {
    this.noise(d, 500, 0.6, 0.18, 'lowpass');
  },
  splash() {
    this.noise(0.25, 1400, 0.7, 0.25);
  },
  squish() {
    this.noise(0.12, 300, 1.5, 0.3, 'lowpass');
  },
  tick() {
    this.tone(1200, 0.03, 'square', 0.05);
  },
  good() {
    [523, 659, 784].forEach((f, i) => this.tone(f, 0.12, 'square', 0.07, 0, i * 0.07));
  },
  bad() {
    this.tone(220, 0.18, 'square', 0.08, -90);
  },
  fanfare() {
    [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'square', 0.07, 0, i * 0.09));
  },
};
