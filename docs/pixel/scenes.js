'use strict';

const MW = 160, MH = 96;

function groundFill(b, base, alt, seed, scale = 0.18, amt = 0.5) {
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const n = fbm(x * scale, y * scale, seed);
      b.d[y * b.w + x] = n + (hash2(x, y, seed) - 0.5) * 0.2 > amt ? alt : base;
    }
}
const BG = {};
function cachedGround(key, base, alt, seed, scale, amt) {
  if (!BG[key]) {
    const g = new Buf(MW, MH);
    groundFill(g, base, alt, seed, scale, amt);
    BG[key] = g.d.slice();
  }
  return BG[key];
}
function useGround(b, key, base, alt, seed, scale, amt) {
  b.d.set(cachedGround(key, base, alt, seed, scale, amt));
}
function meter(b, x, y, h, v, band, col = P.ember2) {
  b.rect(x, y, 5, h, P.ink);
  b.rect(x + 1, y + 1, 3, h - 2, P.earthD);
  if (band) b.rect(x + 1, y + 1 + Math.round((1 - band[1]) * (h - 2)), 3, Math.round((band[1] - band[0]) * (h - 2)), P.grass3);
  const f = Math.round(clamp(v) * (h - 2));
  b.rect(x + 1, y + h - 1 - f, 3, f, col);
}
function hand(b, x, y, flip = false) {
  b.ell(x, y, 5, 3.5, P.skin);
  b.rect(x + (flip ? -9 : 3), y - 2, 6, 4, P.skin2);
  b.px(x - 2, y - 1, P.skin2);
  b.px(x + 1, y + 2, P.skin3);
}
function smokePuff(b, x, y, r, c, a) {
  b.bell(x, y, r, r * 0.8, c, a);
}
function embersBed(b, cx, cy, w, t) {
  b.ell(cx, cy, w, 5, P.char);
  for (let i = 0; i < w * 2; i++) {
    const x = cx - w + i + (hash2(i, 3) * 2 - 1);
    const fl = Math.sin(t * 6 + i * 1.7) * 0.5 + 0.5;
    b.px(x, cy - 1 + hash2(i, 9) * 3, fl > 0.6 ? P.flame : fl > 0.3 ? P.ember2 : P.ember);
  }
}
function flames(b, cx, by, w, h, t) {
  for (let i = -w; i <= w; i++) {
    const hh = h * (1 - Math.abs(i) / (w + 1)) * (0.7 + 0.3 * Math.sin(t * 9 + i * 1.3));
    for (let y = 0; y < hh; y++) {
      const u = y / Math.max(1, hh);
      b.px(cx + i + Math.sin(t * 7 + y * 0.6) * u * 1.5, by - y, u < 0.35 ? P.flameW : u < 0.7 ? P.flame : P.ember2);
    }
  }
}
function label(b, x, y, ok) {
  if (ok) {
    b.line(x, y + 2, x + 2, y + 4, P.good, 2);
    b.line(x + 2, y + 4, x + 6, y - 1, P.good, 2);
  } else {
    b.line(x, y, x + 5, y + 5, P.bad, 2);
    b.line(x + 5, y, x, y + 5, P.bad, 2);
  }
}
function arrowDown(b, x, y, c) {
  b.rect(x - 1, y - 4, 3, 4, c);
  b.rect(x - 3, y, 7, 1, c);
  b.rect(x - 2, y + 1, 5, 1, c);
  b.px(x, y + 2, c);
}
function graph(b, x, y, w, h, bands, trace, now) {
  b.rect(x, y, w, h, P.ink);
  b.rect(x + 1, y + 1, w - 2, h - 2, P.earthD);
  const toY = (T) => y + h - 2 - (T / 1100) * (h - 3);
  for (const bd of bands) {
    const y0 = toY(bd.hi), y1 = toY(bd.lo);
    b.brect(x + 1 + bd.x0 * (w - 2), y0, (bd.x1 - bd.x0) * (w - 2), y1 - y0, P.grass2, 0.35);
  }
  let px0 = null, py0 = null;
  for (let i = 0; i <= now * (w - 2); i++) {
    const u = i / (w - 2);
    const yy = toY(trace(u));
    if (px0 !== null) b.line(px0, py0, x + 1 + i, yy, P.flame);
    px0 = x + 1 + i;
    py0 = yy;
  }
}

