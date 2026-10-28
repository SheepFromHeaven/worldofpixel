#version 300 es
precision highp float;

uniform vec4 uView;
uniform vec2 uBuffer;
out vec4 colour;
#include "weatherLibrary.glsl"
#include "terrain.glsl"

const float MOON_SHADOW_PEAK = 0.34;
const int SHADOW_STEPS = 20;
const float HOLLOW_REACH = 9.0;
const vec2 AROUND[8] = vec2[8](
  vec2(1.0, 0.0), vec2(0.7071, 0.7071), vec2(0.0, 1.0), vec2(-0.7071, 0.7071),
  vec2(-1.0, 0.0), vec2(-0.7071, -0.7071), vec2(0.0, -1.0), vec2(0.7071, -0.7071)
);

float castShadow(vec2 world, vec3 toward, float here) {
  float run = max(length(toward.xy), 0.02);
  vec2 heading = toward.xy / run;
  float rise = toward.z / run;
  float ceiling = uTerrainParams.z * uTerrainParams.x;
  float jitter = bayer(gl_FragCoord.xy);
  float shade = 0.0;
  for (int i = 0; i < SHADOW_STEPS; i += 1) {
    float travel = 1.0 + 8.3 * (pow(1.12, float(i) + jitter) - 1.0);
    float ray = here + 0.12 + travel * rise;
    if (ray > ceiling) break;
    shade = max(shade, smoothstep(0.0, 0.6 + 0.04 * travel, terrainHeight(world + heading * travel) - ray));
  }
  return shade;
}

void main() {
  vec2 at = vec2(gl_FragCoord.x, uCoarse.z - gl_FragCoord.y) * uCoarse.x;
  vec2 world = uView.xy + (at - uBuffer * 0.5) / uView.z;

  float height = terrainHeight(world);
  float reach = uTerrainParams.y;
  vec2 slope = vec2(
    terrainHeight(world + vec2(reach, 0.0)) - terrainHeight(world - vec2(reach, 0.0)),
    terrainHeight(world + vec2(0.0, reach)) - terrainHeight(world - vec2(0.0, reach))
  ) / (2.0 * reach);
  float slopeLength = max(length(slope), 0.0001);
  float downhillSouth = clamp(-slope.y / slopeLength, 0.0, 1.0);

  float delta = 0.0;
  float sunPower = dayAt(world);
  float moonPower = min(moonShadowAt(world) / MOON_SHADOW_PEAK, 1.0) * 0.6;
  bool bySun = sunPower >= moonPower;
  vec3 toward = bySun ? sunToward(world) : moonTowardAt(world);
  float power = (bySun ? sunPower : moonPower) * smoothstep(0.0, 0.12, toward.z);
  if ((uSwitch.x > 0.0 || uSwitch.y > 0.0) && power > 0.01) {
    vec3 normal = normalize(vec3(-slope, 1.0));
    float flatLit = max(toward.z, 0.0);
    float facing = max(dot(normal, toward), 0.0);
    float blocked = uSwitch.y > 0.0 ? castShadow(world, toward, height) : 0.0;
    float lit = mix(flatLit, facing, uSwitch.x) * (1.0 - blocked * uSwitch.y);
    delta = (lit - flatLit) * power;
  }

  float hollow = 0.0;
  float foot = 0.0;
  if (uSwitch.w > 0.0) {
    float ring = 0.0;
    for (int i = 0; i < 8; i += 1) ring += terrainHeight(world + AROUND[i] * HOLLOW_REACH);
    hollow = smoothstep(0.1, 1.2, ring / 8.0 - height);
    float above = terrainAt(world + slope / slopeLength * 1.5).g;
    foot = (1.0 - smoothstep(0.15, 0.45, terrainAt(world).g)) * smoothstep(0.5, 0.85, above);
  }

  colour = vec4(delta * 0.5 + 0.5, hollow, foot, downhillSouth);
}
