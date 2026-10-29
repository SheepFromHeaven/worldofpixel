#version 300 es
precision highp float;

in vec2 vWorld;
flat in vec2 vCentre;
flat in vec4 vHome;
flat in vec4 vKind;
uniform vec2 uBuffer;
uniform sampler2D uGround;
out vec4 outColour;

const float T = float(HOME_TEXELS);
const float PI = 3.14159265;
const float TAU = 6.2831853;

float capsule(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

float tapered(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}

float ellipse(vec2 p, vec2 c, vec2 r) {
  return (length((p - c) / r) - 1.0) * min(r.x, r.y);
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

#include "system/parts.glsl"
#include "system/projection.glsl"
#include "homeProfiles.glsl"

vec4 groundColour() {
  vec2 at = vec2(gl_FragCoord.x, uBuffer.y - gl_FragCoord.y);
  return texture(uGround, clamp(at / uBuffer, 0.0, 1.0));
}

void main() {
  vec4 under = groundColour();
  if (step(0.12, under.b - under.r) > 0.5) discard;
  vec2 texel = floor(vWorld * T) + 0.5;
  vec2 d = texel - vCentre * T;
  vec2 pf = vec2(d.x, -d.y);
  float progress = vHome.z;
  Beast sh = profileHome(int(vKind.x + 0.5), pf, vKind.z, vKind.y, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, vKind.z * 7.0, 0.0, vKind.w, vec4(0.0), progress);
  if (sh.edge > 0.0) discard;
  vec3 earth = mix(under.rgb * 0.45, vec3(0.5, 0.38, 0.25), 0.72);
  vec3 colour = homeColour(int(vKind.x + 0.5), sh.part, sh.u, sh.pc, earth, earth * 1.2, earth, 0.0, vKind.y);
  colour *= 1.0 - 0.1 * sh.shade;
  float lit = floor(clamp(-(d.x + d.y) / (0.7 * vKind.y), -1.0, 1.0) * 2.0 + 0.5) / 2.0;
  colour *= 1.0 + 0.14 * lit;
  if (sh.edge > -0.9 && vKind.y > 8.0) colour *= 0.8;
  outColour = vec4(colour, 1.0);
}