const KNAP = { flake: null, outline: null };
function knapState(mode) {
  const W = MW, H = MH;
  const mask = new Uint8Array(W * H), scar = new Float32Array(W * H).fill(-1), target = new Uint8Array(W * H);
  const cx = mode === 'outline' ? 80 : 70, cy = 48;
  const rx = mode === 'outline' ? 46 : 34, ry = mode === 'outline' ? 36 : 26;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const a = Math.atan2(y - cy, x - cx);
      const rr = 1 + 0.1 * Math.sin(a * 3 + 1) + 0.06 * Math.sin(a * 7);
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
      if (d < rr) mask[y * W + x] = d > rr - 0.09 ? 1 : 2;
    }
  if (mode === 'outline') {
    const th = 60, tw = 40;
    for (let y = 0; y < th; y++) {
      const u = y / (th - 1);
      const hw = (tw / 2) * Math.pow(Math.sin(Math.PI * clamp(u * 0.92 + 0.04)), 0.7) * (0.55 + 0.45 * u);
      for (let x = Math.round(cx - hw); x < Math.round(cx + hw); x++) target[(cy - th / 2 + y) * W + x] = 1;
    }
  }
  return { mask, scar, target, cx, cy, k: 0, flakes: [], last: -1, W, H };
}
function knapStrike(s, mode) {
  const { W, H, mask, scar, target } = s;
  const ang = s.k * 2.39996 + 0.5;
  let px = s.cx, py = s.cy;
  const dx = Math.cos(ang), dy = Math.sin(ang);
  for (let r = 0; r < 70; r++) {
    const x = Math.round(s.cx + dx * r), y = Math.round(s.cy + dy * r);
    if (x < 0 || y < 0 || x >= W || y >= H || !mask[y * W + x]) break;
    px = x;
    py = y;
  }
  const nx = -dx, ny = -dy;
  const L = mode === 'outline' ? 16 : 13, Wd = L * 0.62;
  const removed = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!mask[i]) continue;
      const vx = x - px, vy = y - py;
      const al = vx * nx + vy * ny, ac = -vx * ny + vy * nx;
      const e = Math.pow((al - L / 2) / (L / 2), 2) + Math.pow(ac / (Wd / 2), 2);
      if (e <= 1 && !(mode === 'outline' && target[i])) {
        mask[i] = 0;
        removed.push([x, y]);
      } else if (e <= 1.9) {
        scar[i] = Math.hypot(vx, vy);
        if (mask[i] === 1) mask[i] = 2;
      }
    }
  if (removed.length) s.flakes.push({ pts: removed, ox: px, oy: py, vx: dx * 30, vy: dy * 30 - 10, t: 0 });
  s.hx = px;
  s.hy = py;
  s.hdx = dx;
  s.hdy = dy;
  s.k++;
}
function drawCore(b, s, mode) {
  const { W, H, mask, scar, target } = s;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const m = mask[i];
      if (!m) {
        if (mask[i - 1] || mask[i + 1] || mask[i - W] || mask[i + W]) b.d[i] = P.ink;
        continue;
      }
      let c = m === 1 ? (hash2(x, y, 4) > 0.5 ? P.cortex : P.cortex2) : P.flint;
      if (scar[i] >= 0) c = (scar[i] | 0) % 4 < 2 ? P.flintL : P.flint;
      if (!mask[i - W] || !mask[i - 1]) c = lit(c, 1.25);
      else if (!mask[i + W] || !mask[i + 1]) c = lit(c, 0.7);
      if (mode === 'outline' && !target[i]) c = mix(c, P.ember, 0.18);
      b.d[i] = c;
    }
  if (mode === 'outline')
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (target[i] && (!target[i - 1] || !target[i + 1] || !target[i - W] || !target[i + W]) && (x + y) % 3 === 0)
          b.d[i] = P.bone;
      }
}

