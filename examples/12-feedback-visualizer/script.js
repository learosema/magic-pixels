import {
  WebGL2Renderer,
  RenderTarget,
  Scene,
  Mesh,
  PerspectiveCamera,
  BufferGeometry,
  BufferAttribute,
  createShaderMaterial,
  createFullscreenMaterial,
  createFullscreenMesh,
  createToneMapMaterial,
  DepthAttachment,
  DrawMode,
  Filter,
  Stopwatch,
} from '../magic-pixels.js';

const canvas = document.getElementById('canvas');
const status = document.getElementById('status');
const renderer = new WebGL2Renderer(canvas);
// Nothing is cleared between the passes: the feedback pass overwrites the
// whole target, and the curve has to be drawn on top of it.
renderer.autoClear = false;

// ------------------------------------------------------------ the curve

// A ribbon: a triangle strip with two vertices per sample, `position.x`
// running 0..1 along the curve and `position.y` being -1 or 1, the side of
// the ribbon. The vertex shader evaluates the noise curve, finds its
// direction and pushes the two sides apart, so the line has a width (GL
// lines are always one pixel).
const SAMPLES = 400;
const ribbon = new BufferGeometry();
const points = new Float32Array(SAMPLES * 4);
for (let i = 0; i < SAMPLES; i++) {
  const u = i / (SAMPLES - 1);
  points.set([u, -1, u, 1], i * 4);
}
ribbon.setAttribute('position', new BufferAttribute(points, 2));

const curveVertex = `#version 300 es
precision highp float;
in vec2 position;
uniform float time;
uniform float seed;
uniform float aspect;
uniform float thickness;
out float vSide;
out float vAlong;

float hash(float n) {
  return fract(sin(n * 127.1 + seed) * 43758.5453);
}

// value noise, -1..1
float noise(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash(i), hash(i + 1.0), f) * 2.0 - 1.0;
}

float curve(float u) {
  float y = noise(u * 6.0 + time * 1.3) * 0.32
          + noise(u * 17.0 - time * 2.1) * 0.16
          + noise(u * 43.0 + time * 4.7) * 0.08;
  // the ends stay put, the middle breathes with a slow pulse
  float pulse = 0.65 + 0.35 * sin(time * 2.4 + seed);
  return y * sin(3.14159265 * u) * pulse * 1.5;
}

void main() {
  float u = position.x;
  vec2 p = vec2((u * 2.0 - 1.0) * aspect, curve(u));
  vec2 ahead = vec2(((u + 0.002) * 2.0 - 1.0) * aspect, curve(u + 0.002));
  vec2 tangent = normalize(ahead - p);
  p += vec2(-tangent.y, tangent.x) * position.y * thickness;
  gl_Position = vec4(p.x / aspect, p.y, 0.0, 1.0);
  vSide = position.y;
  vAlong = u;
}`;

const curveFragment = `#version 300 es
precision highp float;
in float vSide;
in float vAlong;
uniform float time;
out vec4 fragColor;

vec3 hue(float h) {
  return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}

void main() {
  // fade to nothing at the edges of the ribbon for a soft line
  float alpha = 1.0 - smoothstep(0.3, 1.0, abs(vSide));
  vec3 color = hue(fract(vAlong * 0.6 + time * 0.07));
  // brighter than 1 on purpose: the float target keeps it, the blur turns
  // it into glow
  fragColor = vec4(color * 3.0, alpha);
}`;

const curveMaterial = createShaderMaterial(
  curveVertex,
  curveFragment,
  { time: 0, seed: Math.random() * 100, aspect: 1, thickness: 0.012 },
  DrawMode.TRIANGLE_STRIP
);
curveMaterial.transparent = true;
curveMaterial.depthTest = false;
const curveScene = new Scene();
curveScene.add(new Mesh(ribbon, curveMaterial));

// ------------------------------------------------- feedback: ping-pong

const feedbackFragment = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D map;
uniform vec2 texel;
uniform float time;
uniform float decay;
uniform float bias;
out vec4 fragColor;

