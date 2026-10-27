#version 300 es
precision highp float;

uniform vec4 uView;
uniform vec2 uBuffer;
uniform float uMode;
uniform float uTime;
uniform float uSea;
uniform sampler2D uHeight;
uniform sampler2D uEco;
uniform sampler2D uStrata;
uniform sampler2D uStrataField;
uniform sampler2D uGround;
uniform float uPlane;
uniform vec4 uLamps[16];
uniform int uLampCount;
uniform vec2 uMetres;
uniform vec3 uRocks[21];
uniform vec3 uMinerals[20];
uniform vec3 uCaves[5];
uniform vec4 uCentre[16];
uniform float uClock;
uniform float uYear;
uniform int uCentreCount;
out vec4 colour;
#include "weatherLibrary.glsl"
vec3 hypso(float t) {
  const vec3 stops[7] = vec3[7](
    vec3(0.34, 0.55, 0.3), vec3(0.5, 0.66, 0.34), vec3(0.76, 0.74, 0.42), vec3(0.72, 0.58, 0.36),
    vec3(0.58, 0.44, 0.32), vec3(0.62, 0.58, 0.56), vec3(0.96, 0.97, 1.0));
  float f = clamp(t, 0.0, 1.0) * 6.0;
  int i = int(min(floor(f), 5.0));
  return mix(stops[i], stops[i + 1], fract(f));
}

vec3 heat(float t) {
  const vec3 stops[7] = vec3[7](
    vec3(0.18, 0.12, 0.5), vec3(0.2, 0.38, 0.82), vec3(0.3, 0.75, 0.86), vec3(0.42, 0.76, 0.36),
    vec3(0.96, 0.86, 0.3), vec3(0.95, 0.5, 0.2), vec3(0.75, 0.12, 0.14));
  float f = clamp(t, 0.0, 1.0) * 6.0;
  int i = int(min(floor(f), 5.0));
  return mix(stops[i], stops[i + 1], fract(f));
}


const int DIGITS[10] = int[10](31599, 29874, 31183, 29647, 5101, 29671, 31719, 4687, 31727, 29679);

float digit(int d, vec2 p) {
  if (p.x < 0.0 || p.x >= 3.0 || p.y < 0.0 || p.y >= 5.0) return 0.0;
  int bit = int(p.y) * 3 + (2 - int(p.x));
  return float((DIGITS[d] >> bit) & 1);
}

float stamp(float hour, vec2 p) {
  int hh = int(hour);
  return min(digit(hh / 10, p) + digit(hh % 10, p - vec2(4.0, 0.0)), 1.0);
}

float arrow(vec2 local, vec2 dir, float speed, float time) {
  float along = dot(local, dir);
  float across = dot(local, vec2(-dir.y, dir.x));
  float reach = clamp(speed * 0.9 + 4.0, 5.0, 17.0);
  float shaft = step(abs(across), 0.9) * step(abs(along), reach - 3.0);
  float dashes = step(mod(along * 0.5 - time * (0.8 + speed * 0.35), 2.0), 1.1);
  float head = step(reach - 6.0, along) * step(along, reach + 1.0) * step(abs(across), (reach + 1.0 - along) * 0.85);
  return max(shaft * dashes, head);
}


float strataHash(vec2 p) {
  p = fract(p * vec2(0.1031, 0.1030));
  p += dot(p, p.yx + 33.33);
  return fract((p.x + p.y) * p.x);
}

float strataNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(strataHash(i), strataHash(i + vec2(1.0, 0.0)), f.x), mix(strataHash(i + vec2(0.0, 1.0)), strataHash(i + vec2(1.0, 1.0)), f.x), f.y);
}

float strataCave(vec4 cell) {
  return floor(cell.b * 255.0 + 0.5);
}

bool strataOpen(vec4 cell) {
  float cave = strataCave(cell);
  return cave > 0.5 && cave < 3.5;
}

bool strataFree(vec4 cell) {
  return strataCave(cell) > 3.5;
}

