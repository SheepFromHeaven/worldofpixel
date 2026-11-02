#version 300 es
precision highp float;

uniform float uTime;
uniform float uGloom;
uniform vec3 uTint;
uniform vec3 uBase[MAX_PEOPLE];
uniform vec3 uAccent[MAX_PEOPLE];
uniform int uLights;
uniform vec4 uPoint[MAX_POINTS];
uniform vec3 uPointColor[MAX_POINTS];

flat in vec4 vPerson;
flat in vec4 vInfo;
flat in vec4 vPose;
in vec2 vWorld;

out vec4 outColour;

const float PI = 3.14159265;
const float TAU = 6.2831853;
const float STANDING_TEXELS = 27.0;
const float SHADOW_ALPHA = 0.3;
const vec3 EYE_COLOUR = vec3(0.07, 0.06, 0.06);

float bayer(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  const float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (m[x + y * 4] + 0.5) / 16.0;
}

#include "system/parts.glsl"

float tapered(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}

struct Beast {
  float edge;
  float part;
  float eye;
  float nose;
  float u;
  float shade;
  vec2 pc;
};

#include "system/projection.glsl"
#include "human/profile.glsl"
#include "human/texture.glsl"

void main() {
  int who = int(vInfo.y + 0.5);
  float L = floor(STANDING_TEXELS * vInfo.z + 0.5);
  vec2 d = floor((vWorld - vPerson.xy) * 16.0);
  vec2 p = vec2(d.x + 0.5, -d.y - 0.5);
  Beast sh = profile_human(p, vPerson.z, L, 1.0, 0.0, 0.0, vPerson.w * 16.0, vInfo.x, uTime, float(who) * 13.0, 0.0, 0.0, vPose, 1.0);

  if (sh.edge > 0.0) {
    vec2 pool = (p - vec2(0.2 * L, -0.03 * L)) / vec2(0.3 * L, 0.09 * L);
    if (length(pool) > 1.0 || bayer(gl_FragCoord.xy) > 0.55) discard;
    outColour = vec4(0.0, 0.0, 0.0, SHADOW_ALPHA);
    return;
  }

  vec3 base = uBase[who];
  vec3 colour = texture_human(sh.part, sh.u, sh.pc, base, uAccent[who], base, 0.0, L);
  Beast near = profile_human(p + vec2(1.5, -1.5), vPerson.z, L, 1.0, 0.0, 0.0, vPerson.w * 16.0, vInfo.x, uTime, float(who) * 13.0, 0.0, 0.0, vPose, 1.0);
  Beast far = profile_human(p + vec2(3.5, -3.5), vPerson.z, L, 1.0, 0.0, 0.0, vPerson.w * 16.0, vInfo.x, uTime, float(who) * 13.0, 0.0, 0.0, vPose, 1.0);
  Beast above = profile_human(p - vec2(1.5, -1.5), vPerson.z, L, 1.0, 0.0, 0.0, vPerson.w * 16.0, vInfo.x, uTime, float(who) * 13.0, 0.0, 0.0, vPose, 1.0);
  Beast dim = profile_human(p - vec2(3.5, -3.5), vPerson.z, L, 1.0, 0.0, 0.0, vPerson.w * 16.0, vInfo.x, uTime, float(who) * 13.0, 0.0, 0.0, vPose, 1.0);
  if (near.edge > 0.0 || above.edge > 0.0) colour *= 0.7;
  else if (far.edge > 0.0) colour *= 0.82;
  else if (dim.edge > 0.0) colour *= 1.12;
  else if ((near.part == EAR) != (sh.part == EAR) || (above.part == EAR) != (sh.part == EAR)) colour *= 0.8;
  if (sh.eye < 0.0 && sh.part == HEAD) colour = EYE_COLOUR;

  vec3 glow = vec3(0.0);
  float lit = 0.0;
  for (int i = 0; i < MAX_POINTS; i += 1) {
    if (i >= uLights) break;
    float falloff = max(1.0 - length(vWorld - uPoint[i].xy) / max(uPoint[i].z, 0.001), 0.0);
    float strength = falloff * falloff * uPoint[i].w;
    glow += uPointColor[i] * strength;
    lit += strength;
  }
  float steps = floor(clamp(lit, 0.0, 1.2) * 5.0 + bayer(gl_FragCoord.xy)) / 5.0;
  vec3 warm = lit > 0.0001 ? glow * (steps / lit) * 0.3 : vec3(0.0);
  float dark = uGloom * (1.0 - clamp(steps * 1.1, 0.0, 0.92));
  outColour = vec4(mix(colour, uTint, dark) + warm, 1.0);
}