const MOCK = {
  knap(b, t, mode = 'flake') {
    useGround(b, 'knap', P.earth2, P.earthD, 8, 0.2, 0.6);
    const period = 1.4;
    if (!KNAP[mode] || t < KNAP[mode].t0) KNAP[mode] = Object.assign(knapState(mode), { t0: t });
    const s = KNAP[mode];
    const k = Math.floor((t - s.t0) / period);
    while (s.k < k) knapStrike(s, mode);
    if (s.k > (mode === 'outline' ? 16 : 6)) {
      KNAP[mode] = Object.assign(knapState(mode), { t0: t });
      return MOCK.knap(b, t, mode);
    }
    drawCore(b, s, mode);
    const ph = ((t - s.t0) % period) / period;
    const ang = s.k * 2.39996 + 0.5;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    let ex = s.cx, ey = s.cy;
    for (let r = 0; r < 70; r++) {
      const x = Math.round(s.cx + dx * r), y = Math.round(s.cy + dy * r);
      if (x < 0 || y < 0 || x >= MW || y >= MH || !s.mask[y * MW + x]) break;
      ex = x;
      ey = y;
    }
    const back = ph < 0.8 ? 6 + (1 - ph / 0.8) * 10 + Math.sin(ph * 20) * (ph < 0.6 ? 0 : 1) : 4;
    b.ell(ex + dx * back, ey + dy * back, 4.5, 3.6, P.rock3);
    b.ell(ex + dx * back - 1, ey + dy * back - 1, 2, 1.4, P.lime2);
    if (mode === 'flake') meter(b, 150, 10, 76, clamp(ph / 0.8) * 0.85, [0.55, 0.85]);
    for (const f of s.flakes) {
      const age = t - s.t0 - (s.flakes.indexOf(f) + 1) * period;
      if (age < 0 || age > 0.6) continue;
      for (const [x, y] of f.pts) b.px(x + f.vx * age, y + f.vy * age + 40 * age * age, P.flintL);
    }
  },
  temper(b, t) {
    useGround(b, 'temper', P.earth2, P.earthD, 13, 0.2, 0.55);
    b.ell(80, 64, 64, 22, P.earthD);
    const c = t % 9;
    const wet = c < 3 ? 1 - c / 3 : c < 6 ? (c - 3) / 3 * 0.3 : 0.15;
    const hgt = 14 + (1 - wet) * 14, wid = 30 + wet * 18;
    b.ell(80, 66 - hgt / 2, wid, hgt, mix(P.mudL, P.mudW, wet));
    if (wet > 0.6) for (let i = 0; i < 4; i++) b.rect(60 + i * 12, 70, 3, 4 + i, P.mudW);
    if (c > 2.4 && c < 3.6) for (let i = 0; i < 6; i++) b.line(62 + i * 7, 56, 64 + i * 7, 60 + (i % 3), P.earthD);
    if (c > 3.6) for (let i = 0; i < Math.min(14, (c - 3.6) * 6); i++) b.line(60 + hash2(i, 1) * 40, 52 + hash2(i, 2) * 14, 63 + hash2(i, 1) * 40, 53 + hash2(i, 2) * 14, P.fibreL);
    hand(b, 80 + Math.sin(t * 5) * 14, 46 - hgt / 3);
    meter(b, 150, 10, 76, 0.2 + (1 - wet) * 0.6, [0.55, 0.7], P.water);
  },
  ribbon(b, t) {
    b.clear(P.earthD);
    const layers = [
      { c: P.earth2, n: 'top', lim: 18 },
      { c: P.sand, n: 'sand', lim: 6 },
      { c: P.clayG, n: 'silt', lim: 28 },
      { c: P.clay, n: 'clay', lim: 62 },
      { c: P.rock2, n: 'gravel', lim: 2 },
    ];
    for (let i = 0; i < layers.length; i++) {
      for (let y = 6 + i * 17; y < 6 + (i + 1) * 17; y++)
        for (let x = 4; x < 52; x++) b.px(x, y, hash2(x, y, i) > 0.8 ? lit(layers[i].c, 0.85) : layers[i].c);
    }
    b.rect(52, 6, 2, 85, P.ink);
    const cyc = t % 12, li = [1, 2, 3][Math.floor(cyc / 4)], ph = (cyc % 4) / 4;
    for (let x = 3; x < 53; x++) {
      b.px(x, 6 + li * 17, P.bone);
      b.px(x, 22 + li * 17, P.bone);
    }
    for (let i = 0; i < layers.length; i++)
      for (let y = 6 + i * 17; y < 6 + (i + 1) * 17; y++)
        if (i === li) for (let x = 4; x < 52; x++) b.px(x, y, hash2(x, y, i) > 0.8 ? lit(layers[i].c, 0.85) : layers[i].c);
    const L = layers[li];
    const len = Math.min(L.lim, ph * 90);
    const broke = ph * 90 > L.lim;
    b.ell(78, 40, 14, 7, P.skin);
    b.ell(78, 58, 14, 7, P.skin2);
    for (let x = 0; x < len; x++) b.rect(90 + x, 47 + Math.pow(x / 60, 2) * 8, 1, 4, L.c);
    if (broke) {
      const f = (ph * 90 - L.lim) / 10;
      b.rect(90 + L.lim + 2, 49 + f * 12, 6, 4, L.c);
    }
    for (let k = 0; k <= 6; k++) b.rect(90 + k * 10, 84, 1, k % 5 === 0 ? 5 : 3, P.bone);
    b.rect(90, 88, 61, 1, P.bone);
  },
  coil(b, t) {
    useGround(b, 'coil', P.earth, P.earth2, 15, 0.2, 0.6);
    b.ell(80, 88, 30, 4, P.rock2);
    const prof = [14, 18, 21, 23, 24, 23, 21, 17, 14, 14, 15, 17];
    for (let i = 0; i < prof.length; i++) {
      const y = 82 - i * 6;
      for (let s of [-1, 1]) {
        b.px(80 + s * (prof[i] + 3), y - 2, (i + Math.floor(t * 2)) % 2 ? P.bone : P.earthD);
      }
    }
    const c = t % 10;
    const n = Math.min(prof.length, Math.floor(c / 0.5) + 1);
    const smooth = c > 6.5 ? clamp((c - 6.5) / 2.5) : 0;
    for (let i = 0; i < n; i++) {
      const y = 82 - i * 6;
      const r = prof[i];
      b.rect(80 - r - 2, y - 3, (r + 2) * 2, 6, P.clay);
      b.rect(80 - r - 2, y - 3, 4, 6, P.clayL);
      b.rect(80 + r - 2, y - 3, 4, 6, lit(P.clay, 0.8));
      if (i > 0 && smooth < 1 && hash2(i, 3) > smooth) b.rect(80 - r - 2, y + 2, (r + 2) * 2, 1, P.earth2);
    }
    if (smooth > 0) hand(b, 80 - 30, 82 - smooth * 64);
  },
  pitfire(b, t, kiln = false) {
    useGround(b, kiln ? 'kiln' : 'pit', P.earth2, P.earthD, kiln ? 17 : 16, 0.2, 0.55);
    const per = 10, u = (t % per) / per;
    const tr = kiln
      ? (x) => (x < 0.25 ? 20 + x * 600 : x < 0.4 ? 170 + (x - 0.25) * 5200 : x < 0.75 ? 950 + Math.sin(x * 40) * 30 : 950 - (x - 0.75) * 3000)
      : (x) => (x < 0.25 ? 20 + x * 700 : x < 0.4 ? 195 + (x - 0.25) * 3700 : x < 0.75 ? 720 + Math.sin(x * 40) * 40 : 720 - (x - 0.75) * 2200);
    const T = tr(u);
    if (kiln) {
      for (let y = 6; y < 66; y++) {
        const hw = 34 * Math.sqrt(1 - Math.pow((66 - y) / 62, 2));
        b.rect(Math.round(80 - hw), y, Math.round(hw * 2), 1, P.earth3);
      }
      b.rect(56, 30, 48, 30, P.char);
      for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) b.rect(58 + k * 9 + (r % 2) * 3, 32 + r * 7, 7, 5, mix(P.clay, P.ember, clamp((T - 500) / 600)));
      b.rect(66, 58, 28, 8, P.char);
      flames(b, 80, 64, 10, 5 + T / 120, t);
      b.rect(74, 4, 12, 3, P.rock2);
      b.rect(74 + Math.sin(t) * 3, 2, 12, 2, P.rockD);
    } else {
      b.ell(80, 52, 56, 14, P.earthD);
      for (let k = 0; k < 3; k++) {
        const pc = mix(P.clayG, P.ember, clamp((T - 450) / 500));
        b.ell(56 + k * 24, 46, 8, 9, pc);
        b.rect(52 + k * 24, 36, 8, 3, pc);
      }
      flames(b, 80, 60, 40, 4 + T / 60, t);
    }
    graph(b, 4, 70, 152, 24, kiln
      ? [{ x0: 0, x1: 0.25, lo: 100, hi: 200 }, { x0: 0.4, x1: 0.75, lo: 900, hi: 1050 }]
      : [{ x0: 0, x1: 0.25, lo: 120, hi: 250 }, { x0: 0.4, x1: 0.75, lo: 600, hi: 850 }], tr, u);
  },
  kiln(b, t) {
    MOCK.pitfire(b, t, true);
  },
  clamp(b, t) {
    useGround(b, 'clamp', P.grass3, P.grassD, 18, 0.2, 0.55);
    const u = (t % 12) / 12;
    for (let y = 30; y < 86; y++) {
      const hw = 64 * Math.sqrt(Math.max(0, 1 - Math.pow((86 - y) / 56, 2)));
      for (let x = Math.round(80 - hw); x < Math.round(80 + hw); x++)
        b.px(x, y, hash2(x, y, 3) > 0.86 ? P.grass3 : y < 40 ? P.earth3 : P.earth);
    }
    const vents = [[30, 82], [48, 56], [80, 31], [112, 56], [130, 82], [80, 84]];
    const open = [1, 0, 1, 0, 1, 1];
    vents.forEach(([x, y], i) => b.ell(x, y, 3, 2, open[i] ? P.char : P.earth3));
    const zoneC = (z) => {
      const p = clamp((u - z * 0.1) * 1.6);
      return p < 0.35 ? P.lime : p < 0.8 ? P.smokeY : P.smokeB;
    };
    vents.forEach(([x, y], i) => {
      if (!open[i]) return;
      const z = x < 60 ? 0 : x > 100 ? 2 : 1;
      for (let k = 0; k < 5; k++) {
        const ph = (t * 0.5 + k / 5 + i * 0.13) % 1;
        smokePuff(b, x + ph * 18, y - 4 - ph * 30, 2 + ph * 5, zoneC(z), 0.55 * (1 - ph));
      }
    });
    if (u > 0.4 && u < 0.55) {
      flames(b, 104, 46, 3, 7, t);
      if (u > 0.5) hand(b, 104, 40);
    }
    if (u > 0.55 && u < 0.56) b.rect(100, 44, 8, 3, P.earth3);
  },
  grind(b, t) {
    useGround(b, 'grind', P.grass3, P.grassD, 19, 0.2, 0.55);
    b.rect(10, 26, 140, 52, P.sand2);
    for (let y = 26; y < 78; y++) for (let x = 10; x < 150; x++) if (hash2(x, y, 5) > 0.9) b.px(x, y, P.sandL);
    const wet = 0.5 + 0.5 * Math.sin(t * 0.5);
    b.bell(80, 52, 50, 16, P.water2, 0.35 * wet);
    for (let i = 0; i < 30; i++) b.px(40 + hash2(i, 1) * 80, 44 + hash2(i, 2) * 16, P.clayG);
    const x = 80 + Math.sin(t * 4) * 34;
    for (let y = 0; y < 22; y++) {
      const u = y / 21;
      const hw = 7 * Math.pow(Math.sin(Math.PI * clamp(u * 0.92 + 0.04)), 0.7) * (0.55 + 0.45 * u);
      b.rect(Math.round(x - 11 + y), Math.round(52 - hw), 1, Math.max(1, Math.round(hw * 2)), y > 17 ? P.lime2 : P.clayG);
    }
    hand(b, x - 12, 42);
    meter(b, 4, 6, 18, clamp((t % 10) / 10), null, P.lime2);
    meter(b, 151, 6, 18, clamp(((t % 10) - 0.6) / 10), null, P.lime2);
  },
  mould(b, t) {
    useGround(b, 'mould', P.earth3, P.earth, 21, 0.2, 0.55);
    const c = t % 6;
    b.rect(30, 56, 50, 20, P.wood4);
    b.rect(34, 60, 42, 12, c < 1.4 ? P.earth2 : P.clay);
    b.rect(30, 56, 50, 2, P.wood3);
    if (c < 0.8) for (let i = 0; i < 10; i++) b.px(36 + hash2(i, Math.floor(t * 8)) * 38, 60 + hash2(i, 3) * 10, P.sandL);
    if (c > 0.8 && c < 1.4) {
      const p = (c - 0.8) / 0.6;
      b.ell(lerp(120, 55, p), lerp(20, 58, p) - Math.sin(p * Math.PI) * 18, 7, 5, P.clay);
    }
    if (c > 1.4 && c < 2.8) {
      b.ell(55, 56, 22, 4, P.clay);
      const p = (c - 1.4) / 1.4;
      b.line(26 + p * 58, 50, 26 + p * 58, 58, P.wood2, 2);
    }
    if (c > 3.4) {
      b.rect(30, 50 - Math.min(10, (c - 3.4) * 20), 50, 4, P.wood4);
    }
    for (let i = 0; i < 4; i++) {
      b.rect(96 + (i % 2) * 28, 60 + Math.floor(i / 2) * 16, 24, 10, P.clay);
      b.rect(96 + (i % 2) * 28, 60 + Math.floor(i / 2) * 16, 24, 1, P.clayL);
    }
  },
  slake(b, t) {
    useGround(b, 'slake', P.grass3, P.grassD, 22, 0.2, 0.55);
    b.ell(80, 60, 66, 26, P.earth2);
    b.ell(80, 60, 60, 22, P.earthD);
    const u = (t % 10) / 10;
    const putty = clamp((u - 0.3) * 1.6);
    b.bell(80, 62, 56, 18, P.lime, putty);
    for (let i = 0; i < 8; i++) {
      const x = 40 + (i % 4) * 26 + hash2(i, 1) * 6, y = 52 + Math.floor(i / 4) * 14;
      const hyd = clamp(u * 2 - i * 0.12);
      if (hyd < 1) b.ell(x, y, 7 * (1 - hyd * 0.7), 5 * (1 - hyd * 0.7), hyd > 0.3 ? P.lime2 : P.lime);
      if (hyd > 0.1 && hyd < 1) b.px(x - 2, y, P.lime3);
    }
    if (u < 0.55) {
      for (let y = 4; y < 50; y++) b.px(118 + Math.sin(y * 0.4 + t * 9) * 1, y, y % 3 ? P.waterL : P.water);
      b.rect(108, 0, 16, 6, P.clayF);
    }
    if (u > 0.15 && u < 0.7)
      for (let k = 0; k < 6; k++) {
        const ph = (t * 0.6 + k / 6) % 1;
        smokePuff(b, 60 + k * 10, 50 - ph * 40, 2 + ph * 5, P.lime, 0.4 * (1 - ph));
      }
    if (u > 0.3 && u < 0.4) for (let k = 0; k < 8; k++) b.px(70 + hash2(k, Math.floor(t * 10)) * 30, 30 + hash2(k, 7) * 20, P.bone);
  },
  house(b, t) {
    useGround(b, 'house', P.grass, P.grass3, 23, 0.2, 0.55);
    const c = t % 14;
    const courses = Math.min(7, Math.floor(c / 0.7));
    const bw = 12, bh = 6, x0 = 32, y0 = 86;
    for (let r = 0; r < courses; r++) {
      const off = r % 2 ? bw / 2 : 0;
      for (let k = -1; k < 9; k++) {
        const x = x0 + k * bw + off;
        const xl = Math.max(x0, x), xr = Math.min(x0 + 96, x + bw - 1);
        if (xr <= xl) continue;
        if (r < 4 && xl >= 68 && xr <= 92) continue;
        const L = Math.max(xl, r < 4 && xl < 68 && xr > 68 ? xl : xl);
        b.rect(L, y0 - (r + 1) * bh, xr - L, bh - 1, P.clayF);
        b.rect(L, y0 - (r + 1) * bh, xr - L, 1, P.ember2);
      }
      b.rect(x0, y0 - r * bh - 1, 96, 1, P.lime2);
    }
    for (let r = 0; r < Math.min(courses, 4); r++) b.rect(68, y0 - (r + 1) * bh, 24, bh, P.char);
    if (courses >= 4) b.rect(64, y0 - 4 * bh - 3, 32, 3, P.wood4);
    if (c > 5.2) {
      const rows = Math.min(5, Math.floor((c - 5.2) / 0.9) + 1);
      for (let r = 0; r < rows; r++) {
        const y = y0 - 7 * bh - r * 7;
        const hw = 56 - r * 10;
        for (let x = 80 - hw; x < 80 + hw; x++) b.rect(x, y - 7, 1, 8, (x + r) % 3 ? P.fibre : P.fibre2);
        b.rect(80 - hw, y, hw * 2, 1, P.fibre2);
      }
    }
  },
  site(b, t, kind = 'bank') {
    drawMiniMap(b, 0, 0, t, kind);
  },
  build(b, t, id = 'leanto') {
    useGround(b, 'build', P.grass, P.grass3, 24, 0.2, 0.55);
    const s = buildSprite(id);
    const sc = 4, ox = 80 - (s.w * sc) / 2, oy = 84 - s.h * sc;
    const u = (t % 7) / 5;
    const rows = Math.floor(clamp(u) * s.h);
    for (let j = s.h - rows; j < s.h; j++)
      for (let i = 0; i < s.w; i++) {
        const v = s.d[j * s.w + i];
        if (v) b.rect(ox + i * sc, oy + j * sc, sc, sc, v);
      }
    if (u < 1)
      for (let j = 0; j < s.h - rows; j++)
        for (let i = 0; i < s.w; i++) if (s.d[j * s.w + i] && (i + j) % 2 === 0) b.bl(ox + i * sc + 1, oy + j * sc + 1, P.bone, 0.35);
    const vx = 10 + ((t * 18) % 50);
    drawVillager(b, vx, 86, { look: 1, id: 1, moving: true, carry: id === 'kiln' ? 'adobe' : 'wood' }, t);
    drawVillager(b, 150 - ((t * 14 + 20) % 40), 88, { look: 2, id: 2, moving: true, carry: 'fibre' }, t);
  },
};

