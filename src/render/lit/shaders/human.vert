#version 300 es
layout(location = 0) in vec2 corner;

uniform vec4 uView;
uniform vec2 uBuffer;
uniform vec4 uPerson[MAX_PEOPLE];
uniform vec4 uInfo[MAX_PEOPLE];

flat out vec4 vPerson;
flat out vec4 vInfo;
out vec2 vWorld;

const float QUAD_WIDTH = 3.6;
const float QUAD_HEIGHT = 3.6;
const float QUAD_BELOW = 0.7;
const float DEPTH_NUDGE = 0.05;

void main() {
  vec4 person = uPerson[gl_InstanceID];
  vec2 foot = floor(person.xy * 16.0 + 0.5) / 16.0;
  vec2 world = vec2(foot.x + (corner.x - 0.5) * QUAD_WIDTH, foot.y + QUAD_BELOW - corner.y * QUAD_HEIGHT);
  vec2 pixel = (world - uView.xy) * uView.z + uBuffer * 0.5;
  float key = (foot.y + DEPTH_NUDGE - uView.y) * LIFTED_DEPTH_PER_TILE;
  float depth = -clamp(key / PROP_DEPTH_RANGE, -0.99, 0.99);
  gl_Position = vec4(pixel.x / uBuffer.x * 2.0 - 1.0, 1.0 - pixel.y / uBuffer.y * 2.0, depth, 1.0);
  vPerson = vec4(foot, person.zw);
  vInfo = uInfo[gl_InstanceID];
  vWorld = world;
}
