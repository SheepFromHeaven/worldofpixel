#version 300 es
layout(location = 0) in vec2 corner;
layout(location = 1) in vec4 aPose;
layout(location = 2) in vec4 aLook;

uniform vec4 uView;
uniform vec2 uBuffer;
uniform float uTime;
uniform float uVisible;
out vec2 vLocal;
out vec4 vLook;
#include "weatherLibrary.glsl"

void main() {
  vec2 unit = corner * 2.0 - 1.0;
  float blob = aLook.z;
  vec2 extent = blob > 5.0 ? vec2(aPose.w * 0.5) : vec2(0.58, 0.34) * aPose.w;
  vec2 local = unit * extent;
  float c = cos(aPose.z);
  float s = sin(aPose.z);
  vec2 world = aPose.xy + vec2(c * local.x - s * local.y, s * local.x + c * local.y);
  vec2 pixel = (world - uView.xy) * uView.z + uBuffer * 0.5;
  gl_Position = vec4(pixel.x / uBuffer.x * 2.0 - 1.0, 1.0 - pixel.y / uBuffer.y * 2.0, 0.0, 1.0);
  vLocal = unit;
  float light = 0.3 + 0.7 * dayAt(aPose.xy);
  float celsius = fieldAt(aPose.xy).r * TEMPERATURE_TEXTURE_SPAN_CELSIUS + TEMPERATURE_TEXTURE_FLOOR_CELSIUS;
  float open = 1.0 - 0.9 * smoothstep(-0.5, -3.0, celsius);
  vLook = vec4(aLook.x * uVisible * light * open, aLook.y, blob, aLook.w);
}
