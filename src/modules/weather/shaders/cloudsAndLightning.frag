#version 300 es
precision highp float;

uniform vec4 uView;
uniform vec2 uBuffer;
uniform float uBody;
uniform int uBoltCount;
uniform vec4 uBolt[MAX_VISIBLE_BOLTS];
uniform vec4 uBoltMeta[MAX_VISIBLE_BOLTS];
out vec4 colour;
#include "weatherLibrary.glsl"
float jag(float y, float seed) {
  return (wNoise(vec2(y * 0.09, seed)) - 0.5) * 2.0 * 16.0 + (wNoise(vec2(y * 0.31, seed + 5.0)) - 0.5) * 6.0;
}

float boltMask(vec2 local, float seed, float size, float reveal) {
  float t = local.y / size;
  float inside = step(0.0, t) * step(t, min(reveal, 1.0));
  float trunk = jag(local.y, seed);
  float core = step(abs(local.x - trunk), 1.4);
  float fork = step(abs(local.x - trunk - (local.y - size * 0.35) * 0.55 - jag(local.y * 1.7, seed + 9.0) * 0.4), 1.1) * step(size * 0.35, local.y) * step(local.y, size * 0.75);
  float other = step(abs(local.x - trunk + (local.y - size * 0.55) * 0.5 - jag(local.y * 1.3, seed + 4.0) * 0.4), 1.1) * step(size * 0.55, local.y) * step(local.y, size * 0.9);
  return max(core, max(fork, other)) * inside;
}

float segmentDistance(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 0.0001), 0.0, 1.0);
  return length(p - (a + ab * t));
}

vec4 cloudParts(vec2 world) {
  vec4 c = cloudState(world);
  vec2 wind = cloudWind(world);
  vec3 core = cloudCore(world, c, wind);

  float water = clamp(c.r * 1.6, 0.0, 1.0);
  vec2 dir = normalize(wind + vec2(0.0001, 0.0));
  vec2 perp = vec2(-dir.y, dir.x);
  float streaks = flowFbm(world, wind * 1.6, vec2(0.0016, 0.0045), 1.0, vec2(2.0, 9.0));
  float cirrus = smoothstep(0.52, 0.8, streaks) * smoothstep(0.3, 0.75, c.a) * 0.3;

  float belt = smoothstep(0.45, 0.7, wNoise(world * 0.006 + vec2(4.0, 1.0) + dir * uSky.z * 0.002));
  float flock = flowFbm(world, wind * 1.2, vec2(0.07), 0.0, vec2(8.0, 3.0));
  float sheep = smoothstep(0.6, 0.64, flock) * belt * smoothstep(0.3, 0.7, c.a) * (1.0 - smoothstep(0.3, 0.7, water)) * 0.85;

  return vec4(max(core.x, sheep), core.y, core.z, cirrus);
}

float partsDensity(vec4 p) {
  return clamp(max(max(p.x, p.y), max(p.z, p.w)), 0.0, 1.0);
}

void main() {
  vec2 at = vec2(gl_FragCoord.x, uBuffer.y - gl_FragCoord.y);
  vec2 world = uView.xy + (at - uBuffer * 0.5) / uView.z;
  vec2 seen = world + (world - uView.xy) * 0.15;
  vec4 parts = cloudParts(seen);
  float density = partsDensity(parts);
  vec2 sunSide = sunToward(world).xy;
  sunSide /= max(length(sunSide), 0.0001);
  float toward = partsDensity(cloudParts(seen + sunSide * 7.0));
  float lit = clamp(0.92 + (density - toward) * 1.0, 0.55, 1.15);
  float band = floor(density * 4.0 + bayer(gl_FragCoord.xy)) / 4.0;
  float alpha = band * 0.85 * uBody;
  float weight = max(parts.x + parts.y + parts.z + parts.w, 0.001);
  vec3 hue = (vec3(1.0) * parts.x + vec3(0.74, 0.77, 0.84) * parts.y + vec3(0.47, 0.51, 0.62) * parts.z + vec3(0.98, 0.99, 1.0) * parts.w) / weight;
  vec3 body = hue * lit * cloudColourAt(world);

  float glow = 0.0;
  float line = 0.0;
  float head = 0.0;
  for (int i = 0; i < MAX_VISIBLE_BOLTS; i += 1) {
    if (i >= uBoltCount) break;
    vec4 path = uBolt[i];
    vec4 meta = uBoltMeta[i];
    float age = uSky.z - meta.y;
    if (age < 0.0 || age > 1.6) continue;

    vec2 start = path.xy;
    vec2 end = path.zw;
    vec2 run = end - start;
    float size = length(run) * uView.z;
    vec2 dir = run / max(length(run), 0.001);
    float leader = 0.28;
    float reveal = clamp(age / leader, 0.0, 1.0);
    float strike = age < leader ? 0.55 : (age < leader + 0.1 ? 1.0 : (age < leader + 0.16 ? 0.4 : exp(-(age - leader - 0.16) * 5.0)));

    vec2 px = (seen - start) * uView.z;
    vec2 local = vec2(dot(px, vec2(-dir.y, dir.x)), dot(px, dir));
    float mask = boltMask(local, meta.x, size, reveal);
    line = max(line, mask * strike);
    float frontPos = reveal * size;
    head = max(head, step(abs(local.y - frontPos), 3.0) * step(abs(local.x - jag(frontPos, meta.x)), 3.0) * step(reveal, 0.999) * 0.9);

    float gap = segmentDistance(seen, start, start + run * reveal);
    float lit = 1.0 - smoothstep(0.0, 38.0, gap);
    glow = max(glow, lit * lit * strike);
    if (meta.z > 0.5) {
      float ground = 1.0 - smoothstep(0.0, 10.0, length(seen - end));
      glow = max(glow, ground * step(leader, age) * strike);
    }
  }
  glow = clamp(glow, 0.0, 1.0);
  body = mix(body, vec3(0.82, 0.88, 1.0), glow * 0.95 * (0.5 + 0.5 * density));
  alpha = max(alpha, glow * 0.5 * uBody * step(0.05, density));

  float strokes = clamp(max(line, head), 0.0, 1.0);
  vec3 colourOut = mix(body, vec3(1.0, 1.0, 0.94), strokes);
  float alphaOut = max(alpha, strokes * uBody);
  colour = vec4(colourOut * alphaOut, alphaOut);
}
