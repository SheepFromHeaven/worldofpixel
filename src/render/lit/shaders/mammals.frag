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
flat in vec4 vBody;
flat in vec4 vPart;
flat in vec4 vTrait;
flat in float vGlance;
flat in vec4 vFlex;
uniform vec2 uBuffer;
uniform sampler2D uGround;
uniform float uZooFlat;
uniform float uXray;
out vec4 outColour;

const float T = float(MAMMAL_TEXELS);
const float PI = 3.14159265;
const float TAU = 6.2831853;
const vec2 SUN = vec2(-0.7071, -0.7071);
const float SHADOW_ALPHA = 0.28;
const float XRAY_SHARE = 0.45;
const vec3 XRAY_TINT = vec3(0.92, 0.96, 1.0);

const int TRAIT_MANE = 1;
const int TRAIT_HUMP = 2;
const int TRAIT_QUILLS = 4;
const int TRAIT_ARMOUR = 8;
const int TRAIT_TRUNK = 16;
const int TRAIT_POUCH = 64;
const int TRAIT_BUSHY = 256;
const int TRAIT_SNOUT = 512;
const int TRAIT_DORSAL = 4096;
const int TRAIT_BILL = 16384;
const int TRAIT_GLIDE = 32768;
const int TRAIT_BACK = 524288;
const int TRAIT_RUFF = 2097152;
const int TRAIT_TUBE = 4194304;
const int TRAIT_LONGEARS = 8388608;

#include "system/parts.glsl"

const vec3 BONE = vec3(0.86, 0.8, 0.66);
const vec3 HORN_DARK = vec3(0.3, 0.26, 0.2);
const vec3 ANTLER = vec3(0.72, 0.6, 0.42);
const vec3 IVORY = vec3(0.93, 0.91, 0.84);
const vec3 DEEP = vec3(0.04, 0.12, 0.18);
const vec3 WATER_TINT = vec3(0.1, 0.24, 0.34);

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

