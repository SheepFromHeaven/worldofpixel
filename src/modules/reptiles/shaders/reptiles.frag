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
flat in vec4 vTrait;
uniform vec2 uBuffer;
uniform sampler2D uGround;
uniform float uZooFlat;
out vec4 outColour;

const float T = float(REPTILE_TEXELS);
const float PI = 3.14159265;
const float TAU = 6.2831853;
const int SEGS = 22;
const int TAIL_SEGS = 8;
const int TRAIT_HOOD = 1;
const int TRAIT_RATTLE = 2;
const int TRAIT_TONGUE = 4;
const int TRAIT_BLUE_TONGUE = 8;
const int TRAIT_CREST = 16;
const int TRAIT_SPIKES = 32;
const int TRAIT_BEARD = 64;
const int TRAIT_CAMO = 128;
const int TRAIT_SIDEWIND = 256;
const int TRAIT_FLIPPERS = 1024;
const int TRAIT_DOME = 2048;
const vec3 TONGUE = vec3(0.82, 0.24, 0.3);
const vec3 TONGUE_BLUE = vec3(0.22, 0.46, 0.96);
const vec3 RATTLE = vec3(0.86, 0.8, 0.62);
const vec3 DEEP = vec3(0.1, 0.2, 0.28);
const vec2 SUN = vec2(-0.7071, -0.7071);

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

struct Shape {
  float edge;
  float eye;
  float limb;
  float tongue;
  float rattle;
  float solid;
  float shell;
  float s;
  float u;
  vec2 grad;
};

Shape blank() {
  Shape sh;
  sh.edge = 1e3;
  sh.eye = 1e3;
  sh.limb = 1e3;
  sh.tongue = 1e3;
  sh.rattle = 1e3;
  sh.solid = 1e3;
  sh.shell = 1e3;
  sh.s = 0.0;
  sh.u = 0.0;
  sh.grad = vec2(0.0);
  return sh;
}

float flicker(float clk, float busy) {
  float window = step(fract(clk * (0.34 + 0.4 * busy)), 0.13);
  return window * (0.45 + 0.55 * abs(sin(clk * 34.0)));
}

float radiusAt(float s, float R, float tailStart, float hood) {
  float neck = 0.78 + 0.22 * smoothstep(0.0, 0.12, s);
  float taper = 1.0 - 0.88 * smoothstep(tailStart, 1.0, s);
  float flare = 1.0 + hood * 1.9 * sqrt(max(0.0, sin(PI * clamp((s - 0.03) / 0.2, 0.0, 1.0))));
  return R * neck * taper * flare;
}

