#version 300 es
precision highp float;

uniform vec4 uView;
uniform vec2 uBuffer;
uniform float uTime;
uniform float uVisible;
uniform sampler2D uRiverField;
uniform sampler2D uRiverRocks;
uniform vec4 uRiverRect;
out vec4 colour;
#include "weatherLibrary.glsl"
#include "waterCommon.glsl"

const float PERIOD = 9.0;
const float DEBRIS_CELL = 1.7;
const float DEBRIS_PERIOD = 14.0;
const float DEBRIS_TRAVEL = 0.55;

vec4 debrisLayer(vec2 q, vec2 dir, float speed, float bright, float live) {
  vec4 layer = vec4(0.0);
  for (int k = 0; k < 2; k += 1) {
    float phase = fract(uTime / DEBRIS_PERIOD + 0.5 * float(k));
    float weight = 1.0 - abs(2.0 * phase - 1.0);
    vec2 p = q - dir * (phase * DEBRIS_PERIOD * DEBRIS_TRAVEL * (0.3 + speed)) + float(k) * vec2(31.7, 12.3);
    p = floor(p * 8.0) / 8.0;
    vec2 id = floor(p / DEBRIS_CELL);
    float h = preciseHash(id + float(k) * 41.0 + 5.0);
    if (h > 0.2 || weight * 1.2 <= bayer(gl_FragCoord.xy + 5.0 * float(k))) continue;
    vec2 centre = (id + vec2(0.2 + 0.6 * preciseHash(id + 9.0), 0.2 + 0.6 * preciseHash(id + 13.0))) * DEBRIS_CELL;
    vec2 d = abs(p - centre);
    float kind = preciseHash(id + 21.0);
    vec2 size = kind < 0.25 ? (preciseHash(id + 4.0) < 0.5 ? vec2(0.22, 0.04) : vec2(0.04, 0.22)) : vec2(0.07 + 0.06 * preciseHash(id + 17.0), 0.06);
    if (d.x > size.x || d.y > size.y) continue;
    vec3 tone = kind < 0.25 ? vec3(0.26, 0.18, 0.1) : (kind < 0.5 ? vec3(0.56, 0.36, 0.16) : (kind < 0.75 ? vec3(0.4, 0.46, 0.18) : vec3(0.8, 0.72, 0.46)));
    layer = over(tint(tone * bright, 1.0 * live), layer);
  }
  return layer;
}

