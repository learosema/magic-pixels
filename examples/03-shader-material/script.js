import {
  WebGL2Renderer,
  Scene,
  Mesh,
  PerspectiveCamera,
  createSphereGeometry,
  createShaderMaterial,
  Vector,
  Stopwatch,
} from '../magic-pixels.js';

const vertexShader = `#version 300 es
precision highp float;
in vec3 position;
in vec3 normal;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
uniform float time;
out vec3 vNormal;
out float vDisplacement;

void main() {
  float displacement =
    sin(position.x * 2.0 + time) *
    sin(position.y * 3.0 + time * 1.3) *
    sin(position.z * 4.0 + time * 0.7) * 0.3;
  vDisplacement = displacement;
  vNormal = normalMatrix * normal;
  vec3 displaced = position + normal * displacement;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
`;

const fragmentShader = `#version 300 es
precision highp float;
in vec3 vNormal;
in float vDisplacement;
uniform float time;
out vec4 fragColor;

vec3 hsv2rgb(vec3 c) {
  vec4 k = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + k.xyz) * 6.0 - k.www);
  return c.z * mix(k.xxx, clamp(p - k.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec3 n = normalize(vNormal);
  float hue = fract(time * 0.05 + vDisplacement);
  vec3 color = hsv2rgb(vec3(hue, 0.6, 0.95));
  float light = max(dot(n, normalize(vec3(0.4, 0.6, 1.0))), 0.15);
  
  fragColor = vec4(color * light + pow(light, 16.) * .5, 1.0);
}
`;

const canvas = document.getElementById('canvas');
const renderer = new WebGL2Renderer(canvas);
renderer.setClearColor('#05060a');

const scene = new Scene();
const material = createShaderMaterial(vertexShader, fragmentShader, {
  time: 0,
});
const blob = new Mesh(createSphereGeometry(1, 48, 48), material);
scene.add(blob);

const camera = new PerspectiveCamera(50, 1, 0.1, 100);
const target = new Vector(0, 0, 0);

function resize() {
  const { innerWidth: width, innerHeight: height } = window;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)).setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const clock = new Stopwatch().start();

function frame() {
  const t = clock.elapsedTime / 1000;
  material.uniforms.time = t;
  camera.position.set(Math.sin(t * 0.2) * 4, 1.5, Math.cos(t * 0.2) * 4);
  camera.lookAt(target);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