vec2 rot(vec2 v, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

struct Beast {
  float edge;
  float part;
  float eye;
  float nose;
  float u;
  vec2 pc;
};

#define PICK(b, d, id) if ((d) < (b).edge) { (b).edge = (d); (b).part = (id); }

float hornShape(vec2 hp, float hl, float hw, float kind, float grow, float L, out float tag) {
  tag = HORN;
  if (grow <= 0.01 || kind < 0.5) return 1e3;
  vec2 h = vec2(hp.x, abs(hp.y));
  float S = grow * L * 0.3;
  float r = max(0.5, L * 0.011);
  vec2 b = vec2(hl * 0.1, hw * 0.8);
  if (kind < 1.5) {
    vec2 tip = b + S * vec2(0.5, 0.95);
    float d = capsule(h, b, tip, r);
    vec2 m1 = mix(b, tip, 0.4);
    vec2 m2 = mix(b, tip, 0.75);
    d = min(d, capsule(h, m1, m1 + S * vec2(0.55, 0.15), r * 0.9));
    d = min(d, capsule(h, m2, m2 + S * vec2(0.5, 0.2), r * 0.9));
    d = min(d, capsule(h, b, b + S * vec2(0.45, 0.1), r * 0.9));
    return d;
  }
  if (kind < 2.5) {
    float R = S * 0.45;
    vec2 c = vec2(-hl * 0.1, hw + R * 0.6);
    float ring = abs(length(h - c) - R) - r * 1.5;
    return max(ring, c.x - h.x - R * 0.35);
  }
  if (kind < 3.5) return capsule(h, b, b + S * vec2(1.3, 0.25), r * 0.85);
  if (kind < 4.5) {
    vec2 m = b + S * vec2(0.25, 0.7);
    return min(capsule(h, b, m, r), capsule(h, m, m + S * vec2(0.8, 0.9), r * 0.85));
  }
  if (kind < 5.5) return capsule(h, b, b + S * vec2(0.3, 0.55), r * 1.1);
  if (kind < 6.5) {
    vec2 m = b + S * vec2(0.2, 0.9);
    return min(capsule(h, b, m, r * 1.6), capsule(h, m, m + S * vec2(0.9, 0.5), r * 1.2));
  }
  if (kind < 7.5) {
    float d = capsule(hp, vec2(hl * 0.72, 0.0), vec2(hl * 0.72 + S * 0.55, 0.0), r * 1.9);
    return min(d, capsule(hp, vec2(hl * 0.3, 0.0), vec2(hl * 0.3 + S * 0.25, 0.0), r * 1.3));
  }
  if (kind < 8.5) {
    tag = TUSK;
    vec2 t0 = vec2(hl * 0.85, hw * 0.6);
    return capsule(h, t0, t0 + S * vec2(1.1, 0.25), r * 1.1);
  }
  if (kind < 9.5) return length(h - b) - max(0.6, L * 0.014);
  vec2 c = b + S * vec2(0.3, 0.9);
  float d = ellipse(h, c, vec2(S * 0.55, S * 0.4));
  d = min(d, capsule(h, c + S * vec2(0.4, -0.2), c + S * vec2(0.8, -0.35), r));
  d = min(d, capsule(h, c + S * vec2(0.45, 0.1), c + S * vec2(0.9, 0.2), r));
  d = min(d, capsule(h, c + S * vec2(0.4, 0.35), c + S * vec2(0.8, 0.6), r));
  return d;
}

Beast animal(vec2 p, float L, float form, float bulk, float neck, float head, float legs, float tail, float ears, int traits, float horn, float hornGrow, float leg, float moving, float posture, float clk, float calf, float carry, float afloat, float seed, float lift, float glance) {
  p.x /= 1.0 + 0.35 * lift;
  float W = max(1.0, bulk * L * 0.5);
  bool primate = form > 6.5 && form < 7.5;
  bool roo = form > 7.5 && form < 8.5;
  bool longBody = form > 0.5 && form < 1.5;
  bool lying = posture > 1.5 && posture < 2.5;
  bool graze = posture > 0.5 && posture < 1.5;
  bool sentinel = posture > 3.5;
  bool snout = (traits & TRAIT_SNOUT) != 0;
  bool tube = (traits & TRAIT_TUBE) != 0;
  bool bushy = (traits & TRAIT_BUSHY) != 0;
  bool thin = tube && snout;
  bool anteater = thin && bushy;
  bool lagomorph = (traits & TRAIT_LONGEARS) != 0 && !tube;

  if (longBody) p.y -= 0.12 * L * sin(p.x / L * 6.0 - leg * 0.35) * moving;
  if (sentinel) {
    p.x *= 1.55;
    W *= 1.1;
  }
  vec2 q = vec2(p.x, abs(p.y));
  float Wb = lying ? W * 1.1 : W;
  float rR = Wb * (lagomorph ? 1.2 : 0.95);
  float rC = Wb * (primate ? 1.15 : (lagomorph ? 0.85 : 1.05));
  vec2 rump = vec2((primate ? -0.3 : -0.42) * L, 0.0);
  vec2 chest = vec2(0.02 * L, 0.0);

  float bodyEdge = tapered(q, rump, chest, rR, rC);
  if (primate) bodyEdge = min(bodyEdge, ellipse(q, chest + vec2(-0.03 * L, 0.0), vec2(0.1 * L, Wb * 1.55)));
  if ((traits & TRAIT_QUILLS) != 0) bodyEdge -= (texelHash(floor(p), seed) - 0.3) * 1.8;
  Beast b;
  b.edge = bodyEdge;
  b.part = BODY;
  b.pc = p;
  b.eye = 1.0;
  b.nose = 1.0;
  b.u = p.x / L;

  if ((traits & TRAIT_RUFF) != 0 && !lying) {
    float ruff = ellipse(q, vec2(0.04 * L, 0.0), vec2(0.15 * L, Wb * 1.32)) - (texelHash(floor(p), seed + 4.0) - 0.5) * 1.8;
    PICK(b, ruff, RUFF);
  }

  float nl = (neck + 0.02) * L * (graze ? 1.3 : (lying ? 0.7 : 1.0)) * (calf > 0.5 ? 0.8 : 1.0);
  float look = lying ? (texelHash(vec2(seed, 1.0), 3.0) > 0.5 ? 1.2 : -1.2) : 0.2 * sin(clk * 0.6 + seed) * (1.0 - moving);
  if (posture > 2.5 && posture < 3.5) look = 0.0;
  if (!lying) look += glance;
  if (anteater && !lying) look += 0.5 * sin(leg / max(2.0, 0.55 * L * (0.5 + 0.5 * legs)) * TAU) * moving;
  vec2 nb = chest + vec2(rC * 0.35, 0.0);
  vec2 ne = nb + rot(vec2(nl, 0.0), look * 0.65);
  float hl = head * L * (calf > 0.5 ? 1.3 : 1.0) * (snout ? 1.7 : 1.0);
  float hw = hl * (snout ? 0.3 : (primate ? 0.55 : 0.46));
  hw = max(0.7, hw);
  vec2 hp = rot(p - ne, -look * 0.9);
  vec2 hq = vec2(hp.x, abs(hp.y));

  float neckEdge = tapered(p, nb, ne, rC * 0.6, hw * 0.95);
  if (neckEdge < b.edge) b.pc = nb + rot(p - nb, -atan(ne.y - nb.y, ne.x - nb.x));
  PICK(b, neckEdge, BODY);
  float headEdge = ellipse(hq, vec2(hl * 0.45, 0.0), vec2(hl * 0.58, hw));
  vec2 eyeAt = vec2(hl * 0.55, hw * 0.55);
  vec2 noseAt = vec2(hl * 0.96, 0.0);
  if (tube) {
    float tw = max(1.0, hl * (thin ? 0.17 : 0.26));
    float skull = thin ? ellipse(hq, vec2(hl * 0.12, 0.0), vec2(hl * 0.2, max(1.0, hl * 0.2))) : ellipse(hq, vec2(hl * 0.15, 0.0), vec2(hl * 0.3, tw * 1.05));
    float muzzle = tapered(hq, vec2(hl * 0.2, 0.0), vec2(hl * 0.92, 0.0), tw * 0.8, tw * 0.5);
    float disc = thin ? 1.0 : ellipse(hq, vec2(hl * 0.96, 0.0), vec2(hl * 0.09, tw * 0.62));
    headEdge = min(skull, min(muzzle, disc));
    hw = thin ? max(1.0, hl * 0.2) : tw;
    eyeAt = thin ? vec2(hl * 0.2, hw * 0.5) : vec2(hl * 0.42, tw * 0.62);
    noseAt = vec2(hl * 1.0, 0.0);
  }
  PICK(b, headEdge, HEAD);
  b.eye = L >= 10.0 && !tube && !lagomorph && !primate && !((traits & TRAIT_ARMOUR) != 0 && snout) ? length(hq - eyeAt) - 0.55 : 1.0;
  b.nose = L >= 16.0 ? length(hq - noseAt) - max(0.6, L * 0.008) : 1.0;

  if ((traits & TRAIT_BILL) != 0) {
    float bill = ellipse(hq, vec2(hl * 1.0, 0.0), vec2(hl * 0.55, hw * 1.1));
    PICK(b, bill, BILL);
  }

  if (ears > 0.01 && (traits & TRAIT_LONGEARS) != 0) {
    float earLen = ears * L * 1.15;
    float earW = max(0.9, earLen * 0.27);
    vec2 base = vec2(-hl * 0.02, hw * 0.85);
    vec2 tip = base + (lagomorph ? vec2(-0.92, 0.32) : vec2(-0.62, 0.78)) * earLen;
    float longEar = tapered(hq, base, tip, earW, earW * 0.75);
    if (longEar < 0.0) {
      b.part = EAR;
      b.edge = min(b.edge, longEar);
    }
  } else if (ears > 0.01) {
    float earR = max(1.0, ears * L * 0.7);
    float flap = (traits & TRAIT_TRUNK) != 0 ? 0.25 * earR * sin(clk * 2.4 + seed) : 0.0;
    vec2 earC = vec2(-hl * 0.02, hw + earR * 0.55 + flap);
    float ear = ellipse(hq, earC, vec2(earR * 0.8, earR * 0.55));
    PICK(b, ear, EAR);
  }

  float tag = HORN;
  float hs = hornShape(hp, hl, hw, horn, hornGrow, L, tag);
  PICK(b, hs, tag);

  if ((traits & TRAIT_TRUNK) != 0) {
    float sway = 0.3 * sin(clk * 1.3 + seed * 3.0) * (0.4 + moving);
    float tr0 = hw * 0.55;
    vec2 t0 = vec2(hl * 0.75, 0.0);
    vec2 t1 = t0 + rot(vec2(0.2 * L, 0.0), sway);
    vec2 t2 = t1 + rot(vec2(0.18 * L, 0.0), sway * 2.0 + 0.2);
    float trunk = min(tapered(hp, t0, t1, tr0, tr0 * 0.65), tapered(hp, t1, t2, tr0 * 0.65, tr0 * 0.3));
    PICK(b, trunk, TRUNK);
  }

  if ((traits & TRAIT_MANE) != 0 && (traits & TRAIT_RUFF) == 0) {
    float mane = capsule(p, nb + vec2(-0.12 * L, 0.0), ne, max(0.55, L * 0.018));
    PICK(b, mane, MANE);
  }

  float ta = 0.35 * sin(clk * 1.9 + seed * 6.0) * (0.3 + moving);
  vec2 troot = vec2(rump.x - rR * 0.5, 0.0);
  vec2 tend = troot + vec2(-cos(ta), sin(ta)) * tail * L;
  float tr = max(0.6, W * 0.28) * (roo ? 1.7 : 1.0) * (bushy ? 1.6 : 1.0);
  if (anteater) tr = max(1.4, W * 0.75);
  bool scaly = (traits & TRAIT_ARMOUR) != 0 && snout;
  if (scaly) tr = max(1.2, W * 0.7);
  float tailEdge = tapered(p, troot, tend, tr, max(0.45, tr * (anteater ? 0.4 : (scaly ? 0.3 : (bushy ? 1.0 : 0.45)))));
  if (tail > 0.01) PICK(b, tailEdge, TAIL);

  if (!lying && afloat < 0.5 && !scaly) {
    float fr = max(1.1, L * (0.04 + 0.05 * bulk));
    float stance = primate ? Wb * 0.8 : Wb * 0.92 + fr * 0.45 * legs;
    float stride = max(2.0, 0.55 * L * (0.5 + 0.5 * legs));
    float ph = leg / stride * TAU;
    float amp = 0.09 * L * (0.4 + 0.6 * legs) * moving;
    float s1 = sin(ph);
    float s2 = -s1;
    float feet;
    if (roo) {
      vec2 rl = vec2(rump.x + 0.1 * L + amp * s1, stance);
      vec2 rr = vec2(rump.x + 0.1 * L + amp * s1, -stance);
      feet = min(capsule(p, rl, rl + vec2(0.25 * L, 0.0), fr * 0.9), capsule(p, rr, rr + vec2(0.25 * L, 0.0), fr * 0.9));
      feet = min(feet, min(length(p - vec2(chest.x, stance * 0.8)), length(p - vec2(chest.x, -stance * 0.8))) - fr * 0.6);
    } else {
      bool bounding = vTrait.y > 1.5 && vTrait.y < 3.5;
      float sf = bounding ? s1 : s2;
      float sr = bounding ? s2 : s1;
      float reach = lagomorph ? lift : 0.0;
      vec2 fl = vec2(chest.x - 0.02 * L + amp * s1 + 0.15 * L * reach, stance);
      vec2 fq = vec2(chest.x - 0.02 * L + amp * sf + 0.15 * L * reach, -stance);
      vec2 rl = vec2(rump.x + 0.1 * L + amp * s2 - 0.3 * L * reach, stance);
      vec2 rr = vec2(rump.x + 0.1 * L + amp * sr - 0.3 * L * reach, -stance);
      feet = min(min(length(p - fl), length(p - fq)), min(length(p - rl), length(p - rr))) - fr;
      if (primate && vTrait.y > 1.5 && vTrait.y < 2.5) feet = min(length(p - rl), length(p - rr)) - fr;
    }
    PICK(b, feet, LEG);
  }

  if ((traits & TRAIT_GLIDE) != 0 && lift > 0.2) {
    float membrane = ellipse(q, vec2(-0.1 * L, 0.0), vec2(0.28 * L, Wb * 2.0));
    PICK(b, membrane, WING);
  }

  if (carry > 0.5) {
    vec2 cc = (traits & TRAIT_BACK) != 0 ? vec2(-0.05 * L, 0.0) : vec2(0.14 * L, Wb * 0.2);
    float young = length(p - cc) - max(0.8, Wb * 0.4);
    PICK(b, young, YOUNG);
  }

  b.u = p.x / L;
  return b;
}

#include "system/projection.glsl"
#include "animalProfiles.glsl"

Beast cetacean(vec2 p, float L, float form, float bulk, float head, float tail, int traits, float horn, float hornGrow, float clk, float moving, float seed, float afloat) {
  float W = max(1.2, bulk * L * 0.5);
  float u0 = p.x / L + 0.5;
  p.y -= 0.07 * L * (1.0 - clamp(u0, 0.0, 1.0)) * sin(p.x / L * 4.0 - clk * 2.2);
  float u = p.x / L + 0.5;
  float prof = pow(max(sin(PI * pow(clamp(u, 0.0, 1.0), 0.8)), 0.0), form > 8.5 ? 0.55 : 0.9);
  float hw = W * prof;
  float body = max(abs(p.y) - hw, max(-u, u - 1.0) * L);
  Beast b;
  b.edge = body;
  b.part = BODY;
  b.pc = p;
  b.eye = 1.0;
  b.nose = 1.0;
  b.u = u;
  vec2 q = vec2(p.x, abs(p.y));
  if (head > 0.3) {
    float block = ellipse(q, vec2(0.34 * L, 0.0), vec2(0.16 * L, W * 0.95));
    PICK(b, block, HEAD);
  }
  if (form > 4.5 && form < 5.5) {
    float beak = capsule(q, vec2(0.44 * L, 0.0), vec2(0.52 * L, 0.0), max(0.7, L * 0.03));
    PICK(b, beak, HEAD);
  }
  float swing = 0.05 * L * sin(clk * 2.2);
  if (form > 8.5) {
    float paddle = ellipse(p, vec2(-0.56 * L, 0.0), vec2(0.08 * L, W * 0.9));
    PICK(b, paddle, FLUKE);
  } else {
    vec2 root = vec2(-0.5 * L, 0.0);
    vec2 tip = vec2(-0.5 * L - 0.1 * L - swing * 0.5, 0.13 * L * (0.8 + 0.2 * sin(clk * 2.2)));
    float fluke = tapered(q, root, vec2(tip.x, abs(tip.y)), max(0.8, L * 0.03), max(0.5, L * 0.012));
    PICK(b, fluke, FLUKE);
  }
  vec2 shoulder = vec2(0.14 * L, W * 0.85);
  float fl = tapered(q, shoulder, shoulder + vec2(-0.1 * L, 0.07 * L + W * 0.2 + 0.02 * L * sin(clk * 1.4)), max(0.7, L * 0.025), max(0.5, L * 0.01));
  PICK(b, fl, FLIPPER);
  if ((traits & TRAIT_DORSAL) != 0) {
    float fin = capsule(p, vec2(-0.04 * L, 0.0), vec2(-0.14 * L, 0.0), max(0.6, L * 0.014));
    PICK(b, fin, FLIPPER);
  }
  if (horn > 7.5 && horn < 8.5 && hornGrow > 0.01) {
    float tusk = capsule(p, vec2(0.46 * L, 0.0), vec2(0.46 * L + 0.3 * hornGrow * L, 0.0), max(0.55, L * 0.007));
    PICK(b, tusk, TUSK);
  }
  b.eye = L >= 10.0 ? length(q - vec2(0.36 * L, hw * 0.55)) - 0.6 : 1.0;
  return b;
}

float belugaWidth(float u) {
  const float U[11] = float[11](0.0, 0.06, 0.16, 0.32, 0.5, 0.66, 0.78, 0.86, 0.92, 0.975, 1.0);
  const float Wd[11] = float[11](0.06, 0.12, 0.3, 0.64, 0.9, 1.0, 0.95, 0.82, 0.86, 0.5, 0.0);
  u = clamp(u, 0.0, 1.0);
  for (int i = 0; i < 10; i++) {
    if (u <= U[i + 1]) return mix(Wd[i], Wd[i + 1], smoothstep(U[i], U[i + 1], u));
  }
  return 0.0;
}

Beast beluga(vec2 p, float L, float bulk, float clk, float moving, float seed) {
  float W = max(1.2, bulk * L * 0.5);
  float glide = 0.35 + 0.65 * moving;
  float u0 = clamp(p.x / L + 0.5, 0.0, 1.0);
  p.y -= glide * 0.035 * L * (1.0 - u0) * (1.0 - u0) * sin(u0 * 5.0 - clk * 2.2);
  float u = p.x / L + 0.5;
  float hw = W * belugaWidth(u);
  float body = max(abs(p.y) - hw, max(-u, u - 1.0) * L);
  Beast b;
  b.edge = body;
  b.part = BODY;
  b.pc = p;
  b.eye = 1.0;
  b.nose = 1.0;
  b.u = u;
  vec2 q = vec2(p.x, abs(p.y));
  float melon = ellipse(q, vec2(0.42 * L, 0.0), vec2(0.09 * L, W * 0.82));
  PICK(b, melon, HEAD);
  float ridge = capsule(p, vec2(-0.26 * L, 0.0), vec2(-0.06 * L, 0.0), max(0.5, L * 0.007));
  if (ridge < 0.0 && b.part == BODY && b.edge < 0.0) b.part = RUFF;
  float beat = sin(clk * 2.2 + 0.6);
  float span = 0.15 * L * (0.7 + 0.3 * abs(beat)) * (0.6 + 0.4 * glide);
  float sweep = 0.075 * L;
  vec2 root = vec2(-0.5 * L + 0.01 * L, 0.0);
  vec2 tip = vec2(-0.5 * L - sweep - 0.015 * L * beat, span);
  float fluke = tapered(q, root, tip, max(0.9, L * 0.028), max(0.45, L * 0.008));
  PICK(b, fluke, FLUKE);
  float sculls = 0.03 * L * sin(clk * 1.4 + seed * 6.0) * glide;
  vec2 shoulder = vec2(0.22 * L, hw * 0.9);
  float fl = tapered(q, shoulder, shoulder + vec2(-0.075 * L + sculls, 0.085 * L), max(0.8, L * 0.026), max(0.9, L * 0.032));
  PICK(b, fl, FLIPPER);
  vec2 eyeAt = vec2(0.37 * L, W * 0.5);
  b.eye = L >= 10.0 ? length(q - eyeAt) - max(0.55, L * 0.008) : 1.0;
  b.nose = L >= 10.0 ? length(vec2(p.x - 0.385 * L, p.y) * vec2(1.0, 2.2)) - max(0.5, L * 0.006) : 1.0;
  return b;
}

Beast seal(vec2 p, float L, float bulk, float horn, float hornGrow, float leg, float moving, float clk, float afloat, float seed, int traits) {
  float W = max(1.2, bulk * L * 0.5);
  vec2 q0 = p;
  float crawl = afloat > 0.5 ? 0.0 : 0.08 * L * sin(leg * 0.25) * moving;
  p.y -= crawl * (0.5 - p.x / L);
  vec2 q = vec2(p.x, abs(p.y));
  float body = tapered(q, vec2(-0.35 * L, 0.0), vec2(0.15 * L, 0.0), W * 0.55, W);
  Beast b;
  b.edge = body;
  b.part = BODY;
  b.pc = p;
  b.eye = 1.0;
  b.nose = 1.0;
  b.u = p.x / L;
  float hr = max(0.9, L * 0.09);
  float head = ellipse(q, vec2(0.38 * L, 0.0), vec2(hr * 1.3, hr));
  PICK(b, head, HEAD);
  float fl = tapered(q, vec2(0.15 * L, W * 0.9), vec2(0.04 * L + 0.02 * L * sin(clk * 1.3), W + 0.16 * L), max(0.8, L * 0.03), max(0.5, L * 0.012));
  PICK(b, fl, FLIPPER);
  float rear = tapered(q, vec2(-0.4 * L, 0.0), vec2(-0.56 * L, 0.1 * L + 0.02 * L * sin(clk * 2.0)), max(0.8, L * 0.03), max(0.5, L * 0.012));
  PICK(b, rear, FLIPPER);
  if (horn > 7.5 && horn < 8.5 && hornGrow > 0.01) {
    float tusk = capsule(q, vec2(0.42 * L, hr * 0.5), vec2(0.42 * L + 0.08 * L * hornGrow, hr * 0.5 + 0.07 * L * hornGrow), max(0.55, L * 0.01));
    PICK(b, tusk, TUSK);
  }
  b.eye = L >= 10.0 ? length(q - vec2(0.43 * L, hr * 0.5)) - 0.55 : 1.0;
  return b;
}

Beast bat(vec2 p, float L, float clk, float seed) {
  vec2 q = vec2(p.x, abs(p.y));
  float flap = 0.9 * sin(TAU * 8.0 * clk + seed * 40.0);
  float body = ellipse(q, vec2(0.0, 0.0), vec2(0.5 * L, max(0.8, 0.22 * L)));
  Beast b;
  b.edge = body;
  b.part = BODY;
  b.pc = p;
  b.eye = 1.0;
  b.nose = 1.0;
  b.u = 0.0;
  float head = length(q - vec2(0.46 * L, 0.0)) - max(0.7, 0.2 * L);
  PICK(b, head, HEAD);
  float span = 1.4 * L + 2.0;
  vec2 tip = vec2(-0.1 * span * (0.5 - 0.5 * flap), span * 0.5 * cos(flap));
  float wing = tapered(q, vec2(0.1 * L, 0.2 * L), vec2(tip.x, 0.2 * L + tip.y), max(0.8, 0.3 * L), 0.5);
  PICK(b, wing, WING);
  return b;
}

void main() {
  float kind = vShape.w;
  float alive = vLook.x;
  vec2 texel = floor(vWorld * T) + 0.5;
  vec2 d = texel - vPose.xy * T;

  if (kind > 3.5 && kind < 4.5) {
    if (onWater() < 0.5) discard;
    float r = length(vWorld - vPose.xy) / vShape.x;
    float width = max(0.08, 2.5 * fwidth(r));
    if (abs(r - vLook.y) > width || alive * 0.9 < bayer(gl_FragCoord.xy)) discard;
    outColour = vec4(vec3(1.0), 1.0);
    return;
  }

  if (kind > 5.5) {
    float r = length(vWorld - vPose.xy) / vShape.x;
    float jitter = (texelHash(floor(vWorld * T * 0.5), 3.0) - 0.5) * 0.35;
    float e = r + jitter;
    if (e > 1.0 || alive * 0.95 < bayer(gl_FragCoord.xy)) discard;
    vec3 ground = groundColour().rgb;
    vec3 earth = ground * 0.52 + vec3(0.05, 0.035, 0.02);
    vec3 colour = e > 0.62 ? earth * 1.12 : earth;
    if (e < 0.26) colour = vec3(0.07, 0.05, 0.04);
    outColour = vec4(colour, 1.0);
    return;
  }

  float L = vShape.x;
  float form = vShape.z;
  float pattern = vBase.w;
  float seed = vAccent.w * 91.0;
  float bulk = vBody.x;
  float neck = vBody.y;
  float head = vBody.z;
  float legs = vBody.w;
  float tail = vPart.x;
  float ears = vPart.y;
  float horn = vPart.z;
  float hornGrow = vPart.w;
  int traits = int(vTrait.x + 0.5);
  float posture = vTrait.z;
  int flags = int(vTrait.w + 0.5);
  float carry = float(flags & 1);
  float afloat = float((flags >> 1) & 1);
  float calf = float((flags >> 2) & 1);
  int profileId = (flags >> 4) & 255;
  float state = float(flags >> 12);
  bool profile = profileId > 0;
  float moving = vMove.x;
  float clk = vMove.z;
  float lift = vPose.w;
  float submerge = vEye.w;
  bool shadow = kind > 4.5;

  float c = cos(vPose.z);
  float s = sin(vPose.z);
  vec2 p = vec2(c * d.x + s * d.y, -s * d.x + c * d.y);
  p /= 1.0 + 0.22 * lift;
  float reachLimit = L * 1.7 + 12.0;
  if (length(p) > reachLimit) discard;

  Beast sh;
  if (profile) {
    vec2 pf = vec2(d.x, 0.5 - d.y);
    if (shadow) sh = profileShadow(pf, vPose.z, L);
    else sh = profileBeast(profileId, pf, vPose.z, L, legs, tail, ears, vMove.y, moving, clk, seed, posture, state, vFlex);
  } else if (form > 2.5 && form < 3.5) sh = bat(p, L, clk, seed);
  else if (form > 9.5) sh = beluga(p, L, bulk, clk, moving, seed);
  else if (form > 3.5 && form < 5.5 || form > 8.5) sh = cetacean(p, L, form, bulk, head, tail, traits, horn, hornGrow, clk, moving, seed, afloat);
  else if (form > 5.5 && form < 6.5) sh = seal(p, L, bulk, horn, hornGrow, vMove.y, moving, clk, afloat, seed, traits);
  else sh = animal(p, L, form, bulk, neck, head, legs, tail, ears, traits, horn, hornGrow, vMove.y, moving, posture, clk, calf, carry, afloat, seed, lift, vGlance);
  if (sh.edge > 0.0) discard;

  if (shadow) {
    if (onWater() > 0.5 || alive * 0.9 < bayer(gl_FragCoord.xy)) discard;
    outColour = vec4(0.0, 0.0, 0.0, SHADOW_ALPHA);
    return;
  }

  bool cet = form > 3.5 && form < 5.5 || form > 8.5;
  bool calfWhale = form > 9.5 && calf > 0.5;
  if (submerge > 0.5) {
    if (alive * 0.32 < bayer(gl_FragCoord.xy)) discard;
    outColour = vec4(mix(vBase.rgb * 0.5, DEEP, 0.6), 1.0);
    return;
  }
  if (alive < bayer(gl_FragCoord.xy)) discard;

  vec3 base = vBase.rgb;
  vec3 accent = vAccent.rgb;
  float spots = vLook.w;
  float W = max(1.0, bulk * L * 0.5);
  vec3 colour = base;
  float part = sh.part;

  if (part == HORN) {
    colour = (horn > 0.5 && horn < 1.5) || horn > 9.5 ? ANTLER : (horn > 6.5 && horn < 7.5 ? base * 0.9 + 0.1 : HORN_DARK);
    if (horn > 8.5 && horn < 9.5) colour = base * 0.75;
  } else if (part == TUSK) colour = IVORY;
  else if (part == BILL) colour = accent;
  else if (part == RUFF || part == MANE) colour = accent;
  else if (part == YOUNG) colour = mix(base, accent, 0.4) * 1.12;
  else if (part == HUMP) colour = base * 1.08;
  else if (part == FAR) colour = base * 0.66;
  else {
    if (part == LEG) colour = (pattern > 4.5 && pattern < 5.5 && ears > 0.0 && bulk > 0.4) ? accent : base * 0.84;
    if (part == TAIL) {
      colour = base * 0.96;
      if ((traits & TRAIT_LONGEARS) != 0 && (traits & TRAIT_TUBE) == 0) colour = mix(base, vec3(1.0), 0.75);
      if (pattern > 5.5 && pattern < 6.5 || pattern > 3.5 && pattern < 4.5 && (traits & TRAIT_BUSHY) != 0) colour = fract((p.x + L) / max(2.0, L * 0.14)) < 0.5 ? accent : base;
      if ((traits & TRAIT_BUSHY) != 0 && pattern < 0.5 && texelHash(floor(p), seed) < 0.2) colour = accent;
    }
    if (part == EAR) colour = (pattern > 4.5 && pattern < 5.5) || ((traits & TRAIT_LONGEARS) != 0 && (traits & TRAIT_TUBE) != 0) ? accent : base * 0.9;
    if (part == FLIPPER || part == FLUKE) colour = base * 0.78;
    if (part == WING) colour = base * 0.86;
    if (part == HEAD) {
      if (pattern > 3.5 && pattern < 4.5) colour = accent;
      if (pattern > 4.5 && pattern < 5.5 && !cet) colour = mix(base, accent, 0.55);
    }
    if (part == BODY || part == HEAD) {
      if (pattern > 0.5 && pattern < 1.5) {
        vec2 cell = floor(sh.pc / max(1.6, L * 0.034));
        if (texelHash(cell, seed) < spots * 0.62) colour = accent;
      } else if (pattern > 1.5 && pattern < 2.5) {
        float w = max(2.0, L * 0.07);
        float v = sh.pc.x + 0.7 * (texelHash(vec2(floor(sh.pc.y / 2.0), 3.0), seed) - 0.5) * w;
        if (fract(v / w) < 0.5) colour = accent;
      } else if (pattern > 2.5 && pattern < 3.5) {
        if (cet) {
          if (abs(sh.pc.y) > W * 0.55) colour = accent;
        } else {
          vec2 cell = floor(sh.pc / max(2.0, L * 0.075) + 0.4 * vec2(texelHash(floor(sh.pc * 0.3), seed), 0.0));
          if (texelHash(cell, seed + 7.0) < 0.62) colour = accent;
        }
      } else if (pattern > 4.5 && pattern < 5.5) {
        if (abs(sh.pc.y) < max(0.6, W * 0.38) && sh.pc.x > -0.45 * L && part == BODY) colour = accent;
      } else if (pattern > 5.5 && pattern < 6.5) {
        if (part == BODY && fract((sh.pc.x + L) / max(2.0, L * 0.15)) < 0.45) colour = accent;
      } else if (pattern > 6.5) {
        if (texelHash(floor(sh.pc), seed) < spots * 0.5) colour = accent;
      }
      if ((traits & TRAIT_ARMOUR) != 0 && part == BODY) colour = fract((sh.pc.x + L) / max(2.0, L * 0.11)) < 0.5 ? base : base * 0.78;
      if ((traits & TRAIT_QUILLS) != 0 && part == BODY) colour = texelHash(floor(sh.pc * 0.7), seed) < 0.5 ? base : mix(base, accent, 0.7);
    }
  }

  if (profile) colour = profileColour(profileId, part, sh.u, sh.pc, base, accent, colour);
  if (calfWhale) colour = mix(colour, vec3(0.5, 0.54, 0.6), 0.85);
  float shade = floor(clamp(-(d.x + d.y) / (0.7 * L), -1.0, 1.0) * 2.0 + 0.5) / 2.0;
  if (uZooFlat < 0.5) {
    colour *= 1.0 + 0.14 * shade;
    if (sh.edge > -0.9 && L > 8.0) colour *= 0.68;
    else if (sh.edge > -0.6) colour *= 0.88;
  }
  if (sh.eye < 0.0 && (part == HEAD || cet)) colour = vEye.rgb;
  if (sh.nose < 0.0 && part == HEAD) colour = vec3(0.07, 0.06, 0.06);
  if (afloat > 0.5 && !cet) colour = mix(colour, WATER_TINT, 0.22);
  if (cet && vMove.w >= 0.0) {
    float sp = vMove.w;
    vec2 blow = p - vec2(0.27 * L, 0.0);
    float rad = (0.03 + 0.1 * sp) * L;
    float puff = abs(length(blow) - rad) - max(0.6, 0.012 * L);
    float cloud = length(blow) - rad * 0.8;
    if ((puff < 0.0 || (cloud < 0.0 && texelHash(floor(d), seed + sp) < 0.5)) && sp < 0.95) colour = vec3(0.92, 0.95, 0.97);
  }
  if (uXray > 0.5) {
    if (bayer(gl_FragCoord.xy) > XRAY_SHARE) discard;
    colour = mix(colour, XRAY_TINT, 0.4);
  }
  outColour = vec4(colour, 1.0);
}
