#version 300 es
layout(location = 0) in vec2 corner;
layout(location = 1) in vec4 a0;
layout(location = 2) in vec4 a1;
layout(location = 3) in vec2 a2;
layout(location = 4) in vec2 a3;

uniform vec4 uView;
uniform vec2 uBuffer;
uniform vec2 uAtlas;
uniform float uCast;
#include "skyPlaces.glsl"
vec2 shadowOf(vec2 at) {
  if (uCast < 0.5) return vec2(0.0);
  bool moon = uCast > 1.5 && (uCast < 2.5 || moonShadowAt(at) > sunShadowAt(at));
  vec3 t = moon ? moonTowardAt(at) : sunToward(at);
  float away = max(length(t.xy), 0.0001);
  float reach = min(3.0, away / max(t.z, 0.001));
  return -t.xy / away * reach;
}

out vec2 vUv;
out vec2 vWorld;
out vec2 vFloor;
out float vFlip;
out float vWind;
out float vSway;
out float vBend;
out float vCanopy;
out float vEmit;
out float vKind;
out vec2 vLocal;
out vec3 vTree;
out float vSize;

void main() {
  float size = a1.x;
  vec2 foot = vec2(a2.x > 0.5 ? a1.x - a1.y : a1.y, a1.z);
  float metres = a1.w * uView.w;
  float flags = a3.y;
  float canopy = mod(flags, 2.0) >= 1.0 ? 1.0 : 0.0;
  vec2 shadow = shadowOf(a0.xy);
  vec2 topLeft = a0.xy + shadow * metres - foot * uView.w;
  vec2 origin = floor((topLeft - uView.xy) * uView.z + uBuffer * 0.5 + 0.5);
  vec2 pixel = origin + corner * size * uView.w * uView.z;
  vec2 ndc = pixel / uBuffer * 2.0 - 1.0;
  float chance = fract(sin(dot(a0.xy, vec2(12.9898, 78.233))) * 43758.5453);
  float key = metres * 8.0 + canopy * 6.0 + (a0.y - uView.y) * 0.02 + (chance - 0.5) * 0.6;
  float depth = -clamp(key / 24.0, -0.99, 0.99);
  gl_Position = vec4(ndc.x, -ndc.y, depth, 1.0);
  vUv = (a0.zw + vec2(a2.x > 0.5 ? 1.0 - corner.x : corner.x, corner.y) * size) / uAtlas;
  vFlip = a2.x;
  vWind = a2.y;
  vSway = a3.x;
  vBend = mod(floor(flags / 2.0), 2.0) >= 1.0 ? 1.0 : 0.0;
  vCanopy = canopy;
  vEmit = mod(floor(flags / 4.0), 2.0) >= 1.0 ? 1.0 : 0.0;
  vKind = floor(flags / 8.0);
  vLocal = corner * size - foot;
  vTree = vec3(a0.xy, chance);
  vSize = size;
  vWorld = a0.xy + (corner * size - foot) * uView.w;
  vFloor = vWorld + shadow * metres;
}