Shape snake(vec2 p, float L, float girth, float blunt, float waves, float restTurn, float moving, float travelled, float alert, float clk, int traits) {
  Shape sh = blank();
  float R = max(0.85, girth * L * 0.5);
  float segLen = L / float(SEGS);
  float W = waves > 0.0 ? waves : clamp(L / 22.0, 1.3, 3.5);
  float amp = (traits & TRAIT_SIDEWIND) != 0 ? 0.95 : 0.62;
  float bigness = clamp(L / 50.0, 0.0, 1.0);
  float phase = TAU * W * travelled / L;
  float rest = 1.0 - moving;
  float hood = ((traits & TRAIT_HOOD) != 0) ? alert : 0.0;

  vec2 pts[SEGS + 1];
  vec2 at = vec2(0.0);
  vec2 sum = at;
  pts[0] = at;
  for (int k = 0; k < SEGS; k++) {
    float s = (float(k) + 0.5) / float(SEGS);
    float env = 0.3 + 0.7 * smoothstep(0.0, 0.5, s);
    float restWave = rest * 0.45 * sin(TAU * 1.1 * s + restTurn * 9.0);
    float coil = rest * restTurn * TAU * pow(s, 1.25) * (0.35 + 0.65 * bigness);
    float ang = PI + moving * amp * env * sin(TAU * W * s - phase) + restWave + coil;
    at += vec2(cos(ang), sin(ang)) * segLen;
    pts[k + 1] = at;
    sum += at;
  }
  vec2 centre = sum / float(SEGS + 1);
  vec2 q = p + centre;
  float tailStart = mix(0.45, 0.93, blunt);

  float best = 1e3;
  float bestS = 0.0;
  float bestU = 0.0;
  vec2 bestN = vec2(0.0);
  for (int k = 0; k < SEGS; k++) {
    vec2 a = pts[k];
    vec2 b = pts[k + 1];
    float sa = float(k) / float(SEGS);
    float sb = float(k + 1) / float(SEGS);
    float ra = radiusAt(sa, R, tailStart, hood);
    float rb = radiusAt(sb, R, tailStart, hood);
    vec2 pa = q - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
    vec2 diff = pa - ba * h;
    float r = mix(ra, rb, h);
    float dd = length(diff) - r;
    if (dd < best) {
      best = dd;
      bestS = mix(sa, sb, h);
      bestN = diff / max(r, 0.01);
      bestU = clamp((ba.x * pa.y - ba.y * pa.x >= 0.0 ? 1.0 : -1.0) * length(bestN), -1.0, 1.0);
    }
  }

  vec2 head = pts[0];
  vec2 fwd = normalize(pts[0] - pts[1]);
  vec2 side = vec2(-fwd.y, fwd.x);
  float hr = R * 1.3 * (1.0 + 0.35 * hood);
  float skull = tapered(q, head - fwd * 0.5 * hr, head + fwd * 1.4 * hr, hr * 0.95, hr * 0.5);
  float eyeR = max(0.4, 0.17 * hr);
  vec2 eyeBase = head + fwd * 0.65 * hr;
  sh.eye = min(length(q - eyeBase - side * 0.58 * hr), length(q - eyeBase + side * 0.58 * hr)) - eyeR;

  float tongueD = 1e3;
  if ((traits & TRAIT_TONGUE) != 0) {
    float f = flicker(clk, moving);
    float tl = (1.0 + 0.04 * L) * f;
    if (tl > 0.3) {
      vec2 root = head + fwd * 1.4 * hr;
      vec2 tip = root + fwd * tl;
      tongueD = capsule(q, root, tip, 0.26);
      tongueD = min(tongueD, capsule(q, tip, tip + fwd * 0.5 * tl + side * 0.45 * tl, 0.22));
      tongueD = min(tongueD, capsule(q, tip, tip + fwd * 0.5 * tl - side * 0.45 * tl, 0.22));
    }
  }
  sh.tongue = tongueD;

  float rattleD = 1e3;
  if ((traits & TRAIT_RATTLE) != 0) {
    vec2 tailEnd = pts[SEGS];
    vec2 back = normalize(pts[SEGS] - pts[SEGS - 1]);
    vec2 across = vec2(-back.y, back.x);
    float shake = sin(clk * 70.0) * 0.55 * alert;
    for (int i = 0; i < 3; i++) {
      vec2 bead = tailEnd + back * (0.5 + float(i) * 0.95) * R + across * shake * float(i);
      rattleD = min(rattleD, length(q - bead) - R * (0.5 + 0.12 * float(i)));
    }
  }
  sh.rattle = rattleD;

  sh.edge = min(min(best, skull), min(tongueD, rattleD));
  sh.solid = min(skull, bestS < 0.1 ? best : 1e3);
  sh.s = bestS;
  sh.u = bestU;
  sh.grad = bestN;
  return sh;
}

