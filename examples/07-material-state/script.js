import {
  WebGL2Renderer,
  Scene,
  Object3D,
  Mesh,
  PerspectiveCamera,
  createPlaneGeometry,
  createBasicMaterial,
  Side,
  Stopwatch,
} from '../magic-pixels.js';

function createPane(color, phase) {
  const material = createBasicMaterial(color);
  material.transparent = true;
  const mesh = new Mesh(createPlaneGeometry(2.2, 2.2), material);
  return { mesh, phase };
}

const panes = [
  createPane('#ff3b3b99', 0),
  createPane('#3bff6a99', 2.1),
  createPane('#3b8bff99', 4.2),
];
const paneGroup = new Object3D();
paneGroup.position.x = -1.4;
paneGroup.add(...panes.map((pane) => pane.mesh));

// A single-sided plane: Side.FRONT culls the back face, so spinning
// it around Y makes it vanish for half the turn.
const singleSidedMaterial = createBasicMaterial('#ffd23b');
singleSidedMaterial.side = Side.FRONT;
const singleSided = new Mesh(createPlaneGeometry(2, 2), singleSidedMaterial);
singleSided.position.x = 3;

const canvas = document.getElementById('canvas');
const renderer = new WebGL2Renderer(canvas);
renderer.setClearColor('#111318');

const scene = new Scene();
scene.add(paneGroup, singleSided);

const camera = new PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 0, 7);

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
  for (const { mesh, phase } of panes) {
    mesh.position.z = Math.sin(t * 0.6 + phase) * 1.2;
  }
  singleSided.rotation.y = t * 0.8;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
