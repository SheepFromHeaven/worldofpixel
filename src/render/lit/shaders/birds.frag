#version 300 es
precision highp float;

in vec2 vWorld;
flat in vec4 vPose;
flat in vec4 vShape;
flat in vec4 vBase;
flat in vec4 vAccent;
flat in vec4 vEye;
flat in vec4 vBill;
flat in vec4 vLook;
flat in vec4 vMove;
flat in vec4 vBody;
uniform vec2 uBuffer;
uniform sampler2D uGround;
uniform float uZooFlat;
out vec4 outColour;

const float T = float(BIRD_TEXELS);
const float PI = 3.14159265;
const float TAU = 6.2831853;
const int TRAIT_CREST = 1;
const int TRAIT_BILL = 2;
const int TRAIT_NECK = 4;
const int TRAIT_FORK = 8;
const int TRAIT_HOVER = 16;
const int TRAIT_HOOK = 128;
const int TRAIT_PLUME = 256;
const float SOAR = 2.0;
const vec2 SUN = vec2(-0.7071, -0.7071);
const float SHADOW_ALPHA = 0.3;

const float BODY = 0.0;
const float HEAD = 1.0;
const float BEAK = 2.0;
const float TAIL = 3.0;
const float WING = 4.0;

float bayer(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  const float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (m[x + y * 4] + 0.5) / 16.0;
}

vec4 groundColour() {
  vec2 at = vec2(gl_FragCoord.x, uBuffer.y - gl_FragCoord.y);
  return texture(uGround, clamp(at / uBuffer, 0.0, 1.0));
}

