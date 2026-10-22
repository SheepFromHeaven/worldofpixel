'use strict';

function teardrop(b, cx, cy, w, h, c, invert = false) {
  for (let y = 0; y < h; y++) {
    let u = y / (h - 1);
    if (invert) u = 1 - u;
    const hw = (w / 2) * Math.pow(Math.sin(Math.PI * clamp(u * 0.92 + 0.04)), 0.7) * (0.55 + 0.45 * u);
    b.rect(Math.round(cx - hw), cy - h / 2 + y, Math.max(1, Math.round(hw * 2)), 1, c);
  }
}

const ICONS = {
  wood: () => spr(12, 12, (b) => {
    // Stacked, never crossed: an X-shaped icon is indistinguishable from the blocked marker.
    b.rect(1, 7, 10, 3, P.wood2);
    b.ell(10, 8.5, 1.6, 1.6, P.wood3);
    b.rect(2, 3, 9, 3, P.wood);
    b.ell(10, 4.5, 1.5, 1.5, P.wood4);
    b.px(3, 3, P.woodL);
  }),
  fibre: () => spr(12, 12, (b) => {
    for (let i = 0; i < 6; i++) b.line(3 + i, 1, 4 + i * 0.6, 10, i % 2 ? P.fibre : P.fibre2);
    b.rect(3, 6, 7, 1, P.wood2);
  }),
  stone: () => spr(12, 12, (b) => {
    b.ell(6, 7, 4.6, 3.4, P.rock);
    b.px(4, 6, P.rock3);
    b.px(7, 8, P.rock2);
  }),
  flake: () => spr(12, 12, (b) => {
    for (let y = 2; y < 10; y++) b.rect(3 + ((y - 2) >> 1), y, 9 - y, 1, P.flintL);
    b.line(3, 2, 7, 9, P.flintH);
  }),
  ember: () => spr(12, 12, (b) => {
    b.ell(6, 8, 4.5, 2.4, P.char2);
    b.px(4, 8, P.ember);
    b.px(6, 7, P.ember2);
    b.px(8, 8, P.ember);
    b.px(6, 9, P.flame);
    b.px(5, 5, P.ember2);
  }),
  mud: () => spr(12, 12, (b) => {
    b.ell(6, 8, 4.8, 3, P.mud);
    b.ell(6, 6, 3, 2, P.mud);
    b.px(4, 6, P.mudL);
    b.px(5, 5, P.mudL);
  }),
  cord: () => spr(12, 12, (b) => {
    b.ell(6, 6, 4.5, 4.5, P.fibre2);
    b.ell(6, 6, 2.5, 2.5, 0);
    for (let a = 0; a < 12; a++) {
      const t = (a / 12) * Math.PI * 2;
      b.px(6 + Math.cos(t) * 3.6, 6 + Math.sin(t) * 3.6, a % 2 ? P.fibreL : P.fibre);
    }
  }),
  stick: () => spr(12, 12, (b) => {
    b.line(1, 10, 8, 3, P.wood, 2);
    b.line(8, 3, 10, 1, P.wood3);
    b.px(9, 2, P.wood3);
  }),
  dstick: () => spr(12, 12, (b) => {
    b.line(1, 10, 8, 3, P.wood, 2);
    b.line(8, 3, 10, 1, P.char2);
    b.px(9, 2, P.char);
    b.px(7, 4, P.wood2);
  }),
  basket: () => spr(12, 12, (b) => {
    for (let y = 4; y < 10; y++) {
      const hw = 5 - (y - 4) * 0.4;
      b.rect(Math.round(6 - hw), y, Math.round(hw * 2), 1, y % 2 ? P.fibre : P.fibre2);
    }
    for (let x = 2; x < 10; x += 2) b.line(x, 4, x + (x < 6 ? 0.6 : -0.6), 9, P.wood4);
    b.rect(1, 3, 10, 1, P.fibre2);
  }),
  daub: () => spr(12, 12, (b) => {
    b.ell(6, 7, 4.6, 3.4, P.mudL);
    b.line(3, 6, 6, 7, P.fibreL);
    b.line(6, 9, 9, 8, P.fibreL);
    b.px(5, 5, P.earth3);
  }),
  wbasket: () => spr(12, 12, (b) => {
    for (let y = 4; y < 10; y++) {
      const hw = 5 - (y - 4) * 0.4;
      b.rect(Math.round(6 - hw), y, Math.round(hw * 2), 1, y % 2 ? P.mud : P.mudL);
    }
    b.rect(1, 3, 10, 1, P.mudL);
    b.px(4, 6, P.fibre);
    b.px(7, 8, P.fibre);
  }),
  berries: () => spr(12, 12, (b) => {
    b.line(6, 2, 5, 5, P.forestD);
    b.ell(3.5, 4.5, 2, 1.4, P.leaf);
    b.ell(8.5, 4, 2, 1.4, P.leafL);
    for (const [x, y] of [[4, 7], [7, 7], [5.5, 9.5]]) {
      b.ell(x, y, 2.2, 2.2, P.cloth1);
      b.px(x - 1, y - 1, P.ember2);
    }
  }),
  water: () => spr(12, 12, (b) => {
    for (let y = 1; y < 11; y++) {
      const u = (y - 1) / 9;
      const hw = u < 0.55 ? u * 6 : 3.3 * Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.68) / 0.33, 2)));
      b.rect(Math.round(6 - hw), y, Math.max(1, Math.round(hw * 2)), 1, P.water);
    }
    b.px(5, 6, P.foam);
    b.px(5, 7, P.waterL);
  }),
  adobe: () => spr(12, 12, (b) => {
    b.ell(6, 7, 5.2, 2.6, P.earth3);
    b.rect(1, 7, 10, 2, P.earth3);
    b.px(3, 6, P.earth);
    b.px(6, 6, P.earth);
    b.px(9, 6, P.earth);
  }),
  clay: () => spr(12, 12, (b) => {
    b.ell(6, 7, 4.8, 3.6, P.clay);
    b.px(4, 5, P.clayL);
    b.px(5, 5, P.clayL);
  }),
  pot: () => spr(12, 12, (b) => {
    b.ell(6, 7, 4.5, 3.8, P.clayF);
    b.rect(4, 2, 4, 2, P.clayF);
    b.rect(3, 1, 6, 1, P.clayF2);
    b.px(4, 6, P.ember2);
  }),
  charcoal: () => spr(12, 12, (b) => {
    b.rect(2, 6, 4, 4, P.char);
    b.rect(6, 4, 4, 6, P.char2);
    b.px(7, 5, P.ash);
    b.px(3, 7, P.rockD);
  }),
  limestone: () => spr(12, 12, (b) => {
    b.rect(2, 4, 8, 6, P.lime2);
    b.rect(3, 3, 6, 1, P.lime);
    b.px(4, 6, P.lime3);
    b.px(7, 8, P.lime3);
  }),
  sand: () => spr(12, 12, (b) => {
    for (let y = 4; y < 10; y++) {
      const hw = (y - 3) * 0.9;
      b.rect(Math.round(6 - hw), y, Math.round(hw * 2), 1, P.sand);
    }
    b.px(5, 6, P.sandL);
    b.px(7, 8, P.sand2);
  }),
  rhead: () => spr(12, 12, (b) => {
    teardrop(b, 6, 6, 8, 10, P.flint);
    b.px(5, 4, P.flintL);
    b.px(7, 7, P.flintL);
    b.px(4, 8, P.flintH);
  }),
  phead: () => spr(12, 12, (b) => {
    teardrop(b, 6, 6, 8, 10, P.clayG);
    b.line(4, 4, 4, 8, P.lime2);
    b.px(5, 3, P.lime);
  }),
  axe: () => spr(12, 12, (b) => {
    b.line(2, 10, 8, 2, P.wood, 2);
    b.rect(7, 1, 4, 4, P.clayG);
    b.px(10, 2, P.lime2);
    b.rect(6, 3, 2, 2, P.fibre2);
  }),
  log: () => spr(12, 12, (b) => {
    b.rect(2, 4, 8, 5, P.wood2);
    b.ell(9, 6.5, 2, 2.6, P.wood3);
    b.px(9, 6, P.wood);
    b.line(3, 5, 7, 5, P.wood);
  }),
  timber: () => spr(12, 12, (b) => {
    b.rect(1, 4, 10, 4, P.wood4);
    b.rect(1, 4, 10, 1, P.wood3);
    b.line(3, 6, 8, 6, P.woodL);
  }),
  gbrick: () => spr(12, 12, (b) => {
    b.rect(1, 5, 10, 4, P.clay);
    b.rect(1, 4, 10, 1, P.clayL);
  }),
  brick: () => spr(12, 12, (b) => {
    b.rect(1, 5, 10, 4, P.clayF);
    b.rect(1, 4, 10, 1, P.ember2);
    b.px(4, 6, P.clayF2);
  }),
  quicklime: () => spr(12, 12, (b) => {
    b.ell(4, 7, 3, 2.6, P.lime);
    b.ell(8, 6, 3, 3, P.lime2);
    b.px(8, 5, P.lime);
  }),
  mortar: () => spr(12, 12, (b) => {
    for (let y = 5; y < 10; y++) {
      const hw = (y - 4) * 1.1;
      b.rect(Math.round(6 - hw), y, Math.round(hw * 2), 1, P.lime2);
    }
    b.px(5, 6, P.lime);
    b.px(7, 8, P.sand2);
  }),
};