const MAP_ROWS = [
  'hhhhhggggggggggggwwggggghhhhhhhh',
  'hhhhgggggggggggggwwgggggfhhhhhhh',
  'hhhggggggggggggggswwggggffhhhhhh',
  'hhggggggggggggggggwwgggfffffhhhh',
  'hgggggggggggggggggwwwggffffffhhh',
  'gggggggggggggggggggwwgfffffffffh',
  'ggggggggggggggggggwwggffffffffff',
  'gggggggggggggggggFFFgfffffffffff',
  'ggggggggggggggggwwggffffffffffff',
  'gggggggggggggggswwgggfffffffffff',
  'ggggggggggggggswwggggfffffffffff',
  'gggggggggggggwwwgggggggfffffffff',
  'ggggggggggggwwssgggggggggfffffff',
  'gggggggggggwwgggggggggggggffffff',
  'ggggggggggwwggggggggggggggggffff',
  'mmmgggggmwwggggggggggggggggggfff',
  'mmllllllwwmggggggggggggggggggggf',
  'mllllllllllmmggggggggggggggggggg',
  'mlllllllllmsssgggggggggggggggggg',
  'mmllllllmmsssggggggggggggggggggg',
];
const MAP_W = 32, MAP_H = 20;
const tileAt = (x, y) => (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H ? 'w' : MAP_ROWS[y][x]);
const isWet = (c) => c === 'w' || c === 'l' || c === 'F';
const isBank = (x, y) =>
  !isWet(tileAt(x, y)) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => isWet(tileAt(x + a, y + b)) && tileAt(x + a, y + b) !== 'F');

