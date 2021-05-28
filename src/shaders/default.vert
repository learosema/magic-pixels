precision highp float;
attribute vec4 position;
attribute vec4 normal;
attribute vec2 uv;
varying vec4 vPosition;
varying vec2 vUv;
varying vec4 vNormal;

void main() {
  vUv = uv;
  vPosition = position;
  vNormal = normal;
  gl_Position = position;
}