const ICON_CACHE = {};
function icon(id) {
  if (!ICON_CACHE[id]) ICON_CACHE[id] = finish(ICONS[id] ? ICONS[id]() : ICONS.stone());
  return ICON_CACHE[id];
}
const ICON_URL = {};
function iconUrl(id) {
  if (!ICON_URL[id]) ICON_URL[id] = sprToCanvas(icon(id), 1).toDataURL();
  return ICON_URL[id];
}

function stones(b, cx, cy, r, n, c = P.rock) {
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    b.ell(cx + Math.cos(t) * r, cy + Math.sin(t) * r * 0.55, 1.6, 1.2, i % 2 ? c : P.rock3);
  }
}

const BUILD_ART = {
  hearth: (b) => {
    b.ell(8, 11, 6, 3, P.char2);
    stones(b, 8, 11, 6, 9);
    b.rect(5, 10, 6, 1, P.wood2);
  },
  forage: (b) => {
    b.line(3, 12, 10, 8, P.wood, 2);
    b.line(4, 9, 11, 12, P.wood2, 1);
    for (let y = 7; y < 12; y++) b.rect(10, y, 4, 1, y % 2 ? P.fibre : P.fibre2);
    b.rect(9, 6, 6, 1, P.fibre2);
  },
  bankdig: (b) => {
    b.ell(7, 11, 5, 2.5, P.mudW);
    b.ell(12, 9, 3, 2.2, P.mud);
    b.line(11, 3, 13, 10, P.char2, 1);
  },
  waterhole: (b) => {
    b.ell(7, 11, 5.5, 2.6, P.water2);
    b.px(5, 10, P.waterL);
    for (let y = 6; y < 11; y++) b.rect(11, y, 4, 1, y % 2 ? P.mud : P.mudL);
  },
  claypit: (b) => {
    b.ell(8, 11, 6, 2.8, P.clayG);
    b.ell(8, 11, 4, 1.6, P.clay);
    b.ell(13, 8, 2.2, 1.6, P.clay);
  },
  quarry: (b) => {
    b.rect(2, 8, 5, 5, P.rock);
    b.rect(7, 6, 6, 7, P.rock2);
    b.rect(9, 10, 5, 3, P.lime2);
    b.px(4, 9, P.rock3);
  },
  sandbar: (b) => {
    for (let y = 7; y < 13; y++) b.rect(8 - (y - 6), y, (y - 6) * 2, 1, P.sand);
    b.px(7, 9, P.sandL);
    for (let y = 8; y < 13; y++) b.rect(12, y, 3, 1, y % 2 ? P.fibre : P.fibre2);
  },
  woodcutter: (b) => {
    b.ell(6, 11, 3.5, 2, P.wood3);
    b.rect(3, 10, 7, 2, P.wood2);
    b.line(6, 4, 7, 10, P.wood, 1);
    b.rect(5, 3, 3, 2, P.clayG);
    b.rect(10, 9, 5, 3, P.wood2);
    b.ell(14, 10.5, 1.2, 1.6, P.wood3);
  },
  knap: (b) => {
    b.ell(8, 10, 5, 3, P.rock2);
    b.ell(8, 9, 4, 2, P.rock);
    b.px(3, 12, P.flintL);
    b.px(12, 12, P.flintL);
    b.px(13, 11, P.flint);
    b.ell(10, 7, 1.6, 1.2, P.flint);
  },
  whittle: (b) => {
    b.ell(8, 11, 4.5, 2.2, P.wood3);
    b.rect(4, 8, 9, 3, P.wood2);
    b.px(2, 12, P.wood3);
    b.px(13, 12, P.wood3);
    b.px(14, 11, P.wood4);
    b.line(6, 3, 10, 7, P.wood, 1);
  },
  harden: (b) => {
    b.ell(8, 12, 4, 1.6, P.char2);
    b.line(3, 4, 3, 12, P.wood2);
    b.line(13, 4, 13, 12, P.wood2);
    b.line(3, 5, 13, 5, P.wood);
    b.line(5, 7, 12, 2, P.wood, 1);
  },
  cord: (b) => {
    b.rect(7, 2, 2, 11, P.wood2);
    b.ell(8, 8, 4, 4, P.fibre2);
    b.ell(8, 8, 2, 2, P.wood2);
    b.px(5, 7, P.fibreL);
  },
  weave: (b) => {
    for (let k = 0; k < 2; k++)
      for (let y = 6; y < 12; y++) b.rect(2 + k * 7, y + k, 6, 1, y % 2 ? P.fibre : P.fibre2);
  },
  daub: (b) => {
    b.ell(8, 11, 6, 2.8, P.earth2);
    b.ell(8, 10.5, 4.5, 1.8, P.mud);
    b.px(6, 10, P.fibreL);
    b.px(10, 11, P.fibreL);
  },
  dauber: (b) => {
    for (let k = 0; k < 2; k++)
      for (let y = 6; y < 12; y++) b.rect(2 + k * 7, y + k, 6, 1, y % 2 ? P.mud : P.mudL);
  },
  shape: (b) => {
    for (let k = 0; k < 3; k++) {
      b.ell(4 + k * 4, 11 - (k % 2), 2, 1.3, P.earth3);
      b.rect(2 + k * 4, 11 - (k % 2), 4, 1, P.earth3);
    }
    for (let k = 0; k < 2; k++) b.rect(4 + k * 5, 7, 4, 2, P.earth);
  },
  potter: (b) => {
    b.ell(5, 10, 3, 3, P.clayF);
    b.rect(4, 6, 2, 1, P.clayF2);
    b.ell(11, 11, 2.6, 2.2, P.clay);
    b.rect(10, 8, 2, 1, P.clay);
  },
  clamp: (b) => {
    for (let y = 5; y < 13; y++) {
      const hw = 6.5 * Math.sqrt(1 - Math.pow((12.5 - y) / 8, 2));
      b.rect(Math.round(8 - hw), y, Math.round(hw * 2), 1, y < 7 ? P.earth3 : P.earth);
    }
    b.px(8, 5, P.char);
    b.px(4, 11, P.char);
  },
  kiln: (b) => {
    for (let y = 2; y < 14; y++) {
      const hw = 6 * Math.sqrt(1 - Math.pow((13.5 - y) / 12, 2));
      b.rect(Math.round(8 - hw), y, Math.round(hw * 2), 1, P.earth3);
    }
    b.rect(6, 10, 4, 4, P.char);
    b.rect(7, 2, 2, 2, P.char2);
    b.px(4, 6, P.earth);
    b.px(11, 8, P.earth);
  },
  axeknap: (b) => {
    b.ell(8, 10, 6, 3.2, P.rock2);
    b.ell(8, 9, 5, 2.2, P.rock);
    teardrop(b, 9, 7, 4, 5, P.flint);
    b.px(2, 12, P.flintL);
    b.px(14, 12, P.flintL);
  },
  grind: (b) => {
    b.rect(2, 8, 12, 5, P.sand2);
    b.rect(2, 8, 12, 1, P.sandL);
    b.rect(5, 9, 6, 2, P.water);
    b.ell(8, 7, 2.2, 1.4, P.clayG);
  },
  haft: (b) => {
    b.rect(3, 10, 10, 3, P.wood2);
    b.line(5, 9, 12, 3, P.wood, 1);
    b.rect(10, 2, 4, 3, P.clayG);
    b.rect(9, 4, 2, 2, P.fibre2);
  },
  hew: (b) => {
    b.rect(2, 7, 12, 3, P.wood4);
    b.rect(2, 7, 12, 1, P.wood3);
    b.line(3, 10, 3, 13, P.wood2);
    b.line(12, 10, 12, 13, P.wood2);
    b.px(6, 13, P.wood3);
    b.px(9, 12, P.wood3);
  },
  mould: (b) => {
    b.rect(2, 9, 6, 4, P.wood4);
    b.rect(3, 10, 4, 2, P.clay);
    b.rect(9, 10, 5, 3, P.clay);
    b.rect(9, 7, 5, 2, P.clay);
  },
  slake: (b) => {
    b.ell(8, 11, 6, 2.6, P.earth2);
    b.ell(8, 10.5, 4.6, 1.6, P.lime);
    b.px(6, 10, P.lime3);
    b.ell(13, 8, 1.8, 1.4, P.sand);
  },
  leanto: (b) => {
    for (let i = 0; i < 7; i++) b.line(2 + i * 2, 13, 4 + i * 2, 5, i % 2 ? P.wood : P.wood2);
    b.line(2, 5, 15, 5, P.wood2);
    for (let i = 0; i < 6; i++) b.line(3 + i * 2, 7, 4 + i * 2, 12, P.fibre2);
  },
  hut: (b) => {
    for (let y = 8; y < 15; y++) b.rect(3, y, 11, 1, y % 2 ? P.mudL : P.earth3);
    for (let y = 2; y < 9; y++) {
      const hw = (y - 1) * 1.05;
      b.rect(Math.round(8.5 - hw), y, Math.round(hw * 2), 1, y % 2 ? P.fibre : P.fibre2);
    }
    b.rect(7, 11, 3, 4, P.char);
  },
  house: (b) => {
    b.rect(2, 8, 13, 7, P.clayF);
    for (let y = 9; y < 15; y += 2) b.line(2, y, 14, y, P.clayF2);
    for (let y = 1; y < 9; y++) {
      const hw = y * 0.95 + 0.5;
      b.rect(Math.round(8.5 - hw), y, Math.round(hw * 2), 1, y % 2 ? P.fibre : P.fibre2);
    }
    b.rect(7, 11, 3, 4, P.char);
    b.rect(3, 10, 2, 2, P.char2);
    b.rect(12, 10, 2, 2, P.char2);
  },
};
const BUILD_CACHE = {};
function buildSprite(id) {
  if (!BUILD_CACHE[id]) BUILD_CACHE[id] = finish(spr(17, 16, BUILD_ART[id] || BUILD_ART.knap));
  return BUILD_CACHE[id];
}
const BUILD_URL = {};
function buildUrl(id) {
  if (!BUILD_URL[id]) BUILD_URL[id] = sprToCanvas(buildSprite(id), 1).toDataURL();
  return BUILD_URL[id];
}