vec3 strataRamp(vec3 base, float step) {
  const float k[5] = float[5](0.56, 0.78, 1.0, 1.18, 1.38);
  float s = clamp(step, 0.0, 4.0);
  int i = int(floor(s));
  return base * k[i];
}

float strataStep(float field, vec2 texel) {
  return floor(clamp(field * 5.0 + (bayer(texel) - 0.5), 0.0, 4.999));
}

vec3 strataRock(int rock, vec2 texel) {
  vec3 base = uRocks[rock];
  float grain = strataHash(texel);
  float coarse = strataNoise(texel * 0.3);
  float field = coarse * 0.55 + grain * 0.45;

  if (rock >= 3 && rock <= 10) {
    float band = strataNoise(vec2(texel.x * 0.05, texel.y * 0.35 + coarse * 2.0));
    field = field * 0.65 + band * 0.35;
  } else if (rock >= 11 && rock <= 15) {
    float salt = strataHash(floor(texel * 0.5) + 7.0);
    field = mix(field, salt, 0.45);
    if (rock == 15) field = 0.3 + 0.55 * strataNoise(texel * vec2(0.8, 0.1));
  } else if (rock >= 16) {
    float streak = strataNoise(vec2(texel.x * 0.1, texel.y * 0.8));
    field = field * 0.4 + streak * 0.6;
    if (grain > 0.985) field = 1.0;
  }

  float lit = strataNoise(texel * 0.2) - strataNoise((texel + vec2(1.0)) * 0.2);
  field += lit * 1.4;
  return strataRamp(base, strataStep(field, texel));
}

vec3 strataOre(vec3 under, int ore, vec2 texel) {
  vec2 cell = floor(texel / 3.0);
  if (strataHash(cell + float(ore) * 3.1) > 0.6) return under;
  vec2 centre = (cell + 0.3 + 0.4 * vec2(strataHash(cell + 1.7), strataHash(cell + 4.1))) * 3.0;
  vec2 d = texel + 0.5 - centre;
  float r = length(d);
  if (r > 1.45) return under;
  float light = clamp(0.55 - (d.x + d.y) * 0.32, 0.0, 1.0);
  vec3 col = uMinerals[ore] * (0.62 + 0.75 * light);
  if (ore >= 13) {
    float twinkle = step(0.93, strataHash(cell + floor(uTime * 2.0 + float(ore))));
    col = mix(col, vec3(1.0), 0.85 * twinkle);
  }
  return col;
}

vec3 strataFloor(int rock, int life, bool drip, vec2 texel) {
  vec3 col = strataRock(rock, texel) * 0.6;
  float rubble = strataHash(floor(texel * 0.5) + 3.0);
  if (rubble > 0.92) col *= 1.45;
  else if (rubble < 0.06) col *= 0.7;

  if (life == 1) {
    float clump = strataNoise(texel * 0.28) + (bayer(texel) - 0.5) * 0.3;
    if (clump > 0.52) col = mix(vec3(0.16, 0.3, 0.12), vec3(0.36, 0.56, 0.2), strataHash(texel + 2.0));
  } else if (life == 2) {
    vec2 cell = floor(texel / 4.0);
    if (strataHash(cell + 5.0) < 0.5) {
      vec2 centre = (cell + 0.3 + 0.4 * vec2(strataHash(cell + 1.3), strataHash(cell + 2.9))) * 4.0;
      vec2 d = texel + 0.5 - centre;
      float r = length(d);
      float glow = 0.75 + 0.25 * sin(uTime * 1.6 + strataHash(cell) * 6.28);
      if (r < 1.3) col = mix(vec3(0.55, 0.78, 0.95), vec3(0.95, 0.8, 0.9), step(0.5, strataHash(cell + 8.0))) * glow;
      else if (r < 2.0) col *= 0.7;
    }
  } else if (life == 3) {
    float clump = strataNoise(texel * 0.22);
    if (clump > 0.5) col = mix(col, vec3(0.3, 0.26, 0.2), 0.85);
    if (strataHash(texel * 1.7) > 0.97) col = vec3(0.92, 0.9, 0.84);
  } else if (life == 5) {
    float wave = 0.5 + 0.5 * sin(texel.x * 0.35 + texel.y * 0.2 + strataNoise(texel * 0.1) * 6.0);
    col = mix(col, vec3(0.88, 0.82, 0.7) * (0.72 + 0.3 * wave), 0.75);
  }

  if (drip) {
    vec2 cell = floor(texel / 6.0);
    if (strataHash(cell + 9.0) < 0.34) {
      vec2 centre = (cell + 0.25 + 0.5 * vec2(strataHash(cell + 3.3), strataHash(cell + 6.1))) * 6.0;
      float radius = 1.0 + 1.5 * strataHash(cell + 2.2);
      vec2 d = texel + 0.5 - centre;
      float r = length(d);
      if (r < radius) {
        float shade = clamp(0.6 - (d.x + d.y) / (2.0 * radius) * 0.9, 0.0, 1.0);
        col = mix(vec3(0.46, 0.4, 0.36), vec3(0.96, 0.92, 0.82), shade);
      } else if (r < radius + 1.0 && d.x + d.y > 0.0) {
        col *= 0.55;
      }
    }
  }
  return col;
}

