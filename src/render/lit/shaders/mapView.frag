#version 300 es
precision highp float;

uniform vec4 uView;
uniform vec2 uBuffer;
uniform float uMode;
uniform float uTime;
uniform float uSea;
uniform sampler2D uHeight;
uniform sampler2D uEco;
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

void main() {
  vec2 at = vec2(gl_FragCoord.x, uBuffer.y - gl_FragCoord.y);
  vec2 world = uView.xy + (at - uBuffer * 0.5) / uView.z;

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
