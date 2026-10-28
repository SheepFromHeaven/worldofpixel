#version 300 es
precision highp float;

uniform sampler2D uAlbedo;
uniform sampler2D uNormal;
uniform float uShadowPass;
uniform float uCast;
uniform int uCount;
uniform vec4 uPoint[MAX_POINTS];
uniform vec3 uPointColor[MAX_POINTS];
uniform float uLightHeight;
uniform float uTime;
uniform float uWind;
uniform vec2 uAtlas;
uniform vec4 uView;
uniform vec2 uBuffer;
uniform vec4 uSee[SEE_THROUGH];
uniform float uSeeGain[SEE_THROUGH];
#include "weatherLibrary.glsl"
in vec2 vUv;
in vec2 vWorld;
in vec2 vFloor;
in float vFlip;
in float vWind;
flat in float vTop;
uniform float uOccluderRange;
in float vSway;
in float vBend;
in float vCanopy;
in float vHides;
in float vLayered;
in float vRim;
in float vFocus;
in float vEmit;
in vec2 vLocal;
in vec3 vTree;
in float vSize;
in vec4 vSmear;
in vec3 vAtlasAt;
in float vSpread;
flat in vec4 vSeasonA;
flat in vec4 vSeasonB;
flat in vec3 vSeasonTp;
flat in vec2 vSwayLean;
flat in float vCastAlpha;
flat in float vSubmerged;
out vec4 colour;

const float BANDS = 5.0;
const float LEAF_ALPHA_FROM = 0.9;
const float WOOD_REACH_ALPHA = 0.8;