Shape lizard(vec2 p, float L, float form, float tailFrac, float bulk, float legScale, float moving, float phase, float restTurn, float clk, int traits, bool afloat) {
  Shape sh = blank();
  bool cham = form > 1.5 && form < 2.5;
  bool croc = form > 3.5;
  float Lb = L * (1.0 - tailFrac);
  float noseX = 0.5 * L;
  float rt = max(0.9, bulk * L * (cham ? 0.55 : 0.5));
  float wobble = moving * (croc ? 0.12 : (cham ? 0.18 : 0.26)) * rt * sin(phase - p.x * 3.0 / max(Lb, 1.0));
  p.y -= wobble;

  float headLen = (croc ? 0.32 : (cham ? 0.2 : 0.22)) * Lb;
  float neckX = noseX - headLen;
  float chestX = noseX - 0.4 * Lb;
  float hipX = noseX - 0.82 * Lb;
  float ventX = noseX - Lb;
  float headR = rt * (croc ? 0.8 : (cham ? 1.05 : 0.8));
  float snoutR = rt * (croc ? 0.4 : 0.4);

  float head = tapered(p, vec2(neckX, 0.0), vec2(noseX - 0.2, 0.0), headR, snoutR);
  if (cham) head = min(head, ellipse(p, vec2(neckX - 0.1 * headLen, 0.0), vec2(0.55 * headLen + 0.4, 0.55 * headR + 0.3)));
  if ((traits & TRAIT_BEARD) != 0) {
    float frill = ellipse(p, vec2(neckX + 0.1 * headLen, 0.0), vec2(rt * 1.65, rt * 1.4));
    frill -= 0.55 * step(0.55, texelHash(floor(p), 4.0)) * step(-1.8, frill);
    head = min(head, frill);
  }
  float torso = min(tapered(p, vec2(neckX, 0.0), vec2(hipX, 0.0), rt * 0.9, rt), tapered(p, vec2(hipX, 0.0), vec2(ventX, 0.0), rt, rt * 0.75));
  float body = min(head, torso);

  float tailLen = tailFrac * L;
  float tailD = 1e3;
  float tr0 = rt * (croc ? 0.78 : 0.7);
  if (cham) {
    vec2 centre = vec2(ventX - 0.25 * tailLen, 0.0);
    vec2 prev = vec2(ventX, 0.0);
    for (int i = 1; i <= 10; i++) {
      float f = float(i) / 10.0;
      float a = float(i) * 0.7;
      float r = 0.25 * tailLen * (1.0 - 0.8 * f);
      vec2 cur = centre + r * vec2(cos(a), sin(a));
      tailD = min(tailD, tapered(p, prev, cur, tr0 * (1.0 - 0.8 * (f - 0.1)), tr0 * (1.0 - 0.8 * f)));
      prev = cur;
    }
  } else {
    vec2 prev = vec2(ventX, 0.0);
    float lazy = (croc ? 0.2 : 0.16) * tailLen;
    for (int i = 1; i <= TAIL_SEGS; i++) {
      float f = float(i) / float(TAIL_SEGS);
      float swing = lazy * f * sin(phase * 0.9 - f * 4.5) * (0.2 + 0.8 * moving);
      float curl = 0.22 * tailLen * f * f * restTurn * (1.0 - moving);
      vec2 cur = vec2(ventX - tailLen * f, swing + curl);
      tailD = min(tailD, tapered(p, prev, cur, tr0 * (1.0 - 0.9 * (f - 1.0 / float(TAIL_SEGS))), tr0 * (1.0 - 0.9 * f)));
      prev = cur;
    }
  }
  body = min(body, tailD);

  float limbR = max(0.5, 0.2 * rt);
  float ll = legScale * (0.5 * rt + 0.1 * Lb) * (cham ? 0.8 : 1.0);
  if (croc && afloat) ll *= 0.25;
  float legs = 1e3;
  for (int k = 0; k < 4; k++) {
    float sy = (k & 1) == 0 ? 1.0 : -1.0;
    float fore = k < 2 ? 1.0 : -1.0;
    float swing = sin(phase + (fore > 0.0 ? 0.0 : PI) + (sy > 0.0 ? 0.0 : PI)) * moving;
    vec2 root = vec2(fore > 0.0 ? chestX : hipX, sy * rt * 0.8);
    vec2 knee = root + vec2(-0.1 * ll * fore + 0.45 * ll * swing, sy * 0.85 * ll);
    vec2 foot = knee + vec2(0.33 * ll * fore + 0.5 * ll * swing, sy * 0.35 * ll);
    legs = min(legs, capsule(p, root, knee, limbR * 1.1));
    legs = min(legs, capsule(p, knee, foot, limbR * 0.9));
    legs = min(legs, length(p - foot) - limbR * 1.15);
  }
  sh.limb = legs;

  float ballR = cham ? max(0.8, 0.5 * headR) : max(0.35, 0.28 * headR);
  float eyeX = neckX + (cham ? 0.35 : 0.42) * headLen;
  float eyeY = headR * (cham ? 1.0 : 0.62);
  vec2 eyeA = vec2(eyeX, eyeY);
  vec2 eyeB = vec2(eyeX, -eyeY);
  float ball = min(length(p - eyeA), length(p - eyeB)) - ballR;
  sh.eye = cham ? min(length(p - eyeA), length(p - eyeB)) - ballR * 0.5 : ball;
  float eyeBulge = cham ? ball : 1e3;

  float tongueD = 1e3;
  if ((traits & (TRAIT_TONGUE | TRAIT_BLUE_TONGUE)) != 0) {
    float f = flicker(clk, moving);
    float tl = (0.12 * Lb + 0.9) * f;
    if (tl > 0.3) {
      vec2 root = vec2(noseX - 0.3, 0.0);
      vec2 tip = root + vec2(tl, 0.0);
      if ((traits & TRAIT_BLUE_TONGUE) != 0) {
        tongueD = tapered(p, root, tip, max(0.5, 0.18 * rt), max(0.7, 0.3 * rt));
      } else {
        tongueD = capsule(p, root, tip, 0.26);
        tongueD = min(tongueD, capsule(p, tip, tip + vec2(0.5 * tl, 0.4 * tl), 0.22));
        tongueD = min(tongueD, capsule(p, tip, tip + vec2(0.5 * tl, -0.4 * tl), 0.22));
      }
    }
  }
  sh.tongue = tongueD;

  float edge = min(min(body, legs), min(eyeBulge, tongueD));
  if ((traits & TRAIT_SPIKES) != 0) edge -= 0.75 * step(0.74, texelHash(floor(p * 1.1), 7.0)) * step(-1.7, edge);
  sh.edge = edge;
  sh.solid = croc ? min(min(head, ball), (abs(p.y) < 0.5 * rt && p.x > ventX - 0.35 * tailLen) ? body : 1e3) : 1e3;
  sh.s = clamp((noseX - p.x) / L, 0.0, 1.0);
  sh.u = clamp(p.y / rt, -1.0, 1.0);
  return sh;
}