const TILE = {
  g: [P.grass, P.grass2, P.grass3],
  f: [P.forest, P.leaf, P.forestD],
  h: [P.rock, P.rock3, P.rock2],
  w: [P.water, P.water2, P.waterL],
  l: [P.water2, P.water, P.waterL],
  F: [P.waterL, P.water, P.foam],
  m: [P.marsh, P.marsh2, P.grass3],
  s: [P.sand, P.sandL, P.sand2],
};
let MAP_BASE = null;
function mapBase(ts) {
  if (MAP_BASE && MAP_BASE.ts === ts) return MAP_BASE;
  const w = MAP_W * ts, h = MAP_H * ts;
  const g = new Buf(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const jx = (vnoise(x * 0.35, y * 0.35, 1) - 0.5) * ts * 0.7, jy = (vnoise(x * 0.35, y * 0.35, 2) - 0.5) * ts * 0.7;
      const c = tileAt(Math.floor((x + jx) / ts), Math.floor((y + jy) / ts));
      const pal = TILE[c];
      const n = fbm(x * 0.2, y * 0.2, 3) + (hash2(x, y, 9) - 0.5) * 0.25;
      g.d[y * w + x] = n > 0.62 ? pal[1] : n < 0.36 ? pal[2] : pal[0];
    }
  for (let ty = 0; ty < MAP_H; ty++)
    for (let tx = 0; tx < MAP_W; tx++) {
      const c = tileAt(tx, ty);
      const r = hash2(tx, ty, 5);
      const cx = tx * ts + ts / 2 + (r - 0.5) * ts * 0.5, cy = ty * ts + ts / 2 + (hash2(tx, ty, 6) - 0.5) * ts * 0.4;
      if (c === 'f') {
        g.rect(cx - 0.5, cy, Math.max(1, ts / 6), ts / 3, P.wood2);
        g.ell(cx, cy - ts * 0.15, ts * 0.42, ts * 0.36, P.forestD);
        g.ell(cx - ts * 0.08, cy - ts * 0.22, ts * 0.26, ts * 0.2, P.leaf);
      }
      if (c === 'h' && r > 0.5) {
        g.ell(cx, cy, ts * 0.28, ts * 0.2, P.rock3);
        g.px(cx + 1, cy + 1, P.rockD);
      }
      if (c === 'm') for (let k = 0; k < 3; k++) g.line(cx + k * 2 - 2, cy + 2, cx + k * 2 - 1, cy - 3, P.reed);
    }
  MAP_BASE = { ts, w, h, d: g.d };
  return MAP_BASE;
}

