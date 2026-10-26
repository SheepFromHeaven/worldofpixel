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
uniform float uSlotStart[BIRD_SPECIES + 1];
uniform vec3 uClick[CLICKS];
uniform sampler2D uHabitat;
out vec2 vWorld;
flat out vec4 vPose;
flat out vec4 vShape;
flat out vec4 vBase;
flat out vec4 vAccent;
flat out vec4 vEye;
flat out vec4 vBill;
flat out vec4 vLook;
flat out vec4 vMove;
flat out vec4 vBody;
#include "weatherLibrary.glsl"
#include "fauna.glsl"

const float CELL = float(BIRD_CELL);
const float T = float(BIRD_TEXELS);
const float PI = 3.14159265;
const float TAU = 6.2831853;
const float HEADINGS = 32.0;
const float FLEE_MEMORY = 140.0;
const float RING_SECONDS = 2.4;
const float WAKE_SECONDS = 1.6;
const float FLEE_LAG = 0.35;
const float FLEE_FACTOR = 2.6;
const float STAY_AWAY = 24.0;
const float FLEDGLING = 0.62;
const float SHADOW_BASE = 0.14;
const float SHADOW_PER_METRE = 0.34;
const int TRAIT_FLOCK = 64;
const int TRAIT_HOVER = 16;
const int TRAIT_DIVE = 32;
const int TRAIT_FLIGHTLESS = 512;
const int TRAIT_FAN = 1024;
const float PASS_TRACK = 54.0;
const float PASS_SPEED = 9.0;
const float PASS_ALTITUDE_GAIN = 1.3;
const float PASS_ALTITUDE_MIN = 6.0;
const float PASS_SHARE = 0.6;
const float PASS_SPACING = 3.2;
const float PASS_TRAIL = 2.4;
const float PERCH = 0.0;
const float SWOOP = 1.0;
const float SOAR = 2.0;
const float FLOAT = 3.0;
const float WALK = 4.0;

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

