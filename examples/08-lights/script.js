import {
  WebGL2Renderer,
  Scene,
  Object3D,
  Mesh,
  PerspectiveCamera,
  AmbientLight,
  DirectionalLight,
  PointLight,
  createBoxGeometry,
  createPlaneGeometry,
  createSphereGeometry,
  createBasicMaterial,
  createShaderMaterial,
  Color,
  Vector,
  Stopwatch,
} from '../magic-pixels.js';

// A minimal lit fragment shader. The vertex shader is the built-in
// one, which hands over vPosition and vNormal in view space; the light
// uniforms arrive in the same space, so no further transforms needed.
// The array sizes are the shader's choice; the renderer fits the
// frame's lights to them and clamps the counts.
const LAMBERT_FRAGMENT_SHADER = `#version 300 es
precision highp float;
#define MAX_DIRECTIONAL_LIGHTS 2
#define MAX_POINT_LIGHTS 4

in vec3 vPosition;
in vec3 vNormal;

uniform vec3 color;
uniform vec3 ambientLightColor;
uniform vec3 directionalLightDirections[MAX_DIRECTIONAL_LIGHTS];
uniform vec3 directionalLightColors[MAX_DIRECTIONAL_LIGHTS];
uniform int directionalLightCount;
uniform vec3 pointLightPositions[MAX_POINT_LIGHTS];
uniform vec3 pointLightColors[MAX_POINT_LIGHTS];
uniform float pointLightRanges[MAX_POINT_LIGHTS];
uniform int pointLightCount;

out vec4 fragColor;

void main() {
  vec3 N = normalize(vNormal);
  vec3 light = ambientLightColor;

  for (int i = 0; i < MAX_DIRECTIONAL_LIGHTS; i++) {
    if (i >= directionalLightCount) break;
    // the uniform is the direction the light shines in; L points at it
    vec3 L = -directionalLightDirections[i];
    light += directionalLightColors[i] * max(dot(N, L), 0.0);
  }

  for (int i = 0; i < MAX_POINT_LIGHTS; i++) {
    if (i >= pointLightCount) break;
    vec3 toLight = pointLightPositions[i] - vPosition;
    float d = length(toLight);
    vec3 L = toLight / d;
    // inverse-square falloff, windowed to zero at the light's range
    float attenuation = 1.0 / max(d * d, 1e-4);
    float range = pointLightRanges[i];
    if (range > 0.0) {
      attenuation *= clamp(1.0 - pow(d / range, 4.0), 0.0, 1.0);
    }
    light += pointLightColors[i] * max(dot(N, L), 0.0) * attenuation;
  }

  vec3 linear = color * light;
  // the lighting math ran in linear space; encode for the sRGB display
  fragColor = vec4(pow(linear, vec3(1.0 / 2.2)), 1.0);
}`;

function createLitMaterial(hex) {
  return createShaderMaterial(undefined, LAMBERT_FRAGMENT_SHADER, {
    color: Color.fromHex(hex),
  });
}

const canvas = document.getElementById('canvas');
const renderer = new WebGL2Renderer(canvas);
renderer.setClearColor('#0b0d12');

const scene = new Scene();

const ground = new Mesh(
  createPlaneGeometry(10, 10, 1, 1),
  createLitMaterial('#8a8f9a')
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.5;
scene.add(ground);

const sphere = new Mesh(
  createSphereGeometry(0.7, 48, 24),
  createLitMaterial('#d94a4a')
);
sphere.position.set(-1.6, 0.2, 0);

const box = new Mesh(
  createBoxGeometry(1.2, 1.2, 1.2),
  createLitMaterial('#4a8ad9')
);
box.position.set(1.6, 0.1, 0);
box.rotation.y = 0.6;

const smallSphere = new Mesh(
  createSphereGeometry(0.4, 32, 16),
  createLitMaterial('#e0d9c8')
);
smallSphere.position.set(0, -0.1, 1.8);
scene.add(sphere, box, smallSphere);

// Lights are nodes: add them to the scene like a mesh.
const ambient = new AmbientLight('#26304a', 0.6);
scene.add(ambient);

// The sun shines along its own -Z axis; lookAt() aims that axis.
const sun = new DirectionalLight('#fff1d6', 0.9);
scene.add(sun);

// The bulb sits on a pivot so rotating the pivot swings it around.
// Its child marker sphere is unlit (basic material) and rides along.
const bulbPivot = new Object3D();
const bulb = new PointLight('#ffb15e', 5, 8);
bulb.position.set(2.2, 0.9, 0);
const marker = new Mesh(
  createSphereGeometry(0.08, 16, 8),
  createBasicMaterial('#ffb15e')
);
bulb.add(marker);
bulbPivot.add(bulb);
scene.add(bulbPivot);

const camera = new PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 3.2, 7.5);
camera.lookAt(new Vector(0, 0, 0));

function resize() {
  const { innerWidth: width, innerHeight: height } = window;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)).setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const clock = new Stopwatch().start();
const origin = new Vector(0, 0, 0);

function frame() {
  const t = clock.elapsedTime / 1000;
  // a low sun circling the scene; only its orientation matters
  sun.position.set(Math.cos(t * 0.25) * 6, 2.5, Math.sin(t * 0.25) * 6);
  sun.lookAt(origin);
  bulbPivot.rotation.y = t * 0.8;
  box.rotation.y = 0.6 + t * 0.3;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