const SITE_RULE = {
  bank: (x, y) => isBank(x, y) && tileAt(x, y) !== 'h',
  water: (x, y) => isBank(x, y) && tileAt(x, y) !== 'h',
  clay: (x, y) => isBank(x, y) && tileAt(x, y) === 'm',
  quarry: (x, y) => tileAt(x, y) === 'h' || tileAt(x, y) === 's',
  forest: (x, y) => tileAt(x, y) === 'f',
  any: (x, y) => !isWet(tileAt(x, y)),
};
const SITE_ICON = { bank: 'bankdig', water: 'waterhole', clay: 'claypit', quarry: 'quarry', forest: 'woodcutter', any: 'forage' };
const SITE_PICK = { bank: [14, 10], water: [15, 9], clay: [8, 15], quarry: [3, 3], forest: [22, 8], any: [7, 6] };
const HEARTH = [9, 9];

function drawMiniMap(b, ox, oy, t, kind, opts = {}) {
  const ts = opts.ts || 5;
  const base = mapBase(ts);
  const sx = opts.sx ?? 0, sy = opts.sy ?? 0;
  for (let y = 0; y < b.h; y++) {
    const yy = y + sy;
    if (yy < 0 || yy >= base.h) continue;
    for (let x = 0; x < b.w; x++) {
      const xx = x + sx;
      if (xx < 0 || xx >= base.w) continue;
      let v = base.d[yy * base.w + xx];
      const tc = tileAt(Math.floor(xx / ts), Math.floor(yy / ts));
      if ((tc === 'w' || tc === 'l') && hash2(xx, yy, Math.floor(t * 3)) > 0.97) v = P.foam;
      b.d[y * b.w + x] = v;
    }
  }
  const T = (tx, ty) => [tx * ts + ts / 2 - sx, ty * ts + ts / 2 - sy];
  if (kind && SITE_RULE[kind]) {
    const blink = 0.25 + 0.2 * Math.sin(t * 4);
    for (let ty = 0; ty < MAP_H; ty++)
      for (let tx = 0; tx < MAP_W; tx++)
        if (SITE_RULE[kind](tx, ty)) b.brect(tx * ts - sx, ty * ts - sy, ts, ts, P.flame, blink);
    const [px, py] = SITE_PICK[kind];
    const [hx, hy] = T(HEARTH[0], HEARTH[1]);
    const [qx, qy] = T(px, py);
    const steps = Math.max(Math.abs(qx - hx), Math.abs(qy - hy));
    for (let i = 0; i < steps; i += 3) {
      const u = i / steps;
      b.px(lerp(hx, qx, u), lerp(hy, qy, u), P.bone);
    }
    const s = buildSprite(SITE_ICON[kind]);
    b.blit(s, qx - 8, qy - 12);
  }
  const [hx, hy] = T(HEARTH[0], HEARTH[1]);
  b.blit(buildSprite('hearth'), hx - 8, hy - 12);
  flames(b, hx, hy - 2, 2, 5, t);
  if (opts.extra) opts.extra(b, T, t);
}

