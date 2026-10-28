#version 300 es
precision highp float;

uniform vec4 uView;
uniform vec2 uBuffer;
uniform sampler2D uCoarseLight;
uniform vec3 uTone[9];
out vec4 colour;
#include "weatherLibrary.glsl"
#include "terrain.glsl"

const float FACE_TEXELS = 16.0;

float banded(float amount, float levels, float salt) {
  return floor(clamp(amount, 0.0, 1.0) * levels + bayer(gl_FragCoord.xy + salt)) / levels;
}

vec4 tinted(vec3 tone, float alpha) {
  return vec4(tone * alpha, alpha);
}

void main() {
  vec2 at = vec2(gl_FragCoord.x, uBuffer.y - gl_FragCoord.y);
  vec2 world = uView.xy + (at - uBuffer * 0.5) / uView.z;

  float land = shoreAt(world);
  if (land < 0.02) {
    colour = vec4(0.0);
    return;
  }

  vec2 span = uCoarse.yz * uCoarse.x;
  vec4 soft = texture(uCoarseLight, vec2(at.x / span.x, 1.0 - at.y / span.y));
  float delta = soft.r * 2.0 - 1.0;
  vec2 here = terrainAt(world);

  vec4 layer = vec4(0.0);

  if (delta < -0.004) {
    layer = over(tinted(uTone[0], banded(-delta * 0.9, 5.0, 0.0) * 0.6), layer);
  } else if (delta > 0.004) {
    layer = over(tinted(uTone[1], banded(delta * 0.8, 5.0, 1.0) * 0.4), layer);
  }

  if (uSwitch.w > 0.0) {
    float alt = clamp(here.r / uTerrainParams.z, 0.0, 1.0);
    layer = over(tinted(uTone[3], banded(smoothstep(0.12, 0.85, alt) * 0.2, 6.0, 2.0) * uSwitch.w), layer);
    layer = over(tinted(uTone[8], banded(soft.g * 0.3, 5.0, 3.0) * uSwitch.w), layer);
    layer = over(tinted(uTone[7], banded(soft.b * 0.6, 3.0, 4.0) * uSwitch.w), layer);
  }

  if (uSwitch.z > 0.0 && (here.g > 0.2 || soft.a > 0.0)) {
    float below = terrainAt(world + vec2(0.0, 1.5)).g;
    float lip = (1.0 - smoothstep(0.2, 0.5, here.g)) * smoothstep(0.5, 0.85, below) * soft.a;
    vec2 texel = floor(world * FACE_TEXELS);
    float strata = smoothstep(0.55, 0.62, fract(world.y * 1.5 + 0.8 * wNoise(vec2(world.x * 0.6, 0.0))));
    float drip = step(0.78, wHash(vec2(texel.x, 3.0))) * (0.5 + 0.5 * wHash(vec2(texel.x, floor(texel.y / 5.0))));
    float face = smoothstep(0.55, 0.9, here.g) * (0.3 + 0.7 * soft.a);
    vec3 rock = mix(uTone[4], uTone[5], clamp(0.5 * strata + 0.6 * drip, 0.0, 1.0));
    layer = over(tinted(rock, banded(face * 0.75, 4.0, 5.0) * uSwitch.z), layer);
    layer = over(tinted(uTone[6], banded(lip * 0.55, 3.0, 6.0) * uSwitch.z), layer);
  }

  colour = layer * land;
}
