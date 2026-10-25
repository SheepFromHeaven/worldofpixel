#version 300 es
layout(location = 0) in vec2 corner;

uniform vec4 uView;
uniform vec2 uBuffer;
uniform float uTime;
uniform float uVisible;
uniform vec4 uCells;
uniform float uLayer;
uniform vec2 uYear;
uniform vec4 uSpecies[INSECT_SPECIES * 6];
uniform float uSlotStart[INSECT_SPECIES + 1];
uniform vec3 uClick[CLICKS];
uniform sampler2D uHabitat;
out vec2 vLocal;
out vec4 vLook;
out vec3 vColour;
#include "weatherLibrary.glsl"

const float CELL = float(INSECT_CELL);
const float LOOK_SCALE = 12.0;
const float MIN_PIXELS = 6.0;
const float PI = 3.14159265;
const float COLONY_SHARE = 0.4;
const float RIPPLE_SECONDS = 2.4;
const float RIPPLE_REACH = 0.4;
const float JUMP_NOTICE = 1.0;
const float JUMP_MEMORY = 180.0;
const float JUMP_SECONDS = 0.3;

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

vec4 strideAt(float t, vec2 cellId, vec2 home, float key, out vec2 ringAt) {
  float period = 144.0 + 144.0 * key;
  float tt = t / period + key * 11.0;
  float k = floor(tt);
  float p = fract(tt);
  vec2 a = home + (rnd2(cellId, key * 7.0 + k) - 0.5) * 2.5;
  vec2 b = home + (rnd2(cellId, key * 7.0 + k + 1.0) - 0.5) * 2.5;
  float glide = 1.5 / period;
  vec2 pos = mix(a, b, smoothstep(0.0, glide, p));
  float age = p >= glide ? (p - glide) * period : (p + 1.0 - glide) * period;
  ringAt = p >= glide ? b : a;
  return vec4(pos, age, 0.0);
}