function heroMap(b, t) {
  drawMiniMap(b, 0, 0, t, null, {
    ts: 8,
    sx: 0,
    sy: 16,
    extra(b, T, t) {
      const builds = [
        ['knap', 7, 9], ['whittle', 8, 11], ['cord', 11, 8], ['weave', 10, 12], ['clamp', 6, 11], ['shape', 12, 11],
        ['bankdig', 14, 10], ['waterhole', 15, 9], ['leanto', 7, 7], ['kiln', 11, 13], ['woodcutter', 23, 8], ['claypit', 8, 15],
      ];
      const sorted = builds.slice().sort((a, b2) => a[2] - b2[2]);
      for (const [id, x, y] of sorted) {
        const [px, py] = T(x, y);
        b.blit(buildSprite(id), px - 8, py - 12);
      }
      const [cx, cy] = T(6, 11);
      for (let k = 0; k < 6; k++) {
        const ph = (t * 0.4 + k / 6) % 1;
        smokePuff(b, cx + ph * 20, cy - 10 - ph * 36, 2 + ph * 5, ph < 0.3 ? P.lime : P.smokeY, 0.5 * (1 - ph));
      }
      const [kx, ky] = T(11, 13);
      b.bl(kx, ky - 6, P.flame, 0.6 + 0.3 * Math.sin(t * 8));
      const routes = [
        { a: [9, 9], b: [14, 10], item: 'mud', s: 0.11 },
        { a: [9, 9], b: [15, 9], item: 'water', s: 0.13 },
        { a: [9, 9], b: [8, 15], item: 'clay', s: 0.08 },
        { a: [9, 9], b: [17, 7], item: 'log', s: 0.06, via: [23, 8] },
      ];
      routes.forEach((r, i) => {
        let ph = (t * r.s + i * 0.3) % 1;
        const back = ph > 0.5;
        const u = back ? (1 - ph) * 2 : ph * 2;
        let [x, y] = T(lerp(r.a[0], r.b[0], u), lerp(r.a[1], r.b[1], u));
        if (r.via && u > 0.5) {
          const v = (u - 0.5) * 2;
          [x, y] = T(lerp(17, r.via[0], v), lerp(7, r.via[1], v));
        } else if (r.via) [x, y] = T(lerp(9, 17, u * 2), lerp(9, 7, u * 2));
        drawVillager(b, x, y + 3, { look: i, id: i, moving: true, carry: back ? r.item : null }, t);
      });
      [[7, 9], [8, 11], [10, 12], [11, 8]].forEach(([x, y], i) => {
        const [px, py] = T(x, y);
        drawVillager(b, px + 7, py + 3, { look: i + 2, id: i + 5, moving: false, working: true }, t);
      });
    },
  });
}

