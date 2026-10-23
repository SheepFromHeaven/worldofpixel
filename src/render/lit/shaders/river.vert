#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aShape;
layout(location = 2) in vec2 aFlow;
layout(location = 3) in vec4 aMeta;

uniform vec4 uView;
uniform vec2 uBuffer;

out vec2 vWorld;
out vec2 vShape;
out vec2 vFlow;
out vec4 vMeta;

void main() {
  vec2 pixel = (aPos - uView.xy) * uView.z + uBuffer * 0.5;
  vec2 ndc = pixel / uBuffer * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  vWorld = aPos;
  vShape = aShape;
  vFlow = aFlow;
  vMeta = aMeta;
}
