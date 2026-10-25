#version 300 es
precision highp float;

in vec2 vLocal;
in vec4 vLook;
uniform vec2 uBuffer;
uniform float uTime;
uniform sampler2D uGround;
out vec4 colour;

const vec3 SHADOW = vec3(0.03, 0.08, 0.12);

float bayer(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  const float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (m[x + y * 4] + 0.5) / 16.0;
}

float inWater() {
  vec2 at = vec2(gl_FragCoord.x, uBuffer.y - gl_FragCoord.y);
  vec4 c = texture(uGround, clamp(at / uBuffer, 0.0, 1.0));
  return step(0.12, c.b - c.r);
}

void main() {
  if (inWater() < 0.5) discard;
  float alpha = vLook.x;
  if (vLook.z > 5.0) {
    float fall = 1.0 - length(vLocal);
    if (fall <= 0.0 || fall * 1.8 < bayer(gl_FragCoord.xy)) discard;
    colour = vec4(SHADOW * alpha, alpha);
    return;
  }
  float u = vLocal.x * 0.58;
  float v = vLocal.y * 0.34;
  float tailness = smoothstep(0.05, -0.45, u);
  float wiggle = sin(uTime * 4.5 + vLook.y + u * 7.0) * (0.012 + 0.03 * vLook.w + (0.03 + 0.06 * vLook.w) * tailness);
  float across = abs(v - wiggle - vLook.z * 0.5 * u * u);
  float t = (u - 0.2) / 0.36;
  float bodyRadius = 0.105 * sqrt(1.0 - min(t * t, 1.0));
  vec2 bodyGap = vec2(max(across - bodyRadius, 0.0), max(abs(t) - 1.0, 0.0) * 0.4);
  float bodyDistance = across <= bodyRadius && bodyGap.y <= 0.0 ? across - bodyRadius : length(bodyGap);
  float tailU = clamp(u, -0.56, -0.15);
  float fan = pow((-0.15 - tailU) / 0.41, 1.4);
  float tailRadius = 0.016 + fan * 0.1;
  vec2 tailGap = vec2(max(across - tailRadius, 0.0), abs(u - tailU));
  float tailDistance = across <= tailRadius && tailGap.y <= 0.0 ? across - tailRadius : length(tailGap);
  float notch = ((-0.47 - u) * 1.2 - across) * 0.6;
  tailDistance = max(tailDistance, notch);
  float soft = 1.0 - smoothstep(-0.025, 0.06, min(bodyDistance, tailDistance));
  if (soft * 0.8 < bayer(gl_FragCoord.xy)) discard;
  colour = vec4(SHADOW * alpha, alpha);
}
