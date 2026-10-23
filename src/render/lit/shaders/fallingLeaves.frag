#version 300 es
precision highp float;

uniform vec4 uView;
uniform vec2 uBuffer;
uniform float uTime;
uniform vec2 uFall;
uniform vec2 uBlow;
uniform float uVisible;
uniform sampler2D uSources;
out vec4 colour;
#include "weatherLibrary.glsl"
float h1(float n) {
  return fract(sin(n * 127.1) * 43758.5453);
}

float h2(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 at = vec2(gl_FragCoord.x, uBuffer.y - gl_FragCoord.y);
  vec2 world = uView.xy + (at - uBuffer * 0.5) / uView.z;
  const float SPAN = 6.0;
  vec2 base = floor(world / SPAN);
  float half_ = max(0.14, 2.2 / uView.z);

  vec4 best = vec4(0.0);
  for (int dy = -1; dy <= 1; dy += 1) {
    for (int dx = -1; dx <= 1; dx += 1) {
      vec2 cellId = base + vec2(float(dx), float(dy));
      for (int slot = 0; slot < 8; slot += 1) {
        bool petal = slot >= 6;
        float lean = southAt(cellId * SPAN);
        float rate = petal ? mix(uBlow.x, uBlow.y, lean) : mix(uFall.x, uFall.y, lean);
        if (rate < 0.01) continue;
        float key = h2(cellId + float(slot) * 17.3);
        float life = 6.0 + 5.0 * h1(key * 9.1);
        float age = fract(uTime / life + h1(key * 3.7));
        float epoch = floor(uTime / life + h1(key * 3.7));
        float roll = h2(cellId * 1.31 + float(slot) + epoch * 0.173);
        vec2 spawn = (cellId + vec2(h2(cellId + epoch + float(slot)), h2(cellId * 2.1 + epoch + float(slot) * 3.0))) * SPAN;
        vec2 source = texture(uSources, clamp((spawn - uMaskRect.xy) / uMaskRect.zw, 0.0, 1.0)).rg;
        float fed = petal ? source.g : source.r;
        if (fed < 0.5 || roll > rate * (petal ? 0.55 : 0.8)) continue;

        vec2 wind = (texture(uField, weatherUv(spawn)).ba * 2.0 - 1.0) * WIND_TEXTURE_RANGE_METRES_PER_SECOND;
        float speed = length(wind);
        vec2 dir = speed > 0.01 ? wind / speed : vec2(1.0, 0.0);
        float run = 0.3 + 0.07 * speed;
        float travel = min(run, 0.5) * life * age;
        vec2 perp = vec2(-dir.y, dir.x);
        float flutter = sin(age * 11.0 + key * 20.0) * 0.28 * (petal ? 1.4 : 1.0);
        vec2 pos = spawn + dir * travel + perp * flutter;

        vec2 d = world - pos;
        float spin = (key + age * 3.0) * 6.2831;
        vec2 r = vec2(cos(spin) * d.x + sin(spin) * d.y, -sin(spin) * d.x + cos(spin) * d.y);
        float size = half_ * (petal ? 0.8 : 1.0) * (0.8 + 0.5 * h1(key * 5.3));
        float hit = step(abs(r.x), size) * step(abs(r.y), size * (petal ? 0.9 : 0.5));
        float alive = smoothstep(0.0, 0.08, age) * (1.0 - smoothstep(0.78, 1.0, age));
        if (hit * alive < 0.5 || (hit * alive < best.a)) continue;

        vec3 tone;
        float pick = h1(key * 7.7);
        if (petal) tone = mix(vec3(1.0, 0.82, 0.9), vec3(1.0, 0.97, 0.95), pick);
        else tone = pick < 0.4 ? vec3(0.9, 0.5, 0.18) : (pick < 0.75 ? vec3(0.78, 0.28, 0.16) : vec3(0.55, 0.38, 0.2));
        best = vec4(tone, 1.0);
      }
    }
  }
  float lum = 0.3 + 0.7 * dayAt(world);
  colour = vec4(best.rgb * lum * best.a * uVisible, best.a * uVisible);
}
