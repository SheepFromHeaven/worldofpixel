#version 300 es
layout(location = 0) in vec2 corner;
layout(location = 1) in vec4 aPose;
layout(location = 2) in vec4 aLook;
layout(location = 3) in vec4 aKind;

uniform vec4 uView;
uniform vec2 uBuffer;
uniform float uTime;
uniform float uVisible;
out vec2 vLocal;
out vec2 vWorld;
flat out vec2 vCentre;
out vec4 vLook;
flat out vec4 vKind;
flat out vec4 vPose;
#include "weatherLibrary.glsl"

const float TAU = 6.2831853;
const float TEXELS = float(FISH_TEXELS);

void main() {
  vec2 unit = corner * 2.0 - 1.0;
  float blob = aLook.z;
  bool model = aKind.x > 0.5 && blob < 5.0;
  vec2 extent = blob > 5.0 ? vec2(aPose.w * 0.5) : (model ? vec2(aPose.w * 0.85) : vec2(0.58, 0.34) * aPose.w);
  vec2 local = unit * extent;
  float c = cos(aPose.z);
  float s = sin(aPose.z);
  vec2 centre = model ? (floor(aPose.xy * TEXELS) + 0.5) / TEXELS : aPose.xy;
  vec2 world = centre + (model ? local : vec2(c * local.x - s * local.y, s * local.x + c * local.y));
  vWorld = world;
  vCentre = centre;
  vec2 pixel = (world - uView.xy) * uView.z + uBuffer * 0.5;
  gl_Position = vec4(pixel.x / uBuffer.x * 2.0 - 1.0, 1.0 - pixel.y / uBuffer.y * 2.0, 0.0, 1.0);
  vLocal = unit;
  float light = 0.3 + 0.7 * dayAt(aPose.xy);
  float celsius = fieldAt(aPose.xy).r * TEMPERATURE_TEXTURE_SPAN_CELSIUS + TEMPERATURE_TEXTURE_FLOOR_CELSIUS;
  float open = 1.0 - 0.9 * smoothstep(-0.5, -3.0, celsius);
  vLook = vec4(aLook.x * uVisible * light * open, aLook.y, blob, aLook.w);
  vKind = aKind;
  float wave = sin(uTime * aKind.z * TAU + aLook.y) * (0.45 + 0.55 * aLook.w);
  float ripple = sin(uTime * aKind.z * TAU + aLook.y - 0.9) * (0.45 + 0.55 * aLook.w);
  vPose = vec4(wave, aLook.z, ripple, 0.0);
}
