#version 300 es
precision highp float;

uniform vec2 uBuffer;
uniform float uTime;
uniform float uVisible;
in vec2 vWorld;
in vec2 vShape;
in vec2 vFlow;
in vec4 vMeta;
out vec4 colour;
#include "weatherLibrary.glsl"
#include "waterCommon.glsl"
void main() {
  vec2 world = vWorld;
  float across = vShape.x;
  float distanceAlongSegment = vShape.y;
  float speed = length(vFlow);
  vec2 dir = vFlow / max(speed, 0.0001);
  vec2 perp = vec2(-dir.y, dir.x);
  float fall = step(0.5, vMeta.x);
  float width = max(vMeta.z, 0.5);
  float inner = abs(across);
  float ditherNoise = bayer(gl_FragCoord.xy) - 0.5;

  float ice = smoothstep(-0.5, -3.0, temperatureAt(world));
  float live = 1.0 - ice;
  float day = dayAt(world);
  float daylightBrightness = 0.3 + 0.7 * day;

  if (painted(vec2(0.0)) < 0.5) discard;
  if (vMeta.y > 0.5 && 1.0 - smoothstep(0.55, 1.0, distanceAlongSegment) <= bayer(gl_FragCoord.xy + 3.0) * 0.999) discard;

  vec2 quantisedWorld = floor(world * 8.0) / 8.0;
  float pattern = 0.0;
  for (int k = 0; k < 2; k += 1) {
    float phase = fract(uTime * (0.2 + 0.18 * speed) + 0.5 * float(k));
    float weight = 1.0 - abs(2.0 * phase - 1.0);
    vec2 p = (quantisedWorld - dir * (phase * 2.4)) * 1.1 + float(k) * vec2(17.3, 5.1);
    float smear = 0.0;
    for (int j = 0; j < 5; j += 1) smear += preciseFbm(p + dir * (float(j) * 0.5));
    pattern += weight * smear * 0.2;
  }

  float high = step(0.58 + ditherNoise * 0.14, pattern) * live;
  float low = step(pattern, 0.4 + ditherNoise * 0.14) * live;
  float bank = max(smoothstep(0.55, 0.85, inner), shoreDistance(2.0));
  float froth = bank * step(0.56 - ditherNoise * 0.12, preciseNoise(quantisedWorld * 5.0 - dir * (0.5 + 0.5 * sin(uTime * 1.9)) * 0.9)) * live;

  vec4 layer = vec4(0.0);
  layer = over(tint(vec3(0.03, 0.13, 0.28) * daylightBrightness, 0.5 * low), layer);
  layer = over(tint(vec3(0.86, 0.96, 1.0) * daylightBrightness, 0.55 * high), layer);
  layer = over(tint(vec3(0.95, 0.98, 1.0) * daylightBrightness, 0.7 * froth), layer);

  if (fall > 0.5) {
    float streak = step(0.42 + ditherNoise * 0.12, preciseNoise(vec2(across * width * 5.0, distanceAlongSegment * 0.7 - uTime * 3.2 * speed))) * live;
    float spray = step(0.5 - ditherNoise * 0.12, preciseFbm(quantisedWorld * 4.0 + uTime * vec2(1.7, -2.3))) * smoothstep(0.5, 0.95, distanceAlongSegment) * live;
    float lip = (1.0 - smoothstep(0.0, 0.2, distanceAlongSegment)) * live;
    layer = over(tint(vec3(0.03, 0.12, 0.24) * daylightBrightness, 0.45 * lip), layer);
    layer = over(tint(vec3(0.92, 0.98, 1.0) * daylightBrightness, 0.82 * streak), layer);
    layer = over(tint(vec3(1.0) * daylightBrightness, 0.9 * spray), layer);
  }

  float drops = rings(quantisedWorld * 1.0, skyState(world).g, uTime) * live * (1.0 - clamp(speed * 0.8, 0.0, 1.0));
  layer = over(tint(vec3(0.92, 0.97, 1.0) * daylightBrightness, 0.7 * drops), layer);

  float crack = step(0.9, preciseNoise(quantisedWorld * 3.1)) * ice;
  layer = over(tint(vec3(0.82, 0.92, 1.0) * daylightBrightness, ice * 0.6), layer);
  layer = over(tint(vec3(0.5, 0.65, 0.85) * daylightBrightness, 0.5 * crack), layer);

  colour = layer * uVisible;
}