void main() {
  vec2 at = vec2(gl_FragCoord.x, uBuffer.y - gl_FragCoord.y);
  vec2 world = uView.xy + (at - uBuffer * 0.5) / uView.z;
  vec2 q = floor(world * 8.0) / 8.0;
  vec2 uv = (q - uRiverRect.xy) / uRiverRect.z;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) discard;

  vec4 field = texture(uRiverField, uv);
  float depth = field.b;
  if (depth < 0.03 || painted(vec2(0.0)) < 0.5) discard;

  vec2 flow = (field.rg * 2.0 - 1.0) * RIVER_FLOW_RANGE;
  float speed = length(flow);
  vec2 dir = flow / max(speed, 0.001);
  float dither = bayer(gl_FragCoord.xy) - 0.5;

  float ice = smoothstep(-0.5, -3.0, temperatureAt(world));
  float live = 1.0 - ice;
  float bright = 0.3 + 0.7 * dayAt(world);

  vec2 shift = vec2(0.0);
  float glint = 0.0;
  for (int k = 0; k < 2; k += 1) {
    float phase = fract(uTime / PERIOD + 0.5 * float(k));
    float weight = 1.0 - abs(2.0 * phase - 1.0);
    vec2 p = (q - flow * phase * PERIOD * 0.5) * 2.4 + float(k) * vec2(17.3, 5.1);
    float n0 = preciseNoise(p);
    shift += weight * vec2(preciseNoise(p + vec2(0.18, 0.0)) - n0, preciseNoise(p + vec2(0.0, 0.18)) - n0);
    glint += weight * step(0.86 + 0.05 * dither, preciseNoise(p * 2.7 + 3.0));
  }
  shift *= (0.25 + speed) * 0.9;
  vec2 bed = floor((world + shift) * 8.0) / 8.0;

  vec2 cell = floor(bed / 0.34);
  float pebble = preciseHash(cell + 3.0);
  float sand = preciseNoise(bed * 1.6 + 9.0);
  vec3 bedColour = mix(vec3(0.56, 0.5, 0.38), vec3(0.32, 0.3, 0.26), step(0.55, pebble));
  bedColour = mix(bedColour, vec3(0.72, 0.66, 0.5), step(0.78, sand) * 0.7);

  float absorb = 1.0 - exp(-depth * 2.8);
  vec3 shallow = bedColour * vec3(0.62, 0.95, 1.05) + vec3(0.04, 0.12, 0.16);
  vec3 deep = vec3(0.07, 0.27, 0.42);
  vec3 water = mix(shallow, deep, absorb);
  water += vec3(0.5, 0.55, 0.6) * clamp(glint, 0.0, 1.0) * 0.25 * (1.0 - absorb * 0.5);
  float alpha = 0.93 * smoothstep(0.03, 0.3, depth);

  vec4 layer = tint(water * bright, alpha);

  float foamIn = field.a;
  if (foamIn > 0.06) {
    float fall = smoothstep(0.3, 0.6, foamIn) * smoothstep(1.3, 1.9, speed);
    vec2 drift = q - dir * uTime * (0.6 + speed);
    float churn = 0.0;
    for (int j = 0; j < 3; j += 1) churn += preciseNoise(drift * 3.2 + dir * (float(j) * 0.3) * fall + float(j) * 7.0);
    churn /= 3.0;
    float foam = step(0.6 - foamIn * 0.55 + dither * 0.18, churn) * smoothstep(0.06, 0.28, foamIn) * live;
    layer = over(tint(vec3(0.96, 0.99, 1.0) * (0.6 + 0.4 * bright), 0.92 * foam), layer);
    if (fall > 0.02) {
      float streak = preciseNoise(vec2(dot(q, vec2(-dir.y, dir.x)) * 5.0, dot(q, dir) * 0.8 - uTime * 3.0));
      layer = over(tint(vec3(0.82, 0.94, 1.0) * bright, 0.55 * step(0.6, streak) * fall * live), layer);
    }
  }

  float h = texture(uRiverRocks, uv).r;
  if (h > 0.34) {
    float hx = texture(uRiverRocks, uv + vec2(0.004, 0.0)).r - texture(uRiverRocks, uv - vec2(0.004, 0.0)).r;
    float hy = texture(uRiverRocks, uv + vec2(0.0, 0.004)).r - texture(uRiverRocks, uv - vec2(0.0, 0.004)).r;
    float lit = dot(normalize(vec2(hx, hy) + 0.0001), vec2(-0.7, -0.7)) * clamp(length(vec2(hx, hy)) * 6.0, 0.0, 1.0);
    float tone = h < 0.5 ? 0.5 : (lit > 0.3 ? 0.95 : (lit > -0.3 ? 0.75 : 0.55));
    layer = over(tint(vec3(0.55, 0.55, 0.58) * tone * (0.55 + 0.45 * bright), 1.0), layer);
  }

  layer = over(debrisLayer(q, dir, speed, bright, live), layer);

  float rain = skyState(world).g;
  if (rain > 0.01) {
    float drops = rings(q, rain, uTime) * live * (1.0 - clamp(speed * 0.8, 0.0, 1.0));
    layer = over(tint(vec3(0.92, 0.97, 1.0) * bright, 0.7 * drops), layer);
  }

  float crack = step(0.9, preciseNoise(q * 3.1)) * ice;
  layer = over(tint(vec3(0.82, 0.92, 1.0) * bright, ice * 0.6), layer);
  layer = over(tint(vec3(0.5, 0.65, 0.85) * bright, 0.5 * crack), layer);

  colour = layer * uVisible;
}