float onWater() {
  vec4 c = groundColour();
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

float tapered(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}

float ellipse(vec2 p, vec2 c, vec2 r) {
  return (length((p - c) / r) - 1.0) * min(r.x, r.y);
}

struct Bird {
  float edge;
  float part;
  float eye;
  float tip;
};

Bird bird(vec2 p, float L, float S, float bulk, float tailLength, int traits, float flying, float angle, float fan) {
  vec2 q = vec2(p.x, abs(p.y));
  float W = max(0.9, bulk * L);
  bool neck = (traits & TRAIT_NECK) != 0;
  bool hooked = (traits & TRAIT_HOOK) != 0;

  float body = ellipse(q, vec2(-0.04 * L, 0.0), vec2(0.42 * L, W * 1.15));

  float hr = neck ? max(0.8, 0.7 * W) : max(0.9, 0.95 * W);
  float hx = neck ? 0.62 * L : 0.4 * L;
  float head = length(q - vec2(hx, 0.0)) - hr;
  if (neck) head = min(head, capsule(q, vec2(0.26 * L, 0.0), vec2(hx, 0.0), max(0.5, 0.3 * W)));
  if ((traits & TRAIT_CREST) != 0) head = min(head, capsule(q, vec2(hx - hr * 0.5, 0.0), vec2(hx - hr * 1.8, 0.0), hr * 0.45));

  float billLength = ((traits & TRAIT_BILL) != 0 ? 0.3 * L : 0.1 * L) * (hooked ? 0.75 : 1.0) + 0.6;
  float beakStart = hx + hr * 0.6;
  float beak = capsule(q, vec2(beakStart, 0.0), vec2(beakStart + billLength, 0.0), max(0.38, 0.2 * W));
  if (hooked) beak = min(beak, length(q - vec2(beakStart + billLength, 0.0)) - max(0.45, 0.24 * W));

  float tl = tailLength * L * 0.9 + 1.0;
  vec2 root = vec2(-0.3 * L, 0.0);
  float tail;
  if ((traits & TRAIT_FORK) != 0) tail = capsule(q, root, vec2(-0.3 * L - tl, W * 0.9), max(0.35, 0.2 * W));
  else if ((traits & TRAIT_PLUME) != 0) tail = capsule(q, root, vec2(-0.3 * L - tl * 1.5, 0.0), max(0.45, 0.28 * W));
  else tail = tapered(q, root, vec2(-0.3 * L - tl, 0.0), W * 0.55, W * 0.9);
  if (fan > 0.01) tail = min(tail, ellipse(q, vec2(-0.3 * L - tl * 0.9, 0.0), vec2(tl * (0.5 + 0.6 * fan), W * (0.8 + 3.8 * fan))));

  float spanHalf = 0.5 * S;
  float rootR = max(1.0, 0.3 * L);
  float tipR = max(0.6, 0.12 * L);
  vec2 shoulder = vec2(0.1 * L, W * 0.45);
  float reach = spanHalf * cos(angle);
  vec2 tip = vec2(0.1 * L - spanHalf * (0.25 - 0.2 * sin(angle)), W * 0.45 + reach);
  float wing = flying > 0.5 ? tapered(q, shoulder, tip, rootR, tipR) : capsule(q, vec2(0.2 * L, W * 0.55), vec2(-0.3 * L, W * 0.7), W * 0.7);

  Bird b;
  b.edge = min(min(min(body, head), min(beak, tail)), wing);
  b.part = BODY;
  float best = body;
  if (tail < best) {
    best = tail;
    b.part = TAIL;
  }
  if (wing < best) {
    best = wing;
    b.part = WING;
  }
  if (head < best) {
    best = head;
    b.part = HEAD;
  }
  if (beak < best) {
    best = beak;
    b.part = BEAK;
  }
  b.eye = L >= 5.0 ? length(q - vec2(hx + hr * 0.15, hr * 0.55)) - 0.55 : 1.0;
  b.tip = flying > 0.5 ? step(W * 0.45 + 0.62 * reach, q.y) : step(q.x, -0.12 * L);
  return b;
}

void main() {
  float kind = vShape.w;
  float alive = vLook.x;
  vec2 texel = floor(vWorld * T) + 0.5;
  vec2 d = texel - vPose.xy * T;
  float c = cos(vPose.z);
  float s = sin(vPose.z);

  if (kind > 3.5 && kind < 4.5) {
    if (onWater() < 0.5) discard;
    float r = length(vWorld - vPose.xy) / vShape.x;
    float width = max(0.08, 2.5 * fwidth(r));
    if (abs(r - vLook.y) > width || alive * 0.9 < bayer(gl_FragCoord.xy)) discard;
    outColour = vec4(vec3(1.0), 1.0);
    return;
  }

  bool shadow = kind > 4.5;
  float L = vShape.x;
  float S = vShape.y;
  float gait = vShape.z;
  float pattern = vBase.w;
  float bulk = vBody.x;
  float beat = vBody.y;
  int traits = int(vBody.z + 0.5);
  float tailLength = vBill.w;
  float flying = vPose.w;
  float clk = vMove.z;

  vec2 p = vec2(c * d.x + s * d.y, -s * d.x + c * d.y);
  float reachLimit = max(L, S) * 0.62 + 5.0;
  if (length(p) > reachLimit * 1.3) discard;

  float amplitude = gait > 1.5 && gait < 2.5 ? 0.14 : 1.0;
  if (beat < 6.0 && gait < 1.5 || beat < 6.0 && gait > 3.5) amplitude *= 0.3 + 0.7 * smoothstep(-0.3, 0.3, sin(clk * 0.7));
  if ((traits & TRAIT_HOVER) != 0) amplitude = 1.2;
  float angle = amplitude * sin(TAU * beat * clk);
  if (gait > 1.5 && gait < 2.5) angle += 0.08 * sin(clk * 0.8);

  float fan = vBody.w;
  Bird sh = bird(p, L, S, bulk, tailLength, traits, flying, angle, fan);
  if (sh.edge > 0.0) discard;
  if (alive < bayer(gl_FragCoord.xy)) discard;
  if (!shadow && sh.part == WING && flying > 0.5 && (traits & TRAIT_HOVER) != 0 && bayer(gl_FragCoord.xy + 1.0) > 0.5) discard;

  if (shadow) {
    if (onWater() > 0.5) discard;
    outColour = vec4(0.0, 0.0, 0.0, SHADOW_ALPHA);
    return;
  }

  vec3 base = vBase.rgb;
  vec3 accent = vAccent.rgb;
  float seed = vAccent.w * 91.0;
  float W = max(0.9, bulk * L);
  vec3 colour = base;

  if (sh.part == BEAK) colour = vBill.rgb;
  else {
    if (sh.part == WING) colour = base * 0.88;
    if (sh.part == TAIL) colour = base * 0.94;
    if (pattern > 0.5 && pattern < 1.5) {
      if (sh.part == HEAD) colour = accent;
    } else if (pattern > 1.5 && pattern < 2.5) {
      if (sh.part == WING && sh.tip > 0.5) colour = accent;
      if (sh.part == TAIL && sh.tip > 0.5 && (traits & TRAIT_PLUME) != 0) colour = accent;
    } else if (pattern > 2.5 && pattern < 3.5) {
      if (texelHash(floor(d), seed) < vLook.w) colour = accent;
    } else if (pattern > 3.5 && pattern < 4.5) {
      if (abs(p.y) < max(0.5, 0.2 * W) && sh.part != WING) colour = accent;
    } else if (pattern > 4.5) {
      if (sh.part == WING && texelHash(floor(d * 0.6), seed) < vLook.w) colour = accent;
    }
    if ((traits & TRAIT_PLUME) != 0 && sh.part == TAIL && pattern < 1.5) colour = mix(base, accent, 0.6);
    if (fan > 0.2 && sh.part == TAIL) colour = texelHash(floor(d * 0.6), seed) < 0.4 ? accent : base * 0.85;
    float shade = uZooFlat > 0.5 ? 0.0 : floor(clamp(-(d.x + d.y) / (0.7 * L), -1.0, 1.0) * 2.0 + 0.5) / 2.0;
    colour *= 1.0 + 0.14 * shade;
  }
  if (uZooFlat < 0.5) {
    if (sh.edge > -0.9 && L > 8.0) colour *= 0.7;
    else if (sh.edge > -0.6) colour *= 0.88;
  }
  if (sh.eye < 0.0 && sh.part != BEAK) colour = vEye.rgb;
  outColour = vec4(colour, 1.0);
}