void main() {
  // each pixel looks up the previous frame a little closer to the centre and
  // twisted around it, so the old picture is magnified: everything drifts
  // outwards from the centre while it fades
  float a = 0.006 * sin(time * 0.4);
  mat2 twist = mat2(cos(a), sin(a), -sin(a), cos(a));
  vec2 uv = twist * (vUv - 0.5) * 0.995 + 0.5;

  // 3x3 blur, weights 4-2-1 (they add up to 1)
  vec2 d = texel * 1.5;
  vec3 c = texture(map, uv).rgb * 0.25;
  c += (texture(map, uv + vec2(d.x, 0.0)).rgb
      + texture(map, uv - vec2(d.x, 0.0)).rgb
      + texture(map, uv + vec2(0.0, d.y)).rgb
      + texture(map, uv - vec2(0.0, d.y)).rgb) * 0.125;
  c += (texture(map, uv + d).rgb
      + texture(map, uv - d).rgb
      + texture(map, uv + vec2(d.x, -d.y)).rgb
      + texture(map, uv + vec2(-d.x, d.y)).rgb) * 0.0625;

  fragColor = vec4(max(c * decay - bias, 0.0), 1.0);
}`;

let useFloat = true;
function createTarget() {
  const target = new RenderTarget(canvas.width || 1, canvas.height || 1, {
    float: useFloat,
    depth: DepthAttachment.NONE,
  });
  // the feedback pass samples between texels when it zooms
  target.colorAttachment.minFilter = Filter.LINEAR;
  target.colorAttachment.magFilter = Filter.LINEAR;
  return target;
}

let targets = [createTarget(), createTarget()];
// 8 bit targets round small values to nothing slowly, so they need a
// bigger constant fade to not leave a ghost behind
const feedbackMaterial = createFullscreenMaterial(feedbackFragment, {
  map: targets[0].colorAttachment,
  texel: [1, 1],
  time: 0,
  decay: 0.965,
  bias: 0.0004,
});
const feedbackScene = new Scene();
feedbackScene.add(createFullscreenMesh(feedbackMaterial));

const displayMaterial = createToneMapMaterial({
  map: targets[0].colorAttachment,
  toneMapping: 'aces',
});
const displayScene = new Scene();
displayScene.add(createFullscreenMesh(displayMaterial));

const camera = new PerspectiveCamera();

function resize() {
  const { innerWidth: width, innerHeight: height } = window;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)).setSize(width, height);
  for (const target of targets) {
    // the renderer rebuilds the framebuffers at the new size; the trails
    // start over
    target.width = canvas.width;
    target.height = canvas.height;
  }
  feedbackMaterial.uniforms.texel = [1 / canvas.width, 1 / canvas.height];
  curveMaterial.uniforms.aspect = canvas.width / canvas.height;
}
window.addEventListener('resize', resize);
canvas.addEventListener('click', () => {
  curveMaterial.uniforms.seed = Math.random() * 100;
});
resize();

// ------------------------------------------------------------- frame

const clock = new Stopwatch().start();
let read = 0;

function drawFrame() {
  const time = clock.elapsedTime / 1000;
  const [from, to] = [targets[read], targets[1 - read]];

  // 1. the previous frame, moved, blurred and faded, into the other target
  feedbackMaterial.uniforms.map = from.colorAttachment;
  feedbackMaterial.uniforms.time = time;
  renderer.render(feedbackScene, camera, to);

  // 2. this frame's curve on top of it
  curveMaterial.uniforms.time = time;
  renderer.render(curveScene, camera, to);

  // 3. show the result
  displayMaterial.uniforms.map = to.colorAttachment;
  renderer.render(displayScene, camera);

  read = 1 - read;
}

function frame() {
  drawFrame();
  requestAnimationFrame(frame);
}

try {
  drawFrame();
  status.textContent = `Two ${canvas.width}×${canvas.height} float targets.`;
} catch (error) {
  if (!/EXT_color_buffer_float/.test(error.message)) {
    throw error;
  }
  // no EXT_color_buffer_float: 8 bit targets, where the glow clips
  useFloat = false;
  targets = [createTarget(), createTarget()];
  feedbackMaterial.uniforms.bias = 0.004;
  resize();
  status.textContent = `Float targets are not supported here (${error.message}); using 8 bits.`;
}
requestAnimationFrame(frame);
