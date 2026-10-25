(async () => {
  const src = await import(location.origin + '/src/render/lit/shaders/shaderSources.ts');
  const rep = await import(location.origin + '/src/sim/reptiles/species.ts');
  const amp = await import(location.origin + '/src/sim/amphibians/species.ts');
  const ins = await import(location.origin + '/src/sim/insects/species.ts');
  const fsh = await import(location.origin + '/src/sim/fish/species.ts');
  const out = {};
  const BG = [236, 228, 208];
  const W = 400, H = 220;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const gl = cv.getContext('webgl2', { preserveDrawingBuffer: true, alpha: false });
  const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
  const build = (fragSource, varyings) => {
    const decl = varyings.map((v) => `flat out vec4 ${v};`).join('\n');
    const assign = varyings.map((v) => `${v}=a_${v};`).join(' ');
    const uni = varyings.map((v) => `uniform vec4 a_${v};`).join('\n');
    const vs = `#version 300 es
layout(location=0) in vec2 corner;
uniform vec2 uCentre; uniform float uHalf; uniform vec2 uBuf; uniform float uTpp;
${uni}
out vec2 vWorld;
${decl}
void main(){
  vec2 px = uCentre + (corner*2.0-1.0)*uHalf;
  gl_Position = vec4(px.x/uBuf.x*2.0-1.0, 1.0-px.y/uBuf.y*2.0, 0.0, 1.0);
  vWorld = vec2(100.0) + (corner*2.0-1.0)*uHalf*uTpp;
  ${assign}
}`;
    const prog = gl.createProgram();
    gl.attachShader(prog, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, fragSource));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    return prog;
  };
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([200, 185, 140, 255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.viewport(0, 0, W, H);
  const shot = (key) => { out[key] = cv.toDataURL('image/png'); };
  const clear = () => { gl.clearColor(BG[0] / 255, BG[1] / 255, BG[2] / 255, 1); gl.clear(gl.COLOR_BUFFER_BIT); };
  const draw = (prog, set, ext, S) => {
    gl.useProgram(prog);
    const u = (n, ...v) => gl['uniform' + v.length + 'f'](gl.getUniformLocation(prog, n), ...v);
    gl.uniform1i(gl.getUniformLocation(prog, 'uGround'), 0);
    u('uBuffer', W, H); u('uBuf', W, H); u('uCentre', W / 2, H / 2); u('uHalf', ext * S); u('uTpp', 1 / (16 * S));
    set(u);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const VARY = ['vPose', 'vShape', 'vBase', 'vAccent', 'vEye', 'vLook', 'vMove', 'vBody', 'vTrait'];
  const rProg = build(src.REPTILE_FRAGMENT_SHADER, VARY);
  for (const s of rep.REPTILES) {
    const size = 3 + 16 * s.length;
    const ext = size * (s.form === 3 ? 1.0 : 0.68) + 5;
    const S = Math.max(1, Math.min(14, Math.floor(Math.min(W / 2 - 8, H / 2 - 8) / ext)));
    clear();
    const moving = s.form === 3 ? 0.55 : 1;
    draw(rProg, (u) => {
      u('a_vPose', 100, 100, 0, 0);
      u('a_vShape', size, s.form, s.pattern, 0);
      u('a_vBase', s.colour[0], s.colour[1], s.colour[2], s.spots);
      u('a_vAccent', s.accent[0], s.accent[1], s.accent[2], 0.37);
      u('a_vEye', s.eye[0], s.eye[1], s.eye[2], 0);
      u('a_vLook', 1, 0, 1, 0.5);
      u('a_vMove', moving, size * 1.3, 0, 3.3);
      u('a_vBody', s.girth, s.tail, s.legs, s.bulk);
      u('a_vTrait', s.traits, s.waves, 0.55, 0);
    }, ext, S);
    shot(s.key);
  }

  const AVARY = ['vPose', 'vShape', 'vBase', 'vAccent', 'vEye', 'vLook', 'vMove'];
  const aProg = build(src.AMPHIBIAN_FRAGMENT_SHADER, AVARY);
  for (const s of amp.AMPHIBIANS) {
    const size = amp.bodyTexels(s);
    const ext = size * 0.85 + 2;
    const S = Math.max(2, Math.min(16, Math.floor(Math.min(W / 2 - 8, H / 2 - 8) / ext)));
    clear();
    draw(aProg, (u) => {
      u('a_vPose', 100, 100, 0, 0.0);
      u('a_vShape', size, s.form, s.pattern, 0);
      u('a_vBase', s.colour[0], s.colour[1], s.colour[2], s.spots);
      u('a_vAccent', s.accent[0], s.accent[1], s.accent[2], 0.37);
      u('a_vEye', s.eye[0], s.eye[1], s.eye[2], 0);
      u('a_vLook', 1, 0, 1, 0);
      u('a_vMove', s.form === 2 ? 1 : 0, 3.0, 0, 0);
    }, ext, S);
    shot(s.key);
  }

  // ---- insects and fish in 2D pixel art
  const c2 = document.createElement('canvas'); c2.width = 160; c2.height = 110;
  const g = c2.getContext('2d');
  const P = 5;
  const col = (c, k = 1) => `rgb(${Math.min(255, Math.round(c[0] * 255 * k))},${Math.min(255, Math.round(c[1] * 255 * k))},${Math.min(255, Math.round(c[2] * 255 * k))})`;
  const clear2 = () => { g.fillStyle = `rgb(${BG.join(',')})`; g.fillRect(0, 0, 160, 110); g.globalAlpha = 1; };
  const dot = (x, y, c) => { g.fillStyle = c; g.fillRect(Math.round(x) * P, Math.round(y) * P, P, P); };
  const ell = (cx, cy, rx, ry, c, a = 1, rot = 0) => {
    g.globalAlpha = a; g.fillStyle = c;
    for (let y = -ry - 2; y <= ry + 2; y++) for (let x = -rx - 2; x <= rx + 2; x++) {
      const px = x * Math.cos(rot) + y * Math.sin(rot), py = -x * Math.sin(rot) + y * Math.cos(rot);
      if ((px * px) / (rx * rx + 0.01) + (py * py) / (ry * ry + 0.01) <= 1) g.fillRect(Math.round(cx + x) * P, Math.round(cy + y) * P, P, P);
    }
    g.globalAlpha = 1;
  };
  const line = (x0, y0, x1, y1, c) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) dot(x0 + ((x1 - x0) * i) / (n || 1), y0 + ((y1 - y0) * i) / (n || 1), c); };
  const CX = 16, CY = 11;
  const WING = 'rgb(220,236,246)';
  const insect = {
    honeybee: (c) => { ell(CX - 2, CY - 4, 5, 3, WING, 0.7, -0.5); ell(CX + 2, CY - 4, 5, 3, WING, 0.7, 0.5); ell(CX - 4, CY, 4, 3, col(c)); ell(CX, CY, 3, 3, col(c, 0.35)); ell(CX + 3, CY, 3, 3, col(c)); ell(CX + 6, CY, 2, 2, col(c, 0.35)); line(CX - 2, CY + 3, CX - 4, CY + 6, '#222'); line(CX + 1, CY + 3, CX + 2, CY + 6, '#222'); },
    bumblebee: (c) => { ell(CX - 2, CY - 4, 5, 3, WING, 0.7, -0.5); ell(CX + 2, CY - 4, 5, 3, WING, 0.7, 0.5); ell(CX - 4, CY, 5, 4, col(c)); ell(CX + 1, CY, 4, 4, col(c, 0.25)); ell(CX + 6, CY, 3, 3, col(c)); line(CX - 3, CY + 4, CX - 5, CY + 7, '#222'); line(CX + 2, CY + 4, CX + 3, CY + 7, '#222'); },
    butterfly: (c) => { ell(CX - 6, CY - 3, 6, 5, col(c), 0.95, -0.4); ell(CX + 6, CY - 3, 6, 5, col(c), 0.95, 0.4); ell(CX - 5, CY + 4, 5, 4, col(c, 0.8), 0.95, 0.4); ell(CX + 5, CY + 4, 5, 4, col(c, 0.8), 0.95, -0.4); ell(CX, CY, 1, 6, '#2a2218'); dot(CX - 1, CY - 7, '#2a2218'); dot(CX + 1, CY - 7, '#2a2218'); ell(CX - 7, CY - 3, 1, 1, '#fff', 1); ell(CX + 7, CY - 3, 1, 1, '#fff', 1); },
    moth: (c) => { ell(CX - 6, CY - 1, 7, 5, col(c), 1, -0.3); ell(CX + 6, CY - 1, 7, 5, col(c), 1, 0.3); ell(CX - 6, CY - 1, 3, 2, col(c, 0.7), 1, -0.3); ell(CX + 6, CY - 1, 3, 2, col(c, 0.7), 1, 0.3); ell(CX, CY, 2, 5, col(c, 0.8)); line(CX - 1, CY - 6, CX - 4, CY - 9, '#3a3228'); line(CX + 1, CY - 6, CX + 4, CY - 9, '#3a3228'); },
    dragonfly: (c) => { ell(CX - 7, CY - 3, 8, 2, WING, 0.8, -0.1); ell(CX + 7, CY - 3, 8, 2, WING, 0.8, 0.1); ell(CX - 7, CY + 1, 8, 2, WING, 0.8, 0.1); ell(CX + 7, CY + 1, 8, 2, WING, 0.8, -0.1); ell(CX, CY - 1, 2, 11, col(c), 1, 1.5707); for (let i = -9; i <= 8; i += 3) dot(CX + i, CY - 1, col(c, 0.5)); ell(CX - 10, CY - 1, 3, 3, col(c, 1.2)); },
    midge: (c) => { for (let i = 0; i < 26; i++) { const a = (i * 2.4) % 6.28, r = 3 + ((i * 7) % 11); const x = CX + Math.cos(a) * r, y = CY + Math.sin(a) * r * 0.7; dot(x, y, '#2a2a2a'); if (i % 3 === 0) dot(x + 1, y - 1, 'rgba(120,120,120,1)'); } ell(CX, CY, 1, 2, '#222'); },
    firefly: (c) => { ell(CX + 3, CY, 6, 6, col(c), 0.22); ell(CX + 3, CY, 4, 4, col(c), 0.35); ell(CX - 3, CY, 5, 3, '#3a3228'); ell(CX - 5, CY, 3, 2, '#5a4a3a'); ell(CX + 3, CY, 3, 2, col(c)); ell(CX - 3, CY - 4, 4, 2, WING, 0.5, 0.6); },
    ant: (c) => { ell(CX - 6, CY, 3, 3, '#1d1612'); ell(CX - 1, CY, 2, 2, '#1d1612'); ell(CX + 5, CY, 4, 3, '#1d1612'); for (const dx of [-3, 0, 3]) { line(CX + dx - 1, CY, CX + dx - 3, CY - 6, '#2a2018'); line(CX + dx - 1, CY, CX + dx - 3, CY + 6, '#2a2018'); } line(CX - 8, CY - 1, CX - 12, CY - 5, '#2a2018'); line(CX - 8, CY + 1, CX - 12, CY + 5, '#2a2018'); },
    beetle: (c) => { ell(CX, CY, 7, 5, col(c, 1.4)); line(CX, CY - 5, CX, CY + 5, col(c, 0.5)); ell(CX - 7, CY, 2, 2, col(c, 0.8)); for (const dx of [-4, 0, 4]) { line(CX + dx, CY + 4, CX + dx - 1, CY + 8, '#222'); line(CX + dx, CY - 4, CX + dx - 1, CY - 8, '#222'); } },
    grasshopper: (c) => { ell(CX, CY, 8, 2, col(c)); ell(CX - 9, CY - 1, 3, 3, col(c, 1.1)); dot(CX - 10, CY - 2, '#111'); line(CX + 1, CY + 1, CX + 7, CY - 5, col(c, 0.7)); line(CX + 7, CY - 5, CX + 12, CY + 4, col(c, 0.7)); line(CX - 4, CY + 2, CX - 6, CY + 6, '#333'); ell(CX + 4, CY - 2, 6, 1, col(c, 0.85), 0.9); },
    termite: (c) => { ell(CX - 6, CY, 3, 3, '#cdb88a'); ell(CX - 1, CY, 3, 2, '#d8c598'); ell(CX + 5, CY, 4, 3, '#e0d0a8'); for (const dx of [-3, 0, 3]) { line(CX + dx, CY, CX + dx - 2, CY - 5, '#8a7a5a'); line(CX + dx, CY, CX + dx - 2, CY + 5, '#8a7a5a'); } },
    waterrunner: (c) => { for (const r of [14, 9]) { g.strokeStyle = 'rgba(120,160,190,0.7)'; g.lineWidth = 2; g.beginPath(); g.ellipse(CX * P, CY * P, r * P, r * P * 0.55, 0, 0, 6.28); g.stroke(); } ell(CX, CY, 3, 1, '#16181c'); line(CX, CY, CX - 10, CY - 7, '#16181c'); line(CX, CY, CX + 10, CY - 7, '#16181c'); line(CX, CY, CX - 11, CY + 5, '#16181c'); line(CX, CY, CX + 11, CY + 5, '#16181c'); line(CX - 2, CY, CX - 6, CY - 3, '#16181c'); },
    fly: (c) => { ell(CX - 4, CY - 4, 6, 3, WING, 0.75, -0.6); ell(CX + 5, CY - 4, 6, 3, WING, 0.75, 0.6); ell(CX, CY, 4, 3, '#2a2a30'); ell(CX - 5, CY, 2, 2, '#6a2a22'); for (const dx of [-1, 1, 3]) line(CX + dx, CY + 2, CX + dx - 1, CY + 6, '#222'); },
  };
  for (const s of ins.INSECTS) {
    if (!insect[s.key]) continue;
    clear2(); insect[s.key](s.colour);
    out[s.key] = c2.toDataURL('image/png');
  }

  // fish, seen from above
  const FISHC = { minnow: ['#aab6b4', '#4a5a58', 0.12, 0.8], perch: ['#7a8a4a', '#3a4a22', 0.2, 1.0], carp: ['#b0803a', '#8a5a22', 0.26, 1.2], trout: ['#8a9078', '#2a2a22', 0.2, 1.0], pike: ['#6a7a3a', '#cfd290', 0.14, 1.5], herring: ['#9aaab6', '#4a5a6a', 0.13, 0.9], mackerel: ['#4a7a8a', '#1a2a3a', 0.16, 1.0], flatfish: ['#8a7a5a', '#4a3a22', 0.4, 0.7], cod: ['#8a8060', '#4a4030', 0.2, 1.1], tuna: ['#2a4a7a', '#0a1a3a', 0.2, 1.4] };
  for (const s of fsh.FISH) {
    const [body, mark, thick, len] = FISHC[s.key];
    clear2();
    g.fillStyle = 'rgba(70,110,140,0.22)'; g.fillRect(0, 0, 160, 110);
    const L = Math.round(8 * len), T = Math.max(1, Math.round(L * thick * 0.9));
    ell(CX, CY, L, T, body);
    ell(CX + L - 2, CY, Math.max(2, Math.round(L / 3)), Math.max(1, Math.round(T * 0.8)), body);
    ell(CX - L - 2, CY - 1, 2, Math.max(2, T), mark, 0.9, 0.6); ell(CX - L - 2, CY + 1, 2, Math.max(2, T), mark, 0.9, -0.6);
    ell(CX, CY - T - 1, Math.round(L * 0.5), 1, mark, 0.9);
    for (let i = -2; i <= 2; i++) if (s.key === 'perch' || s.key === 'mackerel') line(CX + i * 3, CY - T, CX + i * 3, CY + T, mark);
    if (s.key === 'trout' || s.key === 'pike' || s.key === 'flatfish' || s.key === 'cod') for (let i = 0; i < 14; i++) dot(CX - L + ((i * 5) % (2 * L)), CY - T + ((i * 3) % (2 * T)), mark);
    dot(CX + L - 1, CY - Math.max(1, T / 2), '#111'); dot(CX + L - 1, CY + Math.max(1, T / 2), '#111');
    ell(CX - 2, CY + T + 2, 2, 1, mark, 0.8, 0.5); ell(CX - 2, CY - T - 2, 2, 1, mark, 0.8, -0.5);
    out[s.key] = c2.toDataURL('image/png');
  }
  return JSON.stringify(out);
})()
