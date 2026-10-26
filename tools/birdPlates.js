(async () => {
  const src = await import(location.origin + '/src/render/lit/shaders/shaderSources.ts');
  const bds = await import(location.origin + '/src/sim/birds/species.ts');
  const out = {};
  const BG = [236, 228, 208];
  const W = 400, H = 220;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const gl = cv.getContext('webgl2', { preserveDrawingBuffer: true, alpha: false });
  const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
  const VARY = ['vPose', 'vShape', 'vBase', 'vAccent', 'vEye', 'vBill', 'vLook', 'vMove', 'vBody'];
  const decl = VARY.map((v) => `flat out vec4 ${v};`).join('\n');
  const assign = VARY.map((v) => `${v}=a_${v};`).join(' ');
  const uni = VARY.map((v) => `uniform vec4 a_${v};`).join('\n');
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
  gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, src.BIRD_FRAGMENT_SHADER));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([200, 185, 140, 255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.viewport(0, 0, W, H);

  for (const s of bds.BIRDS) {
    const size = 3 + 16 * s.length;
    const span = 2 + 16 * s.span;
    const ext = 0.5 * Math.max(size, span) * 1.15 + 5 + ((s.traits & 1024) ? size * 0.9 : 0);
    const S = Math.max(1, Math.min(14, Math.floor(Math.min(W / 4 - 6, H / 2 - 6) / ext)));
    gl.clearColor(BG[0] / 255, BG[1] / 255, BG[2] / 255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog);
    const u = (n, ...v) => gl['uniform' + v.length + 'f'](gl.getUniformLocation(prog, n), ...v);
    gl.uniform1i(gl.getUniformLocation(prog, 'uGround'), 0);
    const pose = (cx, flying, fan) => {
      u('uBuffer', W, H); u('uBuf', W, H); u('uCentre', cx, H / 2); u('uHalf', ext * S); u('uTpp', 1 / (16 * S));
      u('a_vPose', 100, 100, 0, flying);
      u('a_vShape', size, span, s.gait, 0);
      u('a_vBase', s.colour[0], s.colour[1], s.colour[2], s.pattern);
      u('a_vAccent', s.accent[0], s.accent[1], s.accent[2], 0.37);
      u('a_vEye', s.eye[0], s.eye[1], s.eye[2], 0);
      u('a_vBill', s.bill[0], s.bill[1], s.bill[2], s.tail);
      u('a_vLook', 1, 0, 1, s.spots);
      const clk = (flying ? 0.5 : 0) / s.beat / 6.2831853 * 1.2;
      u('a_vMove', flying, size * 1.3, clk, 0);
      u('a_vBody', s.bulk, s.beat, s.traits, fan);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    pose(W / 4, 0, (s.traits & 1024) ? 1 : 0);
    pose((3 * W) / 4, (s.traits & 512) ? 0 : 1, 0);
    out[s.key] = cv.toDataURL('image/png');
  }
  return JSON.stringify(out);
})()
