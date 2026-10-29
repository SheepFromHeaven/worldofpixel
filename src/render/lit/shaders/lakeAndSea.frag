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

const float PERIOD = 11.0;

void main() {
  vec2 at = vec2(gl_FragCoord.x, uBuffer.y - gl_FragCoord.y);
  vec2 world = uView.xy + (at - uBuffer * 0.5) / uView.z;
  vec2 huv = clamp((world - uMaskRect.xy) / uMaskRect.zw, 0.0, 1.0);
  vec4 mask = texture(uWaterMask, huv);
  if (painted(vec2(0.0)) < 0.5) discard;

  float standing = smoothstep(0.45, 0.6, mask.a);
  float depthMetres = mask.g * 25.5;
  float sea = mask.b;

  float dither = bayer(gl_FragCoord.xy) - 0.5;
  vec2 q = floor(world * 8.0) / 8.0;
  vec2 wind = (fieldAt(world).ba * 2.0 - 1.0) * WIND_TEXTURE_RANGE_METRES_PER_SECOND;
  float blow = length(wind);
  vec2 along = blow > 0.05 ? wind / blow : vec2(1.0, 0.0);
  float rough = clamp(blow / 12.0, 0.0, 1.0) * standing;

  float ice = smoothstep(-0.5, -3.0, temperatureAt(world));
  float live = 1.0 - ice;
  float bright = 0.3 + 0.7 * dayAt(world);

  float shallowness = exp(-depthMetres * 0.7);
  vec2 drift = wind * 0.04;
  vec2 shift = vec2(0.0);
  float spark = 0.0;
  for (int k = 0; k < 2; k += 1) {
    float phase = fract(uTime / PERIOD + 0.5 * float(k));
    float weight = 1.0 - abs(2.0 * phase - 1.0);
    vec2 p = (q - drift * phase * PERIOD) * (1.6 + 1.4 * rough) + float(k) * vec2(23.1, 7.7);
    float n0 = preciseNoise(p);
    shift += weight * vec2(preciseNoise(p + vec2(0.2, 0.0)) - n0, preciseNoise(p + vec2(0.0, 0.2)) - n0);
    spark += weight * step(0.88 - 0.05 * rough + 0.04 * dither, preciseNoise(p * 2.9 + 5.0));
  }
  shift *= (0.25 + 0.9 * rough + 0.7 * shallowness) * 0.7;
  vec2 bed = floor((world + shift) * 8.0) / 8.0;

  vec2 murk = waterMurkAt(world);
  float silt = murk.x;
  float algae = algaeNow(world, murk.y);
  float cloud = clamp(silt * 1.2 + algae * 0.9, 0.0, 1.0);
  float absorb = murkAbsorb(depthMetres, sea, silt, algae);
  vec3 water = waterThrough(bedAt(bed), absorb, sea, silt, algae);
  water += vec3(0.5, 0.55, 0.6) * clamp(spark, 0.0, 1.0) * (0.12 + 0.2 * smoothstep(0.3, 0.9, bright)) * (1.0 - absorb * 0.5) * (1.0 - 0.7 * cloud);
  float alpha = mix(0.55 + 0.4 * (1.0 - shallowness), 0.97, cloud) * standing;
  vec4 layer = tint(water * bright, alpha * live);

  float swell = preciseNoise((q - along * uTime * (0.25 + 0.5 * rough)) * 0.45);
  float ripple = preciseNoise((q - along * uTime * (0.5 + rough)) * vec2(1.4, 2.6) + 3.0);
  float crest = step(0.72 - 0.1 * rough + 0.06 * dither, ripple * (0.55 + 0.9 * swell)) * rough * live;
  layer = over(tint(vec3(0.85, 0.95, 1.0) * bright, 0.38 * crest), layer);
  float caps = step(0.85 - 0.07 * rough + 0.05 * dither, ripple * (0.55 + 0.9 * swell)) * smoothstep(0.4, 0.85, rough) * live;
  layer = over(tint(vec3(0.97, 0.99, 1.0) * bright, 0.85 * caps), layer);

  float reach = 1.4 + 1.6 * (0.5 + 0.5 * sin(uTime * (0.9 + 0.8 * rough) + preciseNoise(q * 1.5) * 6.28));
  float edge = shoreDistance(reach);
  if (edge > 0.0) {
    float surf = step(0.5 + dither * 0.1, preciseNoise(q * 6.0 - vec2(0.0, uTime * 0.35))) * live;
    float line = shoreDistance(reach * 0.45);
    layer = over(tint(mix(vec3(0.96, 0.99, 1.0), vec3(0.78, 0.7, 0.52), cloud * 0.7) * (0.6 + 0.4 * bright), 0.35 * surf * edge + 0.55 * surf * line), layer);
  }

  float rain = skyState(world).g;
  if (rain > 0.01) {
    float drops = rings(q, rain * (1.0 - 0.45 * rough), uTime) * live;
    layer = over(tint(vec3(0.92, 0.97, 1.0) * bright, 0.75 * drops), layer);
  }

  float glint = step(0.99 - 0.008 * rough, preciseHash(floor(world * 16.0) + floor(uTime * 4.0) * 13.0)) * smoothstep(0.3, 0.9, bright) * live * (1.0 - smoothstep(0.15, 0.7, cloud));
  layer = over(tint(vec3(1.0, 0.98, 0.9), 0.85 * glint), layer);

  float poked = 0.0;
  for (int i = 0; i < MAX_POKES; i += 1) {
    float age = uTime - uPoke[i].z;
    if (uPoke[i].w < 0.5 || age < 0.0 || age > 2.4) continue;
    float r = length(world - uPoke[i].xy);
    float fade = 1.0 - age / 2.4;
    poked = max(poked, step(abs(r - age * 1.1), 0.05) * fade);
    poked = max(poked, step(abs(r - (age - 0.4) * 1.1), 0.04) * fade * 0.8 * step(0.4, age));
  }
  layer = over(tint(vec3(0.92, 0.97, 1.0) * bright, 0.75 * poked * live), layer);

  float crack = step(0.9, preciseNoise(q * 2.7)) * ice;
  layer = over(tint(vec3(0.82, 0.92, 1.0) * bright, ice * 0.55), layer);
  layer = over(tint(vec3(0.5, 0.65, 0.85) * bright, 0.5 * crack), layer);

  colour = layer * uVisible;
}
