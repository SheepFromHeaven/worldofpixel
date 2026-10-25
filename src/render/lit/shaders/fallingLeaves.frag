#version 300 es
precision highp float;

in vec4 vColour;
out vec4 colour;

void main() {
  colour = vColour;
}
