#version 300 es
precision highp float;
in vec4 vPosition;
in vec4 vNormal;
in vec2 vUv;
uniform float time;
uniform vec2 resolution;
out vec4 fragColor;

void main() {
  vec3 color = vec3(vNormal.x, vNormal.y, 1.);
  fragColor = vec4(color,1.);
}
