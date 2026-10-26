#version 300 es
layout(location = 0) in vec2 corner;

uniform vec4 uView;
uniform vec2 uBuffer;
uniform float uTime;
uniform float uVisible;
uniform vec4 uCells;
uniform float uLayer;
uniform vec2 uYear;
uniform sampler2D uTable;
uniform float uSlotStart[MAMMAL_SPECIES + 1];
uniform float uPredator[PREDATORS];
uniform vec3 uClick[CLICKS];
uniform sampler2D uHabitat;
out vec2 vWorld;
flat out vec4 vPose;
flat out vec4 vShape;
flat out vec4 vBase;
flat out vec4 vAccent;
flat out vec4 vEye;
flat out vec4 vLook;
flat out vec4 vMove;
flat out vec4 vBody;
flat out vec4 vPart;
flat out vec4 vTrait;
#include "weatherLibrary.glsl"
#include "fauna.glsl"

const float CELL = float(MAMMAL_CELL);
const float T = float(MAMMAL_TEXELS);
const float PI = 3.14159265;
const float TAU = 6.2831853;
const float HEADINGS = 32.0;
const float FLEE_MEMORY = 140.0;
const float RING_SECONDS = 2.4;
const float WAKE_SECONDS = 1.8;
const float FLEE_LAG = 0.4;
const float STAY_AWAY = 30.0;
const float CALF = 0.42;
const float JUVENILE = 0.72;
const float SHADOW_BASE = 0.08;
const float SHADOW_PER_METRE = 0.22;
const float SURFACE_SECONDS = 14.0;
const float JUMP_SECONDS = 1.1;
const float VISIBLE_GAIN = 3.0;

const int TRAIT_CLIMB = 65536;
const int TRAIT_BURROW = 131072;
const int TRAIT_SENTINEL = 262144;
const int TRAIT_BREACH = 1048576;
const int TRAIT_BACK = 524288;
const int TRAIT_POUCH = 64;
const int TRAIT_SPOUT = 8192;

const float WALK = 0.0;
const float TROT = 1.0;
const float HOP = 2.0;
const float BOUND = 3.0;
const float SWIM = 4.0;
const float CRUISE = 5.0;
const float PORPOISE = 6.0;
const float FLY = 7.0;
const float BURROW = 8.0;

const float SOLO = 0.0;
const float FAMILY = 1.0;
const float HERD = 2.0;
const float PACK = 3.0;
const float COLONY = 4.0;
const float POD = 5.0;
const float TROOP = 6.0;
const float HAREM = 7.0;

const float BAT = 3.0;
const float WHALE = 4.0;
const float DOLPHIN = 5.0;
const float SEAL = 6.0;
const float SIREN = 9.0;