vec3 strataWater(vec2 texel) {
  float ripple = strataNoise(texel * 0.35 + vec2(uTime * 0.25, 0.0)) * 0.6 + strataNoise(texel * 0.8 - vec2(0.0, uTime * 0.2)) * 0.4;
  float shine = step(0.9, strataHash(texel + floor(uTime * 1.5))) * step(0.62, ripple);
  vec3 col = strataRamp(uCaves[2], strataStep(ripple, texel) * 0.9 + 0.4);
  return mix(col, uCaves[3] * 1.3, shine);
}

vec3 strataVoid(vec4 cell, vec2 texel) {
  int rock = int(floor(cell.r * 255.0 + 0.5));
  int cave = int(floor(cell.b * 255.0 + 0.5));
  if (cave == 2) return strataWater(texel);
  int life = int(floor(cell.a * 255.0 / 16.0));
  return strataFloor(rock, life, cave == 3, texel);
}

float strataThreshold(vec2 texel) {
  return strataHash(texel + 11.0) * 0.5 + strataNoise(texel * 0.35) * 0.5;
}

float strataGround(vec2 uv) {
  float h = texture(uGround, uv).r;
  return h >= uSea ? (h - uSea) / (1.0 - uSea) * uMetres.x : (h - uSea) / uSea * uMetres.y;
}

vec4 strataCaveTile(ivec2 base, vec2 tile, ivec2 size) {
  vec4 best = vec4(-1.0);
  float weight = -1.0;
  vec2 f = tile - 0.5 - vec2(base);
  for (int j = 0; j < 2; j++) {
    for (int i = 0; i < 2; i++) {
      vec4 cell = texelFetch(uStrata, clamp(base + ivec2(i, j), ivec2(0), size - 1), 0);
      float cave = strataCave(cell);
      if (cave < 0.5 || cave > 3.5) continue;
      float w = (i == 0 ? 1.0 - f.x : f.x) * (j == 0 ? 1.0 - f.y : f.y);
      if (w > weight) { weight = w; best = cell; }
    }
  }
  return best;
}

