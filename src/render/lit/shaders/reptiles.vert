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
uniform float uSlotStart[REPTILE_SPECIES + 1];
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
flat out vec4 vTrait;
#include "weatherLibrary.glsl"
#include "fauna.glsl"
#include "zoo.glsl"

const float CELL = float(REPTILE_CELL);
const float CANOPY_HEIGHT = 6.0;
const float T = float(REPTILE_TEXELS);
const float PI = 3.14159265;
const float HEADINGS = 32.0;
const float FLEE_MEMORY = 150.0;
const float RING_SECONDS = 2.4;
const float WAKE_SECONDS = 1.6;
const float FLEE_BOOST = 3.5;
const float FLEE_LAG = 0.25;
const int TRAIT_PLUNGE = 512;
const int TRAIT_SIDEWIND = 256;
const int TRAIT_HOOD = 1;
const int TRAIT_FLIPPERS = 1024;
const float NEST_EGGS = 30.0;
const float HATCHLING_SIZE = 0.22;
const float JUVENILE_SIZE = 0.5;

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

int mediumOf(vec4 hab) {
  return hab.r <= WATER_FLAG ? 1 : (hab.r < FRESH_FROM ? 4 : 2);
}

bool allowed(vec2 p, int realm) {
  return (mediumOf(habitatOf(p)) & realm) != 0;
}

bool wetAt(vec2 p) {
  return habitatOf(p).r > WATER_FLAG;
}

vec4 fetch(int sp, int k) {
  return texelFetch(uTable, ivec2(k, sp), 0);
}

vec2 spotAt(vec2 cellId, vec2 home, int realm, float key, float n, float reach) {
  vec2 raw = home + (rnd2(cellId, key * 9.0 + n) - 0.5) * 2.0 * reach;
  return allowed(raw, realm) ? raw : home;
}

struct Move {
  vec2 pos;
  vec2 dir;
  float go;
  float travelled;
};

