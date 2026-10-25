#version 300 es
precision highp float;

in vec2 vLocal;
in vec4 vLook;
in vec3 vColour;
uniform vec2 uBuffer;
uniform sampler2D uGround;
out vec4 outColour;

float bayer(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  const float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (m[x + y * 4] + 0.5) / 16.0;
}

float onWater() {
  vec2 at = vec2(gl_FragCoord.x, uBuffer.y - gl_FragCoord.y);
  vec4 c = texture(uGround, clamp(at / uBuffer, 0.0, 1.0));
  return step(0.12, c.b - c.r);
}

void main() {
  float a = vLook.x;
  float kind = vLook.z;
  if (kind > 0.5 && kind < 1.5) {
    float r = length(vLocal);
    float fall = (1.0 - r) * (1.0 - r) * vLook.w * 0.9;
    if (r >= 1.0 || fall < bayer(gl_FragCoord.xy)) discard;
    outColour = vec4(vec3(0.8, 1.0, 0.3) * 0.5, 0.5);
    return;
  }
  if (kind > 1.5 && kind < 2.5) {
    if (onWater() < 0.5) discard;
    float r = length(vLocal);
    float width = max(0.08, 2.5 * fwidth(r));
    if (abs(r - vLook.y) > width || a * 0.9 < bayer(gl_FragCoord.xy)) discard;
    outColour = vec4(vec3(1.0), 1.0);
    return;
  }
  if (kind > 3.5) {
    float r = length(vLocal);
    float cover = 1.0 - r * r;
    if (r >= 1.0 || cover * 0.75 < bayer(gl_FragCoord.xy)) discard;
    float entrance = step(r, 0.1);
    outColour = vec4(vColour * (entrance > 0.5 ? 0.6 : 0.95), 1.0);
    return;
  }
  if (kind > 2.5 && kind < 3.5 && onWater() < 0.5) discard;
  if (a < 0.2) discard;
  outColour = vec4(vColour, 1.0);
}