float cell(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float castAlpha() {
  if (uCast > 3.5) {
    vec4 light = uPoint[int(uCast - 3.5)];
    float falloff = max(1.0 - length(light.xy - vWorld) / max(light.z, 0.001), 0.0);
    return min(falloff * falloff * light.w * 1.2, 0.85);
  }
  return vCastAlpha;
}

float torchFill(vec2 at) {
  float fill = 0.0;
  for (int i = 0; i < MAX_POINTS; i += 1) {
    if (i >= uCount) break;
    float falloff = max(1.0 - length(uPoint[i].xy - at) / max(uPoint[i].z, 0.001), 0.0);
    fill += falloff * falloff * uPoint[i].w;
  }
  return clamp(fill, 0.0, 1.0);
}

float spared(vec2 at) {
  return uCast > 3.5 ? 1.0 : 1.0 - 0.85 * torchFill(at);
}

vec2 swayed() {
  if (vSway <= 0.0) return vUv;
  float beat = floor(uTime * 2.5);
  float along = vBend > 0.5 ? clamp(length(vLocal) / (vSize * 0.35), 0.0, 1.0) : 1.0;
  vec2 shift = vec2(clamp(floor(vSwayLean.x * along + 0.5), -vSwayLean.y, vSwayLean.y), 0.0);

  float reach = length(vLocal) / (vSize * 0.38);
  vec2 texel = floor(vLocal);
  float twitch = cell(texel + vTree.xy * 3.0 + beat);
  if (vBend < 0.5 && reach > 0.75 && twitch < 0.025 * uWind * vWind * vSway) shift.x += cell(texel + beat) > 0.5 ? 1.0 : -1.0;

  shift.x *= vFlip > 0.5 ? -1.0 : 1.0;
  return vUv - shift / uAtlas;
}

float seeThroughClear(float alpha, bool backed) {
  if (vCanopy < 0.5 && vHides < 0.5 && vTop < TALL_MARK_HEIGHT) return 0.0;
  vec2 at = vec2(gl_FragCoord.x, uBuffer.y - gl_FragCoord.y);
  float clear = 0.0;
  bool leaves = vCanopy > 0.5 && alpha > LEAF_ALPHA_FROM;
  for (int i = 0; i < SEE_THROUGH; i += 1) {
    vec4 focus = uSee[i];
    if (focus.w <= 0.0) continue;
    vec2 centre = (vec2(focus.x, focus.y - focus.z) - uView.xy) * uView.z + uBuffer * 0.5;
    vec2 away = at - centre;
    float lower = leaves ? 0.0 : 1.0 - smoothstep(-0.5, 1.0, -away.y / (focus.w * SEE_THROUGH_OUTER * uView.z * SEE_THROUGH_RISE_BAND));
    if (!leaves && away.y < 0.0) away.y *= SEE_THROUGH_DEPTH;
    float gap = length(away) / (focus.w * SEE_THROUGH_OUTER * uView.z);
    float ramp = clamp((1.0 - gap) / (leaves ? SEE_THROUGH_LEAF_BAND : SEE_THROUGH_WOOD_BAND), 0.0, 1.0);
    if (leaves && backed && gap < 1.0) ramp = min(1.0, ramp + SEE_THROUGH_REVEAL_BIAS);
    float inside = leaves ? ramp : ramp * ramp * ramp;
    clear = max(clear, uSeeGain[i] * max(inside, lower * ramp));
  }
  return clear;
}

float seeThroughReveal() {
  vec2 at = vec2(gl_FragCoord.x, uBuffer.y - gl_FragCoord.y);
  float best = 2.0;
  for (int i = 0; i < SEE_THROUGH; i += 1) {
    vec4 focus = uSee[i];
    if (focus.w <= 0.0 || uSeeGain[i] <= 0.0) continue;
    vec2 centre = (vec2(focus.x, focus.y - focus.z) - uView.xy) * uView.z + uBuffer * 0.5;
    float gap = length(at - centre) / (focus.w * SEE_THROUGH_OUTER * uView.z);
    if (gap >= 1.0) continue;
    float shown = min(1.0, clamp((1.0 - gap) / SEE_THROUGH_LEAF_BAND, 0.0, 1.0) + SEE_THROUGH_REVEAL_BIAS) * uSeeGain[i];
    best = best > 1.5 ? shown : max(best, shown);
  }
  return best;
}

vec2 sampled() {
  return swayed();
}

vec2 woodBehind(vec2 uv) {
  return uv + vec2(vSize, 0.0) / uAtlas;
}

bool present(vec2 local) {
  if (vSeasonB.w > 0.5) {
    if (vSeasonTp.z > 0.5) return false;
  } else if (cell(floor(local) + vSeasonTp.xy * 1.37) > vSeasonB.x) return false;
  if (cell(floor(local) * 1.7 + vSeasonTp.yx) < vSeasonA.y * 1.04) return false;
  return true;
}

float smearedHit() {
  float sweepLength = sqrt(dot(vSmear.zw, vSmear.zw));
  int steps = int(min(ceil(sweepLength * (uCast > 3.5 ? 1.0 : 2.0)), 192.0));
  vec2 foot = vSmear.xy - vLocal;
  vec2 direction = sweepLength > 0.0001 ? vSmear.zw / sweepLength : vec2(1.0, 0.0);
  vec2 sideways = vec2(-direction.y, direction.x);
  vec2 fromFoot = vSmear.xy - foot;
  float forward = dot(fromFoot, direction);
  float lateral = dot(fromFoot, sideways);
  float softness = (vSpread > 0.0 ? 0.3 : 0.05) * sweepLength;
  float jitter = (bayer(gl_FragCoord.xy) - 0.5) * 2.0 * softness;
  for (int i = 0; i <= steps; i += 1) {
    float along = steps == 0 ? 0.0 : float(i) / float(steps);
    float widen = 1.0 + vSpread * along;
    vec2 at = foot + direction * (forward - sweepLength * along) + sideways * ((lateral + jitter * along) / widen);
    if (at.x < 0.0 || at.y < 0.0 || at.x >= vSize || at.y >= vSize) continue;
    vec2 texel = floor(at);
    float across = vFlip > 0.5 ? vSize - 1.0 - texel.x : texel.x;
    vec2 uv = (vAtlasAt.xy + vec2(across, texel.y) + 0.5) / uAtlas;
    if (textureLod(uAlbedo, uv, 0.0).a < 0.5) continue;
    if (present(at - foot)) return along;
  }
  return -1.0;
}

void main() {
  if (uShadowPass > 3.5) {
    if (texture(uAlbedo, swayed()).a < 0.5) discard;
    if (!present(vLocal)) discard;
    colour = vec4(clamp(vTop / uOccluderRange, 0.0, 1.0), 0.0, 0.0, 1.0);
    return;
  }
  if (uShadowPass > 2.5) {
    vec2 uv = sampled();
    float alpha = texture(uAlbedo, uv).a;
    if (alpha < 0.5) discard;
    if (alpha <= LEAF_ALPHA_FROM && vCanopy > 0.5) {
      float revealed = seeThroughReveal();
      if (revealed < 1.5 && revealed * SEE_THROUGH_GAIN <= bayer(gl_FragCoord.xy)) discard;
    }
    bool backed = alpha > LEAF_ALPHA_FROM && vLayered > 0.5 && texture(uAlbedo, woodBehind(uv)).a > 0.5;
    if (alpha > LEAF_ALPHA_FROM && (!present(vLocal) || seeThroughClear(alpha, backed) * SEE_THROUGH_GAIN > bayer(gl_FragCoord.xy))) {
      if (vLayered < 0.5 || texture(uAlbedo, woodBehind(uv)).a < 0.5) discard;
      alpha = 0.0;
    }
    if (seeThroughClear(alpha, false) * SEE_THROUGH_GAIN > bayer(gl_FragCoord.xy)) discard;
    colour = vec4(0.0);
    return;
  }
  if (uShadowPass > 0.5 && uCast > 3.5 && castAlpha() < 0.02) discard;
  if (vAtlasAt.z > 0.5) {
    float along = smearedHit();
    if (vEmit > 0.5 || along < 0.0) discard;
    float sweepLength = max(sqrt(dot(vSmear.zw, vSmear.zw)), 0.0001);
    float reach = vSize * 0.5;
    float ahead = dot(vLocal, vSmear.zw / sweepLength);
    float trail = mix(1.0, 0.1, clamp((ahead + reach) / (sweepLength + reach * 2.0), 0.0, 1.0));
    if (uShadowPass > 1.5) {
      float a = castAlpha() * spared(vWorld) * trail;
      colour = vec4(1.0 - a * 0.6, 1.0 - a * 0.5, 1.0 - a * 0.35, 1.0);
      return;
    }
    colour = vec4(0.0, 0.0, 0.0, castAlpha() * spared(vFloor) * trail);
    return;
  }
  vec2 uv = sampled();
  vec4 albedo = texture(uAlbedo, uv);
  if (albedo.a < 0.5) discard;
  bool leaf = albedo.a > LEAF_ALPHA_FROM;
  if (!leaf && vCanopy > 0.5) {
    float revealed = seeThroughReveal();
    if (revealed < 1.5 && revealed * SEE_THROUGH_GAIN <= bayer(gl_FragCoord.xy)) discard;
  }
  vec2 reliefUv = uv;
  bool backed = leaf && vLayered > 0.5 && texture(uAlbedo, woodBehind(uv)).a > 0.5;
  if (leaf && (!present(vLocal) || seeThroughClear(albedo.a, backed) * SEE_THROUGH_GAIN > bayer(gl_FragCoord.xy))) {
    vec4 behind = vLayered > 0.5 ? texture(uAlbedo, woodBehind(uv)) : vec4(0.0);
    if (behind.a < 0.5) discard;
    reliefUv = woodBehind(uv);
    albedo = behind;
    albedo.a = WOOD_REACH_ALPHA;
    leaf = false;
  }
  vec2 tp = vSeasonTp.xy;
  vec4 sa = vSeasonA;
  vec4 sb = vSeasonB;
  if (uShadowPass > 0.5 && vEmit > 0.5) discard;
  if (uShadowPass > 1.5) {
    float spare = spared(vWorld);
    float a = castAlpha() * spare;
    colour = vec4(1.0 - a * 0.6, 1.0 - a * 0.5, 1.0 - a * 0.35, 1.0);
    return;
  }
  if (uShadowPass > 0.5) {
    colour = vec4(0.0, 0.0, 0.0, castAlpha() * spared(vFloor));
    return;
  }

  if (seeThroughClear(albedo.a, false) * SEE_THROUGH_GAIN > bayer(gl_FragCoord.xy)) discard;

  if (vEmit > 0.5) {
    colour = vec4(albedo.rgb * 1.12, 1.0);
    return;
  }

  vec4 relief = texture(uNormal, reliefUv);
  vec2 slope = relief.xy * 2.0 - 1.0;
  if (vFlip > 0.5) slope.x = -slope.x;
  vec3 normal = vec3(slope, sqrt(max(0.0, 1.0 - dot(slope, slope))));

  float crevice = mix(0.62, 1.0, smoothstep(0.0, 0.55, relief.z));
  float facing = pow((dot(normal, sunToward(vWorld)) + 1.0) * 0.5, 2.0);
  float moonFacing = pow((dot(normal, moonTowardAt(vWorld)) + 1.0) * 0.5, 1.6);
  vec4 gs = groundState(vWorld);
  float shore = shoreAt(vWorld);
  float shaded = max(cloudAt(vWorld + uCloudShift) * dayAt(vWorld), skyState(vWorld).r * 0.8);
  vec3 light = ambientAt(vWorld) * (1.0 - 0.12 * shaded) + sunColourAt(vWorld) * (1.0 - 0.62 * shaded) * facing + moonColourAt(vWorld) * moonFacing;

  float leafy = max(vCanopy, (vSway > 0.3 && vBend < 0.5) ? 0.6 : 0.0);
  for (int i = 0; i < MAX_POINTS; i += 1) {
    if (i >= uCount) break;
    vec2 away = uPoint[i].xy - vWorld;
    float reach = max(uPoint[i].z, 0.001);
    float falloff = max(1.0 - length(away) / reach, 0.0);
    vec3 toLight = normalize(vec3(away, uLightHeight - relief.z * 0.8));
    float lit = 0.3 + 0.7 * max(dot(normal, toLight), 0.0);
    light += uPointColor[i] * uPoint[i].w * falloff * falloff * (lit + 0.35 * leafy);
  }
  light *= crevice;
  light += vec3(0.5, 0.55, 0.75) * uStorm.x;

  float level = max(max(light.r, light.g), light.b);
  float banded = floor(level * BANDS + bayer(gl_FragCoord.xy)) / BANDS;
  light *= banded / max(level, 0.001);

  vec3 leaves = albedo.rgb;
  float shade = dot(leaves, vec3(0.3, 0.55, 0.15));
  bool accent = relief.a < 0.99;
  if (accent) {
    if (cell(floor(vLocal) * 0.7 + tp) > sa.z) leaves = vec3(0.26, 0.43, 0.21);
  } else if (leaf) {
    vec3 autumn = mix(vec3(1.35, 0.85, 0.3), vec3(1.2, 0.45, 0.25), wHash(vTree.xy)) * shade;
    vec3 straw = vec3(1.1, 0.92, 0.55) * shade * 1.15;
    vec3 dry = vec3(0.6, 0.52, 0.45) * shade * 1.2;
    leaves = mix(leaves, mix(autumn, straw, sb.y), sa.x * 0.85);
    leaves = mix(leaves, dry, sa.y * 0.65);
    if (sa.w > 0.0 && albedo.g > albedo.r && cell(floor(vLocal) * 2.3 + tp.yx) < sa.w * 0.2) {
      leaves = mix(vec3(1.0, 0.82, 0.88), vec3(1.0, 0.97, 0.95), wHash(vTree.xy + 3.0));
    }
  }
  vec3 lit = leaves * (1.0 - 0.28 * gs.g * shore) * light;
  if (vSubmerged > 0.5) {
    float under = smoothstep(0.0, 5.0, vLocal.y);
    lit = mix(lit, mix(lit * vec3(0.7, 0.9, 1.0), vec3(0.12, 0.32, 0.4) * max(light.r, max(light.g, light.b)), 0.5), under);
  }

  float up = smoothstep(0.55, 0.92, normal.z);
  float flurry = wNoise(vWorld * 2.1 + 3.0);
  float cover = smoothstep(flurry - 0.1, flurry + 0.1, gs.r * 1.15) * shore * mix(1.0, 0.8, vCanopy) * up;
  cover = floor(cover * 3.0 + bayer(gl_FragCoord.xy + 4.0)) / 3.0;
  float brightness = max(max(light.r, light.g), light.b);
  lit = mix(lit, vec3(0.9, 0.94, 1.0) * min(1.0, brightness * 0.95 + 0.12), cover * 0.92);

  vec4 haze = hazeAt(vWorld);
  float veil = floor(haze.a * 5.0 + bayer(gl_FragCoord.xy + 2.0)) / 5.0;
  lit = mix(lit, haze.rgb, veil * mix(0.9, 0.55, vCanopy));
  if (vFocus < 0.5) lit *= BACKGROUND_DIM;
  colour = vec4(lit, 1.0);
}
