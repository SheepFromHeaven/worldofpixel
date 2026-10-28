#version 300 es
layout(location = 0) in vec2 corner;

uniform vec4 uView;
uniform vec2 uBuffer;
uniform vec4 uFlame[MAX_POINTS];
uniform vec4 uInfo[MAX_POINTS];

flat out vec4 vFlame;
flat out vec4 vInfo;
out vec2 vWorld;

const float QUAD_WIDTH = 2.4;
const float QUAD_HEIGHT = 3.0;
const float QUAD_BELOW = 0.3;
const float HEAD_TILES = 0.78;
const float DEPTH_NUDGE = 0.03;

void main() {
  vec4 flame = uFlame[gl_InstanceID];
  float head = flame.y - HEAD_TILES;
  vec2 world = vec2(flame.x + (corner.x - 0.5) * QUAD_WIDTH, head + QUAD_BELOW - corner.y * QUAD_HEIGHT);
  vec2 pixel = (world - uView.xy) * uView.z + uBuffer * 0.5;
  float key = (flame.y + DEPTH_NUDGE - uView.y) * LIFTED_DEPTH_PER_TILE;
  float depth = -clamp(key / PROP_DEPTH_RANGE, -0.99, 0.99);
  gl_Position = vec4(pixel.x / uBuffer.x * 2.0 - 1.0, 1.0 - pixel.y / uBuffer.y * 2.0, depth, 1.0);
  vFlame = flame;
  vInfo = uInfo[gl_InstanceID];
  vWorld = world;
}
