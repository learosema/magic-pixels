import {
  WebGL2Renderer,
  RenderTarget,
  Scene,
  Mesh,
  PerspectiveCamera,
  AmbientLight,
  DirectionalLight,
  createPlaneGeometry,
  createSphereGeometry,
  createBoxGeometry,
  createPbrMaterial,
  createFullscreenMaterial,
  createFullscreenMesh,
  DepthAttachment,
  Vector,
  Stopwatch,
} from '../magic-pixels.js';

const canvas = document.getElementById('canvas');
const renderer = new WebGL2Renderer(canvas);
renderer.setClearColor('#0b0d12');

// ------------------------------------------------------------- scene

// Objects receding into the distance, so that the depth has a range to show.
// The default PBR material converts to sRGB itself, and the target is an
// ordinary 8-bit one: the colour half of the picture is shown as it is.
const scene = new Scene();

const floor = new Mesh(
  createPlaneGeometry(80, 80, 1, 1),
  createPbrMaterial({
    baseColorFactor: [0.2, 0.22, 0.26, 1],
    metallicFactor: 0,
    roughnessFactor: 0.7,
  })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.7;
scene.add(floor);

const sphereGeometry = createSphereGeometry(0.7, 40, 20);
const boxGeometry = createBoxGeometry(1.2, 1.2, 1.2);
const colors = [
  [0.85, 0.2, 0.15, 1],
  [0.9, 0.6, 0.15, 1],
  [0.3, 0.7, 0.35, 1],
  [0.25, 0.5, 0.85, 1],
];
const objects = [];
for (let i = 0; i < 9; i++) {
  const material = createPbrMaterial({
    baseColorFactor: colors[i % colors.length],
    metallicFactor: 0,
    roughnessFactor: 0.4,
  });
  const mesh = new Mesh(i % 2 ? boxGeometry : sphereGeometry, material);
  mesh.position.set(i % 2 ? 2 : -2, 0, 3 - i * 3);
  scene.add(mesh);
  objects.push(mesh);
}

scene.add(new AmbientLight('#404a6a', 0.7));
const sun = new DirectionalLight('#fff1d6', 2.5);
sun.position.set(4, 8, 6);
sun.lookAt(new Vector(0, 0, -6));
scene.add(sun);

const camera = new PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 2.2, 8);
camera.lookAt(new Vector(0, 0, -8));

// ----------------------------------------------- target and display pass

// depth: 'texture' makes the depth attachment a Texture,
// `target.depthAttachment`, that a material can sample.
const target = new RenderTarget(canvas.width || 1, canvas.height || 1, {
  depth: DepthAttachment.TEXTURE,
});

const displayFragment = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D colorMap;
uniform sampler2D depthMap;
uniform float near;
uniform float far;
uniform float range;
uniform float split;
uniform float linearize;
out vec4 fragColor;

void main() {
  // the depth texture holds the depth buffer value, 0 at the near plane and
  // 1 at the far plane, in the red channel
  float d = texture(depthMap, vUv).r;
  float shown = d;
  if (linearize > 0.5) {
    // undo the perspective projection: depth 0..1 -> NDC z -1..1 -> the
    // distance in front of the camera, then scale to 0..1 over range
    float z = d * 2.0 - 1.0;
    float eyeDistance = (2.0 * near * far) / (far + near - z * (far - near));
    shown = clamp(eyeDistance / range, 0.0, 1.0);
  }
  vec3 color = texture(colorMap, vUv).rgb;
  vec3 depth = vec3(shown);
  // a thin line marks the split
  float line = 1.0 - smoothstep(0.0, 0.002, abs(vUv.x - split));
  vec3 result = vUv.x < split ? color : depth;
  fragColor = vec4(mix(result, vec3(1.0, 0.4, 0.1), line), 1.0);
}`;

const displayMaterial = createFullscreenMaterial(displayFragment, {
  colorMap: target.colorAttachment,
  depthMap: target.depthAttachment,
  near: camera.near,
  far: camera.far,
  range: 25,
  split: 0.5,
  linearize: 1,
});
const passScene = new Scene();
passScene.add(createFullscreenMesh(displayMaterial));

const mode = document.getElementById('mode');
mode.addEventListener('change', () => {
  displayMaterial.uniforms.linearize = mode.value === 'linear' ? 1 : 0;
});
canvas.addEventListener('pointermove', (event) => {
  displayMaterial.uniforms.split = event.clientX / window.innerWidth;
});

function resize() {
  const { innerWidth: width, innerHeight: height } = window;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)).setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  // both attachments are rebuilt at the new size
  target.width = canvas.width;
  target.height = canvas.height;
}
window.addEventListener('resize', resize);
resize();

// ------------------------------------------------------------- frame

const clock = new Stopwatch().start();

function frame() {
  const t = clock.elapsedTime / 1000;
  objects.forEach((mesh, i) => {
    mesh.rotation.y = t * 0.5 + i;
    mesh.position.y = Math.sin(t + i) * 0.25;
  });
  renderer.render(scene, camera, target);
  renderer.render(passScene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