const CLOTHES = ['cloth1', 'cloth2', 'cloth3', 'cloth4', 'cloth5'];

function drawVillager(b, x, y, v, t) {
  x = Math.round(x);
  y = Math.round(y);
  const cloth = P[CLOTHES[v.look % CLOTHES.length]];
  const hair = v.look % 3 === 0 ? P.hair2 : P.hair;
  const moving = v.moving;
  const step = moving ? Math.floor(t * 8 + v.id) % 2 : 0;
  const bob = v.working ? Math.floor(t * 4 + v.id) % 2 : 0;
  b.bell(x, y + 0.5, 3, 1.2, P.ink, 0.25);
  b.px(x - 1, y - 1, step ? P.skin3 : P.ink);
  b.px(x + 1, y - 1, step ? P.ink : P.skin3);
  if (!moving) {
    b.px(x - 1, y - 1, P.ink);
    b.px(x + 1, y - 1, P.ink);
  }
  b.rect(x - 1, y - 5 + bob, 3, 4, cloth);
  b.px(x - 1, y - 5 + bob, lit(cloth, 1.2));
  b.rect(x - 1, y - 7 + bob, 3, 2, P.skin);
  b.rect(x - 1, y - 8 + bob, 3, 1, hair);
  if (v.look % 2) b.px(x - 1, y - 7 + bob, hair);
  if (v.working) {
    const arm = Math.floor(t * 4 + v.id) % 2;
    b.px(x + 2, y - 4 - arm + bob, P.skin);
  }
  if (v.carry) {
    const c = ITEM_COLOR[v.carry] || P.bone;
    b.rect(x - 1, y - 11 + bob, 3, 2, c);
    b.px(x - 1, y - 11 + bob, lit(c, 1.25));
  }
}

const ITEM_COLOR = {};
function itemColor(id) {
  if (ITEM_COLOR[id] !== undefined) return ITEM_COLOR[id];
  const s = icon(id);
  const counts = new Map();
  for (const v of s.d) if (v && v !== P.ink) counts.set(v, (counts.get(v) || 0) + 1);
  let best = P.bone, n = 0;
  for (const [k, c] of counts) if (c > n) {
    n = c;
    best = k;
  }
  ITEM_COLOR[id] = best;
  return best;
}
