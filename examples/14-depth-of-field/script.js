import {
  WebGL2Renderer,
  RenderTarget,
  Scene,
  Mesh,
  Object3D,
  PerspectiveCamera,
  AmbientLight,
  DirectionalLight,
  PointLight,
  createPlaneGeometry,
  createSphereGeometry,
  createBoxGeometry,
  createPbrMaterial,
  createFullscreenMaterial,
  createFullscreenMesh,
  DepthAttachment,
  Filter,
  Vector,
  Stopwatch,
} from '../magic-pixels.js';

const canvas = document.getElementById('canvas');
const status = document.getElementById('status');
const renderer = new WebGL2Renderer(canvas);
renderer.setClearColor('#05060a');

// ------------------------------------------------------------- scene

// A street at night: a road between two rows of buildings with lit windows,
// street lamps every few metres, and some objects on the road. Everything
// is drawn into a float target without colour conversion (`linearOutput`),
// so the lights can be much brighter than 1.
const scene = new Scene();

// the same random street every time
let seed = 7;
function random() {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
}

const ground = new Mesh(
  createPlaneGeometry(60, 260, 1, 1),
  createPbrMaterial({
    baseColorFactor: [0.02, 0.022, 0.03, 1],
    metallicFactor: 0,
    roughnessFactor: 0.8,
    linearOutput: true,
  })
);
ground.rotation.x = -Math.PI / 2;
ground.position.set(0, 0, -110);
scene.add(ground);

const road = new Mesh(
  createPlaneGeometry(6.4, 260, 1, 1),
  createPbrMaterial({
    baseColorFactor: [0.05, 0.052, 0.06, 1],
    metallicFactor: 0,
    roughnessFactor: 0.55,
    linearOutput: true,
  })
);
road.rotation.x = -Math.PI / 2;
road.position.set(0, 0.01, -110);
scene.add(road);

// unlit, emissive lights: base colours well above 1
const buildingMaterial = createPbrMaterial({
  baseColorFactor: [0.05, 0.055, 0.07, 1],
  metallicFactor: 0,
  roughnessFactor: 0.9,
  linearOutput: true,
});
const windowMaterials = [
  [5, 3.2, 1.2],
  [2, 4, 6],
  [5, 5, 4.2],
].map((color) =>
  createPbrMaterial({
    unlit: true,
    baseColorFactor: [...color, 1],
    linearOutput: true,
  })
);
const windowGeometry = createBoxGeometry(0.06, 0.9, 0.7);

const postGeometry = createBoxGeometry(0.14, 3.4, 0.14);
const capGeometry = createBoxGeometry(0.62, 0.1, 0.62);
const lanternGeometry = createSphereGeometry(0.3, 20, 10);
const postMaterial = createPbrMaterial({
  baseColorFactor: [0.06, 0.06, 0.07, 1],
  metallicFactor: 0.6,
  roughnessFactor: 0.5,
  linearOutput: true,
});
const lanternMaterial = createPbrMaterial({
  unlit: true,
  baseColorFactor: [7, 4.6, 1.8, 1],
  linearOutput: true,
});

const SPACING = 7.5;
for (let k = 0; k < 14; k++) {
  const z = 4 - k * SPACING;
  for (const side of [-1, 1]) {
    // a building with lit windows on the side facing the road
    const height = 7 + random() * 9;
    const building = new Mesh(
      createBoxGeometry(5, height, 6),
      buildingMaterial
    );
    building.position.set(side * 10.5, height / 2, z);
    scene.add(building);
    for (let y = 2; y < height - 1; y += 1.8) {
      for (const dz of [-1.8, 0, 1.8]) {
        if (random() < 0.35) {
          const light = new Mesh(
            windowGeometry,
            windowMaterials[Math.floor(random() * windowMaterials.length)]
          );
          light.position.set(side * 8, y, z + dz);
          scene.add(light);
        }
      }
    }

    // a street lamp on the pavement: pole, cap and glowing lantern
    const lamp = new Object3D();
    lamp.position.set(side * 3.9, 0, z);
    const post = new Mesh(postGeometry, postMaterial);
    post.position.y = 1.7;
    const lantern = new Mesh(lanternGeometry, lanternMaterial);
    lantern.position.y = 3.6;
    const cap = new Mesh(capGeometry, postMaterial);
    cap.position.y = 3.95;
    lamp.add(post, lantern, cap);
    scene.add(lamp);
  }
}

