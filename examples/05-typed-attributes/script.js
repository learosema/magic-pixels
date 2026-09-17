import {
  WebGL2Renderer,
  Scene,
  Mesh,
  PerspectiveCamera,
  BufferGeometry,
  BufferAttribute,
  createBoxGeometry,
  createNormalMaterial,
  Stopwatch,
} from '../magic-pixels.js';

// Positions land in -1..1 for a size-2 box, which is exactly what a
// normalized signed integer can represent without rescaling.
function createQuantizedBoxGeometry() {
  const source = createBoxGeometry(2, 2, 2);
  const { position, normal, uv } = source.attributes;

  const qPosition = new Int16Array(position.data.length);
  for (let i = 0; i < position.data.length; i++) {
    qPosition[i] = Math.round(position.data[i] * 32767);
  }

  const qNormal = new Int8Array(normal.data.length);
  for (let i = 0; i < normal.data.length; i++) {
    qNormal[i] = Math.round(normal.data[i] * 127);
  }

  const qUv = new Uint8Array(uv.data.length);
  for (let i = 0; i < uv.data.length; i++) {
    qUv[i] = Math.round(uv.data[i] * 255);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(qPosition, 3, true));
  geometry.setAttribute('normal', new BufferAttribute(qNormal, 3, true));
  geometry.setAttribute('uv', new BufferAttribute(qUv, 2, true));
  // the box is indexed (each corner is shared by the two triangles of
  // its face); reuse the source geometry's index as-is
  geometry.setIndex(source.index, source.indexType);
  return geometry;
}

const canvas = document.getElementById('canvas');
const renderer = new WebGL2Renderer(canvas);
renderer.setClearColor('#111318');

const scene = new Scene();
const material = createNormalMaterial();

const floatBox = new Mesh(createBoxGeometry(2, 2, 2), material);
floatBox.position.set(-1.4, 0, 0);
const quantizedBox = new Mesh(createQuantizedBoxGeometry(), material);
quantizedBox.position.set(1.4, 0, 0);
scene.add(floatBox, quantizedBox);

const camera = new PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 0, 6);

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
  floatBox.rotation.x = quantizedBox.rotation.x = t * 0.6;
  floatBox.rotation.y = quantizedBox.rotation.y = t * 0.8;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
