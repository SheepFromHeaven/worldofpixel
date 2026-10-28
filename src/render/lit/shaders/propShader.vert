#version 300 es
layout(location = 0) in vec2 corner;
layout(location = 1) in vec4 a0;
layout(location = 2) in vec4 a1;
layout(location = 3) in vec2 a2;
layout(location = 4) in vec2 a3;

uniform vec4 uView;
uniform vec2 uBuffer;
uniform vec2 uAtlas;
uniform sampler2D uCrop;
uniform float uCast;
uniform float uShadowPass;
uniform vec4 uPoint[MAX_POINTS];
uniform float uLightHeight;
uniform float uTime;
uniform float uWind;
uniform vec4 uSeasonal[48];
#include "weatherLibrary.glsl"
float cell(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec2 shadowOf(vec2 at, float height) {
  if (uCast < 0.5) return vec2(0.0);
  if (uCast > 3.5) {
    vec2 fromLight = at - uPoint[int(uCast - 3.5)].xy;
    float distance = max(length(fromLight), 0.0001);
    return fromLight / distance * min(10.0, distance / max(uLightHeight * 0.7 - height, 0.12));
  }
  bool moon = uCast > 1.5 && (uCast < 2.5 || moonShadowAt(at) > sunShadowAt(at));
  vec3 t = moon ? moonTowardAt(at) : sunToward(at);
  float away = max(length(t.xy), 0.0001);
  float reach = min(3.0, away / max(t.z, 0.001));
  return -t.xy / away * reach;
}

invariant gl_Position;

out vec2 vUv;
out vec2 vWorld;
out vec2 vFloor;
out float vFlip;
out float vWind;
out float vSway;
out float vBend;
out float vCanopy;
out float vHides;
out float vLayered;
out float vRim;
out float vFocus;
out float vEmit;
out vec2 vLocal;
out vec3 vTree;
out float vSize;
out vec4 vSmear;
out vec3 vAtlasAt;
out float vSpread;
flat out vec4 vSeasonA;
flat out vec4 vSeasonB;
flat out vec3 vSeasonTp;
flat out vec2 vSwayLean;
flat out float vCastAlpha;
flat out float vTop;

void main() {
  float size = a1.x;
  vec2 foot = vec2(a2.x > 0.5 ? a1.x - a1.y : a1.y, a1.z);
  float metres = a1.w * uView.w;
  float flags = a3.y;
  float canopy = mod(flags, 2.0) >= 1.0 ? 1.0 : 0.0;
  float hides = mod(floor(flags / 8.0), 2.0) >= 1.0 ? 1.0 : 0.0;
  float layered = mod(floor(flags / LAYERED_FLAG), 2.0) >= 1.0 ? 1.0 : 0.0;
  vec2 shadow = shadowOf(a0.xy, metres);
  bool smear = uShadowPass > 0.5 && uCast > 0.5 && canopy < 0.5;
  vec2 topLeft = a0.xy + (smear ? vec2(0.0) : shadow * metres) - foot * uView.w;
  vec2 origin = floor((topLeft - uView.xy) * uView.z + uBuffer * 0.5 + 0.5);
  float texelPixels = uView.w * uView.z;
  vec2 sweep = smear ? shadow * metres * uView.z : vec2(0.0);
  vec4 cropped = floor(texelFetch(uCrop, ivec2(a0.zw), 0) * 255.0 + 0.5);
  vec2 cropLow = cropped.xy;
  vec2 cropHigh = cropped.zw;
  if (cropHigh.x <= cropLow.x || cropHigh.y <= cropLow.y) {
    cropLow = vec2(0.0);
    cropHigh = vec2(size);
  }
  if (a2.x > 0.5) {
    float mirroredLow = size - cropHigh.x;
    cropHigh.x = size - cropLow.x;
    cropLow.x = mirroredLow;
  }
  vec2 lowOffset = cropLow * texelPixels;
  vec2 highOffset = cropHigh * texelPixels;
  vec2 extent = highOffset - lowOffset;
  float spread = 0.0;
  if (smear && uCast > 3.5) {
    float tip = 1.0 / (1.0 - min(metres / (uLightHeight * 0.7), 0.8));
    spread = min((tip - 1.0) * (0.5 + uPoint[int(uCast - 3.5)].w), 3.0);
  }
  vec2 margin = extent * spread + vec2(length(sweep) * (spread > 0.0 ? 0.3 : 0.05));
  vec2 low = origin + lowOffset + min(sweep, vec2(0.0)) - margin;
  vec2 high = origin + highOffset + max(sweep, vec2(0.0)) + margin;
  vec2 pixel = smear ? mix(low, high, corner) : origin + mix(lowOffset, highOffset, corner);
  vec2 local = (pixel - origin) / texelPixels;
  vec2 ndc = pixel / uBuffer * 2.0 - 1.0;
  float chance = fract(sin(dot(a0.xy, vec2(12.9898, 78.233))) * 43758.5453);
  float rim = mod(floor(flags / 16.0), 2.0) >= 1.0 ? 1.0 : 0.0;
  float key = liftedKey(a0.y, uView.y, canopy * 2.0 + hides);
  float depth = propDepth(key);
  gl_Position = vec4(ndc.x, -ndc.y, depth, 1.0);
  vUv = (a0.zw + vec2(a2.x > 0.5 ? size - local.x : local.x, local.y)) / uAtlas;
  vFlip = a2.x;
  vWind = a2.y;
  vSway = a3.x;
  vBend = mod(floor(flags / 2.0), 2.0) >= 1.0 ? 1.0 : 0.0;
  vCanopy = canopy;
  vHides = hides;
  vLayered = layered;
  vRim = rim;
  vFocus = mod(floor(flags / 32.0), 2.0) >= 1.0 ? 1.0 : 0.0;
  vEmit = mod(floor(flags / 4.0), 2.0) >= 1.0 ? 1.0 : 0.0;
  vLocal = local - foot;
  vSmear = vec4(local, smear ? sweep / texelPixels : vec2(0.0));
  vSpread = spread;
  vAtlasAt = vec3(a0.zw, smear ? 1.0 : 0.0);
  vTree = vec3(a0.xy, chance);
  vSize = size;

  vec2 tp = mod(a0.xy, 61.0);
  int kind = int(mod(floor(flags / 64.0), STEM_FLAG / 64.0) + 0.5);
  int side = southAt(a0.xy) >= chance ? 24 : 0;
  vec4 sa = uSeasonal[side + kind * 2];
  vec4 sb = uSeasonal[side + kind * 2 + 1];
  float whole = cell(tp * 1.37 + 5.3);
  float wholeAbsent = (sb.w > 0.5 && (whole < sb.z || whole >= sb.x)) ? 1.0 : 0.0;
  vSeasonA = sa;
  vSeasonB = sb;
  vSeasonTp = vec3(tp, wholeAbsent);

  float beat = floor(uTime * 2.5);
  float phase = chance * 6.2831;
  float gust = sin(beat * 0.41 + dot(a0.xy, vec2(0.21, 0.13)) + phase * 0.3)
    + 0.5 * sin(beat * 0.97 + dot(a0.xy, vec2(-0.37, 0.29)) + phase);
  float gale = groundState(a0.xy).b;
  float lean = gust * uWind * (0.12 + a2.y * 0.75 + gale * 1.4) * a3.x;
  float bends = mod(floor(flags / 2.0), 2.0) >= 1.0 ? 1.0 : 0.0;
  vSwayLean = vec2(lean, (bends > 0.5 || gale > 0.55) ? 2.0 : 1.0);

  float casting = 0.0;
  if (uShadowPass > 0.5 && uCast > 0.5 && uCast < 3.5) {
    float sunPart = sunShadowAt(a0.xy);
    float moonPart = moonShadowAt(a0.xy);
    casting = uCast < 1.5 ? sunPart : (uCast < 2.5 ? moonPart : max(sunPart, moonPart) * 1.2);
  }
  vCastAlpha = casting;
  vTop = metres;
  vWorld = a0.xy + vLocal * uView.w;
  vFloor = vWorld + shadow * metres;
}