// things on the road, to focus on
const sphereGeometry = createSphereGeometry(0.7, 32, 16);
const boxGeometry = createBoxGeometry(1.2, 1.2, 1.2);
const objects = [];
[
  [sphereGeometry, [-1.2, 0.7, -4], [0.2, 0.45, 0.75, 1], 0],
  [boxGeometry, [1.3, 0.6, -11], [0.75, 0.25, 0.15, 1], 0],
  [sphereGeometry, [-0.9, 0.7, -20], [0.9, 0.7, 0.3, 1], 1],
  [boxGeometry, [1.0, 0.6, -32], [0.2, 0.6, 0.35, 1], 0],
].forEach(([geometry, position, baseColorFactor, metallicFactor]) => {
  const mesh = new Mesh(
    geometry,
    createPbrMaterial({
      baseColorFactor,
      metallicFactor,
      roughnessFactor: 0.3,
      linearOutput: true,
    })
  );
  mesh.position.set(...position);
  scene.add(mesh);
  objects.push(mesh);
});

scene.add(new AmbientLight('#2a3350', 0.7));
const moon = new DirectionalLight('#8fa4d8', 0.9);
moon.position.set(-5, 8, 4);
moon.lookAt(new Vector(0, 0, -10));
scene.add(moon);
for (const [z, color] of [
  [-3, '#ffb15e'],
  [-18, '#ffb15e'],
]) {
  const light = new PointLight(color, 8, 14);
  light.position.set(0, 3.4, z);
  scene.add(light);
}

const camera = new PerspectiveCamera(42, 1, 0.1, 160);
camera.position.set(0, 1.6, 8);
camera.lookAt(new Vector(0, 1.5, -40));

// ----------------------------------------------- target and depth pass

let target = createTarget(true);

function createTarget(float) {
  const target = new RenderTarget(canvas.width || 1, canvas.height || 1, {
    float,
    depth: DepthAttachment.TEXTURE,
  });
  // the blur samples between texels
  target.colorAttachment.minFilter = Filter.LINEAR;
  target.colorAttachment.magFilter = Filter.LINEAR;
  return target;
}

// Depth of field in one pass. Each pixel has a blur radius, growing with
// how far its distance is from the focus distance; it averages a disc of
// neighbours (a spiral of taps at golden-angle steps covers a disc evenly).
// A neighbour only counts if its own blur radius reaches this pixel, so a
// sharp lamp in the foreground does not smear over the blurred street
// behind it. The result is tone mapped and converted to sRGB right here.
const depthOfFieldFragment = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D colorMap;
uniform sampler2D depthMap;
uniform vec2 texel;
uniform float near;
uniform float far;
uniform float focus;
uniform float aperture;
uniform float exposure;
out vec4 fragColor;

const int TAPS = 96;
const float GOLDEN_ANGLE = 2.39996323;
const float MAX_SAMPLE = 10.0;

// depth buffer value -> distance in front of the camera
float eyeDistance(vec2 uv) {
  float z = texture(depthMap, uv).r * 2.0 - 1.0;
  return (2.0 * near * far) / (far + near - z * (far - near));
}

// blur radius in pixels: 0 at the focus distance, growing on both sides up
// to the aperture
float blurRadius(float dist) {
  return clamp(abs(dist - focus) / dist, 0.0, 1.0) * aperture;
}

vec3 aces(vec3 c) {
  return clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0);
}

vec3 linearToSrgb(vec3 c) {
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}

