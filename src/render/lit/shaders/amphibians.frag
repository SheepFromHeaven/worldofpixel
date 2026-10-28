#version 300 es
precision highp float;

in vec2 vWorld;
flat in vec4 vPose;
flat in vec4 vShape;
flat in vec4 vBase;
flat in vec4 vAccent;
flat in vec4 vEye;
flat in vec4 vLook;
flat in vec4 vMove;
uniform vec2 uBuffer;
uniform sampler2D uGround;
uniform float uZooFlat;
out vec4 outColour;

const float T = float(AMPHIBIAN_TEXELS);
const float PI = 3.14159265;
const vec3 JELLY = vec3(0.78, 0.88, 0.82);
const vec3 NUCLEUS = vec3(0.09, 0.11, 0.08);
const vec3 SAC = vec3(0.92, 0.9, 0.72);

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

float texelHash(vec2 p, float seed) {
  vec3 q = fract(vec3(p.xyx + seed) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

float capsule(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

float ellipse(vec2 p, vec2 c, vec2 r) {
  return (length((p - c) / r) - 1.0) * min(r.x, r.y);
}

float tapered(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}

struct Shape {
  float edge;
  float eye;
  float sac;
  float limb;
};

Shape creature(vec2 p, float L, float form, float stretch, float moving, float phase, float call) {
  Shape s;
  s.eye = 1e3;
  s.sac = 1e3;
  s.limb = 1e3;
  float limb = max(0.5, 0.075 * L);
  if (form > 1.5) {
    float wave = sin(p.x * 0.9 / max(1.0, L * 0.18) - phase) * moving * 0.09 * L * (0.35 + 0.65 * clamp(0.5 - p.x / L, 0.0, 1.0));
    p.y -= wave;
    float body = tapered(p, vec2(0.3 * L, 0.0), vec2(-0.05 * L, 0.0), max(0.6, 0.095 * L), max(0.55, 0.08 * L));
    float tail = tapered(p, vec2(-0.05 * L, 0.0), vec2(-0.5 * L, 0.0), max(0.55, 0.08 * L), 0.28);
    float head = ellipse(p, vec2(0.33 * L, 0.0), vec2(max(0.9, 0.12 * L), max(0.7, 0.1 * L)));
    float d = min(min(body, tail), head);
    float legs = 1e3;
    for (int k = 0; k < 4; k++) {
      float sy = (k & 1) == 0 ? 1.0 : -1.0;
      float front = k < 2 ? 1.0 : 0.0;
      float swing = sin(phase * 1.0 + (sy > 0.0 ? 0.0 : PI) + (front > 0.5 ? 0.0 : PI)) * moving * 0.07 * L;
      float x = front > 0.5 ? 0.16 * L : -0.1 * L;
      legs = min(legs, capsule(p, vec2(x, sy * 0.05 * L), vec2(x + swing, sy * 0.24 * L), limb * 0.8));
    }
    s.limb = legs;
    s.edge = min(d, legs);
    s.eye = min(length(p - vec2(0.36 * L, 0.07 * L)), length(p - vec2(0.36 * L, -0.07 * L))) - 0.45;
    return s;
  }

  bool toad = form > 0.5;
  vec2 bodyR = toad ? vec2(0.38 * L, 0.33 * L) : vec2(0.36 * L, 0.27 * L);
  float body = ellipse(p, vec2(toad ? -0.02 * L : -0.06 * L, 0.0), max(bodyR, vec2(1.3, 1.0)));
  float head = ellipse(p, vec2(0.3 * L, 0.0), max(vec2(0.17 * L, 0.2 * L), vec2(0.8, 0.8)));
  float d = min(body, head);
  float legs = 1e3;
  float eyeR = max(0.45, 0.065 * L);
  float eyes = 1e3;
  for (int k = 0; k < 2; k++) {
    float sy = k == 0 ? 1.0 : -1.0;
    vec2 hip = vec2(-0.2 * L, sy * 0.2 * L);
    vec2 knee = vec2(mix(-0.4, -0.55, stretch) * L, sy * mix(toad ? 0.4 : 0.38, 0.24, stretch) * L);
    vec2 foot = vec2(mix(toad ? -0.34 : -0.28, -0.8, stretch) * L, sy * mix(toad ? 0.38 : 0.34, 0.12, stretch) * L);
    legs = min(legs, capsule(p, hip, knee, limb * (toad ? 1.2 : 1.1)));
    legs = min(legs, capsule(p, knee, foot, limb * 0.9));
    vec2 shoulder = vec2(0.17 * L, sy * 0.2 * L);
    vec2 hand = vec2(mix(0.22, 0.4, stretch) * L, sy * mix(0.36, 0.18, stretch) * L);
    legs = min(legs, capsule(p, shoulder, hand, max(0.45, 0.06 * L)));
    eyes = min(eyes, length(p - vec2(0.33 * L, sy * 0.15 * L)) - eyeR);
  }
  s.limb = legs;
  s.eye = eyes;
  float sacReach = 0.15 * L * call;
  s.sac = call > 0.0 ? ellipse(p, vec2(0.45 * L, 0.0), vec2(max(0.7, sacReach), max(0.6, sacReach * 0.9))) : 1e3;
  s.edge = min(min(min(d, legs), eyes), s.sac);
  return s;
}

vec3 skin(Shape s, vec2 d, vec2 p, float L, float pattern) {
  float seed = vAccent.w * 91.0;
  vec3 colour = vBase.rgb;
  float spots = vBase.w;
  if (pattern > 2.5) {
    if (texelHash(floor(d * 0.55), seed) < spots) colour = vAccent.rgb;
  } else if (pattern > 1.5) {
    float stripe = step(abs(p.y), 0.55) * step(abs(p.x + 0.05 * L), 0.36 * L);
    if (stripe > 0.5) colour = vAccent.rgb;
    else if (texelHash(d, seed) < spots * 0.5) colour = vBase.rgb * 0.75;
  } else if (pattern > 0.5) {
    if (texelHash(d, seed) < spots * 0.7) colour = vAccent.rgb;
  }
  float shade = uZooFlat > 0.5 ? 0.0 : floor(clamp(-(d.x + d.y) / (0.6 * L), -1.0, 1.0) * 2.0 + 0.5) / 2.0;
  colour *= 1.0 + 0.14 * shade;
  if (s.edge > -0.9 && L > 4.5 && uZooFlat < 0.5) colour *= 0.7;
  if (s.limb < s.edge + 0.01 && s.limb < -0.2 && L > 4.5) colour *= 0.9;
  return colour;
}

void main() {
  float kind = vShape.w;
  float alive = vLook.x;
  vec2 texel = floor(vWorld * T) + 0.5;
  vec2 d = texel - vPose.xy * T;
  float c = cos(vPose.z);
  float s = sin(vPose.z);
  vec2 p = vec2(c * d.x + s * d.y, -s * d.x + c * d.y);

  if (kind > 3.5 && kind < 4.5) {
    if (onWater() < 0.5) discard;
    float r = length(vWorld - vPose.xy) / 0.7;
    float width = max(0.08, 2.5 * fwidth(r));
    if (abs(r - vLook.y) > width || alive * 0.9 < bayer(gl_FragCoord.xy)) discard;
    outColour = vec4(vec3(1.0), 1.0);
    return;
  }

  if (kind > 4.5) {
    if (onWater() > 0.5) discard;
    float L = vShape.x;
    float r = length(vec2(p.x / (0.45 * L), p.y / (0.32 * L)));
    if (r >= 1.0 || alive * 0.55 < bayer(gl_FragCoord.xy)) discard;
    outColour = vec4(0.0, 0.0, 0.0, 0.45);
    return;
  }

  if (kind > 0.5 && kind < 1.5) {
    if (onWater() < 0.5) discard;
    float reach = 3.3 + 0.9 * (texelHash(floor(d), 5.0) - 0.5);
    if (length(d) > reach || texelHash(floor(d), 2.0) > 0.72) discard;
    bool dark = texelHash(floor(d), 9.0) < 0.4;
    outColour = vec4(dark ? NUCLEUS : JELLY * (0.55 + 0.45 * vLook.z), 0.9);
    if (alive < bayer(gl_FragCoord.xy)) discard;
    return;
  }

  if (kind > 1.5 && kind < 2.5) {
    if (onWater() < 0.5) discard;
    float along = floor(p.x);
    float line = floor(1.8 * sin(along * 0.7 + vAccent.w * 40.0) + 0.5);
    float across = floor(p.y) - line;
    if (abs(p.x) > 7.5 || abs(across) > 1.0 || texelHash(floor(d), 3.0) > 0.85) discard;
    bool dark = mod(along + across, 2.0) < 0.5;
    outColour = vec4(dark ? NUCLEUS : JELLY * (0.45 + 0.4 * vLook.z), 0.9);
    if (alive < bayer(gl_FragCoord.xy)) discard;
    return;
  }

  if (kind > 2.5 && kind < 3.5) {
    if (onWater() < 0.5) discard;
    float wag = sin(vMove.y + p.x * 1.5) * 0.45;
    float head = ellipse(p, vec2(0.0), vec2(1.3, 0.9));
    float tail = capsule(p, vec2(-0.8, 0.0), vec2(-3.0, wag * 2.0), 0.45);
    if (min(head, tail) > 0.0 || alive * 0.95 < bayer(gl_FragCoord.xy)) discard;
    outColour = vec4(vBase.rgb * 0.35 + vec3(0.02, 0.03, 0.02), 0.9);
    return;
  }

  float L = vShape.x;
  Shape shape = creature(p, L, vShape.y, vPose.w, vMove.x, vMove.y, vMove.z);
  if (shape.edge > 0.0) discard;
  if (alive < bayer(gl_FragCoord.xy)) discard;
  vec3 colour = skin(shape, d, p, L, vShape.z);
  if (shape.sac < 0.0) colour = SAC * (0.55 + 0.45 * vLook.z);
  if (shape.eye < 0.0) colour = vEye.rgb;
  outColour = vec4(colour, 1.0);
}
