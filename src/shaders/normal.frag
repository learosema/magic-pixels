#version 300 es
precision highp float;
in vec3 vPosition;
in vec3 vNormal;
in vec2 vUv;
out vec4 fragColor;

void main() {
  vec3 color = normalize(vNormal) * 0.5 + 0.5;
  fragColor = vec4(color, 1.);
}
