#version 300 es
precision highp float;

uniform vec4 uView;
uniform vec2 uBuffer;
uniform vec3 uTint;
uniform vec2 uLitter;
uniform sampler2D uSources;
uniform int uCount;
uniform vec4 uPoint[MAX_POINTS];
uniform vec3 uPointColor[MAX_POINTS];
uniform sampler2D uOccluder;
uniform vec4 uOccluderRect;
uniform vec4 uMarch;
out vec4 colour;
#include "weatherLibrary.glsl"
float occlusion(vec2 from, vec2 to) {
  float dist = length(to - from);
  float reach = max(0.0, 1.0 - 0.8 / max(dist, 0.0001));
  int steps = int(clamp(ceil(dist * reach * 4.0), 3.0, 20.0));
  float jitter = bayer(gl_FragCoord.xy);
  for (int i = 0; i < 20; i += 1) {
    if (i >= steps) break;
    float t = (float(i) + jitter) / float(steps) * reach;
    vec2 at = mix(from, to, t);
    vec2 uv = vec2((at.x - uOccluderRect.x) / uOccluderRect.z, 1.0 - (at.y - uOccluderRect.y) / uOccluderRect.w);
    if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) continue;
    if (texture(uOccluder, uv).r * uMarch.w > uMarch.y * t) return 1.0;
  }
  return 0.0;
}

void main() {
  vec2 at = vec2(gl_FragCoord.x, uBuffer.y - gl_FragCoord.y);
  vec2 world = uView.xy + (at - uBuffer * 0.5) / uView.z;

  vec3 glow = vec3(0.0);
  float lit = 0.0;
  for (int i = 0; i < MAX_POINTS; i += 1) {
    if (i >= uCount) break;
    float falloff = max(1.0 - length(world - uPoint[i].xy) / max(uPoint[i].z, 0.001), 0.0);
    float strength = falloff * falloff * uPoint[i].w;
    if (uMarch.x > 0.5 && falloff > 0.0) strength *= 1.0 - uMarch.z * occlusion(world, uPoint[i].xy);
    glow += uPointColor[i] * strength;
    lit += strength;
  }

  float steps = floor(clamp(lit, 0.0, 1.2) * 5.0 + bayer(gl_FragCoord.xy)) / 5.0;
  vec3 warm = lit > 0.0001 ? glow * (steps / lit) * 0.3 : vec3(0.0);
  float dark = gloomAt(world) * (1.0 - clamp(steps * 1.1, 0.0, 0.92));
  float shade = max(cloudAt(world + uCloudShift) * dayAt(world), skyState(world).r * 0.8);
  dark = 1.0 - (1.0 - dark) * (1.0 - 0.34 * shade);
  dark *= 1.0 - 0.8 * uStorm.x;
  vec4 layer = vec4(uTint * dark + warm, dark);
  layer = over(vec4(vec3(0.0), 1.0 - BACKGROUND_DIM), layer);

  vec4 gs = groundState(world);
  float shore = shoreAt(world);
  float lum = 0.22 + 0.78 * dayAt(world);

  float litterNow = mix(uLitter.x, uLitter.y, southAt(world));
  if (litterNow > 0.01) {
    float near = 0.0;
    for (int ly = -1; ly <= 1; ly += 1) {
      for (int lx = -1; lx <= 1; lx += 1) {
        vec2 spot = world + vec2(float(lx), float(ly)) * 1.6;
        near += texture(uSources, clamp((spot - uMaskRect.xy) / uMaskRect.zw, 0.0, 1.0)).r;
      }
    }
    near /= 9.0;
    vec2 pile = floor(world * 6.0);
    float roll = wHash(pile);
    float strewn = litterNow * shore * smoothstep(0.04, 0.55, near) * (0.5 + 0.5 * wNoise(world * 0.7));
    if (roll < strewn * 0.8) {
      float pick = wHash(pile + 5.0);
      vec3 leaf = pick < 0.35 ? vec3(0.78, 0.4, 0.15) : (pick < 0.7 ? vec3(0.62, 0.3, 0.14) : vec3(0.42, 0.28, 0.16));
      leaf *= 1.0 - 0.3 * smoothstep(0.7, 1.0, litterNow) * wHash(pile + 9.0);
      layer = over(vec4(leaf * lum * 0.9, 0.9), layer);
    }
  }

  float flurry = wNoise(world * 0.8) * 0.6 + wNoise(world * 3.3 + 11.0) * 0.4;
  float snowing = smoothstep(flurry - 0.1, flurry + 0.1, gs.r * 1.2) * shore * step(0.02, gs.r);
  snowing = floor(snowing * 3.0 + bayer(gl_FragCoord.xy + 4.0)) / 3.0;
  layer = over(vec4(vec3(0.88, 0.93, 1.0) * lum * snowing * 0.92, snowing * 0.92), layer);

  float soaked = gs.g * shore * (1.0 - snowing);
  soaked = floor(soaked * 3.0 + bayer(gl_FragCoord.xy + 6.0)) / 3.0;
  layer = over(vec4(vec3(0.02, 0.04, 0.1) * soaked * 0.24, soaked * 0.24), layer);

  float pond = smoothstep(0.62, 0.68, wNoise(world * 0.26 + 5.0)) * smoothstep(0.55, 0.9, gs.g) * shore * (1.0 - snowing);
  pond = floor(pond * 2.0 + bayer(gl_FragCoord.xy + 8.0)) / 2.0;
  layer = over(vec4(mix(vec3(0.42, 0.5, 0.62), fogColourAt(world), 0.3) * lum * pond * 0.55, pond * 0.55), layer);

  vec4 haze = hazeAt(world);
  float veil = floor(haze.a * 5.0 + bayer(gl_FragCoord.xy + 2.0)) / 5.0 * 0.9;
  colour = over(vec4(haze.rgb * veil, veil), layer);
}