float hh(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

vec2 rnd2(vec2 id, float k) {
  return vec2(hh(id + vec2(k * 1.31, k * 0.71)), hh(id.yx + vec2(k * 0.53 + 9.1, k * 1.77 + 3.3)));
}

float trap(vec4 r, float x) {
  if (x < r.x || x > r.w) return 0.0;
  if (x < r.y) return smoothstep(r.x, r.y, x);
  if (x > r.z) return smoothstep(r.w, r.z, x);
  return 1.0;
}

vec2 turn(vec2 v, float angle) {
  return vec2(v.x * cos(angle) - v.y * sin(angle), v.x * sin(angle) + v.y * cos(angle));
}

float quantised(float heading) {
  float turnStep = TAU / HEADINGS;
  return floor(heading / turnStep + 0.5) * turnStep;
}

vec4 habitatOf(vec2 p) {
  vec2 uv = (p - uMaskRect.xy) / uMaskRect.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
  return texture(uHabitat, uv);
}

int mediumOf(vec4 hab) {
  return hab.b <= WATER_FLAG ? 1 : (hab.b < FRESH_FROM ? 4 : 2);
}

bool allowed(vec2 p, int realm) {
  return (mediumOf(habitatOf(p)) & realm) != 0;
}

vec4 fetch(int sp, int k) {
  return texelFetch(uTable, ivec2(k, sp), 0);
}

vec2 spotAt(vec2 cellId, vec2 base, int realm, float key, float n, float reach) {
  vec2 raw = base + (rnd2(cellId, key * 9.0 + n) - 0.5) * 2.0 * reach;
  return allowed(raw, realm) ? raw : base;
}

struct Move {
  vec2 pos;
  vec2 dir;
  float go;
  float travelled;
  float u;
  float rest;
};

Move moveAt(float t, vec2 cellId, vec2 base, int realm, float key, float period, float speed, float reach, float curve) {
  float tt = t / period + key * 13.0;
  float n = floor(tt);
  float p = fract(tt);
  vec2 a = spotAt(cellId, base, realm, key, n, reach);
  vec2 b = spotAt(cellId, base, realm, key, n + 1.0, reach);
  vec2 d = b - a;
  float span = length(d);
  float h = hh(vec2(key * 5.0, n)) * TAU;
  vec2 heading = span > 0.05 ? d / span : vec2(cos(h), sin(h));
  vec2 side = vec2(-heading.y, heading.x) * (hh(vec2(key * 3.0, n + 0.5)) < 0.5 ? 1.0 : -1.0);
  float seconds = clamp(span / max(speed, 0.01), 0.5, period * 0.85);
  float u = clamp(p * period / seconds, 0.0, 1.0);
  float e = mix(u, smoothstep(0.0, 1.0, u), 0.3);
  float slope = 0.7 + 1.8 * u * (1.0 - u);
  float bow = curve * span * 0.16;
  Move m;
  m.pos = mix(a, b, e) + side * bow * sin(u * PI);
  vec2 along = d * slope + side * bow * PI * cos(u * PI);
  m.dir = span > 0.05 && length(along) > 0.001 ? normalize(along) : heading;
  m.go = span > 0.05 ? smoothstep(0.0, 0.08, u) * (1.0 - smoothstep(0.92, 1.0, u)) : 0.0;
  m.travelled = span * e + n * 3.7;
  m.u = u;
  m.rest = p * period - seconds;
  return m;
}

Move trackAt(float t, vec2 base, float key, float speed, float reach) {
  float amp = max(reach * 0.5, 4.0);
  float w = speed / amp * 0.7;
  float a1 = w * t + key * 40.0;
  float a2 = w * 0.62 * t + key * 17.0;
  Move m;
  m.pos = base + amp * vec2(sin(a1), 0.8 * sin(a2));
  vec2 v = amp * w * vec2(cos(a1), 0.8 * 0.62 * cos(a2));
  m.dir = length(v) > 0.0001 ? normalize(v) : vec2(1.0, 0.0);
  m.go = 1.0;
  m.travelled = t * speed;
  m.u = 0.5;
  m.rest = -1.0;
  return m;
}

struct Leader {
  float alive;
  vec2 pos;
};

Leader leaderOf(int sp, vec2 cellId, float group) {
  Leader r;
  r.alive = 0.0;
  r.pos = vec2(0.0);
  vec4 social = fetch(sp, 13);
  float gsize = max(1.0, social.x);
  float gcount = max(1.0, social.y);
  if (group >= gcount) return r;
  vec4 nature = fetch(sp, 10);
  vec4 shape = fetch(sp, 5);
  vec4 habits = fetch(sp, 9);
  float spF = float(sp);
  float gkey = hh(cellId * 1.37 + vec2(group * 7.1 + spF * 3.7, group * 2.3 + spF * 1.1));
  vec2 home = (cellId + vec2(hh(cellId + vec2(group * 3.1 + spF * 0.7, 0.3)), hh(cellId * 1.7 + vec2(group * 5.3 + spF * 1.3, 1.1)))) * CELL;
  int realm = int(habits.x + 0.5);
  vec4 hab = habitatOf(home);
  int medium = mediumOf(hab);
  if ((medium & realm) == 0) return r;
  int life = MAMMAL_BASE + sp;
  vec4 lv = faunaLevels(life, home);
  float crowd = faunaDensity(lv.r) + faunaDensity(lv.g) + faunaDensity(lv.b);
  float expected = VISIBLE_GAIN * crowd * CELL * CELL / (gcount * 0.5 * (gsize + 1.0));
  vec4 suits = faunaSuits(life, home);
  if (gkey >= expected * nature.w / max(suits.r, 0.04)) return r;
  vec4 eye = fetch(sp, 8);
  vec4 taste = medium == 1 ? fetch(sp, 0) : fetch(sp, 1);
  float micro = clamp(eye.w + taste.x * hab.x + taste.y * hab.y + taste.w * hab.w, 0.0, 1.0);
  vec4 rhythm = fetch(sp, 4);
  vec4 f = fieldAt(home);
  float celsius = f.r * TEMPERATURE_TEXTURE_SPAN_CELSIUS + TEMPERATURE_TEXTURE_FLOOR_CELSIUS;
  float daylight = dayAt(home);
  float phase = mix(uYear.x, uYear.y, southAt(home));
  float busy = clamp(mix(rhythm.y, rhythm.x, daylight) + rhythm.z * 4.0 * daylight * (1.0 - daylight), 0.0, 1.0);
  vec4 gs = groundState(home);
  float wetness = max(skyState(home).g, smoothstep(0.1, 0.5, gs.g));
  float dry = 1.0 - rhythm.w * smoothstep(WET_FROM, WET_TO, wetness);
  float thaw = 1.0 - smoothstep(SNOW_FROM, SNOW_TO, gs.r);
  float lengthM = shape.x;
  float small = 1.0 - smoothstep(0.35, 0.9, lengthM);
  float awake = mix(1.0, busy, 0.9 * small);
  float density = clamp(expected * micro / max(suits.r, 0.04), 0.0, 1.0) * nature.w * trap(fetch(sp, 2), celsius) * trap(fetch(sp, 3), phase) * awake * dry * thaw;
  float alive = density > gkey ? 1.0 : 0.0;
  if (alive <= 0.0) return r;
  float gait = shape.w;
  float period = habits.y * 3.0 * (0.6 + 0.8 * gkey);
  float speed = habits.z;
  float reach = min(habits.w, 0.3 * speed * period);
  Move m;
  if (gait > 4.5 && gait < 6.5) {
    vec2 base = home;
    if (nature.z == POD) base += (rnd2(cellId, group) - 0.5) * 2.0;
    m = trackAt(uTime, base, gkey, speed, reach);
  } else {
    m = moveAt(uTime, cellId, home, realm, gkey, period, speed, reach, 0.0);
  }
  float lying = 0.0;
  if (medium == 1 && gait < 4.5) {
    lying = smoothstep(0.45, 0.7, 1.0 - busy) * (1.0 - small);
    m.pos = mix(m.pos, home + (rnd2(cellId + group, 6.6) - 0.5) * (0.6 + lengthM), lying);
  }
  r.alive = alive * (1.0 - lying);
  r.pos = m.pos;
  return r;
}

void main() {
  vWorld = vec2(0.0);
  vPose = vec4(0.0);
  vShape = vec4(0.0);
  vBase = vec4(0.0);
  vAccent = vec4(0.0);
  vEye = vec4(0.0);
  vLook = vec4(0.0);
  vMove = vec4(0.0);
  vBody = vec4(0.0);
  vPart = vec4(0.0);
  vTrait = vec4(0.0);
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);

  bool body = (gl_InstanceID & 1) == 1;
  if (!body && uLayer > 0.5) return;
  int inst = gl_InstanceID >> 1;
  int slot = inst % MAMMAL_SLOTS;
  int cellIndex = inst / MAMMAL_SLOTS;
  int columns = int(uCells.z);
  vec2 cellId = uCells.xy + vec2(float(cellIndex % columns), float(cellIndex / columns));
  int sp = 0;
  for (int b = 128; b >= 1; b >>= 1) {
    int c = sp + b;
    if (c < MAMMAL_SPECIES && float(slot) >= uSlotStart[c]) sp = c;
  }

  vec4 shape = fetch(sp, 5);
  float lengthM = shape.x;
  vec4 nature = fetch(sp, 10);
  int traits = int(nature.y + 0.5);
  float form = shape.z;
  bool canopy = (traits & TRAIT_CLIMB) != 0 || form == BAT;
  if (body && canopy != (uLayer > 0.5)) return;

  vec4 likes = fetch(sp, 0);
  vec4 wetLikes = fetch(sp, 1);
  vec4 temperature = fetch(sp, 2);
  vec4 season = fetch(sp, 3);
  vec4 rhythm = fetch(sp, 4);
  vec4 colour = fetch(sp, 6);
  vec4 accent = fetch(sp, 7);
  vec4 eye = fetch(sp, 8);
  vec4 habits = fetch(sp, 9);
  vec4 look = fetch(sp, 11);
  vec4 limbs = fetch(sp, 12);
  vec4 social = fetch(sp, 13);
  vec4 extra = fetch(sp, 14);

  float heightM = shape.y;
  float gait = shape.w;
  float socialKind = nature.z;
  float sight = nature.w;
  float gsize = max(1.0, social.x);
  float gcount = max(1.0, social.y);
  float slotF = float(slot);
  float local = slotF - uSlotStart[sp];
  float group = floor(local / gsize);
  float member = local - group * gsize;
  float spF = float(sp);
  int realm = int(habits.x + 0.5);

  float gkey = hh(cellId * 1.37 + vec2(group * 7.1 + spF * 3.7, group * 2.3 + spF * 1.1));
  float key = hh(cellId * 1.91 + vec2(local * 5.3 + spF * 1.9, local * 1.7 + 0.5));
  vec2 home = (cellId + vec2(hh(cellId + vec2(group * 3.1 + spF * 0.7, 0.3)), hh(cellId * 1.7 + vec2(group * 5.3 + spF * 1.3, 1.1)))) * CELL;
  vec4 hab = habitatOf(home);
  int medium = mediumOf(hab);
  if ((medium & realm) == 0) return;

  vec4 taste = medium == 1 ? likes : wetLikes;
  float micro = clamp(eye.w + taste.x * hab.x + taste.y * hab.y + taste.w * hab.w, 0.0, 1.0);
  if (micro < 0.01) return;

  int life = MAMMAL_BASE + sp;
  vec4 lv = faunaLevels(life, home);
  vec4 suits = faunaSuits(life, home);

  vec4 f = fieldAt(home);
  float celsius = f.r * TEMPERATURE_TEXTURE_SPAN_CELSIUS + TEMPERATURE_TEXTURE_FLOOR_CELSIUS;
  float daylight = dayAt(home);
  float warm = trap(temperature, celsius);
  float phase = mix(uYear.x, uYear.y, southAt(home));
  float seasonal = trap(season, phase);
  float busy = clamp(mix(rhythm.y, rhythm.x, daylight) + rhythm.z * 4.0 * daylight * (1.0 - daylight), 0.0, 1.0);
  vec4 gs = groundState(home);
  float wetness = max(skyState(home).g, smoothstep(0.1, 0.5, gs.g));
  float dry = 1.0 - rhythm.w * smoothstep(WET_FROM, WET_TO, wetness);
  float thaw = 1.0 - smoothstep(SNOW_FROM, SNOW_TO, gs.r);

  float adults = faunaDensity(lv.r);
  float juveniles = faunaDensity(lv.g);
  float calves = faunaDensity(lv.b);
  float crowd = adults + juveniles + calves;
  float avgSize = 0.5 * (gsize + 1.0);
  float expected = VISIBLE_GAIN * crowd * CELL * CELL / (gcount * avgSize);
  float small = 1.0 - smoothstep(0.35, 0.9, lengthM);
  float awake = mix(1.0, busy, 0.9 * small);
  float density = clamp(expected * micro / max(suits.r, 0.04), 0.0, 1.0) * sight * warm * seasonal * awake * dry * thaw;
  float alive = density > gkey ? 1.0 : 0.0;
  if (alive <= 0.0) return;
  float count = 1.0 + floor(hh(vec2(gkey, 3.3)) * gsize);
  if (member >= count) return;

  float shareCalf = crowd > 0.0 ? calves / crowd : 0.0;
  float shareJuv = crowd > 0.0 ? juveniles / crowd : 0.0;
  float draw = hh(vec2(key, 17.1));
  float stage = 2.0;
  if (member > 0.5) {
    if (socialKind == FAMILY) {
      float youngShare = clamp(3.0 * (shareCalf + shareJuv) + 0.25, 0.0, 1.0);
      if (draw < youngShare) stage = draw < youngShare * shareCalf / max(shareCalf + shareJuv, 1e-6) ? 0.0 : 1.0;
    } else if (draw < shareCalf) stage = 0.0;
    else if (draw < shareCalf + shareJuv) stage = 1.0;
  }
  float sizeScale = stage < 0.5 ? CALF : stage < 1.5 ? JUVENILE : 1.0;
  if (socialKind == HAREM && member < 0.5) sizeScale = 1.1;
  float variety = 0.92 + 0.16 * hh(vec2(key, 2.2));

  float period = habits.y * 3.0 * (0.6 + 0.8 * gkey);
  float speed = habits.z;
  float reach = min(habits.w, 0.3 * speed * period);
  float fear = nature.x;
  float t = uTime;
  float clk = t + key * 50.0;

  bool swimmer = gait > 3.5 && gait < 6.5;
  bool flyer = gait > 6.5 && gait < 7.5;
  bool burrower = gait > 7.5;
  bool colony = socialKind == COLONY;
  float lag = (socialKind == PACK || socialKind == POD) ? 0.7 : (socialKind == FAMILY ? 0.9 : 0.35);
  float tm = t - member * lag * (stage < 1.5 ? 0.5 : 1.0);

  Move m;
  float lying = 0.0;
  float hole = 0.0;
  if (burrower) {
    float cycle = max(period * (1.0 + gkey) * 2.0, 8.0);
    float outFrac = lengthM < 0.2 ? 0.07 : 0.45;
    float ph = fract(t / cycle + key);
    float u = clamp(ph / outFrac, 0.0, 1.0);
    float up = ph < outFrac ? smoothstep(0.0, 0.1, u) * (1.0 - smoothstep(0.9, 1.0, u)) : 0.0;
    float sentinel = ((traits & TRAIT_SENTINEL) != 0 && member < 0.5) ? 1.0 : 0.0;
    float h = hh(vec2(key, floor(t / cycle + key) * 3.1)) * TAU;
    vec2 away = vec2(cos(h), sin(h)) * reach * 0.5;
    m.pos = home + away * sin(u * PI) * step(ph, outFrac) * (1.0 - sentinel) + (rnd2(cellId + local, 5.5) - 0.5) * 1.6;
    m.dir = away * cos(u * PI) * (1.0 - sentinel) + (sentinel > 0.5 ? vec2(cos(h), sin(h)) : vec2(0.0));
    m.dir = length(m.dir) > 0.001 ? normalize(m.dir) : vec2(cos(h), sin(h));
    m.go = (1.0 - sentinel) * step(0.12, up) * step(ph, outFrac);
    m.travelled = reach * u * 2.0;
    m.u = u;
    m.rest = 0.0;
    hole = sentinel > 0.5 ? 1.0 : up;
  } else if (swimmer && gait > 4.5) {
    vec2 base = home;
    if (socialKind == POD) base += (rnd2(cellId, group) - 0.5) * 2.0;
    m = trackAt(tm, base, gkey, speed, reach);
    if (socialKind == POD || socialKind == FAMILY) {
      float spread = (member - 0.5 * (count - 1.0)) * (1.1 + lengthM * 0.5);
      m.pos += vec2(-m.dir.y, m.dir.x) * spread;
    }
  } else if (flyer) {
    float a1 = t * speed / max(reach * 0.18, 3.0) + key * TAU;
    float a2 = t * speed / max(reach * 0.13, 2.0) * 1.3 + key * 17.0;
    vec2 centre = home + 0.25 * reach * vec2(sin(t * 0.07 + gkey * 40.0), cos(t * 0.05 + gkey * 30.0));
    m.pos = centre + reach * 0.3 * vec2(sin(a1) * cos(a2 * 0.3), sin(a2) * 0.8);
    vec2 v = reach * 0.3 * vec2(cos(a1) * cos(a2 * 0.3), cos(a2) * 0.8 * 1.3);
    m.dir = normalize(v + vec2(0.001));
    m.go = 1.0;
    m.travelled = t * speed;
    m.u = 0.5;
    m.rest = -1.0;
  } else {
    float lead = colony ? key : gkey;
    vec2 base = colony ? home : home;
    float curve = 0.0;
    float stepper = colony ? t : tm;
    m = moveAt(stepper, cellId, base, realm, lead, period, speed, reach, curve);
    float spreadR = (0.8 + 0.7 * sqrt(count)) * (0.5 + lengthM) * (socialKind == HERD || socialKind == TROOP ? 1.4 : socialKind == HAREM ? 1.0 : socialKind == FAMILY ? 0.5 : 0.35);
    if (member > 0.5 && !colony) {
      vec2 off = (rnd2(cellId + member * 3.0, 4.4) - 0.5) * 2.0 * spreadR;
      m.pos += off;
      if (stage < 1.5 && socialKind != PACK) m.pos = mix(m.pos, moveAt(t, cellId, base, realm, gkey, period, speed, reach, 0.0).pos, 0.55) + off * 0.35;
    }
  }

  float quiet = 1.0 - busy;
  float landed = (medium == 1 && gait < 4.5 && !flyer && !burrower) ? 1.0 : 0.0;
  if (landed > 0.5 && lengthM > 0.5) {
    lying = smoothstep(0.45, 0.7, quiet) * (1.0 - small);
    m.pos = mix(m.pos, home + (rnd2(cellId + local, 6.6) - 0.5) * (0.6 + lengthM), lying);
    m.go *= 1.0 - lying;
  }

  vec2 threat = vec2(0.0);
  if (fear > 0.01 && !burrower && !flyer && (extra.x > 0.5 || lengthM < 1.6)) {
    vec2 rel = (m.pos - uView.xy) * uView.z;
    if (abs(rel.x) < uBuffer.x * 0.5 + 400.0 && abs(rel.y) < uBuffer.y * 0.5 + 400.0) {
      vec2 mine = floor(m.pos / CELL);
      for (int pi = 0; pi < PREDATORS; pi++) {
        int psp = int(uPredator[pi] + 0.5);
        if (psp == sp) continue;
        float ratio = lengthM / fetch(psp, 5).x;
        if (ratio > 2.0 || (extra.x < 0.5 && ratio > 0.67)) continue;
        if ((int(fetch(psp, 9).x + 0.5) & realm) == 0) continue;
        for (int dx = -1; dx <= 1; dx++) {
          for (int dy = -1; dy <= 1; dy++) {
            for (int g = 0; g < 2; g++) {
              Leader l = leaderOf(psp, mine + vec2(float(dx), float(dy)), float(g));
              if (l.alive <= 0.0) continue;
              vec2 away = m.pos - l.pos;
              float d = length(away);
              if (d < fear) threat += normalize(away + vec2(0.0001, 0.0)) * (fear - d) * 1.1 * l.alive;
            }
          }
        }
      }
    }
  }
  float push = length(threat);
  float carried = 0.0;
  if (push > 0.05) {
    m.pos += threat;
    carried += push;
    if (push > 1.0) {
      m.dir = threat / push;
      m.go = 1.0;
      lying = 0.0;
    }
  }

  vec2 fleeAt = vec2(0.0);
  float startled = 0.0;
  float startleArc = 0.0;
  vec2 fleeDir = m.dir;
  vec2 total = vec2(0.0);
  float hidden = 0.0;
  if (fear > 0.01) {
    for (int i = 0; i < CLICKS; i++) {
      vec3 c = uClick[i];
      float since = t - c.z;
      if (since < 0.0 || since > FLEE_MEMORY) continue;
      vec2 at = m.pos;
      vec2 away = at - c.xy;
      if (length(away) > fear) continue;
      if (burrower) {
        hidden = max(hidden, 1.0 - smoothstep(STAY_AWAY, STAY_AWAY + 6.0, since));
        continue;
      }
      float angle = (hh(vec2(gkey, c.z)) - 0.5) * 0.9;
      vec2 dir = turn(normalize(away + vec2(0.0001, 0.0)), angle);
      float flee = fear * 1.6 * (0.8 + 0.5 * hh(vec2(gkey, c.z + 5.1)));
      vec2 jump = dir * flee;
      for (int j = 0; j < 3; j++) {
        if (allowed(at + jump, realm)) break;
        jump = turn(dir, (j == 0 ? 0.8 : j == 1 ? -0.8 : 2.4)) * flee;
      }
      if (!allowed(at + jump, realm)) jump = vec2(0.0);
      float len = length(jump);
      if (len < 0.01) continue;
      total += jump;
      float lagStart = FLEE_LAG * hh(vec2(key, c.z + 9.7));
      float seconds = clamp(len / (speed * 2.4 + 1.0), 0.8, 9.0);
      float u = clamp((since - lagStart) / seconds, 0.0, 1.0);
      float back = lagStart + seconds + STAY_AWAY * (0.6 + 0.8 * hh(vec2(gkey, c.z + 2.2)));
      float u2 = clamp((since - back) / (seconds * 1.6), 0.0, 1.0);
      fleeAt += jump * smoothstep(0.0, 1.0, u) * (1.0 - smoothstep(0.0, 1.0, u2));
      if (u > 0.0 && u < 1.0) {
        startled = 1.0;
        startleArc = sin(u * PI);
        fleeDir = dir;
      } else if (u2 > 0.0 && u2 < 1.0) {
        startled = 1.0;
        startleArc = sin(u2 * PI);
        fleeDir = -dir;
      }
      carried += len * (smoothstep(0.0, 1.0, u) + smoothstep(0.0, 1.0, u2));
    }
    m.pos += fleeAt;
    if (startled > 0.5) {
      m.dir = fleeDir;
      m.go = 1.0;
      lying = 0.0;
    }
  }
  if (hidden > 0.0) hole = 0.0;

  vec4 here = habitatOf(m.pos);
  bool afloat = here.b > WATER_FLAG;
  float lum = 0.5 + 0.5 * daylight;
  float tint = 0.92 + 0.16 * hh(vec2(key, 5.5));
  float texels = (3.0 + 16.0 * lengthM) * variety * sizeScale;
  float heading = atan(m.dir.y, m.dir.x);
  float moving = m.go;

  float lift = 0.0;
  float submerge = 0.0;
  float spout = -1.0;
  float dive = social.w;
  if (form == WHALE || form == DOLPHIN || form == SIREN) {
    float cyc = max(dive, 12.0) + SURFACE_SECONDS;
    float cp = fract(clk / cyc);
    float onTop = cp * cyc;
    if (gait > 5.5) {
      float jumpCycle = max(period, 6.0) * (1.0 + 0.6 * hh(vec2(key, 8.1)));
      float jp = fract(clk / jumpCycle) * jumpCycle;
      float ju = clamp(jp / JUMP_SECONDS, 0.0, 1.0);
      lift = jp < JUMP_SECONDS ? sin(ju * PI) : 0.0;
      submerge = lift > 0.04 ? 0.0 : 1.0;
      if (jp < JUMP_SECONDS) m.go = 1.0;
    } else {
      float up = onTop < SURFACE_SECONDS ? 1.0 - smoothstep(SURFACE_SECONDS - 3.0, SURFACE_SECONDS, onTop) : 0.0;
      submerge = 1.0 - smoothstep(0.0, 0.3, up);
      if (onTop < 3.5 && (traits & TRAIT_SPOUT) != 0) spout = onTop / 3.5;
      if ((traits & TRAIT_BREACH) != 0 && hh(vec2(floor(clk / cyc), key)) < 0.35) {
        float bu = clamp((onTop - 6.0) / 2.4, 0.0, 1.0);
        lift = onTop > 6.0 && onTop < 8.4 ? sin(bu * PI) : 0.0;
        if (lift > 0.0) submerge = 0.0;
      }
    }
    moving = 1.0;
  } else if (swimmer && afloat) {
    float diveGap = max(dive, 8.0) * (1.0 + hh(vec2(gkey, 4.2)));
    float dp = fract(clk / (diveGap + 6.0)) * (diveGap + 6.0);
    submerge = dive < 1.0 ? 0.0 : smoothstep(6.0, 7.5, dp);
  }
  submerge = 0.0;
  if (gait > 1.5 && gait < 2.5 && moving > 0.2) lift = sin(m.u * PI * 6.0 + key * 10.0) * 0.5 + 0.5;
  if (flyer) lift = 0.6 + 0.4 * sin(t * 0.7 + key * 20.0);

  float sentinelUp = 0.0;
  if ((traits & TRAIT_SENTINEL) != 0 && moving < 0.2 && !flyer) sentinelUp = step(0.5, hh(vec2(key, floor(t / 12.0))));
  float posture = lying > 0.5 ? 2.0 : (startled > 0.5 || push > 1.0) ? 3.0 : (moving < 0.15 ? (extra.x > 0.5 && extra.x < 1.5 ? 1.0 : 0.0) : 0.0);
  if (sentinelUp > 0.5) posture = 4.0;
  float restTurn = (hh(vec2(key, 8.8)) * 2.0 - 1.0) * 0.6;
  if (moving < 0.2 && !swimmer && !flyer) heading += restTurn * (lying > 0.5 ? 2.0 : 0.6);

  float kind = 0.0;
  vec2 place = m.pos;
  float forward = 0.7 + look.z + look.w + (((traits & 16) != 0) ? 0.6 : 0.0) + 0.5 * social.z * (look.x > 0.5 ? 1.0 : 0.0);
  float backward = 0.7 + limbs.y;
  float extent = texels * max(forward, backward) * 1.12 + 6.0;
  if (form == WHALE || form == DOLPHIN) extent = texels * 0.72 + 8.0;
  if (flyer) extent = texels * 3.4 + 6.0;
  float ringRadius = 0.0;
  float ringM = clamp(0.4 + 0.45 * lengthM, 0.5, 4.0);
  float visible = alive * uVisible * (1.0 - hidden);
  float mound = 0.3 + 0.5 * min(lengthM, 1.2);

  if (!body) {
    float landing = m.rest;
    if ((burrower || (traits & TRAIT_BURROW) != 0) && medium == 1) {
      if (member > 0.5) return;
      kind = 6.0;
      place = home;
      extent = mound * T * 1.4;
      ringM = mound;
      visible *= burrower ? 1.0 : 0.8;
    } else if (afloat && (form == WHALE || form == DOLPHIN) && lift > 0.0 && lift < 0.2 && gait > 5.5) {
      kind = 4.0;
      float since = fract(clk / max(period, 6.0)) * max(period, 6.0);
      ringRadius = clamp((since - JUMP_SECONDS) / RING_SECONDS, 0.0, 1.0);
      if (ringRadius > 0.999) return;
      ringM *= 2.0;
      extent = ringM * T;
      visible *= 1.0 - ringRadius;
    } else if (afloat && moving > 0.2) {
      float age = fract(t / WAKE_SECONDS + key) * WAKE_SECONDS;
      kind = 4.0;
      ringRadius = age / WAKE_SECONDS;
      place = m.pos - m.dir * age * max(speed, 0.5) * 0.7;
      ringM *= 0.8;
      extent = ringM * T;
      visible *= (1.0 - ringRadius) * (1.0 - 0.6 * submerge);
    } else if (!afloat && !flyer) {
      kind = 5.0;
      place = m.pos + normalize(vec2(0.6, 0.8)) * (SHADOW_BASE + SHADOW_PER_METRE * heightM * (1.0 + 1.5 * lift)) * sizeScale;
      if (hole > 0.0 && burrower) visible *= hole;
    } else if (!afloat && flyer) {
      kind = 5.0;
      place = m.pos + normalize(vec2(0.6, 0.8)) * (0.3 + 1.2 * lengthM);
      visible *= 0.5;
    } else {
      return;
    }
  }

  float size = texels;
  vec2 snapped = (floor(place * T) + 0.5) / T;
  vec2 world = snapped + (corner * 2.0 - 1.0) * (extent / T);
  vec2 pixel = (world - uView.xy) * uView.z + uBuffer * 0.5;
  gl_Position = vec4(pixel.x / uBuffer.x * 2.0 - 1.0, 1.0 - pixel.y / uBuffer.y * 2.0, 0.0, 1.0);

  float leg = (m.travelled + carried) * T;
  bool antlered = (look.x > 0.5 && look.x < 1.5) || look.x > 9.5;
  float season01 = 1.0;
  if (antlered) season01 = smoothstep(0.1, 0.3, phase) * (1.0 - smoothstep(0.72, 0.84, phase));
  bool male = member < 0.5 && socialKind == HAREM ? true : hh(vec2(key, 9.9)) < (socialKind == HAREM ? 0.2 : 0.45);
  float hornGrow = social.z * season01 * (stage > 1.5 ? 1.0 : stage > 0.5 ? 0.35 : 0.0) * (antlered && !male ? 0.0 : (male ? 1.0 : 0.7));
  float carry = ((traits & (TRAIT_POUCH | TRAIT_BACK)) != 0 && stage > 1.5 && member < 0.5 && shareCalf > 0.0 && hh(vec2(gkey, 7.7)) < min(1.0, 8.0 * shareCalf)) ? 1.0 : 0.0;

  vWorld = world;
  vPose = vec4(snapped, quantised(heading), lift);
  vShape = vec4(kind == 4.0 || kind == 6.0 ? ringM : size, heightM * T, form, kind);
  vBase = vec4(colour.rgb * tint * lum, look.y);
  vAccent = vec4(accent.rgb * lum, key);
  vEye = vec4(eye.rgb * lum, submerge);
  vLook = vec4(visible, ringRadius, lum, colour.w);
  vMove = vec4(moving, leg, clk, spout);
  vBody = vec4(accent.w, look.z, look.w, limbs.x);
  vPart = vec4(limbs.y, limbs.z, look.x, hornGrow);
  vTrait = vec4(nature.y, gait, posture, carry + (afloat ? 2.0 : 0.0) + (stage < 0.5 ? 4.0 : 0.0) + (hole > 0.0 ? 8.0 : 0.0));
}
