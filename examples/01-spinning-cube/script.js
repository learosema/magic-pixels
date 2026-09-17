import {
  WebGL2Renderer,
  Scene,
  Mesh,
  PerspectiveCamera,
  createBoxGeometry,
  createNormalMaterial,
  Stopwatch,
} from '../magic-pixels.js';

const canvas = document.getElementById('canvas');
const renderer = new WebGL2Renderer(canvas);
renderer.setClearColor('#111318');

const scene = new Scene();
const cube = new Mesh(createBoxGeometry(1, 1, 1), createNormalMaterial());
scene.add(cube);

const camera = new PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(0, 0, 3);

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
  cube.rotation.x = t * 0.6;
  cube.rotation.y = t * 0.8;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