bool wetAt(vec2 p) {
  return habitatOf(p).b > WATER_FLAG;
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
  float e = mix(u, smoothstep(0.0, 1.0, u), 0.35);
  float slope = 0.65 + 2.1 * u * (1.0 - u);
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

void main() {
  vWorld = vec2(0.0);
  vPose = vec4(0.0);
  vShape = vec4(0.0);
  vBase = vec4(0.0);
  vAccent = vec4(0.0);
  vEye = vec4(0.0);
  vBill = vec4(0.0);
  vLook = vec4(0.0);
  vMove = vec4(0.0);
  vBody = vec4(0.0);
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);

  bool body = (gl_InstanceID & 1) == 1;
  if (body != (uLayer > 0.5)) return;
  int inst = gl_InstanceID >> 1;
  int slot = inst % BIRD_SLOTS;
  int cellIndex = inst / BIRD_SLOTS;
  int columns = int(uCells.z);
  vec2 cellId = uCells.xy + vec2(float(cellIndex % columns), float(cellIndex / columns));
  int sp = 0;
  for (int i = 1; i < BIRD_SPECIES; i++) {
    if (float(slot) >= uSlotStart[i]) sp = i;
  }
  float slots = uSlotStart[sp + 1] - uSlotStart[sp];

  vec4 likes = fetch(sp, 0);
  vec4 temperature = fetch(sp, 1);
  vec4 rhythm = fetch(sp, 3);
  vec4 shape = fetch(sp, 4);
  vec4 colour = fetch(sp, 5);
  vec4 accent = fetch(sp, 6);
  vec4 eye = fetch(sp, 7);
  vec4 habits = fetch(sp, 8);
  vec4 nature = fetch(sp, 9);
  vec4 bill = fetch(sp, 10);

  int realm = int(habits.x + 0.5);
  int traits = int(nature.y + 0.5);
  float slotF = float(slot);
  float t = uTime;
  float gait = shape.z;
  bool flock = (traits & TRAIT_FLOCK) != 0;
  float key = hh(cellId * 1.37 + slotF * 7.1);
  float legKey = flock ? hh(cellId * 2.91 + float(sp) * 1.9) : key;
  float lengthM = shape.x;
  float texels = 3.0 + 16.0 * lengthM;
  float spanTexels = 2.0 + 16.0 * shape.y;

  vec2 home = (cellId + vec2(hh(cellId + slotF * 3.1 + 0.3), hh(cellId * 1.7 + slotF * 5.3 + 1.1))) * CELL;
  vec2 base = flock ? (cellId + 0.5) * CELL : home;
  vec4 hab = habitatOf(home);
  int medium = mediumOf(hab);
  if ((medium & realm) == 0) return;

  int life = BIRD_BASE + sp;
  vec4 lv = faunaLevels(life, home);
  vec4 suits = faunaSuits(life, home);

  float micro = clamp(eye.w + dot(likes, hab), 0.0, 1.0);
  if (micro < 0.01) return;

  vec4 f = fieldAt(home);
  float celsius = f.r * TEMPERATURE_TEXTURE_SPAN_CELSIUS + TEMPERATURE_TEXTURE_FLOOR_CELSIUS;
  float daylight = dayAt(home);
  float warm = trap(temperature, celsius);
  float busy = clamp(mix(rhythm.y, rhythm.x, daylight) + rhythm.z * 4.0 * daylight * (1.0 - daylight), 0.0, 1.0);
  vec4 gs = groundState(home);
  float wetness = max(skyState(home).g, smoothstep(0.1, 0.5, gs.g));
  float dry = 1.0 - rhythm.w * smoothstep(WET_FROM, WET_TO, wetness);
  float thaw = 1.0 - smoothstep(SNOW_FROM, SNOW_TO, gs.r);
  float migrate = fetch(sp, 11).x;
  float lat = latitudeOf(home);
  float phase = mix(uYear.x, uYear.y, southAt(home));
  float spring = smoothstep(0.0, 0.03, phase) * (1.0 - smoothstep(0.17, 0.22, phase));
  float autumn = smoothstep(0.5, 0.53, phase) * (1.0 - smoothstep(0.67, 0.72, phase));
  float passage = migrate * max(spring, autumn);
  float poleward = lat >= 0.0 ? -1.0 : 1.0;
  vec2 passDir = vec2(0.0, spring >= autumn ? poleward : -poleward);
  bool passing = passage > 0.02 && hh(vec2(key, 7.7)) < passage * PASS_SHARE && suits.r > 0.08;
  float fledglings = faunaDensity(lv.g);
  float crowd = faunaDensity(lv.r) + fledglings;
  float expected = crowd * CELL * CELL / slots;
  float density = clamp(expected * micro / max(suits.r, 0.04), 0.0, 1.0) * warm * busy * dry * thaw;
  float alive = passing || density > key ? 1.0 : 0.0;
  if (alive <= 0.0) return;
  float stage = hh(vec2(key, 17.1));
  float sizeScale = !passing && crowd > 0.0 && stage < fledglings / crowd ? FLEDGLING : 1.0;

  float period = habits.y * (0.6 + 0.8 * legKey);
  float speed = habits.z;
  float reach = habits.w;
  float fear = passing ? 0.0 : nature.x;
  float peak = nature.w;
  bool flyer = gait < 1.5;
  float clk = t + key * 50.0;

  bool flightless = (traits & TRAIT_FLIGHTLESS) != 0;
  Move m;
  float orbit = 0.0;
  float passFade = 1.0;
  if (passing) {
    float f = fract(t * max(speed, PASS_SPEED) / PASS_TRACK + legKey * 5.3);
    float j = slotF - uSlotStart[sp] - 0.5 * (slots - 1.0);
    vec2 side = vec2(-passDir.y, passDir.x);
    m.pos = (cellId + 0.5) * CELL + passDir * ((f - 0.5) * PASS_TRACK - abs(j) * PASS_TRAIL) + side * j * PASS_SPACING;
    m.dir = passDir;
    m.go = 1.0;
    m.travelled = t * PASS_SPEED;
    m.u = 0.5;
    m.rest = -1.0;
    orbit = 1.0;
    passFade = smoothstep(0.0, 0.08, f) * (1.0 - smoothstep(0.92, 1.0, f));
  } else if (gait > 1.5 && gait < 2.5) {
    float radius = 3.0 + 5.0 * shape.y;
    float sense = hh(vec2(key, 4.4)) < 0.5 ? 1.0 : -1.0;
    float angle = sense * (t * speed / radius) + key * TAU;
    vec2 centre = home + 0.5 * reach * vec2(sin(t * 0.031 + key * 40.0), cos(t * 0.023 + key * 30.0));
    m.pos = centre + radius * vec2(cos(angle), sin(angle));
    m.dir = sense * vec2(-sin(angle), cos(angle));
    m.go = 1.0;
    m.travelled = t * speed;
    m.u = 0.5;
    m.rest = -1.0;
    orbit = 1.0;
  } else {
    m = moveAt(t, cellId, base, realm, legKey, period, speed, reach, flyer ? 1.0 : 0.0);
    if (flock) m.pos += (rnd2(cellId + slotF, 3.3) - 0.5) * 3.0;
  }

  vec2 fleeAt = vec2(0.0);
  float startled = 0.0;
  float startleArc = 0.0;
  vec2 fleeDir = m.dir;
  vec2 total = vec2(0.0);
  float carried = 0.0;
  if (fear > 0.01) {
    for (int i = 0; i < CLICKS; i++) {
      vec3 c = uClick[i];
      float since = t - c.z;
      if (since < 0.0 || since > FLEE_MEMORY) continue;
      vec2 at;
      if (orbit > 0.5) at = m.pos;
      else {
        Move then = moveAt(c.z, cellId, base, realm, legKey, period, speed, reach, flyer ? 1.0 : 0.0);
        at = then.pos + total;
      }
      vec2 away = at - c.xy;
      if (length(away) > fear) continue;
      float angle = (hh(vec2(key, c.z)) - 0.5) * 0.9;
      vec2 dir = turn(normalize(away + vec2(0.0001, 0.0)), angle);
      float flee = fear * FLEE_FACTOR * (0.8 + 0.5 * hh(vec2(key, c.z + 5.1)));
      vec2 jump = dir * flee;
      for (int j = 0; j < 3; j++) {
        if (allowed(at + jump, realm)) break;
        jump = turn(dir, (j == 0 ? 0.8 : j == 1 ? -0.8 : 2.4)) * flee;
      }
      if (!allowed(at + jump, realm)) jump = vec2(0.0);
      float len = length(jump);
      if (len < 0.01) continue;
      total += jump;
      float lag = FLEE_LAG * hh(vec2(key, c.z + 9.7));
      float seconds = clamp(len / (flightless ? max(peak, 3.0) : speed * 1.3 + 2.0), 0.6, 6.0);
      float u = clamp((since - lag) / seconds, 0.0, 1.0);
      float back = lag + seconds + STAY_AWAY * (0.6 + 0.8 * hh(vec2(key, c.z + 2.2)));
      float u2 = clamp((since - back) / seconds, 0.0, 1.0);
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
    }
  }

  vec4 here = habitatOf(m.pos);
  bool afloat = here.b > WATER_FLAG;
  float lum = 0.5 + 0.5 * daylight;
  float tint = 0.92 + 0.16 * hh(vec2(key, 5.5));
  float size = texels * (0.9 + 0.2 * hh(vec2(key, 2.2))) * sizeScale;
  float spanSize = spanTexels * (0.9 + 0.2 * hh(vec2(key, 2.2))) * sizeScale;
  float heading = atan(m.dir.y, m.dir.x);
  float moving = m.go;
  float inFlight = 0.0;
  float altitude = 0.0;
  if (passing) {
    inFlight = 1.0;
    altitude = max(peak, PASS_ALTITUDE_MIN) * PASS_ALTITUDE_GAIN;
  } else if (orbit > 0.5) {
    inFlight = 1.0;
    altitude = peak * (0.85 + 0.15 * sin(t * 0.2 + key * 20.0));
  } else {
    float arc = flyer ? sin(m.u * PI) * step(0.001, moving) : 0.0;
    if (gait > 0.5 && gait < 1.5) arc = 0.45 + 0.55 * arc;
    inFlight = flyer ? step(0.15, moving) : 0.0;
    altitude = peak * arc * inFlight;
  }
  if (startled > 0.5) {
    inFlight = 1.0;
    altitude = max(altitude, peak * (0.35 + 0.65 * startleArc));
  }
  if ((traits & TRAIT_HOVER) != 0 && startled < 0.5) {
    float perched = step(0.75, fract(t / (period * 1.6) + key * 3.0));
    inFlight = max(inFlight, 1.0 - perched);
    altitude = max(altitude, peak * 0.6 * (1.0 - perched));
  }
  if (flightless) {
    inFlight = 0.0;
    altitude = 0.0;
  }
  float display = 0.0;
  if ((traits & TRAIT_FAN) != 0 && moving < 0.2 && inFlight < 0.5) {
    float cycle = fract(t / 40.0 + key * 3.0);
    display = smoothstep(0.08, 0.14, cycle) * (1.0 - smoothstep(0.34, 0.4, cycle));
  }
  float restTurn = (hh(vec2(key, 8.8)) * 2.0 - 1.0) * 0.5;
  if (inFlight < 0.5 && moving < 0.2 && orbit < 0.5) heading += restTurn;

  float kind = 0.0;
  vec2 place = m.pos;
  float extent = 0.5 * max(size, spanSize) * 1.15 + 5.0 + ((traits & TRAIT_FAN) != 0 ? size * 0.9 : 0.0);
  float ringRadius = 0.0;
  float ringM = clamp(0.35 + 0.45 * lengthM, 0.4, 1.6);
  float visible = alive * uVisible * passFade;

  if (!body) {
    float landed = m.rest;
    if (afloat && inFlight < 0.5 && landed >= 0.0 && landed < RING_SECONDS) {
      kind = 4.0;
      ringRadius = landed / RING_SECONDS;
      ringM *= 1.5;
      extent = ringM * T;
      visible *= 1.0 - ringRadius;
    } else if (afloat && gait > 2.5 && gait < 3.5 && moving > 0.2) {
      float age = fract(t / WAKE_SECONDS + key) * WAKE_SECONDS;
      kind = 4.0;
      ringRadius = age / WAKE_SECONDS;
      place = m.pos - m.dir * age * speed * 0.6;
      extent = ringM * T;
      visible *= 1.0 - ringRadius;
    } else if (!afloat) {
      kind = 5.0;
      place = m.pos + normalize(vec2(0.6, 0.8)) * (SHADOW_BASE + SHADOW_PER_METRE * altitude);
    } else {
      return;
    }
  }

  vec2 snapped = (floor(place * T) + 0.5) / T;
  vec2 world = snapped + (corner * 2.0 - 1.0) * (extent / T);
  vec2 pixel = (world - uView.xy) * uView.z + uBuffer * 0.5;
  gl_Position = vec4(pixel.x / uBuffer.x * 2.0 - 1.0, 1.0 - pixel.y / uBuffer.y * 2.0, 0.0, 1.0);

  vWorld = world;
  vPose = vec4(snapped, quantised(heading), inFlight);
  vShape = vec4(kind == 4.0 ? ringM : size, spanSize, gait, kind);
  vBase = vec4(colour.rgb * tint * lum, shape.w);
  vAccent = vec4(accent.rgb * lum, key);
  vEye = vec4(eye.rgb * lum, afloat ? 1.0 : 0.0);
  vBill = vec4(bill.rgb * lum, bill.w);
  vLook = vec4(visible, ringRadius, lum, colour.w);
  vMove = vec4(moving, (m.travelled + carried) * T, clk, altitude);
  vBody = vec4(accent.w, nature.z, nature.y, display);
}
