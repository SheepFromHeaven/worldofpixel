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

const float ROCK_CELL = 2.4;
const float DEBRIS_CELL = 1.7;
const float DEBRIS_PERIOD = 14.0;
const float DEBRIS_TRAVEL = 0.55;

vec4 rockLayer(vec2 q, vec2 dir, vec2 perp, float speed, float inner, float bright, float dither, float live) {
  vec4 layer = vec4(0.0);
  vec2 id = floor(q / ROCK_CELL);
  float density = mix(0.03, 0.24, smoothstep(0.3, 1.3, speed));
  for (int oy = -1; oy <= 1; oy += 1) {
    for (int ox = -1; ox <= 1; ox += 1) {
      vec2 cid = id + vec2(float(ox), float(oy));
      if (preciseHash(cid + 11.0) > density) continue;
      vec2 centre = (cid + vec2(0.2 + 0.6 * preciseHash(cid + 3.0), 0.2 + 0.6 * preciseHash(cid + 7.0))) * ROCK_CELL;
      float r = 0.3 + 0.32 * preciseHash(cid + 5.0);
      vec2 d = q - centre;
      float len = length(d);
      float al = dot(d, dir);
      float lat = dot(d, perp);
      float reach = r * 8.0;

      if (len < r && inner < 0.8) {
        float lit = dot(d / max(len, 0.001), vec2(-0.7, -0.7));
        float tone = lit > 0.35 ? 0.95 : (lit > -0.2 ? 0.75 : 0.55);
        layer = over(tint(vec3(0.55, 0.55, 0.58) * tone * (0.55 + 0.45 * bright), 1.0), layer);
      } else if (len < r + 0.125 && al < r * 0.3) {
        layer = over(tint(vec3(0.95, 0.98, 1.0) * bright, 0.9 * live), layer);
      }

      if (al > r * 0.6 && al < reach) {
        float fade = 1.0 - al / reach;
        float spread = r * 0.9 + al * 0.18;
        float inside = 1.0 - smoothstep(spread * 0.6, spread, abs(lat));
        float stripe = preciseNoise(vec2(lat * 16.0, al * 4.0 - uTime * (1.0 + speed) * 2.4));
        float wake = step(1.0 - fade * 0.9 + dither * 0.25, stripe) * inside * fade;
        float edge = (1.0 - smoothstep(0.0, 0.045, abs(abs(lat) - spread))) * fade * step(0.35, preciseNoise(vec2(al * 9.0 - uTime * 3.0, lat * 3.0)));
        layer = over(tint(vec3(0.96, 0.99, 1.0) * bright, 0.8 * max(wake, edge) * live), layer);
      }
    }
  }
  return layer;
}

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
  vec2 world = vWorld;
  float across = vShape.x;
  float along = vShape.y;
  float speed = length(vFlow);
  vec2 dir = vFlow / max(speed, 0.0001);
  vec2 perp = vec2(-dir.y, dir.x);
  float fall = smoothstep(50.0, 75.0, vMeta.w) * vMeta.x;
  float width = max(vMeta.z, 0.5);
  float inner = abs(across);
  float dither = bayer(gl_FragCoord.xy) - 0.5;

  float ice = smoothstep(-0.5, -3.0, temperatureAt(world));
  float live = 1.0 - ice;
  float day = dayAt(world);
  float bright = 0.3 + 0.7 * day;

  if (painted(vec2(0.0)) < 0.5) discard;
  float wakeQuad = step(1.5, vMeta.y);
  if (vMeta.y > 0.5 && wakeQuad < 0.5 && 1.0 - smoothstep(0.55, 1.0, along) <= bayer(gl_FragCoord.xy + 3.0) * 0.999) discard;

  vec2 q = floor(world * 8.0) / 8.0;
  vec4 layer = vec4(0.0);

  if (wakeQuad > 0.5) {
    float bend = vMeta.w;
    float warp = bend * 0.55 * along * along + 0.1 * sin(along * 9.0 + bend * 7.0) + (preciseNoise(vec2(along * 4.0, bend * 9.0 + uTime * 0.25)) - 0.5) * 0.3;
    float wa = floor(along * 19.0) / 19.0;
    float wx = floor((across - warp) * 7.6) / 7.6;
    float wi = abs(wx);
    float lean = 0.1 + 0.8 * wa + 0.1 * sin(wa * 7.0 + bend * 5.0);
    float beat = floor(uTime * (1.0 + speed) * 3.0) / 3.0;
    float edgeLine = step(abs(wi - lean), 0.085);
    float dashes = step(0.5, preciseNoise(vec2(wa * 8.0 - beat, wx * 3.0 + bend * 11.0)));
    float tail = 1.0 - wa;
    float inside = step(wi, lean - 0.12) * tail;
    float eddy = step(0.66, preciseNoise(vec2(wx * 7.0 + bend * 3.0, wa * 5.0 - beat))) * inside * step(0.12, wa);
    float apex = step(length(vec2(wx * 0.6, wa * 1.5)), 0.17);
    float foam = max(max(edgeLine * dashes * step(wa, 0.9) * (0.4 + 0.6 * tail), eddy), apex);
    layer = over(tint(vec3(0.9, 0.97, 1.0) * (0.6 + 0.4 * bright), 0.85 * foam * live), layer);
    colour = layer * uVisible;
    return;
  }

  if (fall < 0.05) {
    layer = over(rockLayer(q, dir, perp, speed, inner, bright, dither, live), layer);
    layer = over(debrisLayer(q, dir, speed, bright, live), layer);
  }

  float drops = rings(q, skyState(world).g, uTime) * live * (1.0 - clamp(speed * 0.8, 0.0, 1.0)) * (1.0 - fall);
  layer = over(tint(vec3(0.92, 0.97, 1.0) * bright, 0.7 * drops), layer);

  if (fall > 0.05) {
    float column = floor(across * width * 8.0) / 8.0;
    float rate = uTime * 2.4;
    float edgeFade = 1.0 - smoothstep(0.55, 0.95, inner);
    float fadeIn = smoothstep(0.0, 0.1, along);
    float streak = preciseNoise(vec2(column * 7.0, along * 5.0 - rate));
    float fine = preciseNoise(vec2(column * 17.0 + 3.0, along * 9.0 - rate * 1.6));
    float shown = fall * edgeFade * fadeIn * live;

    vec3 body = mix(vec3(0.34, 0.62, 0.86), vec3(0.22, 0.5, 0.76), along);
    layer = over(tint(body * bright, 0.42 * shown), layer);
    float lightStreak = step(0.62 + dither * 0.1, streak);
    layer = over(tint(vec3(0.82, 0.94, 1.0) * bright, 0.8 * lightStreak * shown), layer);
    float darkStreak = step(fine, 0.1);
    layer = over(tint(vec3(0.08, 0.22, 0.4) * bright, 0.7 * darkStreak * shown), layer);
    float lip = (1.0 - smoothstep(0.0, 0.07, along)) * 0.5;
    layer = over(tint(vec3(0.92, 0.98, 1.0) * bright, lip * shown), layer);

    float base = smoothstep(0.5, 0.95, along);
    vec2 cell = floor(q / 0.24);
    float hb = preciseHash(cell + 7.0);
    vec2 centre = (cell + vec2(0.25 + 0.5 * preciseHash(cell + 2.0), 0.25 + 0.5 * preciseHash(cell + 6.0))) * 0.24;
    float radius = 0.05 + 0.09 * hb;
    float dist = length(q - centre);
    float bubble = step(hb, base * 0.95) * step(dist, radius);
    float rim = step(radius - 0.035, dist) * bubble;
    float froth = step(0.5 - base * 0.3 + dither * 0.2, preciseFbm(q * 6.5 + vec2(0.0, uTime * 1.4))) * smoothstep(0.7, 0.9, along);
    vec3 white = mix(vec3(1.0), vec3(0.62, 0.84, 0.95), rim * 0.7);
    layer = over(tint(white * bright, 0.95 * max(bubble, froth) * shown), layer);
    float drop = step(preciseHash(floor(q * 5.0) + floor(uTime * 3.0)), 0.04 * smoothstep(0.35, 0.8, along));
    layer = over(tint(vec3(1.0) * bright, 0.95 * drop * shown), layer);
  }

  float crack = step(0.9, preciseNoise(q * 3.1)) * ice;
  layer = over(tint(vec3(0.82, 0.92, 1.0) * bright, ice * 0.6), layer);
  layer = over(tint(vec3(0.5, 0.65, 0.85) * bright, 0.5 * crack), layer);

  colour = layer * uVisible;
}
