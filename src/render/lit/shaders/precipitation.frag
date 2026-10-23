#version 300 es
precision highp float;

uniform vec4 uView;
uniform vec2 uBuffer;
uniform float uVisible;
uniform float uTime;
uniform float uSlant;
uniform float uSand;
out vec4 colour;
#include "weatherLibrary.glsl"
float one(float n) {
  return fract(sin(n * 127.1) * 43758.5453);
}

float two(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uBuffer.y - gl_FragCoord.y);
  vec2 world = uView.xy + (p - uBuffer * 0.5) / uView.z;
  vec4 state = skyState(world);

  float x = p.x - p.y * uSlant;
  float column = floor(x / 5.0);
  float h = one(column + 3.0);
  float y = p.y - uTime * (300.0 + h * 240.0) + h * 997.0;
  float span = 48.0 + h * 34.0;
  float streak = step(mod(y, span), 9.0) * step(mod(x, 5.0), 1.0) * step(two(vec2(column, floor(y / span))), state.g * 0.9);

  float strip = floor(p.x / 7.0);
  float sh = one(strip + 11.0);
  float sy = p.y - uTime * (34.0 + sh * 40.0) + sh * 733.0;
  float lane = floor(sy / 22.0);
  float sx = p.x + sin(uTime * 1.3 + lane * 1.7 + sh * 6.0) * 2.0;
  float within = mod(sx, 7.0);
  float at = floor(two(vec2(strip, lane)) * 5.0);
  float flake = step(at, within) * step(within, at + 1.5) * step(mod(sy, 22.0), 2.0) * step(two(vec2(strip + 0.5, lane)), state.b * 0.7);

  float row = floor(p.y / 4.0);
  float dh = one(row + 31.0);
  float blown = p.x * uSand + uTime * (240.0 + dh * 260.0) + dh * 811.0;
  float dspan = 36.0 + dh * 40.0;
  float speck = step(mod(blown, dspan), 6.0) * step(mod(p.y, 4.0), 2.0) * step(two(vec2(row, floor(blown / dspan))), state.a * 1.2);

  float rainAlpha = streak * 0.55 * uVisible;
  float snowAlpha = flake * 0.9 * uVisible;
  float sandAlpha = speck * 0.8 * uVisible;
  vec3 tone = vec3(0.72, 0.8, 0.95) * rainAlpha + vec3(1.0) * snowAlpha + vec3(0.85, 0.7, 0.45) * sandAlpha;
  float alpha = max(max(rainAlpha, snowAlpha), sandAlpha);

  float glow = 1.0 - smoothstep(0.0, 9.0, length(world - uStorm.yz));
  vec3 flash = vec3(0.7, 0.78, 1.0) * (uStorm.x * 0.22 + uStorm.x * glow * glow * 0.9);
  colour = vec4(tone * (0.3 + 0.7 * dayAt(world)) + flash, alpha);
}
