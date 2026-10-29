#version 300 es
layout(location = 0) in vec2 corner;
layout(location = 1) in vec4 aHome;
layout(location = 2) in vec4 aKind;

uniform vec4 uView;
uniform vec2 uBuffer;
out vec2 vWorld;
flat out vec2 vCentre;
flat out vec4 vHome;
flat out vec4 vKind;

const float T = float(HOME_TEXELS);

void main() {
  vec2 centre = (floor(aHome.xy * T) + 0.5) / T;
  float reach = aKind.y / T * 0.85;
  vec2 unit = corner * 2.0 - 1.0;
  vec2 world = centre + vec2(unit.x * reach, unit.y * reach - reach * 0.25);
  vec2 pixel = (world - uView.xy) * uView.z + uBuffer * 0.5;
  gl_Position = vec4(pixel.x / uBuffer.x * 2.0 - 1.0, 1.0 - pixel.y / uBuffer.y * 2.0, 0.0, 1.0);
  vWorld = world;
  vCentre = centre;
  vHome = aHome;
  vKind = aKind;
}