Move moveAt(float t, vec2 cellId, vec2 home, int realm, float key, float period, float speed, float reach) {
  float tt = t / period + key * 13.0;
  float n = floor(tt);
  float p = fract(tt);
  vec2 a = spotAt(cellId, home, realm, key, n, reach);
  vec2 b = spotAt(cellId, home, realm, key, n + 1.0, reach);
  vec2 d = b - a;
  float span = length(d);
  float h = hh(vec2(key * 5.0, n)) * 2.0 * PI;
  Move m;
  m.dir = span > 0.05 ? d / span : vec2(cos(h), sin(h));
  float seconds = clamp(span / max(speed, 0.01), 0.5, period * 0.85);
  float u = clamp(p * period / seconds, 0.0, 1.0);
  float e = smoothstep(0.0, 1.0, u);
  m.pos = mix(a, b, e);
  m.go = span > 0.05 ? smoothstep(0.0, 0.08, u) * (1.0 - smoothstep(0.92, 1.0, u)) : 0.0;
  m.travelled = span * e + n * 3.7;
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
  vBody = vec4(0.0);
  vTrait = vec4(0.0);
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);

  bool body = (gl_InstanceID & 1) == 1;
  int inst = gl_InstanceID >> 1;
  int slot = inst % REPTILE_SLOTS;
  int cellIndex = inst / REPTILE_SLOTS;
  int columns = int(uCells.z);
  vec2 cellId = uCells.xy + vec2(float(cellIndex % columns), float(cellIndex / columns));
  int sp = 0;
  for (int i = 1; i < REPTILE_SPECIES; i++) {
    if (float(slot) >= uSlotStart[i]) sp = i;
  }
  bool zoo = zooOn();
  ZooAnchor anchor = zooAnchor(uTime);
  if (zooSkips(sp, cellId, slot, uSlotStart[sp])) return;

  vec4 likes = fetch(sp, 0);
  vec4 temperature = fetch(sp, 1);
  vec4 season = fetch(sp, 2);
  vec4 rhythm = fetch(sp, 3);
  vec4 shape = fetch(sp, 4);
  vec4 colour = fetch(sp, 5);
  vec4 accent = fetch(sp, 6);
  vec4 eye = fetch(sp, 7);
  vec4 habits = fetch(sp, 8);
  vec4 nature = fetch(sp, 9);
  vec4 build = fetch(sp, 10);

  bool canopy = accent.w > 0.5;
  if (body == (uLayer < 0.5)) return;

  int realm = int(habits.x + 0.5);
  int traits = int(nature.y + 0.5);
  float slotF = float(slot);
  float t = uTime;
  float form = shape.y;
  float key = hh(cellId * 1.37 + slotF * 7.1);
  float texels = 3.0 + 16.0 * shape.x;

  vec2 home = (cellId + vec2(hh(cellId + slotF * 3.1 + 0.3), hh(cellId * 1.7 + slotF * 5.3 + 1.1))) * CELL;
  if (zoo) home = anchor.pos;
  vec4 hab = habitatOf(home);
  int medium = mediumOf(hab);
  bool realmOk = (medium & realm) != 0;
  bool nests = form > 2.5 && medium == 1;
  if (!realmOk && !nests) return;

  int life = REPTILE_BASE + sp;
  vec4 lv = faunaLevels(life, home);
  vec4 suits = faunaSuits(life, home);

  if (nests && !body) {
    float chance = clamp(faunaDensity(lv.a) / max(suits.b, 0.04) / NEST_EGGS * CELL * CELL / build.x, 0.0, 1.0);
    float built = smoothstep(0.0, 0.12, chance - hh(vec2(key, 41.7)));
    if (built > 0.0) {
      float radius = form > 3.5 ? 4.0 + 2.2 * shape.x : 2.0 + 3.0 * shape.x;
      vec2 snappedNest = (floor(home * T) + 0.5) / T;
      vec2 worldNest = snappedNest + (corner * 2.0 - 1.0) * ((radius + 2.0) / T);
      vec2 pixelNest = (worldNest - uView.xy) * uView.z + uBuffer * 0.5;
      gl_Position = vec4(pixelNest.x / uBuffer.x * 2.0 - 1.0, 1.0 - pixelNest.y / uBuffer.y * 2.0, 0.0, 1.0);
      float lumNest = 0.5 + 0.5 * dayAt(home);
      vWorld = worldNest;
      vPose = vec4(snappedNest, 0.0, 0.0);
      vShape = vec4(radius, form, shape.z, 6.0);
      vBase = vec4(colour.rgb * lumNest, colour.w);
      vAccent = vec4(accent.rgb * lumNest, key);
      vLook = vec4(built * uVisible, 0.0, lumNest, 0.0);
      return;
    }
  }
  if (!realmOk) return;

  float micro = clamp(eye.w + dot(likes, hab), 0.0, 1.0);
  if (micro < 0.01 && !zoo) return;

  vec4 f = fieldAt(home);
  float celsius = f.r * TEMPERATURE_TEXTURE_SPAN_CELSIUS + TEMPERATURE_TEXTURE_FLOOR_CELSIUS;
  float daylight = dayAt(home);
  float warm = trap(temperature, celsius);
  float busy = clamp(mix(rhythm.y, rhythm.x, daylight) + rhythm.z * 4.0 * daylight * (1.0 - daylight), 0.0, 1.0);
  vec4 gs = groundState(home);
  float wetness = max(skyState(home).g, smoothstep(0.1, 0.5, gs.g));
  float dry = 1.0 - rhythm.w * smoothstep(WET_FROM, WET_TO, wetness);
  float thaw = 1.0 - smoothstep(SNOW_FROM, SNOW_TO, gs.r);
  float hatchlings = faunaDensity(lv.b);
  float juveniles = faunaDensity(lv.g);
  float crowd = faunaDensity(lv.r) + juveniles + hatchlings;
  float expected = crowd * CELL * CELL / build.x;
  float density = clamp(expected * micro / max(suits.r, 0.04), 0.0, 1.0) * warm * busy * dry * thaw;
  float alive = zoo ? 1.0 : smoothstep(0.0, 0.12, density - key);
  if (alive <= 0.0) return;
  float stage = hh(vec2(key, 17.1));
  float sizeScale = crowd > 0.0 && stage < hatchlings / crowd ? HATCHLING_SIZE : (crowd > 0.0 && stage < (hatchlings + juveniles) / crowd ? JUVENILE_SIZE : 1.0);

  float slow = 1.0 - 0.65 * (1.0 - warm);
  float period = habits.y * (0.6 + 0.8 * key) / slow;
  float speed = habits.z * slow;
  float reach = habits.w;
  float fear = nature.x;

  Move m = moveAt(t, cellId, home, realm, key, period, speed, reach);
  vec2 fleeAt = vec2(0.0);
  float fleeing = 0.0;
  vec2 fleeDir = m.dir;
  float landedAge = -1.0;
  vec2 total = vec2(0.0);
  float carried = 0.0;
  if (fear > 0.01) {
    for (int i = 0; i < CLICKS; i++) {
      vec3 c = uClick[i];
      float since = t - c.z;
      if (since < 0.0 || since > FLEE_MEMORY) continue;
      Move then = moveAt(c.z, cellId, home, realm, key, period, speed, reach);
      vec2 at = then.pos + total;
      vec2 away = at - c.xy;
      if (length(away) > fear) continue;
      float angle = (hh(vec2(key, c.z)) - 0.5) * 0.9;
      vec2 dir = turn(normalize(away + vec2(0.0001, 0.0)), angle);
      float flee = fear * (0.7 + 0.6 * hh(vec2(key, c.z + 5.1)));
      vec2 jump = dir * flee;
      if ((traits & TRAIT_PLUNGE) != 0) {
        for (int j = 0; j < 9; j++) {
          vec2 cand = turn(dir, (float(j) - 4.0) * 0.38) * flee;
          if (wetAt(at + cand)) {
            jump = cand;
            break;
          }
        }
      }
      if (!allowed(at + jump, realm)) jump = vec2(0.0);
      float len = length(jump);
      if (len < 0.01) continue;
      total += jump;
      float lag = FLEE_LAG * hh(vec2(key, c.z + 9.7));
      float seconds = clamp(len / (speed * FLEE_BOOST + 0.4), 0.4, 3.5);
      float u = clamp((since - lag) / seconds, 0.0, 1.0);
      float fade = 1.0 - smoothstep(FLEE_MEMORY * 0.35, FLEE_MEMORY, since);
      fleeAt += jump * smoothstep(0.0, 1.0, u) * fade;
      if (u > 0.0 && u < 1.0) {
        fleeing = sin(u * PI) * 0.5 + 0.5;
        fleeDir = dir;
      }
      carried += len * smoothstep(0.0, 1.0, u);
      float landed = since - lag - seconds;
      if (landed >= 0.0 && landed < RING_SECONDS && wetAt(at + jump)) landedAge = landed;
    }
    m.pos += fleeAt;
    if (fleeing > 0.0) {
      m.dir = fleeDir;
      m.go = max(m.go, 1.0);
    }
  }

  if (zoo && anchor.going > 0.5) {
    m.dir = anchor.dir;
    m.go = 1.0;
    fleeing = 0.0;
  }
  carried += anchor.travelled;

  vec4 here = habitatOf(m.pos);
  bool afloat = here.r > WATER_FLAG;
  float lengthM = shape.x;
  float lum = 0.5 + 0.5 * daylight;
  float tint = 0.9 + 0.2 * hh(vec2(key, 5.5));
  float size = texels * (0.88 + 0.24 * hh(vec2(key, 2.2))) * sizeScale;
  float heading = atan(m.dir.y, m.dir.x);
  if ((traits & TRAIT_SIDEWIND) != 0) heading += (hh(vec2(key, 6.1)) < 0.5 ? 1.0 : -1.0) * 0.95;
  float moving = m.go;
  float travelled = (m.travelled + carried) * T;
  float clk = t + key * 50.0;

  float alert = 0.0;
  if ((traits & TRAIT_HOOD) != 0 || form < 0.5) {
    float cycle = fract(t / (24.0 + 30.0 * key) + key * 7.0);
    alert = smoothstep(0.55, 0.62, cycle) * (1.0 - smoothstep(0.82, 0.9, cycle)) * (1.0 - moving);
  }
  float restTurn = (hh(vec2(key, 8.8)) * 2.0 - 1.0) * (0.45 + 0.5 * clamp(size / 60.0, 0.0, 1.0));

  float kind = 0.0;
  vec2 place = m.pos;
  float extent = size * (form > 2.5 && form < 3.5 ? 1.0 : 0.68) + 5.0;
  float ringRadius = 0.0;
  float reachM = clamp(0.35 + 0.18 * lengthM, 0.4, 1.6);

  if (!body) {
    if (!afloat) {
      if (size < 5.0) return;
      kind = 5.0;
    } else if (landedAge >= 0.0) {
      kind = 4.0;
      ringRadius = landedAge / RING_SECONDS;
      reachM *= 1.6;
      extent = reachM * T;
    } else if (moving > 0.2) {
      float age = fract(t / WAKE_SECONDS + key) * WAKE_SECONDS;
      kind = 4.0;
      ringRadius = age / WAKE_SECONDS;
      place = m.pos - m.dir * age * speed * 0.6;
      extent = reachM * T;
    } else {
      return;
    }
  }

  vec2 snapped = (floor(place * T) + 0.5) / T;
  vec2 world = snapped + (corner * 2.0 - 1.0) * (extent / T);
  vec2 pixel = (world - uView.xy) * uView.z + uBuffer * 0.5;
  float depth = body ? propDepth(depthKey(canopy ? CANOPY_HEIGHT : 0.0, m.pos.y, uView.y)) : 0.0;
  gl_Position = vec4(pixel.x / uBuffer.x * 2.0 - 1.0, 1.0 - pixel.y / uBuffer.y * 2.0, depth, 1.0);

  float visible = alive * uVisible;
  if (kind == 4.0) visible *= 1.0 - ringRadius;
  float mood = smoothstep(0.35, 0.65, 0.5 + 0.5 * sin(t * 0.09 + key * 30.0));
  vWorld = world;
  vPose = vec4(snapped, quantised(heading), 0.0);
  vShape = vec4(kind == 4.0 ? reachM : size, form, shape.z, kind);
  vBase = vec4(colour.rgb * tint * lum, colour.w);
  vAccent = vec4(accent.rgb * lum, key);
  vEye = vec4(eye.rgb * lum, afloat ? 1.0 : 0.0);
  vLook = vec4(visible, ringRadius, lum, mood);
  vMove = vec4(moving, travelled, alert, clk);
  vBody = vec4(shape.w, nature.z, build.y, build.z);
  vTrait = vec4(nature.y, build.w, restTurn, fleeing);
}
