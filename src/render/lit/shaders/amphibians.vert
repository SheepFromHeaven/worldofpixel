#version 300 es
layout(location = 0) in vec2 corner;

uniform vec4 uView;
uniform vec2 uBuffer;
uniform float uTime;
uniform float uVisible;
uniform vec4 uCells;
uniform float uLayer;
uniform vec2 uYear;
uniform vec4 uSpecies[AMPHIBIAN_SPECIES * 12];
uniform float uSlotStart[AMPHIBIAN_SPECIES + 1];
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
#include "weatherLibrary.glsl"
#include "fauna.glsl"
#include "zoo.glsl"

const float CELL = float(AMPHIBIAN_CELL);
const float CANOPY_HEIGHT = 6.0;
const float HEIGHT_PER_METRE = 0.3;
const float T = float(AMPHIBIAN_TEXELS);
const float PI = 3.14159265;
const float HEADINGS = 16.0;
const float HOP_SECONDS = 0.38;
const float HOP_REACH = 1.3;
const float WALK_REACH = 2.2;
const float WALK_METRES_PER_SECOND = 0.22;
const float JUMP_NOTICE = 2.0;
const float JUMP_MEMORY = 120.0;
const float JUMP_SECONDS = 0.34;
const float RING_SECONDS = 1.8;
const float RING_REACH = 0.7;
const float YOUNG_PER_GROUP = float(AMPHIBIAN_GROUP);
const float EGGS_PER_CLUMP = 150.0;
const float YOUNG_GROUPS = 2.0;
const float FROGLET_SIZE = 0.5;
const float ZOO_HOP_METRES = 0.45;

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
  float turnStep = 2.0 * PI / HEADINGS;
  return floor(heading / turnStep + 0.5) * turnStep;
}

vec4 habitatOf(vec2 p) {
  vec2 uv = (p - uMaskRect.xy) / uMaskRect.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
  return texture(uHabitat, uv);
}

bool wetAt(vec2 p) {
  return habitatOf(p).r > WATER_FLAG;
}

vec2 spotAt(vec2 cellId, vec2 home, bool homeWet, float key, float n, float reach) {
  vec2 raw = home + (rnd2(cellId, key * 9.0 + n) - 0.5) * 2.0 * reach;
  return wetAt(raw) == homeWet ? raw : home;
}

struct Move {
  vec2 pos;
  vec2 dir;
  float lift;
  float stretch;
  float moving;
};

