(async () => {
  const src = await import(location.origin + '/src/render/lit/shaders/shaderSources.ts');
  const mm = await import(location.origin + '/src/sim/mammals/species.ts');
  const only = (globalThis.__only ?? '').split(',').filter(Boolean);
  const out = {};
  const BG = [236, 228, 208];
  const W = 480, H = 300;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const gl = cv.getContext('webgl2', { preserveDrawingBuffer: true, alpha: false });
  const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
  const VARY = ['vPose', 'vShape', 'vBase', 'vAccent', 'vEye', 'vLook', 'vMove', 'vBody', 'vPart', 'vTrait'];
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
  gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, src.MAMMAL_FRAGMENT_SHADER));
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
  for (const s of mm.MAMMALS) {
    if (only.length && !only.includes(s.key)) continue;
    const size = 3 + 16 * s.length;
    const forward = 0.7 + s.neck + s.head + ((s.traits & 16) ? 0.6 : 0) + (s.horn > 0 ? 0.5 * s.hornSize : 0);
    const ext = size * Math.max(forward, 0.7 + s.tail) * 1.12 + 6;
    const bat = s.form === 3;
    const E = bat ? size * 3.4 + 6 : ext;
    const raw = Math.min(W / 4 - 6, H / 2 - 6) / E;
    const S = raw >= 1 ? Math.min(20, Math.floor(raw)) : raw;
    gl.clearColor(BG[0] / 255, BG[1] / 255, BG[2] / 255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog);
    const u = (n, ...v) => gl['uniform' + v.length + 'f'](gl.getUniformLocation(prog, n), ...v);
    gl.uniform1i(gl.getUniformLocation(prog, 'uGround'), 0);
    const pose = (cx, moving, posture) => {
      u('uBuffer', W, H); u('uBuf', W, H); u('uCentre', cx, H / 2); u('uHalf', E * S); u('uTpp', 1 / (16 * S));
      u('a_vPose', 100, 100, 0, 0);
      u('a_vShape', size, s.height * 16, s.form, 0);
      u('a_vBase', s.colour[0], s.colour[1], s.colour[2], s.pattern);
      u('a_vAccent', s.accent[0], s.accent[1], s.accent[2], 0.37);
      u('a_vEye', s.eye[0], s.eye[1], s.eye[2], 0);
      u('a_vLook', 1, 0, 1, s.spots);
      u('a_vMove', moving, size * 1.3 * (moving ? 1 : 0) + 3, 0.6, -1);
      u('a_vBody', s.bulk, s.neck, s.head, s.legs);
      u('a_vPart', s.tail, s.ears, s.horn, s.hornSize);
      u('a_vTrait', s.traits, s.gait, posture, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    pose(W / 4, 0, 0);
    pose((3 * W) / 4, 1, 0);
    out[s.key] = cv.toDataURL('image/png');
  }
  return JSON.stringify(out);
})()
