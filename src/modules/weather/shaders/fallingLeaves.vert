#version 300 es
layout(location = 0) in vec2 corner;

uniform vec4 uView;
uniform vec2 uBuffer;
uniform float uTime;
uniform vec2 uFall;
uniform vec2 uBlow;
uniform float uVisible;
uniform vec4 uCells;
uniform sampler2D uSources;
out vec4 vColour;
#include "weatherLibrary.glsl"
float h1(float n) {
  return fract(sin(n * 127.1) * 43758.5453);
}

float h2(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

const float SPAN = 6.0;
const int SLOTS = 8;

void main() {
  vColour = vec4(0.0);
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);

  int slot = gl_InstanceID % SLOTS;
  int cell = gl_InstanceID / SLOTS;
  int columns = int(uCells.z);
  vec2 cellId = uCells.xy + vec2(float(cell % columns), float(cell / columns));
  bool petal = slot >= 6;
  float slotF = float(slot);

  float lean = southAt(cellId * SPAN);
  float rate = petal ? mix(uBlow.x, uBlow.y, lean) : mix(uFall.x, uFall.y, lean);
  if (rate < 0.01) return;

  float key = h2(cellId + slotF * 17.3);
  float life = 6.0 + 5.0 * h1(key * 9.1);
  float cycle = uTime / life + h1(key * 3.7);
  float age = fract(cycle);
  float epoch = floor(cycle);
  float roll = h2(cellId * 1.31 + slotF + epoch * 0.173);
  if (roll > rate * (petal ? 0.55 : 0.8)) return;

  float alive = smoothstep(0.0, 0.08, age) * (1.0 - smoothstep(0.78, 1.0, age));
  if (alive < 0.5) return;

  vec2 spawn = (cellId + vec2(h2(cellId + epoch + slotF), h2(cellId * 2.1 + epoch + slotF * 3.0))) * SPAN;
  vec2 source = texture(uSources, clamp((spawn - uMaskRect.xy) / uMaskRect.zw, 0.0, 1.0)).rg;
  if ((petal ? source.g : source.r) < 0.5) return;

  vec2 wind = (texture(uField, weatherUv(spawn)).ba * 2.0 - 1.0) * WIND_TEXTURE_RANGE_METRES_PER_SECOND;
  float speed = length(wind);
  vec2 dir = speed > 0.01 ? wind / speed : vec2(1.0, 0.0);
  float run = 0.3 + 0.07 * speed;
  float travel = min(run, 0.5) * life * age;
  vec2 perp = vec2(-dir.y, dir.x);
  float flutter = sin(age * 11.0 + key * 20.0) * 0.28 * (petal ? 1.4 : 1.0);
  vec2 pos = spawn + dir * travel + perp * flutter;

  float half_ = max(0.14, 2.2 / uView.z);
  float size = half_ * (petal ? 0.8 : 1.0) * (0.8 + 0.5 * h1(key * 5.3));
  vec2 extent = vec2(size, size * (petal ? 0.9 : 0.5));
  float spin = (key + age * 3.0) * 6.2831;
  vec2 local = (corner * 2.0 - 1.0) * extent;
  vec2 world = pos + vec2(cos(spin) * local.x - sin(spin) * local.y, sin(spin) * local.x + cos(spin) * local.y);

  vec2 pixel = (world - uView.xy) * uView.z + uBuffer * 0.5;
  gl_Position = vec4(pixel.x / uBuffer.x * 2.0 - 1.0, 1.0 - pixel.y / uBuffer.y * 2.0, 0.0, 1.0);

  vec3 tone;
  float pick = h1(key * 7.7);
  if (petal) tone = mix(vec3(1.0, 0.82, 0.9), vec3(1.0, 0.97, 0.95), pick);
  else tone = pick < 0.4 ? vec3(0.9, 0.5, 0.18) : (pick < 0.75 ? vec3(0.78, 0.28, 0.16) : vec3(0.55, 0.38, 0.2));
  float lum = 0.3 + 0.7 * dayAt(pos);
  vColour = vec4(tone * lum * uVisible, uVisible);
}