function heroFloor(b, t) {
  b.clear(P.earthD);
  const cols = 5, rows = 4, sq = 28, ox = 10, oy = 14, tilt = 0.7;
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const px = ox + x * sq, py = oy + y * sq * tilt;
      for (let j = 0; j < sq * tilt; j++)
        for (let i = 0; i < sq; i++) {
          const n = hash2(px + i, Math.floor(py + j), 7);
          b.px(px + i, py + j, n > 0.85 ? P.earth3 : n < 0.1 ? P.earth2 : P.earth);
        }
      for (let i = 0; i < sq; i += 2) {
        b.px(px + i, py, P.earth3);
        b.px(px, py + i * tilt, P.earth3);
      }
    }
  const cell = (x, y) => [ox + x * sq + sq / 2, oy + y * sq * tilt + sq * tilt * 0.75];
  const bay = (x, y, item, inward) => {
    const [cx, cy] = cell(x, y);
    b.brect(cx - 12, cy - 15, 24, 18, inward ? P.bone : P.ember, 0.35);
    b.blit(icon(item), cx - 6, cy - 14);
  };
  bay(0, 1, 'wood', true);
  bay(0, 2, 'mud', true);
  bay(4, 1, 'charcoal', false);
  bay(4, 2, 'mud', false);
  const [sx, sy] = cell(1, 1);
  for (let k = 0; k < 4; k++) b.rect(sx - 10 + (k % 2) * 3, sy - 4 - k * 3, 20, 3, k % 2 ? P.wood2 : P.wood);
  const [mx, my] = cell(2.5, 1.5);
  for (let y = 0; y < 30; y++) {
    const hw = 30 * Math.sqrt(Math.max(0, 1 - Math.pow(y / 30, 2)));
    b.rect(Math.round(mx - hw), Math.round(my - y), Math.round(hw * 2), 1, y > 24 ? P.earth3 : P.earth);
  }
  for (let k = 0; k < 5; k++) {
    const ph = (t * 0.5 + k / 5) % 1;
    smokePuff(b, mx + ph * 14, my - 32 - ph * 22, 2 + ph * 4, P.smokeY, 0.55 * (1 - ph));
  }
  const [ex, ey] = cell(2.5, 3);
  b.blit(icon('ember'), ex - 6, ey - 12);
  const arr = (x0, y0, x1, y1) => {
    const [a, c] = cell(x0, y0), [d, e] = cell(x1, y1);
    for (let i = 0; i <= 10; i++) b.px(lerp(a, d, i / 10), lerp(c, e, i / 10) - 6, P.bone);
  };
  arr(0, 1, 1, 1);
  arr(0, 2, 1.6, 1.6);
  arr(3.4, 1.4, 4, 1);
  arr(3.4, 1.6, 4, 2);
  arr(2.5, 3, 2.5, 2.2);
  drawVillager(b, sx + 14, sy + 4, { look: 1, id: 1, working: true }, t);
  drawVillager(b, mx - 26, my + 8, { look: 3, id: 3, working: Math.floor(t) % 2 === 0 }, t);
}
