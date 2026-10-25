#version 300 es
precision highp float;

uniform vec4 uView;
uniform vec2 uBuffer;
uniform vec4 uFog;
out vec4 colour;
#include "weatherLibrary.glsl"

const float STEPS = 5.0;

void main() {
  vec2 p = vec2(gl_FragCoord.x, uBuffer.y - gl_FragCoord.y);
  vec2 world = uView.xy + (p - uBuffer * 0.5) / uView.z;
  float reach = length(world - uFog.xy) + (wNoise(world * 0.4) - 0.5) * 3.0 + (wNoise(world * 1.7 + 9.0) - 0.5) * 0.8;
  float thickness = clamp((reach - uFog.z) / max(uFog.w, 0.001), 0.0, 1.0);
  float steps = floor(thickness * STEPS + bayer(gl_FragCoord.xy)) / STEPS;
  colour = vec4(vec3(0.045, 0.055, 0.075) * steps, steps);
}
