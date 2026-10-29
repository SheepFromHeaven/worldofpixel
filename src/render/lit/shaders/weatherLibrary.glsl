const float BACKGROUND_DIM = 0.78;
#include "skyPlaces.glsl"
uniform sampler2D uWeather;
uniform vec4 uWeatherRect;
uniform vec4 uSky;
uniform vec2 uDrift;
uniform vec2 uCloudShift;
uniform sampler2D uSkyState;
uniform sampler2D uGroundState;
uniform sampler2D uWaterMask;
uniform sampler2D uWaterMurk;
uniform vec4 uMaskRect;
uniform vec4 uStorm;
uniform sampler2D uField;
uniform sampler2D uCloud;

vec2 weatherUv(vec2 world) {
  return clamp((world - uWeatherRect.xy) / uWeatherRect.zw, 0.0, 1.0);
}

vec4 skyState(vec2 world) {
  vec4 raw = texture(uSkyState, weatherUv(world));
  return vec4(raw.r, smoothstep(0.08, 0.3, raw.g), smoothstep(0.08, 0.3, raw.b), smoothstep(0.1, 0.35, raw.a));
}

vec4 groundState(vec2 world) {
  return texture(uGroundState, weatherUv(world));
}

vec2 waterMurkAt(vec2 world) {
  return texture(uWaterMurk, clamp((world - uMaskRect.xy) / uMaskRect.zw, 0.0, 1.0)).rg;
}

float shoreAt(vec2 world) {
  float water = texture(uWaterMask, clamp((world - uMaskRect.xy) / uMaskRect.zw, 0.0, 1.0)).r;
  return 1.0 - smoothstep(0.3, 0.7, water);
}

vec4 over(vec4 top, vec4 bottom) {
  return top + bottom * (1.0 - top.a);
}

float bayer(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  const float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (m[x + y * 4] + 0.5) / 16.0;
}

float wHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float wNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), f.x), mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), f.x), f.y);
}

float wFbm(vec2 p) {
  float amount = 0.5;
  float sum = 0.0;
  for (int i = 0; i < 4; i += 1) {
    sum += amount * wNoise(p);
    p *= 2.03;
    amount *= 0.5;
  }
  return sum / 0.9375;
}

vec4 weatherAt(vec2 world) {
  return texture(uWeather, clamp((world - uWeatherRect.xy) / uWeatherRect.zw, 0.0, 1.0));
}

float fogAt(vec2 world) {
  vec4 w = weatherAt(world);
  vec2 drift = uDrift * uSky.z;
  float wisps = wFbm((world - drift * 0.4) * 0.05 + 3.0);
  float bank = wFbm((world - drift * 0.15) * 0.013);
  float density = w.r * uSky.x * fogTimeAt(world) * (0.35 + 1.1 * wisps) * (0.5 + 0.9 * bank);
  return smoothstep(0.1, 0.7, density);
}

vec4 cloudState(vec2 world) {
  return texture(uCloud, weatherUv(world));
}

vec2 cloudWind(vec2 world) {
  return (texture(uField, weatherUv(world)).ba * 2.0 - 1.0) * WIND_TEXTURE_RANGE_METRES_PER_SECOND * 0.25;
}

float flowFbm(vec2 world, vec2 wind, vec2 scale, float turn, vec2 offset) {
  float phase = uSky.z / 25.0;
  float a = fract(phase);
  float b = fract(phase + 0.5);
  float mixing = 1.0 - abs(2.0 * a - 1.0);
  vec2 dir = normalize(wind + vec2(0.0001, 0.0));
  mat2 frame = mat2(dir.x, -dir.y, dir.y, dir.x);
  vec2 pa = mix(world - wind * a * 25.0, frame * (world - wind * a * 25.0), turn);
  vec2 pb = mix(world - wind * b * 25.0, frame * (world - wind * b * 25.0), turn);
  return mix(wFbm(pb * scale + offset), wFbm(pa * scale + offset), mixing);
}

vec3 cloudCore(vec2 world, vec4 c, vec2 wind) {
  float water = clamp(c.r * 1.6, 0.0, 1.0);
  float share = max(0.0, 1.0 - c.g - c.b);
  float nCu = flowFbm(world, wind, vec2(0.04), 0.0, vec2(3.1, 7.7));
  float thrCu = 0.8 - 0.5 * water;
  float cu = smoothstep(thrCu, thrCu + 0.1, nCu) * share * smoothstep(0.1, 0.3, c.r * 1.6);
  float nSt = flowFbm(world, wind * 0.9, vec2(0.009), 0.0, vec2(11.0, 4.0));
  float thrSt = 0.66 - 0.45 * water;
  float st = smoothstep(thrSt, thrSt + 0.25, nSt) * 0.85 * c.b;
  float nCb = flowFbm(world, wind * 0.8, vec2(0.016), 0.0, vec2(5.0, 2.0));
  float cb = smoothstep(0.28, 0.5, nCb + 0.35 * c.g + 0.2 * (c.r * 1.6 - 0.8)) * c.g;
  return vec3(cu, st, cb);
}

float cloudAt(vec2 world) {
  vec3 v = cloudCore(world, cloudState(world), cloudWind(world));
  return clamp(max(v.x, max(v.y, v.z)), 0.0, 1.0);
}

vec4 fieldAt(vec2 world) {
  return texture(uField, weatherUv(world));
}

vec4 hazeAt(vec2 world) {
  float fog = fogAt(world);
  vec4 st = skyState(world);
  float storm = clamp(st.g * 0.55 + st.b * 0.85 + st.a * 0.95, 0.0, 1.0) * (1.0 - 0.75 * uStorm.w);
  storm *= 0.55 + 0.45 * wFbm(world * 0.035 - uDrift * uSky.z * 0.6);
  float lum = 0.25 + 0.75 * dayAt(world);
  float total = st.g + st.b + st.a + 0.0001;
  vec3 tone = (vec3(0.52, 0.57, 0.65) * st.g + vec3(0.82, 0.86, 0.92) * st.b + vec3(0.8, 0.62, 0.38) * st.a) / total * lum;
  return vec4(mix(fogColourAt(world), tone, storm / (fog + storm + 0.0001)), max(fog, storm));
}

float seenFromZoom(float lengthMetres) {
  return clamp(SIGHT_NEAREST_ZOOM * sqrt(SIGHT_BIGGEST_METRES / max(lengthMetres, 0.001)), SIGHT_NEAREST_ZOOM, SIGHT_FARTHEST_ZOOM);
}

float sightFade(float zoom, float lengthMetres) {
  return clamp(1.0 + log2(zoom / seenFromZoom(lengthMetres)) / SIGHT_FADE_LEVELS, 0.0, 1.0);
}

float propDepth(float key) {
  return -clamp(key / PROP_DEPTH_RANGE, -0.99, 0.99);
}

float liftedKey(float worldY, float viewY, float layer) {
  return (worldY - viewY) * LIFTED_DEPTH_PER_TILE + layer * 0.01;
}

float depthKey(float height, float worldY, float viewY) {
  return liftedKey(worldY, viewY, 0.0);
}