vec2 scutes(vec2 q, float cs, float seed) {
  vec2 g = q / cs;
  vec2 id = floor(g);
  vec2 f = fract(g);
  float d1 = 9.0;
  float d2 = 9.0;
  float who = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 n = vec2(float(i), float(j));
      vec2 cid = id + n;
      vec2 pt = n + 0.15 + 0.7 * vec2(texelHash(cid, seed), texelHash(cid.yx, seed + 3.0));
      float dist = length(pt - f);
      if (dist < d1) {
        d2 = d1;
        d1 = dist;
        who = texelHash(cid, seed + 9.0);
      } else if (dist < d2) {
        d2 = dist;
      }
    }
  }
  return vec2(1.0 - smoothstep(0.0, 0.2, d2 - d1), who);
}

Shape turtle(vec2 p, float L, float bulk, float tailFrac, float legScale, float moving, float phase, float restTurn, int traits, bool afloat) {
  Shape sh = blank();
  bool sea = (traits & TRAIT_FLIPPERS) != 0;
  bool dome = (traits & TRAIT_DOME) != 0;
  float rx = 0.5 * L;
  float ry = rx * (dome ? 0.82 : bulk);
  float rear = max(0.0, -p.x / rx);
  float ryx = max(0.3, ry * (1.0 - (sea ? 0.45 : 0.12) * rear * rear));
  float shell = (length(vec2(p.x / rx, p.y / ryx)) - 1.0) * min(rx, ryx);

  float stretch = 0.75 + 0.25 * moving;
  vec2 headC = vec2(rx * (1.0 + 0.2 * stretch), 0.0);
  float headR = max(0.7, 0.19 * rx * (sea ? 0.8 : 1.0));
  float head = ellipse(p, headC, vec2(max(0.9, 0.3 * rx), headR));
  float neck = capsule(p, vec2(0.6 * rx, 0.0), headC, max(0.6, 0.13 * rx));

  float tailLen = max(0.0, tailFrac) * L;
  float tailD = 1e3;
  if (tailLen > 0.5) {
    float swing = 0.12 * tailLen * sin(phase * 0.7) * moving + 0.15 * tailLen * restTurn * (1.0 - moving);
    tailD = tapered(p, vec2(-0.85 * rx, 0.0), vec2(-0.85 * rx - tailLen, swing), max(0.6, 0.08 * rx), 0.3);
  }

  float limbR = max(0.6, 0.12 * rx * (dome ? 1.4 : 1.0));
  float legs = 1e3;
  if (sea) {
    float stroke = sin(phase * 0.55);
    for (int k = 0; k < 2; k++) {
      float sy = k == 0 ? 1.0 : -1.0;
      vec2 root = vec2(0.3 * rx, sy * ryx * 0.85);
      float ang = -0.35 + (0.2 + 0.5 * moving) * stroke;
      vec2 tip = root + vec2(sin(ang), cos(ang) * sy) * 0.72 * rx * legScale;
      legs = min(legs, tapered(p, root, tip, 0.2 * rx, 0.07 * rx));
      vec2 hind = vec2(-0.55 * rx, sy * ryx * 0.45);
      legs = min(legs, tapered(p, hind, hind + vec2(-0.25 * rx, sy * 0.3 * rx), 0.09 * rx, 0.04 * rx));
    }
  } else {
    float reachOut = 0.28 * rx * legScale;
    for (int k = 0; k < 4; k++) {
      float sy = (k & 1) == 0 ? 1.0 : -1.0;
      float fore = k < 2 ? 1.0 : -1.0;
      float swing = sin(phase + (fore > 0.0 ? 0.0 : PI) + (sy > 0.0 ? 0.0 : PI)) * moving;
      vec2 root = vec2(0.48 * rx * fore, sy * ryx * 0.75);
      vec2 foot = vec2(0.58 * rx * fore + 0.2 * rx * swing, sy * (ryx * 0.88 + reachOut));
      float paddle = afloat ? 0.7 : 1.0;
      legs = min(legs, capsule(p, root, foot, limbR * paddle));
      legs = min(legs, length(p - foot) - limbR * 1.25 * paddle);
    }
  }

  float skinD = min(min(head, neck), min(tailD, legs));
  sh.shell = shell;
  sh.limb = skinD;
  sh.edge = min(shell, skinD);
  sh.eye = length(p - headC - vec2(0.12 * rx, headR * 0.65)) - max(0.3, 0.07 * rx);
  sh.eye = min(sh.eye, length(p - headC - vec2(0.12 * rx, -headR * 0.65)) - max(0.3, 0.07 * rx));
  sh.solid = min(shell, min(head, neck));
  sh.s = clamp((rx - p.x) / L, 0.0, 1.0);
  sh.u = clamp(p.y / ryx, -1.0, 1.0);
  return sh;
}

