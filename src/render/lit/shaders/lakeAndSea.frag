#version 300 es
precision highp float;

uniform vec4 uView;
uniform vec2 uBuffer;
uniform float uTime;
uniform float uVisible;
uniform vec4 uPoke[MAX_POKES];
out vec4 colour;
#include "weatherLibrary.glsl"
#include "waterCommon.glsl"
void main() {
  vec2 at = vec2(gl_FragCoord.x, uBuffer.y - gl_FragCoord.y);
  vec2 world = uView.xy + (at - uBuffer * 0.5) / uView.z;
  vec2 huv = clamp((world - uMaskRect.xy) / uMaskRect.zw, 0.0, 1.0);
  float depth = texture(uWaterMask, huv).r;
  if (painted(vec2(0.0)) < 0.5) discard;
  float standing = smoothstep(0.45, 0.6, depth);

  float ditherNoise = bayer(gl_FragCoord.xy) - 0.5;
  vec2 quantisedWorld = floor(world * 8.0) / 8.0;
  vec2 wind = (fieldAt(world).ba * 2.0 - 1.0) * WIND_TEXTURE_RANGE_METRES_PER_SECOND;
  float blow = length(wind);
  vec2 along = blow > 0.05 ? wind / blow : vec2(1.0, 0.0);
  vec2 across = vec2(-along.y, along.x);
  float rough = clamp(blow / 12.0, 0.0, 1.0) * standing;

  float ice = smoothstep(-0.5, -3.0, temperatureAt(world));
  float live = 1.0 - ice;
  float day = dayAt(world);
  float daylightBrightness = 0.3 + 0.7 * day;

  float pattern = 0.0;
  for (int k = 0; k < 2; k += 1) {
    float phase = fract(uTime * (0.12 + 0.2 * rough) + 0.5 * float(k));
    float weight = 1.0 - abs(2.0 * phase - 1.0);
    vec2 p = (quantisedWorld - along * (phase * 3.0)) * 0.95 + float(k) * vec2(31.7, 9.3);
    float smear = 0.0;
    for (int j = 0; j < 3; j += 1) smear += preciseFbm(p + along * (float(j) * 0.35 * rough));
    pattern += weight * smear / 3.0;
  }
  float crest = step(0.665 - 0.06 * rough + ditherNoise * 0.08, pattern) * live;
  float trough = step(pattern, 0.33 + ditherNoise * 0.08) * live;
  float caps = step(0.76 - 0.05 * rough + ditherNoise * 0.06, pattern) * smoothstep(0.35, 0.8, rough) * live;

  float reach = 1.5 + 1.5 * (0.5 + 0.5 * sin(uTime * 1.3 + preciseNoise(quantisedWorld * 2.0) * 6.28));
  float lap = shoreDistance(reach) * step(0.5 + ditherNoise * 0.1, preciseNoise(quantisedWorld * 7.0 - vec2(0.0, uTime * 0.3))) * live;

  float rain = skyState(world).g;
  float drops = rings(quantisedWorld, rain * (1.0 - 0.45 * rough), uTime) * live;

  float glint = step(0.99 - 0.008 * rough, preciseHash(floor(world * 16.0) + floor(uTime * 4.0) * 13.0)) * smoothstep(0.3, 0.9, day) * live;

  float poked = 0.0;
  for (int i = 0; i < MAX_POKES; i += 1) {
    float age = uTime - uPoke[i].z;
    if (uPoke[i].w < 0.5 || age < 0.0 || age > 2.4) continue;
    float r = length(world - uPoke[i].xy);
    float fade = 1.0 - age / 2.4;
    poked = max(poked, step(abs(r - age * 1.1), 0.05) * fade);
    poked = max(poked, step(abs(r - (age - 0.4) * 1.1), 0.04) * fade * 0.8 * step(0.4, age));
  }

  vec4 layer = vec4(0.0);
  layer = over(tint(vec3(0.03, 0.13, 0.3) * daylightBrightness, 0.38 * trough), layer);
  layer = over(tint(vec3(0.8, 0.93, 1.0) * daylightBrightness, (0.1 + 0.28 * rough) * crest), layer);
  layer = over(tint(vec3(0.97, 0.99, 1.0) * daylightBrightness, 0.7 * caps), layer);
  layer = over(tint(vec3(0.95, 0.98, 1.0) * daylightBrightness, 0.65 * lap), layer);
  layer = over(tint(vec3(0.92, 0.97, 1.0) * daylightBrightness, 0.75 * max(drops, poked * live)), layer);
  layer = over(tint(vec3(1.0, 0.98, 0.9), 0.85 * glint), layer);
  float crack = step(0.9, preciseNoise(quantisedWorld * 2.7)) * ice;
  layer = over(tint(vec3(0.82, 0.92, 1.0) * daylightBrightness, ice * 0.55), layer);
  layer = over(tint(vec3(0.5, 0.65, 0.85) * daylightBrightness, 0.5 * crack), layer);

  colour = layer * uVisible * (0.6 + 0.4 * standing);
}