vec3 strataLamps(vec3 colour, vec2 world, vec2 texel) {
  float glow = 0.0;
  float flame = 0.0;
  float post = 0.0;
  for (int i = 0; i < 16; i++) {
    if (i >= uLampCount) break;
    vec2 d = world - uLamps[i].xy;
    float r = length(d);
    float flicker = 0.9 + 0.1 * sin(uTime * 9.0 + float(i) * 3.1) + 0.05 * sin(uTime * 23.0 + float(i));
    float level = uLamps[i].z;
    glow = max(glow, level * flicker * (1.0 - smoothstep(0.5, 9.0, r)));
    if (level > 0.9) {
      vec2 local = floor(d * 16.0);
      if (abs(local.x) < 1.5 && local.y >= -4.0 && local.y < 0.0) flame = max(flame, 1.0 - 0.18 * abs(local.y + 2.0));
      if (abs(local.x) < 0.5 && local.y >= 0.0 && local.y < 5.0) post = 1.0;
    }
  }
  float banded = floor(glow * 5.0 + strataHash(texel * 1.3) * 0.9) / 5.0;
  vec3 warm = vec3(1.0, 0.72, 0.38);
  colour = colour * (1.0 + banded * 2.2) + warm * banded * 0.28;
  if (post > 0.5) colour = vec3(0.24, 0.15, 0.08);
  if (flame > 0.0) colour = mix(vec3(1.0, 0.45, 0.12), vec3(1.0, 0.92, 0.55), flame);
  return colour;
}

vec4 strataBase(vec2 world) {
  ivec2 size = textureSize(uStrata, 0);
  vec2 sizef = vec2(size);
  vec2 tile = world - uMaskRect.xy;
  vec2 texel = floor(tile * 16.0);
  vec2 uv = tile / sizef;
  vec2 px = 1.0 / sizef;

  float ground = strataGround(uv);
  vec2 slope = vec2(strataGround(uv + vec2(px.x, 0.0)) - strataGround(uv - vec2(px.x, 0.0)), strataGround(uv + vec2(0.0, px.y)) - strataGround(uv - vec2(0.0, px.y))) * 0.5;
  float depth = (ground - uPlane) / max(length(slope), 0.75);

  vec2 wobble = (vec2(strataNoise(texel * 0.22), strataNoise(texel * 0.22 + 9.0)) - 0.5) * 0.3;
  vec2 fuv = (tile + wobble) / sizef;
  vec2 field = texture(uStrataField, fuv).rg;
  float occupancy = field.r;
  bool cave = occupancy > 0.5;
  float threshold = strataThreshold(texel);

  if (!cave) {
    if (depth <= 0.0) return vec4(0.0);
    vec2 jitter = (vec2(strataNoise(texel * 0.17 + 3.0), strataNoise(texel * 0.17 + 13.0)) - 0.5) * 1.2;
    ivec2 at = clamp(ivec2(floor(tile + jitter)), ivec2(0), size - 1);
    vec4 here = texelFetch(uStrata, at, 0);
    int rock = int(floor(here.r * 255.0 + 0.5));
    int ore = int(floor(here.g * 255.0 + 0.5));
    vec3 colour = strataRock(rock, texel);
    if (ore > 0) colour = strataOre(colour, ore, texel);
    colour *= 1.0 - 0.38 * step(depth, 0.18);
    if (occupancy > 0.5 - 0.14) {
      vec2 inward = vec2(texture(uStrataField, fuv + vec2(px.x, 0.0)).r - texture(uStrataField, fuv - vec2(px.x, 0.0)).r, texture(uStrataField, fuv + vec2(0.0, px.y)).r - texture(uStrataField, fuv - vec2(0.0, px.y)).r);
      float lit = dot(normalize(inward + 1e-4), vec2(1.0, 1.0));
      colour *= lit > 0.0 ? 1.12 : 0.78;
    }
    return vec4(colour, 1.0);
  }

  ivec2 base = ivec2(floor(tile - 0.5));
  vec4 data = strataCaveTile(base, tile, size);
  if (data.r < 0.0) data = texelFetch(uStrata, clamp(ivec2(floor(tile)), ivec2(0), size - 1), 0);
  float cover = clamp(0.5 + depth, 0.0, 1.0);
  if (threshold >= cover) return vec4(0.0);

  vec3 colour = strataVoid(data, texel);
  bool flooded = field.g > 0.5;
  if (flooded) colour = strataWater(texel);
  if (!flooded && occupancy < 0.62) {
    vec2 inward = vec2(texture(uStrataField, fuv + vec2(px.x, 0.0)).r - texture(uStrataField, fuv - vec2(px.x, 0.0)).r, texture(uStrataField, fuv + vec2(0.0, px.y)).r - texture(uStrataField, fuv - vec2(0.0, px.y)).r);
    float lit = dot(normalize(inward + 1e-4), vec2(1.0, 1.0));
    int rock = int(floor(data.r * 255.0 + 0.5));
    colour = lit > 0.0 ? strataRock(rock, texel) * 1.3 : strataRock(rock, texel) * 0.35;
  } else {
    float inner = smoothstep(0.62, 0.95, occupancy);
    float shade = mix(0.62, 0.3, inner);
    colour = mix(colour * shade, vec3(0.05, 0.06, 0.1), 0.42 * inner + 0.18);
    if (flooded) colour = mix(colour, vec3(0.1, 0.32, 0.62), 0.55);
  }
  return vec4(colour, 1.0);
}