vec3 snakePattern(Shape sh, float L, float pattern, vec3 base, vec3 accent, float spots, float seed, float R) {
  float along = sh.s * L;
  float band = max(1.4, L * 0.07);
  if (pattern > 7.5) return base;
  if (pattern > 5.5) {
    vec2 cell = floor(vec2(along, sh.u * R) / max(1.5, R * 1.3));
    return texelHash(cell, seed) < spots ? accent : base;
  }
  if (pattern > 4.5) {
    float zw = max(3.0, R * 3.4);
    float zig = abs(fract(along / zw) - 0.5) * 2.0;
    return abs(sh.u - (zig - 0.5) * 0.9) < 0.3 ? accent : base;
  }
  if (pattern > 3.5) {
    float dw = max(3.2, R * 3.2);
    float v = abs(fract(along / dw) - 0.5) * 2.0;
    float inner = v + abs(sh.u) * 1.1;
    if (inner < 0.62) return accent;
    if (inner < 0.85) return mix(base, accent, 0.25) * 1.15;
    return base;
  }
  if (pattern > 2.5) {
    float idx = floor(along / band);
    if (spots > 0.7) {
      float ring = mod(idx, 4.0);
      if (ring < 0.5) return base;
      if (ring < 1.5 || ring > 2.5) return vec3(0.04, 0.04, 0.05);
      return accent;
    }
    float odd = mod(idx, 2.0);
    if (spots > 0.35) return odd > 0.5 ? mix(base, accent, 0.9) : base;
    return odd > 0.5 && abs(sh.u) > 0.3 ? accent : base;
  }
  if (pattern > 1.5) return abs(sh.u) < 0.3 ? accent : base;
  if (pattern > 0.5) return texelHash(floor(vec2(along, sh.u * R)), seed) < spots * 0.6 ? accent : base;
  return base;
}

