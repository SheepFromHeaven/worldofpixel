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
  float progress = aHome.z;
  float radius = (0.5 + 0.22 * aHome.w) * (0.35 + 0.65 * smoothstep(0.0, 0.7, progress));
  vec2 world = centre + (corner * 2.0 - 1.0) * radius * 1.25;
  vec2 pixel = (world - uView.xy) * uView.z + uBuffer * 0.5;
  gl_Position = vec4(pixel.x / uBuffer.x * 2.0 - 1.0, 1.0 - pixel.y / uBuffer.y * 2.0, 0.0, 1.0);
  vWorld = world;
  vCentre = centre;
  vHome = vec4(progress, aHome.w, radius, aKind.y);
  vKind = aKind;
}
