precision highp float;
varying vec4 vPosition;
varying vec4 vNormal;
varying vec2 vUv;
varying float vFaceIndex;
uniform float time;
uniform vec2 resolution;

void main() {
  vec3 color = vec3(vNormal.x, vNormal.y, 1.);
  gl_FragColor = vec4(color,1.);
}