void main() {
  vLocal = vec2(0.0);
  vLook = vec4(0.0);
  vColour = vec3(0.0);
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);

  int second = gl_InstanceID & 1;
  int inst = gl_InstanceID >> 1;
  int slot = inst % INSECT_SLOTS;
  int cell = inst / INSECT_SLOTS;
  int columns = int(uCells.z);
  vec2 cellId = uCells.xy + vec2(float(cell % columns), float(cell / columns));
  int sp = 0;
  for (int i = 1; i < INSECT_SPECIES; i++) {
    if (float(slot) >= uSlotStart[i]) sp = i;
  }

  vec4 likes = uSpecies[sp * 6];
  vec4 temperature = uSpecies[sp * 6 + 1];
  vec4 season = uSpecies[sp * 6 + 2];
  vec4 rhythm = uSpecies[sp * 6 + 3];
  vec4 body = uSpecies[sp * 6 + 4];
  vec4 colour = uSpecies[sp * 6 + 5];
  float layerOf = second == 1 && body.y > 11.5 ? 0.0 : colour.w;
  if (abs(layerOf - uLayer) > 0.5) return;

  float mode = body.y;
  float slotF = float(slot);
  float key = hh(cellId * 1.37 + slotF * 7.1);
  vec2 home = (cellId + vec2(hh(cellId + slotF * 3.1 + 0.3), hh(cellId * 1.7 + slotF * 5.3 + 1.1))) * CELL;

  vec2 nest = (cellId + 0.5) * CELL + (rnd2(cellId, 5.0) - 0.5) * 2.0;
  vec2 food = nest + (rnd2(cellId, 7.0) - 0.5) * 7.0;
  bool mound = mode > 9.5 && mode < 10.5;
  bool colony = mode > 10.5 && mode < 11.5;
  float reach = body.x;
  if (mound || colony) home = nest;
  if (second == 1 && mode < 3.5 || second == 1 && mode > 4.5 && mode < 11.5) return;

  vec2 huv = (home - uMaskRect.xy) / uMaskRect.zw;
  if (huv.x < 0.0 || huv.y < 0.0 || huv.x > 1.0 || huv.y > 1.0) return;
  vec4 hab = texture(uHabitat, huv);
  float base = clamp(dot(likes, hab), 0.0, 1.0);
  if (base < 0.02) return;

  vec4 f = fieldAt(home);
  float celsius = f.r * TEMPERATURE_TEXTURE_SPAN_CELSIUS + TEMPERATURE_TEXTURE_FLOOR_CELSIUS;
  float year = mix(uYear.x, uYear.y, southAt(home));
  float daylight = dayAt(home);
  float busy = clamp(mix(rhythm.y, rhythm.x, daylight) + rhythm.z * 4.0 * daylight * (1.0 - daylight), 0.0, 1.0);
  float windSpeed = length((f.ba * 2.0 - 1.0) * WIND_TEXTURE_RANGE_METRES_PER_SECOND) * INSECT_SHELTER;
  float calm = 1.0 - smoothstep(rhythm.w * 0.6, rhythm.w, windSpeed);
  float dry = 1.0 - body.z * smoothstep(0.05, 0.35, skyState(home).g);
  float density = base * trap(temperature, celsius) * trap(season, year) * busy * calm * dry;
  float alive = smoothstep(0.0, 0.12, density - key);
  if (mound || colony) {
    float colonyDensity = base * trap(temperature, celsius) * trap(season, year) * COLONY_SHARE;
    float colonyKey = hh(cellId * 2.3 + 11.1);
    float exists = smoothstep(0.0, 0.12, colonyDensity - colonyKey);
    alive = mound ? exists : exists * smoothstep(0.0, 0.12, busy * calm * dry - key);
  }
  if (alive <= 0.0) return;

  float t = uTime;
  vec2 pos = home;
  float head = key * 2.0 * PI;
  float lift = 0.0;
  float flap = 0.0;
  float glow = 0.0;
  float ringAge = 99.0;
  vec2 ringAt = home;

  if (mode < 0.5) {
    float tt = t / (2.2 + 1.6 * key) + key * 13.0;
    float k = floor(tt);
    float p = fract(tt);
    vec2 a = home + (rnd2(cellId, key * 9.0 + k) - 0.5) * 3.0;
    vec2 b = home + (rnd2(cellId, key * 9.0 + k + 1.0) - 0.5) * 3.0;
    float hop = smoothstep(0.86, 1.0, p);
    pos = mix(a, b, hop);
    vec2 dir = b - a;
    head = atan(dir.y, dir.x);
    flap = 70.0;
    lift = 0.4;
  } else if (mode < 1.5) {
    float a1 = t * 0.37 + key * 20.0;
    float a2 = t * 0.83 + key * 7.0;
    float b1 = t * 0.31 + key * 11.0;
    float b2 = t * 0.71 + key * 3.0;
    pos = home + 1.6 * vec2(sin(a1) + 0.6 * sin(a2), cos(b1) + 0.6 * cos(b2)) + 0.1 * vec2(sin(t * 3.1 + key * 5.0), cos(t * 2.7 + key * 9.0));
    vec2 vel = 1.6 * vec2(0.37 * cos(a1) + 0.5 * cos(a2), -0.31 * sin(b1) - 0.43 * sin(b2));
    head = atan(vel.y, vel.x);
    flap = 9.0 + 4.0 * key;
    lift = 0.8;
  } else if (mode < 2.5) {
    float tt = t / (4.0 + 3.0 * key) + key * 17.0;
    float k = floor(tt);
    float p = fract(tt);
    vec2 a = home + (rnd2(cellId, key * 5.0 + k) - 0.5) * 8.0;
    vec2 b = home + (rnd2(cellId, key * 5.0 + k + 1.0) - 0.5) * 8.0;
    float run = smoothstep(0.88, 1.0, p);
    pos = mix(a, b, run);
    vec2 dir = b - a;
    head = atan(dir.y, dir.x);
    flap = 45.0;
    lift = 0.6;
  } else if (mode < 3.5) {
    vec2 centre = (cellId + 0.5) * CELL + (rnd2(cellId, 3.0) - 0.5) * 1.5;
    pos = centre + 0.55 * vec2(sin(t * (3.0 + key * 4.0) + key * 40.0), cos(t * (2.5 + key * 5.0) + key * 17.0));
    head = key * 6.28 + t * 5.0;
    flap = 80.0;
    lift = 0.3;
  } else if (mode < 4.5) {
    pos = home + 1.2 * vec2(sin(t * 0.2 + key * 30.0), cos(t * 0.17 + key * 9.0));
    glow = pow(max(0.0, sin(t * 1.3 + key * 40.0)), 2.0);
    head = key * 6.28;
    lift = 0.7;
  } else if (mode < 5.5) {
    float rate = 0.01 * (0.7 + 0.6 * key);
    float tt = fract(t * rate + (slotF * 0.31) + hh(vec2(slotF, key * 3.0)) * 0.08);
    float along = abs(2.0 * tt - 1.0);
    vec2 dir = food - nest;
    vec2 across = normalize(vec2(-dir.y, dir.x) + vec2(0.0001));
    pos = mix(nest, food, along) + across * 0.03 * sin(t * 2.3 + slotF);
    head = atan(dir.y, dir.x) + (tt < 0.5 ? PI : 0.0);
    flap = 12.0;
  } else if (mode < 6.5) {
    float a = key * 6.28;
    float tt = fract(t / 36.0 + key);
    float walk = smoothstep(0.0, 0.1, tt) * (1.0 - smoothstep(0.55, 0.65, tt));
    pos = home + vec2(cos(a), sin(a)) * (tt - 0.5) * 0.9 * (0.4 + 0.6 * walk);
    head = a;
    flap = 6.0 * walk;
  } else if (mode < 7.5) {
    float tt = t / (3.5 + 3.0 * key) + key * 11.0;
    float k = floor(tt);
    float p = fract(tt);
    vec2 a = home + (rnd2(cellId, key * 3.0 + k) - 0.5) * 2.5;
    vec2 b = home + (rnd2(cellId, key * 3.0 + k + 1.0) - 0.5) * 2.5;
    float u = clamp(p / 0.18, 0.0, 1.0);
    pos = mix(a, b, u);
    lift = sin(u * PI) * 0.5;
    vec2 dir = b - a;
    head = atan(dir.y, dir.x);
    flap = 4.0 * (1.0 - step(0.18, p));
  } else if (mode < 8.5) {
    head = key * 6.28 + 0.1 * sin(t * 0.3 + key * 9.0);
    flap = 3.0;
  } else if (mode < 9.5) {
    pos = home + 1.0 * vec2(sin(t * 5.0 + key * 40.0) * sin(t * 0.7 + key), cos(t * 4.3 + key * 20.0) * sin(t * 0.9 + key * 3.0)) + 0.04 * floor(vec2(sin(t * 11.0 + key * 7.0), cos(t * 9.0 + key * 5.0)) * 3.0);
    head = key * 6.28 + t * 3.0;
    flap = 90.0;
    lift = 0.3;
  } else if (mode < 10.5) {
    pos = home;
  } else if (mode < 11.5) {
    float reachOut = 0.4 + 30.0 * body.x;
    float spread = reachOut * (0.15 + 0.85 * pow(hh(vec2(slotF * 1.9, key * 5.0)), 1.6));
    float speed = 0.25 + 0.5 * hh(vec2(key * 3.0, slotF));
    vec4 ph = vec4(hh(vec2(slotF, 1.0)), hh(vec2(slotF, 2.0)), hh(vec2(slotF, 3.0)), hh(vec2(slotF, 4.0))) * 6.283 + cellId.x;
    float tx = t * speed;
    vec2 drift = vec2(sin(tx + ph.x) + 0.6 * sin(tx * 1.73 + ph.y) + 0.35 * sin(tx * 3.11 + ph.z), cos(tx * 0.87 + ph.w) + 0.6 * cos(tx * 1.51 + ph.x) + 0.35 * cos(tx * 2.93 + ph.y)) / 1.95;
    vec2 wiggle = floor(vec2(sin(t * 6.0 + ph.z * 3.0), cos(t * 5.3 + ph.w * 3.0)) * 1.5 + 0.5) * 0.03;
    pos = nest + drift * spread + wiggle;
    vec2 vel = vec2(cos(tx + ph.x), -sin(tx * 0.87 + ph.w));
    head = atan(vel.y, vel.x);
  } else {
    vec2 ringBase;
    vec4 now = strideAt(t, cellId, home, key, ringBase);
    vec2 full = vec2(0.0);
    vec2 shift = vec2(0.0);
    float landedAge = -1.0;
    for (int i = 0; i < CLICKS; i++) {
      vec3 c = uClick[i];
      float since = uTime - c.z;
      if (since < 0.0 || since > JUMP_MEMORY) continue;
      vec2 thenRing;
      vec2 at = strideAt(c.z, cellId, home, key, thenRing).xy + full;
      vec2 away = at - c.xy;
      if (length(away) > JUMP_NOTICE) continue;
      float angle = (hh(vec2(key, c.z)) - 0.5) * 1.4;
      vec2 dir = normalize(away + vec2(0.0001, 0.0));
      dir = vec2(dir.x * cos(angle) - dir.y * sin(angle), dir.x * sin(angle) + dir.y * cos(angle));
      vec2 jump = dir * (1.0 + hh(vec2(key, c.z + 5.1)));
      full += jump;
      float lag = 0.12 * hh(vec2(key, c.z + 9.7));
      float flight = smoothstep(0.0, 1.0, clamp((since - lag) / JUMP_SECONDS, 0.0, 1.0));
      shift += jump * flight * (1.0 - smoothstep(JUMP_MEMORY * 0.35, JUMP_MEMORY, since));
      float landed = since - lag - JUMP_SECONDS;
      if (landed >= 0.0 && landed < RIPPLE_SECONDS) landedAge = landed;
    }
    pos = now.xy + shift;
    ringAge = now.z;
    ringAt = ringBase + shift;
    if (landedAge >= 0.0) {
      ringAge = landedAge;
      ringAt = pos;
    }
  }

  float halfPixels = 1.0;
  float kind = 0.0;
  float ringRadius = 0.0;
  vec2 place = pos;
  if (second == 1) {
    if (mode > 3.5 && mode < 4.5) {
      kind = 1.0;
      halfPixels = 12.0;
    } else {
      if (ringAge > RIPPLE_SECONDS) return;
      kind = 2.0;
      place = ringAt;
      ringRadius = ringAge / RIPPLE_SECONDS;
      halfPixels = max(4.0, RIPPLE_REACH * uView.z);
    }
  } else if (mode > 11.5) {
    kind = 3.0;
  } else if (mound) {
    kind = 4.0;
    halfPixels = max(3.0, reach * uView.z);
  }
  vec2 centre = (place - uView.xy) * uView.z + uBuffer * 0.5;
  centre = floor(centre * 0.5 + 0.5) * 2.0;
  vec2 pixel = centre + (corner * 2.0 - 1.0) * halfPixels;
  gl_Position = vec4(pixel.x / uBuffer.x * 2.0 - 1.0, 1.0 - pixel.y / uBuffer.y * 2.0, 0.0, 1.0);

  float lum = 0.4 + 0.6 * daylight;
  vec3 tone = colour.rgb;
  if (mode > 0.5 && mode < 1.5 && colour.r > 0.7) {
    float pick = hh(vec2(key, 4.4));
    tone = pick < 0.3 ? vec3(0.95, 0.55, 0.15) : (pick < 0.55 ? vec3(0.95, 0.95, 0.85) : (pick < 0.8 ? vec3(0.4, 0.6, 0.95) : vec3(0.95, 0.85, 0.25)));
  }
  float visible = alive * uVisible;
  if (mode > 3.5 && mode < 4.5) {
    visible *= glow;
    lum = 1.0;
  }
  if (kind == 2.0) {
    visible *= 1.0 - ringRadius;
    tone = vec3(0.85, 0.93, 0.98);
    lum = 0.4 + 0.6 * daylight;
  }
  vLocal = corner * 2.0 - 1.0;
  vColour = tone * lum;
  vLook = vec4(visible, ringRadius, kind, glow);
}
