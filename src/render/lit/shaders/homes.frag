#version 300 es
precision highp float;

in vec2 vWorld;
flat in vec2 vCentre;
flat in vec4 vHome;
flat in vec4 vKind;
uniform vec2 uBuffer;
uniform sampler2D uGround;
out vec4 outColour;

const float T = float(HOME_TEXELS);
const float TAU = 6.2831853;
const float BUILT = 0.55;

float texelHash(vec2 p, float seed) {
  vec3 q = fract(vec3(p.xyx + seed) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

vec4 groundColour() {
  vec2 at = vec2(gl_FragCoord.x, uBuffer.y - gl_FragCoord.y);
  return texture(uGround, clamp(at / uBuffer, 0.0, 1.0));
}

float onWater() {
  vec4 c = groundColour();
  return step(0.12, c.b - c.r);
}

float bayer(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  const float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (m[x + y * 4] + 0.5) / 16.0;
}

void main() {
  if (onWater() > 0.5) discard;
  vec2 texel = floor(vWorld * T) + 0.5;
  vec2 d = texel / T - vCentre;
  float progress = vHome.x;
  float entrances = vHome.y;
  float radius = vHome.z;
  float seed = vHome.w * 91.0;
  float r = length(d) / radius;
  float jitter = (texelHash(texel, seed + 3.0) - 0.5) * 0.35;
  float e = r + jitter;
  if (e > 1.0) discard;
  vec3 ground = groundColour().rgb;
  vec3 earth = ground * 0.52 + vec3(0.05, 0.035, 0.02);
  float built = smoothstep(BUILT - 0.2, BUILT, progress);
  vec3 colour = mix(ground * 0.82, e > 0.62 ? earth * 1.12 : earth, built);
  if (built < 0.5 && texelHash(texel, seed + 11.0) > 0.55 + 0.4 * progress) discard;
  float holeSize = 0.11 * smoothstep(0.3, BUILT, progress);
  for (int i = 0; i < 8; i += 1) {
    if (float(i) >= entrances) break;
    float angle = texelHash(vec2(float(i), 5.0), seed) * TAU;
    float away = i == 0 ? 0.0 : radius * (0.5 + 0.2 * texelHash(vec2(float(i), 9.0), seed));
    vec2 at = vec2(cos(angle), sin(angle)) * away;
    float gap = length(d - at);
    if (gap < holeSize) colour = vec3(0.07, 0.05, 0.04);
    else if (gap < holeSize * 1.45 && holeSize > 0.01) colour = ground * 0.4 + vec3(0.03, 0.02, 0.01);
  }
  outColour = vec4(colour, 1.0);
}
