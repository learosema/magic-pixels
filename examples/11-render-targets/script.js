import {
  WebGL2Renderer,
  RenderTarget,
  Scene,
  Object3D,
  Mesh,
  PerspectiveCamera,
  AmbientLight,
  DirectionalLight,
  PointLight,
  createPlaneGeometry,
  createSphereGeometry,
  createPbrMaterial,
  createToneMapMaterial,
  createFullscreenMesh,
  ToneMapping,
  Vector,
  Stopwatch,
} from '../magic-pixels.js';

const canvas = document.getElementById('canvas');
const renderer = new WebGL2Renderer(canvas);
renderer.setClearColor('#0b0d12');

// ------------------------------------------------------------- scene

// Every material writes linear colour: the tone-mapping pass, not the PBR
// shader, converts to sRGB. Without `linearOutput` the scene would be
// converted twice.
const scene = new Scene();

const floor = new Mesh(
  createPlaneGeometry(14, 14, 1, 1),
  createPbrMaterial({
    baseColorFactor: [0.1, 0.11, 0.13, 1],
    metallicFactor: 0,
    roughnessFactor: 0.6,
    linearOutput: true,
  })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.7;
scene.add(floor);

const sphereGeometry = createSphereGeometry(0.55, 48, 24);
const colors = [
  [0.8, 0.12, 0.08, 1],
  [0.8, 0.5, 0.1, 1],
  [0.95, 0.75, 0.35, 1],
  [0.9, 0.9, 0.9, 1],
];
colors.forEach((baseColorFactor, i) => {
  const sphere = new Mesh(
    sphereGeometry,
    createPbrMaterial({
      baseColorFactor,
      metallicFactor: i < 2 ? 0 : 1,
      roughnessFactor: 0.15 + i * 0.2,
      linearOutput: true,
    })
  );
  sphere.position.set((i - 1.5) * 1.6, 0, 0);
  scene.add(sphere);
});

// The lights are brighter than 1 on purpose: in a linear HDR target
// nothing is clipped, the tone-mapping pass decides what happens to it.
scene.add(new AmbientLight('#2a3350', 0.5));
const sun = new DirectionalLight('#fff1d6', 3);
scene.add(sun);

const bulbPivot = new Object3D();
const bulb = new PointLight('#ffb15e', 25, 9);
bulb.position.set(3, 1.2, 0);
bulbPivot.add(bulb);
scene.add(bulbPivot);

const camera = new PerspectiveCamera(40, 1, 0.1, 100);
camera.position.set(0, 3, 8.5);
camera.lookAt(new Vector(0, 0, 0));

// -------------------------------------------------- render target + pass

// A half float target holds values above 1. It needs EXT_color_buffer_float;
// without it the demo falls back to 8 bits, where the highlights clip
// before the tone mapping can do anything about them.
let target = new RenderTarget(canvas.width || 1, canvas.height || 1, {
  float: true,
});
const status = document.getElementById('status');

const passScene = new Scene();
let passes = {};
let pass = null;

function createPasses() {
  passes = Object.fromEntries(
    Object.values(ToneMapping).map((toneMapping) => [
      toneMapping,
      createToneMapMaterial({ map: target.colorAttachment, toneMapping }),
    ])
  );
  passScene.remove(...passScene.children);
  pass = createFullscreenMesh(passes[select.value]);
  passScene.add(pass);
  applyExposure();
}

const select = document.getElementById('tone-mapping');
const slider = document.getElementById('exposure');
const exposureValue = document.getElementById('exposure-value');

function applyExposure() {
  const exposure = Number(slider.value);
  exposureValue.textContent = exposure.toFixed(2);
  for (const material of Object.values(passes)) {
    material.uniforms.exposure = exposure;
  }
}

select.addEventListener('change', () => {
  pass.material = passes[select.value];
});
slider.addEventListener('input', applyExposure);
createPasses();

function resize() {
  const { innerWidth: width, innerHeight: height } = window;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)).setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  // The target follows the canvas: the renderer notices the new size on
  // the next render and rebuilds the framebuffer.
  target.width = canvas.width;
  target.height = canvas.height;
}
window.addEventListener('resize', resize);
resize();

// ------------------------------------------------------------- frame

const clock = new Stopwatch().start();
const origin = new Vector(0, 0, 0);

function drawFrame() {
  renderer.render(scene, camera, target);
  renderer.render(passScene, camera);
}

function frame() {
  const t = clock.elapsedTime / 1000;
  sun.position.set(Math.cos(t * 0.2) * 6, 3, Math.sin(t * 0.2) * 6);
  sun.lookAt(origin);
  bulbPivot.rotation.y = t * 0.6;
  drawFrame();
  requestAnimationFrame(frame);
}

try {
  drawFrame();
  status.textContent = `Rendering into a ${target.width}×${target.height} float target.`;
} catch (error) {
  if (!/EXT_color_buffer_float/.test(error.message)) {
    throw error;
  }
  // no EXT_color_buffer_float: use an 8 bit target instead
  target = new RenderTarget(canvas.width, canvas.height);
  createPasses();
  status.textContent = `Float targets are not supported here (${error.message}); using 8 bits, so bright highlights clip.`;
}
requestAnimationFrame(frame);