vec4 strata(vec2 world) {
  vec4 base = strataBase(world);
  if (base.a < 0.5 || uLampCount == 0) return base;
  vec2 texel = floor((world - uMaskRect.xy) * 16.0);
  return vec4(strataLamps(base.rgb, world, texel), 1.0);
}

void main() {
  vec2 at = vec2(gl_FragCoord.x, uBuffer.y - gl_FragCoord.y);
  vec2 world = uView.xy + (at - uBuffer * 0.5) / uView.z;

  if (uMode > 6.5) {
    colour = strata(world);
    return;
  }

  if (uMode > 5.5) {
    vec2 euv = clamp((world - uMaskRect.xy) / uMaskRect.zw, 0.0, 1.0);
    float fertile = texture(uEco, euv).r;
    float ewater = texture(uWaterMask, euv).r;
    float eh = texture(uHeight, euv).r;
    float steps = floor(fertile * 8.0 + bayer(gl_FragCoord.xy)) / 8.0;
    vec3 col = ewater > 0.5 ? vec3(0.16, 0.26, 0.4) : mix(vec3(0.62, 0.55, 0.42), vec3(0.16, 0.5, 0.2), sqrt(steps));
    colour = vec4(col, 1.0);
    return;
  }

  if (uMode > 4.5) {
    vec2 suv = clamp((world - uMaskRect.xy) / uMaskRect.zw, 0.0, 1.0);
    float sh = texture(uHeight, suv).r;
    float swater = texture(uWaterMask, suv).r;
    float lat = latitudeOf(world);
    float southern = step(bayer(gl_FragCoord.xy), southAt(world));
    float phase = fract(uYear + 0.5 * southern);
    float quarter = floor(phase * 4.0);
    vec3 tone = quarter < 1.0 ? vec3(0.55, 0.8, 0.4) : quarter < 2.0 ? vec3(0.95, 0.8, 0.3) : quarter < 3.0 ? vec3(0.85, 0.45, 0.2) : vec3(0.72, 0.82, 0.97);
    float salt = max(0.0, (sh - uSea) / (1.0 - uSea));
    vec3 base = swater > 0.5 ? vec3(0.2, 0.3, 0.42) : mix(vec3(0.5, 0.55, 0.45), vec3(0.78, 0.76, 0.72), salt);
    vec3 col = mix(base, tone, 0.5);
    float lines = 0.0;
    for (int i = 0; i < 5; i += 1) {
      float at0 = i == 0 ? 0.0 : i == 1 ? 23.44 : i == 2 ? -23.44 : i == 3 ? 66.56 : -66.56;
      float edge = abs(lat - at0);
      float width = fwidth(lat) * (i == 0 ? 1.6 : 1.0);
      lines = max(lines, step(edge, width) * (i == 0 ? 1.0 : 0.55));
    }
    col = mix(col, vec3(0.97, 0.95, 0.85), lines);
    col *= 0.55 + 0.45 * floor(dayAt(world) * 4.0 + bayer(gl_FragCoord.xy)) / 4.0;
    colour = vec4(col, 1.0);
    return;
  }

  if (uMode > 3.5) {
    vec2 zuv = clamp((world - uMaskRect.xy) / uMaskRect.zw, 0.0, 1.0);
    float zh = texture(uHeight, zuv).r;
    float zwater = texture(uWaterMask, zuv).r;
    float across = (world.x - uPlaceRect.x) / uPlaceRect.z;
    float hours = (across - 0.5) * 16.0;
    float zone = floor(hours + 0.5);
    float pick = mod(zone + 16.0, 6.0);
    vec3 hue = pick < 1.0 ? vec3(0.9, 0.45, 0.4) : pick < 2.0 ? vec3(0.95, 0.75, 0.35) : pick < 3.0 ? vec3(0.55, 0.8, 0.45) : pick < 4.0 ? vec3(0.4, 0.75, 0.8) : pick < 5.0 ? vec3(0.5, 0.55, 0.9) : vec3(0.8, 0.5, 0.8);
    float zalt = max(0.0, (zh - uSea) / (1.0 - uSea));
    vec3 base = zwater > 0.5 ? vec3(0.2, 0.3, 0.42) : mix(vec3(0.5, 0.55, 0.45), vec3(0.78, 0.76, 0.72), zalt);
    vec3 col = mix(base, hue, 0.38);
    float line = step(fract(hours + 0.5), fwidth(hours) * 1.2) * step(fwidth(hours), 0.5);
    float day = dayAt(world);
    col *= 0.38 + 0.62 * floor(day * 4.0 + bayer(gl_FragCoord.xy)) / 4.0;
    col = mix(col, vec3(0.95, 0.95, 0.85), line * 0.9);

    float labelY = uBuffer.y * 0.22;
    for (int k = -8; k <= 8; k += 1) {
      float centreX = uPlaceRect.x + (0.5 + float(k) / 16.0) * uPlaceRect.z;
      vec2 spot = vec2((centreX - uView.x) * uView.z + uBuffer.x * 0.5, labelY);
      float hour = floor(fract(uClock + float(k) / 24.0) * 24.0);
      vec2 local = floor((at - spot) / 3.0) + vec2(3.5, 2.5);
      if (local.x >= -2.0 && local.x < 9.0 && local.y >= -2.0 && local.y < 7.0) {
        col = mix(col, vec3(0.04, 0.06, 0.1), 0.8);
        if (stamp(hour, local) > 0.5) col = vec3(1.0, 0.95, 0.75);
      }
    }
    colour = vec4(col, 1.0);
    return;
  }

  if (uMode > 2.5) {
    float grid = 38.0;
    vec2 cell = floor(at / grid);
    vec2 centre = (cell + 0.5) * grid;
    vec2 anchor = uView.xy + (centre - uBuffer * 0.5) / uView.z;
    vec4 f = fieldAt(anchor);
    vec2 wind = (f.ba * 2.0 - 1.0) * WIND_TEXTURE_RANGE_METRES_PER_SECOND;
    float speed = length(wind);
    vec2 dir = speed > 0.01 ? wind / speed : vec2(1.0, 0.0);
    float mark = arrow(at - centre, dir, speed, uTime);
    vec3 tone = mix(vec3(0.55, 0.85, 0.95), vec3(1.0, 0.85, 0.3), smoothstep(2.0, 9.0, speed));
    tone = mix(tone, vec3(1.0, 0.35, 0.3), smoothstep(9.0, 18.0, speed));
    vec4 veil = vec4(0.02, 0.04, 0.08, 0.42);
    veil.rgb *= veil.a;
    colour = mark > 0.5 ? vec4(tone, 1.0) : veil;

    float pressure = (fieldAt(world).g * 2.0 - 1.0) * PRESSURE_TEXTURE_RANGE;
    float lines = pressure / 0.5;
    float iso = step(fract(lines), fwidth(lines) * 1.2) * step(fwidth(lines), 0.5);
    if (iso > 0.5 && mark < 0.5) colour = vec4(vec3(0.82, 0.88, 0.95) * 0.7, 0.7);

    for (int i = 0; i < 16; i += 1) {
      if (i >= uCentreCount) break;
      float strength = uCentre[i].z;
      float grow = abs(strength);
      vec2 spot = (uCentre[i].xy - uView.xy) * uView.z + uBuffer * 0.5;
      float unit = floor(1.0 + 2.0 * grow + 0.5);
      vec2 local = floor((at - spot) / unit);
      float radius = length(at - spot);
      float ring = step(abs(radius - (9.0 + 12.0 * grow)), 1.0);
      vec3 hue = strength > 0.0 ? vec3(1.0, 0.45, 0.35) : vec3(0.45, 0.68, 1.0);
      if (radius < (9.0 + 12.0 * grow)) colour = vec4(vec3(0.02, 0.04, 0.08) * 0.6, 0.6);
      if (ring > 0.5) colour = vec4(hue * (0.5 + 0.5 * grow), 1.0);
      vec2 g = local + vec2(2.0, 3.0);
      if (g.x >= 0.0 && g.x < 5.0 && g.y >= 0.0 && g.y < 7.0) {
        float glyph = strength > 0.0
          ? max(step(g.x, 0.5) + step(3.5, g.x), step(abs(g.y - 3.0), 0.5))
          : max(step(g.x, 0.5), step(5.5, g.y + 0.0) * step(g.y, 6.5));
        if (glyph > 0.5) colour = vec4(hue, 1.0);
      }
    }
    return;
  }

  vec2 huv = clamp((world - uMaskRect.xy) / uMaskRect.zw, 0.0, 1.0);
  float h = texture(uHeight, huv).r;
  float water = texture(uWaterMask, huv).r;
  vec2 e = 2.0 / uMaskRect.zw;
  float hx = texture(uHeight, huv + vec2(e.x, 0.0)).r - texture(uHeight, huv - vec2(e.x, 0.0)).r;
  float hy = texture(uHeight, huv + vec2(0.0, e.y)).r - texture(uHeight, huv - vec2(0.0, e.y)).r;
  float lit = clamp(0.5 - (hx + hy) * 16.0, 0.0, 1.0);
  lit = floor(lit * 4.0 + bayer(gl_FragCoord.xy)) / 4.0;
  float alt = max(0.0, (h - uSea) / (1.0 - uSea));

  if (uMode < 1.5) {
    vec3 col;
    if (water > 0.5) {
      float depth = clamp((uSea - h) / uSea, 0.0, 1.0);
      depth = h >= uSea ? 0.0 : floor(depth * 6.0) / 6.0;
      col = mix(vec3(0.5, 0.76, 0.86), vec3(0.08, 0.2, 0.44), sqrt(depth));
    } else {
      float band = floor(alt * 16.0) / 16.0;
      col = hypso(band) * (0.8 + 0.4 * lit);
      float c = alt * 16.0;
      col *= 1.0 - 0.28 * step(fract(c), fwidth(c));
    }
    colour = vec4(col, 1.0);
    return;
  }

  float kelvin = fieldAt(world).r * TEMPERATURE_TEXTURE_SPAN_CELSIUS + TEMPERATURE_TEXTURE_FLOOR_CELSIUS;
  float stepped = floor(kelvin / 3.0) * 3.0;
  vec3 col = heat((stepped - TEMPERATURE_TEXTURE_FLOOR_CELSIUS) / TEMPERATURE_TEXTURE_SPAN_CELSIUS);
  col *= water > 0.5 ? 0.72 : (0.88 + 0.22 * lit);
  float iso = kelvin / 10.0;
  col *= 1.0 - 0.4 * step(fract(iso), fwidth(iso));
  colour = vec4(col, 1.0);
}