// a different pseudo-random number per pixel, 0..1
float noise(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

void main() {
  float centreDistance = eyeDistance(vUv);
  float radius = blurRadius(centreDistance);
  // in focus: nothing to blur, one texture fetch
  if (radius < 0.5) {
    vec3 sharp = texture(colorMap, vUv).rgb * exposure;
    fragColor = vec4(linearToSrgb(aces(sharp)), 1.0);
    return;
  }
  // the area of the disc grows with the square of the radius, so the number
  // of taps does too
  int taps = int(clamp(radius * radius * 0.9, 16.0, float(TAPS)));
  // every pixel turns its spiral of taps by a random angle, so the gaps
  // between taps become fine grain instead of a visible pattern
  float spin = noise(gl_FragCoord.xy) * 6.2831853;
  vec3 sum = min(texture(colorMap, vUv).rgb, vec3(MAX_SAMPLE));
  float weightSum = 1.0;
  for (int i = 0; i < TAPS; i++) {
    if (i >= taps) {
      break;
    }
    float r = sqrt((float(i) + 0.5) / float(taps));
    float angle = float(i) * GOLDEN_ANGLE + spin;
    vec2 offset = vec2(cos(angle), sin(angle)) * r * radius; // in pixels
    vec2 uv = vUv + offset * texel;
    float sampleDistance = eyeDistance(uv);
    // Something behind this pixel always counts: it is what a blurry
    // near pixel looks through, and it makes soft edges. Something in
    // front only counts if its own blur reaches this pixel, so a sharp
    // lamp does not smear over the blurred street behind it.
    float weight = sampleDistance > centreDistance
      ? 1.0
      : clamp(blurRadius(sampleDistance) - length(offset) + 1.0, 0.0, 1.0);
    // a tiny bright lamp hit by only a few taps would flicker: cap it
    vec3 color = min(texture(colorMap, uv).rgb, vec3(MAX_SAMPLE));
    sum += color * weight;
    weightSum += weight;
  }
  vec3 result = sum / weightSum * exposure;
  fragColor = vec4(linearToSrgb(aces(result)), 1.0);
}`;

const passMaterial = createFullscreenMaterial(depthOfFieldFragment, {
  colorMap: target.colorAttachment,
  depthMap: target.depthAttachment,
  texel: [1, 1],
  near: camera.near,
  far: camera.far,
  focus: 12,
  aperture: 12,
  exposure: 1,
});
const passScene = new Scene();
passScene.add(createFullscreenMesh(passMaterial));

// -------------------------------------------------------------- controls

const auto = document.getElementById('auto');
const focusSlider = document.getElementById('focus');
const focusValue = document.getElementById('focus-value');
const apertureSlider = document.getElementById('aperture');
const apertureValue = document.getElementById('aperture-value');

// ?focus=12 starts with a fixed focus distance
const startFocus = new URLSearchParams(location.search).get('focus');
if (startFocus !== null) {
  auto.checked = false;
  focusSlider.value = startFocus;
}

function setFocus(distance) {
  passMaterial.uniforms.focus = distance;
  focusValue.textContent = distance.toFixed(1);
}
focusSlider.addEventListener('input', () => {
  auto.checked = false;
  setFocus(Number(focusSlider.value));
});
// the blur radius is in pixels, so it scales with the height of the canvas:
// the aperture slider means the same on a phone and on a 4K screen
function setAperture() {
  passMaterial.uniforms.aperture =
    (Number(apertureSlider.value) * canvas.height) / 900;
  apertureValue.textContent = apertureSlider.value;
}
apertureSlider.addEventListener('input', setAperture);
setFocus(Number(focusSlider.value));

function resize() {
  const { innerWidth: width, innerHeight: height } = window;
  renderer.setPixelRatio(1).setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  target.width = canvas.width;
  target.height = canvas.height;
  passMaterial.uniforms.texel = [1 / canvas.width, 1 / canvas.height];
  setAperture();
}
window.addEventListener('resize', resize);
resize();

// ------------------------------------------------------------- frame

const clock = new Stopwatch().start();

function drawFrame() {
  const t = clock.elapsedTime / 1000;
  objects.forEach((mesh, i) => {
    mesh.rotation.y = t * 0.4 + i;
  });
  if (auto.checked) {
    // sweep the focus between about 7 and 70 units, evenly in log space
    const focus = 7 * 10 ** (0.5 + 0.5 * Math.sin(t * 0.35));
    focusSlider.value = focus;
    setFocus(focus);
  }
  renderer.render(scene, camera, target);
  renderer.render(passScene, camera);
}

function frame() {
  drawFrame();
  requestAnimationFrame(frame);
}

try {
  drawFrame();
  status.textContent = `Float target with a depth texture, ${canvas.width}×${canvas.height}.`;
} catch (error) {
  if (!/EXT_color_buffer_float/.test(error.message)) {
    throw error;
  }
  // no EXT_color_buffer_float: an 8 bit target, where the lamps clip to
  // small discs instead of glowing bokeh
  target = createTarget(false);
  passMaterial.uniforms.colorMap = target.colorAttachment;
  passMaterial.uniforms.depthMap = target.depthAttachment;
  resize();
  status.textContent = `Float targets are not supported here (${error.message}); using 8 bits.`;
}
requestAnimationFrame(frame);
