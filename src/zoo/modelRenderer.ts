const VERTEX = `#version 300 es
in vec2 aCorner;
void main() { gl_Position = vec4(aCorner, 0.0, 1.0); }`;

export interface ModelLook {
  yaw: number;
  pitch: number;
  distance: number;
  body: readonly [number, number, number, number];
  colour: readonly [number, number, number];
  accent: readonly [number, number, number];
  time: number;
  phase: number;
  walk: boolean;
  state?: number;
  travel?: number;
  pose?: readonly number[];
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ModelRenderer {
  draw(rect: Rect, look: ModelLook): void;
  dispose(): void;
}

const compile = (gl: WebGL2RenderingContext, type: number, source: string): WebGLShader => {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'shader failed');
  return shader;
};

const link = (gl: WebGL2RenderingContext, fragment: string): WebGLProgram => {
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link failed');
  return program;
};

export function createModelRenderer(gl: WebGL2RenderingContext, fragment: string): ModelRenderer {
  const program = link(gl, fragment);
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const corner = gl.getAttribLocation(program, 'aCorner');
  gl.enableVertexAttribArray(corner);
  gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
  const at = (name: string): WebGLUniformLocation | null => gl.getUniformLocation(program, name);
  const uniforms = { res: at('uRes'), origin: at('uOrigin'), cam: at('uCam'), body: at('uBody'), colour: at('uColour'), accent: at('uAccent'), time: at('uTime'), phase: at('uPhase'), walk: at('uWalk'), state: at('uState'), travel: at('uTravel'), pose: at('uPose') };
  return {
    draw(rect, look) {
      gl.useProgram(program);
      gl.enable(gl.SCISSOR_TEST);
      gl.viewport(rect.x, rect.y, rect.width, rect.height);
      gl.scissor(rect.x, rect.y, rect.width, rect.height);
      gl.uniform2f(uniforms.res, rect.width, rect.height);
      gl.uniform2f(uniforms.origin, rect.x, rect.y);
      gl.uniform3f(uniforms.cam, look.yaw, look.pitch, look.distance);
      gl.uniform4f(uniforms.body, ...look.body);
      gl.uniform3f(uniforms.colour, ...look.colour);
      gl.uniform3f(uniforms.accent, ...look.accent);
      gl.uniform1f(uniforms.time, look.time);
      gl.uniform1f(uniforms.phase, look.phase);
      gl.uniform1f(uniforms.walk, look.walk ? 1 : 0);
      gl.uniform1f(uniforms.state, look.state ?? 0);
      gl.uniform1f(uniforms.travel, look.travel ?? 0);
      gl.uniform4f(uniforms.pose, look.pose?.[0] ?? 0, look.pose?.[1] ?? 0, look.pose?.[2] ?? 0, look.pose?.[3] ?? 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disable(gl.SCISSOR_TEST);
    },
    dispose() {
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
    },
  };
}
