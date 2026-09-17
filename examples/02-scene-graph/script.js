import {
  WebGL2Renderer,
  Scene,
  Object3D,
  Mesh,
  PerspectiveCamera,
  createSphereGeometry,
  createBasicMaterial,
  Vector,
  Stopwatch,
} from '../magic-pixels.js';

const canvas = document.getElementById('canvas');
const renderer = new WebGL2Renderer(canvas);
renderer.setClearColor('#05060a');

const scene = new Scene();

const sun = new Mesh(
  createSphereGeometry(0.8, 32, 16),
  createBasicMaterial('#ffcc33')
);
scene.add(sun);

// pivot: orbits the sun, carrying everything below it
const planetPivot = new Object3D();
scene.add(planetPivot);

// anchor: fixed distance from the sun, does not spin itself
const planetAnchor = new Object3D();
planetAnchor.position.set(2.5, 0, 0);
planetPivot.add(planetAnchor);

const planet = new Mesh(
  createSphereGeometry(0.35, 32, 16),
  createBasicMaterial('#3d8bff')
);
planetAnchor.add(planet);

// pivot: orbits the planet, independent of the planet's own spin
const moonPivot = new Object3D();
planetAnchor.add(moonPivot);

const moon = new Mesh(
  createSphereGeometry(0.12, 24, 12),
  createBasicMaterial('#c8c8c8')
);
moon.position.set(0.7, 0, 0);
moonPivot.add(moon);

const camera = new PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(0, 3, 6);
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

function frame() {
  const t = clock.elapsedTime / 1000;
  planetPivot.rotation.y = t * 0.5; // planet orbiting the sun
  planet.rotation.y = t * 2; // planet spinning on its own axis
  moonPivot.rotation.y = t * 3; // moon orbiting the planet
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