Move moveAt(float t, bool hop, vec2 cellId, vec2 home, bool homeWet, float key, float rest) {
  float period = rest * (0.6 + 0.8 * key);
  float tt = t / period + key * 13.0;
  float n = floor(tt);
  float p = fract(tt);
  float reach = hop ? HOP_REACH : WALK_REACH;
  vec2 a = spotAt(cellId, home, homeWet, key, n, reach);
  vec2 b = spotAt(cellId, home, homeWet, key, n + 1.0, reach);
  vec2 d = b - a;
  float span = length(d);
  float h = hh(vec2(key * 5.0, n)) * 2.0 * PI;
  Move m;
  m.dir = span > 0.05 ? d / span : vec2(cos(h), sin(h));
  float seconds = hop ? HOP_SECONDS : clamp(span / WALK_METRES_PER_SECOND, 0.5, period * 0.8);
  float u = clamp(p * period / seconds, 0.0, 1.0);
  m.moving = (u > 0.0 && u < 1.0 && span > 0.05) ? 1.0 : 0.0;
  if (hop) {
    m.pos = mix(a, b, u);
    m.lift = sin(u * PI) * 0.3 * min(1.0, span);
    m.stretch = sin(u * PI) * step(0.05, span);
  } else {
    m.pos = mix(a, b, smoothstep(0.0, 1.0, u));
    m.lift = 0.0;
    m.stretch = 0.0;
  }
  return m;
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
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);

  int second = gl_InstanceID & 1;
  int inst = gl_InstanceID >> 1;
  int slot = inst % AMPHIBIAN_SLOTS;
  int cell = inst / AMPHIBIAN_SLOTS;
  int columns = int(uCells.z);
  vec2 cellId = uCells.xy + vec2(float(cell % columns), float(cell / columns));
  int sp = 0;
  for (int i = 1; i < AMPHIBIAN_SPECIES; i++) {
    if (float(slot) >= uSlotStart[i]) sp = i;
  }
  bool zoo = zooOn();
  ZooAnchor anchor = zooAnchor(uTime);
  if (zooSkips(sp, cellId, slot, uSlotStart[sp])) return;

  int row = sp * 12;
  vec4 likes = uSpecies[row];
  vec4 temperature = uSpecies[row + 1];
  vec4 season = uSpecies[row + 2];
  vec4 rhythm = uSpecies[row + 3];
  vec4 body = uSpecies[row + 4];
  float seen = zoo ? 1.0 : sightFade(uView.z, body.x);
  if (seen <= 0.0) return;
  vec4 colour = uSpecies[row + 5];
  vec4 accent = uSpecies[row + 6];
  vec4 eye = uSpecies[row + 7];
  vec4 spawnRange = uSpecies[row + 8];
  vec4 larvaRange = uSpecies[row + 9];
  vec4 waterRange = uSpecies[row + 10];
  vec4 counts = uSpecies[row + 11];

  float local = float(slot) - uSlotStart[sp];
  bool young = local >= counts.x;
  bool canopy = accent.w > 0.5;
  bool underlay = young || second == 1;
  if (underlay == (uLayer > 0.5)) return;
  if (young && second == 1) return;
  if (canopy && second == 1) return;

  float slotF = float(slot);
  float t = uTime;
  float texels = 3.2 + 30.0 * body.x;
  float key = hh(cellId * 1.37 + slotF * 7.1);

  if (young) {
    float group = floor((local - counts.x) / YOUNG_PER_GROUP);
    float member = local - counts.x - group * YOUNG_PER_GROUP;
    vec2 centre = (cellId + rnd2(cellId + float(sp) * 17.0, group * 3.0 + 1.0)) * CELL;
    vec4 hab = habitatOf(centre);
    if (hab.r <= WATER_FLAG) return;

    int life = AMPHIBIAN_BASE + sp;
    vec4 lv = faunaLevels(life, centre);
    vec4 suits = faunaSuits(life, centre);
    float tadpoles = clamp(faunaDensity(lv.b) / max(suits.g, 0.04) * CELL * CELL / (YOUNG_PER_GROUP * YOUNG_GROUPS), 0.0, 1.0);
    float clumps = counts.z > 0.5 ? clamp(faunaDensity(lv.a) / max(suits.b, 0.04) / EGGS_PER_CLUMP * CELL * CELL / YOUNG_GROUPS, 0.0, 1.0) : 0.0;
    float groupKey = hh(cellId * 2.9 + group * 5.3 + float(sp) * 7.7);
    float eggKey = hh(cellId * 3.3 + group * 6.1 + float(sp) * 9.1);
    float aTad = smoothstep(0.0, 0.12, tadpoles - groupKey);
    float aEgg = smoothstep(0.0, 0.12, clumps - eggKey);
    float alive = max(aTad, aEgg);
    if (alive <= 0.0) return;

    bool eggs = aEgg > aTad;
    float lum = 0.5 + 0.5 * dayAt(centre);
    vec2 pos = centre;
    float kind = 3.0;
    float heading = 0.0;
    float moving = 0.0;
    float size = 2.6;
    float extent = 4.0;
    if (eggs) {
      if (member > 0.5) return;
      kind = counts.z > 1.5 ? 2.0 : 1.0;
      heading = hh(vec2(group, float(sp))) * 2.0 * PI;
      extent = counts.z > 1.5 ? 10.0 : 6.0;
    } else {
      float mk = hh(cellId * 1.9 + slotF * 4.1);
      float tx = t * (0.2 + 0.3 * mk);
      vec2 drift = vec2(sin(tx + mk * 40.0) + 0.5 * sin(tx * 2.3 + mk * 9.0), cos(tx * 0.8 + mk * 21.0) + 0.5 * cos(tx * 1.9 + mk * 5.0));
      vec2 darting = floor(vec2(sin(t * 2.1 + mk * 33.0), cos(t * 1.7 + mk * 17.0)) * 1.5 + 0.5) * 0.06;
      pos = centre + (rnd2(cellId, slotF) - 0.5) * 0.5 + 0.35 * drift + darting;
      vec2 v = vec2(cos(tx + mk * 40.0) + cos(tx * 2.3 + mk * 9.0), -sin(tx * 0.8 + mk * 21.0));
      heading = atan(v.y, v.x);
      moving = 1.0;
    }
    vec2 snapped = (floor(pos * T) + 0.5) / T;
    vec2 world = snapped + (corner * 2.0 - 1.0) * (extent / T);
    vec2 pixel = (world - uView.xy) * uView.z + uBuffer * 0.5;
    gl_Position = vec4(pixel.x / uBuffer.x * 2.0 - 1.0, 1.0 - pixel.y / uBuffer.y * 2.0, 0.0, 1.0);
    vWorld = world;
    vPose = vec4(snapped, quantised(heading), 0.0);
    vShape = vec4(size, body.y, body.z, kind);
    vBase = vec4(colour.rgb * lum, colour.w);
    vAccent = vec4(accent.rgb * lum, key);
    vEye = vec4(eye.rgb * lum, 1.0);
    vLook = vec4(alive * uVisible * seen, 0.0, lum, 0.0);
    vMove = vec4(moving, t * 8.0 + key * 30.0, 0.0, 0.0);
    return;
  }

  vec2 home = (cellId + vec2(hh(cellId + slotF * 3.1 + 0.3), hh(cellId * 1.7 + slotF * 5.3 + 1.1))) * CELL;
  if (zoo) home = anchor.pos;
  vec4 hab = habitatOf(home);
  bool homeWet = hab.r > WATER_FLAG;
  bool floats = likes.x > 0.3;
  if (homeWet && !floats) return;

  float base = clamp(eye.w + dot(likes, hab), 0.0, 1.0);
  if (base < 0.02 && !zoo) return;

  int life = AMPHIBIAN_BASE + sp;
  vec4 lv = faunaLevels(life, home);
  float adults = faunaDensity(lv.r);
  float froglets = faunaDensity(lv.g);
  float total = adults + froglets;
  float suitMean = max(faunaSuits(life, home).r, 0.04);
  float expected = total * CELL * CELL / counts.x;

  vec4 f = fieldAt(home);
  float celsius = f.r * TEMPERATURE_TEXTURE_SPAN_CELSIUS + TEMPERATURE_TEXTURE_FLOOR_CELSIUS;
  float year = mix(uYear.x, uYear.y, southAt(home));
  float daylight = dayAt(home);
  float busy = clamp(mix(rhythm.y, rhythm.x, daylight) + rhythm.z * 4.0 * daylight * (1.0 - daylight), 0.0, 1.0);
  vec4 gs = groundState(home);
  float wetness = max(skyState(home).g, smoothstep(0.1, 0.5, gs.g));
  float damp = 1.0 - rhythm.w + rhythm.w * smoothstep(WET_FROM, WET_TO, wetness);
  float thaw = 1.0 - smoothstep(SNOW_FROM, SNOW_TO, gs.r);
  float density = clamp(expected * base / suitMean, 0.0, 1.0) * trap(temperature, celsius) * busy * damp * thaw;
  float alive = zoo ? 1.0 : smoothstep(0.0, 0.12, density - key);
  if (alive <= 0.0) return;
  float froglet = total > 0.0 && hh(vec2(key, 17.3)) < froglets / total ? 1.0 : 0.0;

  bool hopper = body.w < 0.5;
  bool afloat = homeWet;
  Move m = moveAt(t, hopper && !afloat, cellId, home, homeWet, key, counts.w);
  float ringAge = 99.0;
  vec2 ringAt = home;
  if (hopper && !canopy) {
    vec2 full = vec2(0.0);
    vec2 shift = vec2(0.0);
    float flying = 0.0;
    vec2 flyDir = m.dir;
    float landedAge = -1.0;
    for (int i = 0; i < CLICKS; i++) {
      vec3 c = uClick[i];
      float since = t - c.z;
      if (since < 0.0 || since > JUMP_MEMORY) continue;
      Move then = moveAt(c.z, !afloat, cellId, home, homeWet, key, counts.w);
      vec2 at = then.pos + full;
      vec2 away = at - c.xy;
      if (length(away) > JUMP_NOTICE) continue;
      float angle = (hh(vec2(key, c.z)) - 0.5) * 1.2;
      vec2 dir = turn(normalize(away + vec2(0.0001, 0.0)), angle);
      vec2 jump = dir * (0.9 + 0.9 * hh(vec2(key, c.z + 5.1)));
      if (wetAt(at + jump) && !floats) jump = vec2(0.0);
      if (length(jump) < 0.01) continue;
      full += jump;
      float lag = 0.1 * hh(vec2(key, c.z + 9.7));
      float u = clamp((since - lag) / JUMP_SECONDS, 0.0, 1.0);
      shift += jump * smoothstep(0.0, 1.0, u) * (1.0 - smoothstep(JUMP_MEMORY * 0.35, JUMP_MEMORY, since));
      if (u > 0.0 && u < 1.0) {
        flying = sin(u * PI);
        flyDir = dir;
      }
      float landed = since - lag - JUMP_SECONDS;
      if (landed >= 0.0 && landed < RING_SECONDS) landedAge = landed;
    }
    m.pos += shift;
    if (flying > 0.0) {
      m.lift += flying * 0.35;
      m.stretch = max(m.stretch, flying);
      m.dir = flyDir;
      m.moving = 1.0;
    }
    if (landedAge >= 0.0) {
      ringAge = landedAge;
      ringAt = m.pos;
    }
    if (floats) afloat = wetAt(m.pos);
  }

  if (zoo && anchor.going > 0.5) {
    m.dir = anchor.dir;
    m.moving = 1.0;
    if (hopper && !afloat) {
      float hop = sin(fract(anchor.travelled / ZOO_HOP_METRES) * PI);
      m.lift = max(m.lift, 0.3 * hop);
      m.stretch = max(m.stretch, hop);
    }
  }

  float stretch = afloat ? max(m.stretch, 0.6 + 0.4 * m.moving) : m.stretch;
  float size = texels * (0.85 + 0.3 * hh(vec2(key, 2.2))) * mix(1.0, FROGLET_SIZE, froglet);
  float lum = 0.5 + 0.5 * daylight;
  float heading = atan(m.dir.y, m.dir.x);

  float calls = 0.0;
  if (counts.y > 0.5 && body.y < 1.5) {
    float calling = max(trap(spawnRange, year), 0.6 * trap(larvaRange, year));
    float caller = step(hh(vec2(key, 3.3)), calling * (1.0 - daylight) * 1.3);
    calls = caller * step(0.5, fract(t * 4.0 + key * 3.0)) * step(0.35, fract(t / (4.0 + 3.0 * key) + key * 7.0)) * (1.0 - m.moving);
  }

  float kind = 0.0;
  float extent = size * 0.85 + 2.0;
  vec2 place = m.pos + vec2(0.0, -m.lift);
  float ringRadius = 0.0;
  if (second == 1) {
    if (m.lift > 0.02) {
      kind = 5.0;
      place = m.pos;
      extent = size * 0.6 + 1.0;
    } else if (ringAge < RING_SECONDS) {
      kind = 4.0;
      place = ringAt;
      ringRadius = ringAge / RING_SECONDS;
      extent = RING_REACH * T;
    } else {
      return;
    }
  }

  vec2 snapped = (floor(place * T) + 0.5) / T;
  vec2 world = snapped + (corner * 2.0 - 1.0) * (extent / T);
  vec2 pixel = (world - uView.xy) * uView.z + uBuffer * 0.5;
  float depth = second == 1 ? 0.0 : propDepth(depthKey(canopy ? CANOPY_HEIGHT : m.lift * HEIGHT_PER_METRE, m.pos.y, uView.y));
  gl_Position = vec4(pixel.x / uBuffer.x * 2.0 - 1.0, 1.0 - pixel.y / uBuffer.y * 2.0, depth, 1.0);

  float tint = 0.9 + 0.2 * hh(vec2(key, 5.5));
  float visible = alive * uVisible * seen;
  if (kind == 4.0) visible *= 1.0 - ringRadius;
  vWorld = world;
  vPose = vec4(snapped, quantised(heading), stretch);
  vShape = vec4(size, body.y, body.z, kind);
  vBase = vec4(colour.rgb * tint * lum, colour.w);
  vAccent = vec4(accent.rgb * lum, key);
  vEye = vec4(eye.rgb * lum, afloat ? 1.0 : 0.0);
  vLook = vec4(visible, ringRadius, lum, 0.0);
  vMove = vec4(m.moving, t * 6.0 + key * 30.0, calls, 0.0);
}
