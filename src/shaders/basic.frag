#version 300 es
precision highp float;
uniform vec4 color;
out vec4 fragColor;

void main() {
  fragColor = color;
}
