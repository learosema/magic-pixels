#version 300 es
precision highp float;
in vec4 position;
in vec4 normal;
in vec2 uv;
out vec4 vPosition;
out vec2 vUv;
out vec4 vNormal;

void main() {
  vUv = uv;
  vPosition = position;
  vNormal = normal;
  gl_Position = position;
}