vec3 legPattern(Shape sh, vec2 d, vec2 p, float L, float form, float pattern, vec3 base, vec3 accent, float spots, float seed, float rt, float tailFrac) {
  float Lb = L * (1.0 - tailFrac);
  bool onBody = p.x > 0.5 * L - Lb;
  if (pattern > 7.5) {
    float ridge = abs(p.y) < rt * 0.6 && p.x > -0.45 * L ? 1.0 : 0.0;
    if (ridge > 0.5 && mod(floor(p.x * 0.8) + (p.y > 0.0 ? 1.0 : 0.0), 2.0) < 0.5) return accent;
    if (abs(p.y) < rt * 0.6 && p.x <= -0.45 * L && mod(floor(p.x * 0.8), 2.0) < 0.5) return accent;
    return base;
  }
  if (pattern > 5.5) return texelHash(floor(d * 0.55), seed) < spots ? accent : base;
  if (pattern > 2.5 && pattern < 3.5) return mod(floor(p.x / max(1.2, 0.09 * L)), 2.0) > 0.5 ? accent : base;
  if (pattern > 1.5 && pattern < 2.5) {
    if (form > 1.5 && form < 2.5) return abs(abs(p.y) - 0.5 * rt) < max(0.5, 0.15 * rt) && onBody ? accent : base;
    return abs(p.y) < max(0.5, 0.12 * rt) && onBody ? accent : base;
  }
  if (pattern > 0.5 && pattern < 1.5) return texelHash(floor(d), seed) < spots * 0.7 ? accent : base;
  return base;
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

  if (kind > 5.5) {
    float radius = vShape.x;
    float away = length(d);
    if (away > radius - 0.8 * texelHash(floor(d), 3.0) || alive < bayer(gl_FragCoord.xy)) discard;
    bool croc = vShape.y > 3.5;
    vec3 soil = croc ? vec3(0.34, 0.28, 0.14) : vec3(0.64, 0.54, 0.35);
    vec3 dark = croc ? vec3(0.19, 0.21, 0.08) : vec3(0.46, 0.38, 0.23);
    vec3 nestColour = texelHash(floor(d), 5.0) > 0.55 ? dark : soil;
    if (away < radius * 0.55 && texelHash(floor(d), 9.0) < 0.22) nestColour = vec3(0.94, 0.92, 0.82);
    nestColour *= (0.55 + 0.45 * vLook.z) * (1.0 + 0.12 * clamp(-(d.x + d.y) / radius, -1.0, 1.0));
    outColour = vec4(nestColour, 1.0);
    return;
  }

  bool shadow = kind > 4.5;
  float L = vShape.x;
  float form = vShape.y;
  float pattern = vShape.z;
  float moving = vMove.x;
  float girth = vBody.x;
  float tailFrac = vBody.y;
  float legScale = vBody.z;
  float bulk = vBody.w;
  int traits = int(vTrait.x + 0.5);
  float waves = vTrait.y;
  float restTurn = vTrait.z;
  bool afloat = vEye.w > 0.5;
  float clk = vMove.w;
  float stride = max(2.0, L * 0.28);
  float phase = vMove.y / stride * TAU;

  vec2 off = shadow ? vec2(0.9, 1.3) * clamp(L * 0.05, 0.5, 2.2) : vec2(0.0);
  vec2 dd = d - off;
  vec2 p = vec2(c * dd.x + s * dd.y, -s * dd.x + c * dd.y);

  float reachLimit = L * (form > 2.5 && form < 3.5 ? 1.0 : 0.68) + 5.0;
  if (length(p) > reachLimit * 1.2) discard;

  Shape sh;
  float rt = max(0.9, bulk * L * 0.5);
  if (form < 0.5) sh = snake(p, L, girth, tailFrac, waves, restTurn, moving, vMove.y, vMove.z, clk, traits);
  else if (form > 2.5 && form < 3.5) sh = turtle(p, L, bulk, tailFrac, legScale, moving, phase, restTurn, traits, afloat);
  else sh = lizard(p, L, form, tailFrac, bulk, legScale, moving, phase, restTurn, clk, traits, afloat);

  if (sh.edge > 0.0) discard;
  if (alive < bayer(gl_FragCoord.xy)) discard;

  if (shadow) {
    if (onWater() > 0.5) discard;
    outColour = vec4(0.0, 0.0, 0.0, 0.34);
    return;
  }

  bool submerged = afloat && form != 3.0;
  if (afloat && sh.solid > 0.0 && fract(bayer(gl_FragCoord.xy) + 0.37) > 0.6) discard;

  vec3 base = vBase.rgb;
  vec3 accent = vAccent.rgb;
  float seed = vAccent.w * 91.0;
  bool cham = (traits & TRAIT_CAMO) != 0;
  if (cham) base = mix(base, accent, vLook.w * 0.55);

  vec3 colour = base;
  float R = max(0.85, girth * L * 0.5);
  if (form < 0.5) {
    colour = snakePattern(sh, L, pattern, base, accent, vBase.w, seed, R);
    if ((traits & TRAIT_HOOD) != 0 && vMove.z > 0.2 && sh.s > 0.04 && sh.s < 0.2) {
      float spec = 1.0 - smoothstep(0.1, 0.6, abs(sh.u));
      colour = mix(colour, accent, vMove.z * (0.35 + 0.4 * spec));
    }
    vec2 n = vec2(c * sh.grad.x - s * sh.grad.y, s * sh.grad.x + c * sh.grad.y);
    float lit = uZooFlat > 0.5 ? 0.0 : dot(n, SUN) * smoothstep(0.0, 0.8, abs(sh.u));
    colour *= 1.0 + 0.2 * floor(clamp(lit, -1.0, 1.0) * 2.0 + 0.5) / 2.0;
    if (sh.rattle < 0.0) colour = RATTLE * (0.55 + 0.45 * vLook.z);
  } else if (form > 2.5 && form < 3.5) {
    float rx = 0.5 * L;
    float shade = uZooFlat > 0.5 ? 0.0 : floor(clamp(-(d.x + d.y) / (0.8 * L), -1.0, 1.0) * 2.0 + 0.5) / 2.0;
    if (sh.shell < 0.0) {
      vec2 sc = scutes(p, max(2.2, 0.28 * rx), seed);
      vec3 plate = sc.y < vBase.w * 0.6 ? accent : base;
      colour = mix(plate, plate * 0.55, sc.x * step(4.0, L));
      float ring = sh.shell > -max(0.9, 0.1 * rx) ? 1.0 : 0.0;
      colour = mix(colour, accent * 0.85, ring * 0.45 * step(6.0, L));
      colour *= 1.0 + 0.22 * shade;
    } else {
      colour = mix(base * 0.85, vec3(dot(base, vec3(0.33))), 0.25) + vec3(0.04, 0.03, 0.0);
      if (texelHash(floor(d), seed) < 0.2 && p.x > rx) colour = accent;
      colour *= 1.0 + 0.12 * shade;
    }
  } else {
    colour = legPattern(sh, d, p, L, form, pattern, base, accent, vBase.w, seed, rt, tailFrac);
    float shade = uZooFlat > 0.5 ? 0.0 : floor(clamp(-(d.x + d.y) / (0.6 * L), -1.0, 1.0) * 2.0 + 0.5) / 2.0;
    colour *= 1.0 + 0.14 * shade;
    if ((traits & TRAIT_CREST) != 0 && abs(p.y) < 0.55 && p.x > -0.6 * L && p.x < 0.3 * L && mod(floor(p.x * 0.9), 2.0) < 0.5) colour = accent * 1.2;
    if (sh.limb < sh.edge + 0.01 && sh.limb < -0.2 && L > 4.5) colour *= 0.9;
    if (cham) {
      vec3 ground = groundColour().rgb * (0.55 + 0.45 * vLook.z);
      colour = mix(colour, ground, 0.4);
    }
  }
  if (sh.edge > -0.9 && L > 4.5 && uZooFlat < 0.5) colour *= 0.68;

  if (sh.tongue < 0.0) colour = (traits & TRAIT_BLUE_TONGUE) != 0 ? TONGUE_BLUE : TONGUE;
  if (sh.eye < 0.0) colour = vEye.rgb;
  if (submerged) colour = mix(colour, DEEP * (0.5 + 0.5 * vLook.z), 0.3);
  outColour = vec4(colour, 1.0);
}
