import {
  WebGL2Renderer,
  Scene,
  Object3D,
  Mesh,
  PerspectiveCamera,
  AmbientLight,
  DirectionalLight,
  Vector,
  Stopwatch,
  loadGltf,
  parseGltf,
  computeBoundingSphere,
} from '../magic-pixels.js';

// ---------------------------------------------------------- models

const SAMPLES =
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/';
// Every load (a sample, a dropped file, or one of the two embedded
// models below) gets both decoder options: they only do anything for a
// file that actually carries the matching extension.
const sample = (name, path) => ({
  name,
  load: () => loadGltf(SAMPLES + path, decoderOptions()),
});

// A tiny box, quantized and compressed with `gltfpack -cc`
// (`EXT_meshopt_compression` + `KHR_mesh_quantization`), embedded as
// a `.glb` so this demo needs no server for it. `MeshoptDecoder` is
// the exact shape `options.meshopt` wants: `{ ready, decodeGltfBuffer }`.
const MESHOPT_BOX_GLB =
  'Z2xURgIAAAA8BwAASAYAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJnbHRmcGFjayAxLjIifSwiZXh0ZW5zaW9uc1VzZWQiOlsiS0hSX21lc2hfcXVhbnRpemF0aW9uIiwiRVhUX21lc2hvcHRfY29tcHJlc3Npb24iXSwiZXh0ZW5zaW9uc1JlcXVpcmVkIjpbIktIUl9tZXNoX3F1YW50aXphdGlvbiIsIkVYVF9tZXNob3B0X2NvbXByZXNzaW9uIl0sImJ1ZmZlcnMiOlt7ImJ5dGVMZW5ndGgiOjIxNn0seyJieXRlTGVuZ3RoIjozNjAsImV4dGVuc2lvbnMiOnsiRVhUX21lc2hvcHRfY29tcHJlc3Npb24iOnsiZmFsbGJhY2siOnRydWV9fX1dLCJidWZmZXJWaWV3cyI6W3siYnVmZmVyIjoxLCJieXRlT2Zmc2V0IjowLCJieXRlTGVuZ3RoIjo5NiwiYnl0ZVN0cmlkZSI6NCwidGFyZ2V0IjozNDk2MiwiZXh0ZW5zaW9ucyI6eyJFWFRfbWVzaG9wdF9jb21wcmVzc2lvbiI6eyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjAsImJ5dGVMZW5ndGgiOjYwLCJieXRlU3RyaWRlIjo0LCJtb2RlIjoiQVRUUklCVVRFUyIsImZpbHRlciI6Ik9DVEFIRURSQUwiLCJjb3VudCI6MjR9fX0seyJidWZmZXIiOjEsImJ5dGVPZmZzZXQiOjk2LCJieXRlTGVuZ3RoIjoxOTIsImJ5dGVTdHJpZGUiOjgsInRhcmdldCI6MzQ5NjIsImV4dGVuc2lvbnMiOnsiRVhUX21lc2hvcHRfY29tcHJlc3Npb24iOnsiYnVmZmVyIjowLCJieXRlT2Zmc2V0Ijo2MCwiYnl0ZUxlbmd0aCI6MTI0LCJieXRlU3RyaWRlIjo4LCJtb2RlIjoiQVRUUklCVVRFUyIsImNvdW50IjoyNH19fSx7ImJ1ZmZlciI6MSwiYnl0ZU9mZnNldCI6Mjg4LCJieXRlTGVuZ3RoIjo3MiwidGFyZ2V0IjozNDk2MywiZXh0ZW5zaW9ucyI6eyJFWFRfbWVzaG9wdF9jb21wcmVzc2lvbiI6eyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjE4NCwiYnl0ZUxlbmd0aCI6MjksImJ5dGVTdHJpZGUiOjIsIm1vZGUiOiJUUklBTkdMRVMiLCJjb3VudCI6MzZ9fX1dLCJhY2Nlc3NvcnMiOlt7ImJ1ZmZlclZpZXciOjAsImJ5dGVPZmZzZXQiOjAsImNvbXBvbmVudFR5cGUiOjUxMjAsImNvdW50IjoyNCwidHlwZSI6IlZFQzMiLCJub3JtYWxpemVkIjp0cnVlfSx7ImJ1ZmZlclZpZXciOjEsImJ5dGVPZmZzZXQiOjAsImNvbXBvbmVudFR5cGUiOjUxMjMsImNvdW50IjoyNCwidHlwZSI6IlZFQzMiLCJtaW4iOlswLDAsMF0sIm1heCI6WzE2MzgzLDE2MzgzLDE2MzgzXX0seyJidWZmZXJWaWV3IjoyLCJieXRlT2Zmc2V0IjowLCJjb21wb25lbnRUeXBlIjo1MTIzLCJjb3VudCI6MzYsInR5cGUiOiJTQ0FMQVIifV0sIm1hdGVyaWFscyI6W3sibmFtZSI6IlJlZCIsInBick1ldGFsbGljUm91Z2huZXNzIjp7ImJhc2VDb2xvckZhY3RvciI6WzAuODAwMDAwMDEyLDAsMCwxXSwibWV0YWxsaWNGYWN0b3IiOjB9fV0sIm1lc2hlcyI6W3sicHJpbWl0aXZlcyI6W3siYXR0cmlidXRlcyI6eyJOT1JNQUwiOjAsIlBPU0lUSU9OIjoxfSwiaW5kaWNlcyI6MiwibWF0ZXJpYWwiOjB9XX1dLCJub2RlcyI6W3sibWVzaCI6MCwidHJhbnNsYXRpb24iOlstMC41LC0wLjUsLTAuNV0sInNjYWxlIjpbNi4xMDM4ODgxNWUtMDUsNi4xMDM4ODgxNWUtMDUsNi4xMDM4ODgxNWUtMDVdfV0sInNjZW5lcyI6W3sibm9kZXMiOlswXX1dLCJzY2VuZSI6MH0gICDYAAAAQklOAKAFAADAAP7AwAAABP4FAMAAwP3+wMAAAP39AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH9/AKAFGSZAmYAEAAAFPz/A/359fn1+fX59fn1+wAwAAH1+BQAISEhIAAAABQAMzMx9fn1+fcwAAAB+fQUIQJmAZmYAAAUMwP/AfX59fn1+ff//AAB+fX59fn1+fQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/P/8/AADh8BDwEPAQ8BDwEPAQAHaHVmd4qYZliWiYAWkAAAAAAA==';

// The Khronos sample Box, Draco-compressed.
const DRACO_BOX_JSON = {
  asset: { generator: 'COLLADA2GLTF', version: '2.0' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [
    {
      children: [1],
      matrix: [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1],
    },
    { mesh: 0 },
  ],
  meshes: [
    {
      primitives: [
        {
          attributes: { NORMAL: 1, POSITION: 2 },
          indices: 0,
          mode: 4,
          material: 0,
          extensions: {
            KHR_draco_mesh_compression: {
              bufferView: 0,
              attributes: { NORMAL: 0, POSITION: 1 },
            },
          },
        },
      ],
      name: 'Mesh',
    },
  ],
  accessors: [
    {
      componentType: 5123,
      count: 36,
      max: [23],
      min: [0],
      type: 'SCALAR',
    },
    {
      componentType: 5126,
      count: 24,
      max: [1.007843137254902, 1.007843137254902, 1.007843137254902],
      min: [-1.007843137254902, -1.007843137254902, -1.007843137254902],
      type: 'VEC3',
    },
    {
      componentType: 5126,
      count: 24,
      max: [0.5004885197850513, 0.5004885197850513, 0.5004885197850513],
      min: [-0.5004885197850513, -0.5004885197850513, -0.5004885197850513],
      type: 'VEC3',
    },
  ],
  materials: [
    {
      pbrMetallicRoughness: {
        baseColorFactor: [0.800000011920929, 0, 0, 1],
        metallicFactor: 0,
        roughnessFactor: 1,
      },
      name: 'Red',
      emissiveFactor: [0, 0, 0],
      alphaMode: 'OPAQUE',
      doubleSided: false,
    },
  ],
  bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 118 }],
  buffers: [
    {
      byteLength: 120,
      uri: 'data:application/octet-stream;base64,RFJBQ08CAgEBAAAACAwBCwAAA19bCgEBEFUEXOONRgL/AAAAAQABAAkDAAECAQEJAwAAAwEBAQADAwEwARADACSWEwokBAAAAAD/BwAAAAAAvwAAAL8AAAC/AACAPwsGAwEBAQEBQAEA/wAAAH8AAAD/AqFBCAAA',
    },
  ],
  extensionsRequired: ['KHR_draco_mesh_compression'],
  extensionsUsed: ['KHR_draco_mesh_compression'],
};

// Both `options.draco` and `options.meshopt` decode in a pool of Web
// Workers instead of blocking the main thread, given a `{ decoderPath }`
// / `{ moduleUrl }` instead of an already-initialized decoder: each
// worker fetches and initializes the decoder itself, once, the first
// time it is asked to decode. Both objects are reused for every load
// below; magic-pixels spawns and disposes the actual workers per
// `parseGltf`/`loadGltf` call.
const DRACO_OPTIONS = {
  decoderPath: 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/',
};
const MESHOPT_OPTIONS = {
  moduleUrl:
    'https://cdn.jsdelivr.net/npm/meshoptimizer@1.2.0/meshopt_decoder.mjs',
};

// The loader options every load below passes: it only decodes a
// bufferView or primitive that actually carries the matching
// extension, so passing both unconditionally is what lets any
// sample, drop, or embedded model "just work".
function decoderOptions() {
  return { meshopt: MESHOPT_OPTIONS, draco: DRACO_OPTIONS };
}

const MODELS = [
  sample('Box', 'Box/glTF-Binary/Box.glb'),
  sample('BoxTextured', 'BoxTextured/glTF-Binary/BoxTextured.glb'),
  sample('BoxVertexColors', 'BoxVertexColors/glTF-Binary/BoxVertexColors.glb'),
  sample('BoxInterleaved', 'BoxInterleaved/glTF-Binary/BoxInterleaved.glb'),
  sample('Duck', 'Duck/glTF-Binary/Duck.glb'),
  sample('Suzanne (.gltf + .bin)', 'Suzanne/glTF/Suzanne.gltf'),
  sample('Lantern', 'Lantern/glTF-Binary/Lantern.glb'),
  sample('DamagedHelmet', 'DamagedHelmet/glTF-Binary/DamagedHelmet.glb'),
  sample('AntiqueCamera', 'AntiqueCamera/glTF-Binary/AntiqueCamera.glb'),
  sample(
    'NormalTangentMirrorTest',
    'NormalTangentMirrorTest/glTF-Binary/NormalTangentMirrorTest.glb'
  ),
  sample(
    'AlphaBlendModeTest',
    'AlphaBlendModeTest/glTF-Binary/AlphaBlendModeTest.glb'
  ),
  sample('OrientationTest', 'OrientationTest/glTF-Binary/OrientationTest.glb'),
  sample('Sponza (large, many files)', 'Sponza/glTF/Sponza.gltf'),
  {
    name: 'Box (EXT_meshopt_compression, embedded)',
    load: async () => {
      const bytes = Uint8Array.from(atob(MESHOPT_BOX_GLB), (c) =>
        c.charCodeAt(0)
      );
      return parseGltf(bytes, { meshopt: MESHOPT_OPTIONS });
    },
  },
  {
    name: 'Box (KHR_draco_mesh_compression, embedded)',
    load: async () => parseGltf(DRACO_BOX_JSON, { draco: DRACO_OPTIONS }),
  },
];

const select = document.getElementById('model');
MODELS.forEach(({ name }, index) => {
  const option = document.createElement('option');
  option.textContent = name;
  option.value = String(index);
  select.append(option);
});
// `?model=Duck` preselects a model by (the start of) its name
const requested = new URLSearchParams(location.search).get('model');
const presetIndex = requested
  ? MODELS.findIndex((m) => m.name.startsWith(requested))
  : -1;
select.value = String(presetIndex >= 0 ? presetIndex : 7);

// ----------------------------------------------------------- scene

const canvas = document.getElementById('canvas');
const renderer = new WebGL2Renderer(canvas);
renderer.setClearColor('#0b0d12');

const scene = new Scene();

// The loaded model hangs off a pivot that the mouse turns. A file's
// own `Scene` is an `Object3D`, so it can be a child like anything else.
const pivot = new Object3D();
scene.add(pivot);

const camera = new PerspectiveCamera(40, 1, 0.1, 100);
scene.add(camera);

// A headlight parented to the camera plus a fill from above; a file
// that brings its own KHR_lights_punctual lights adds to these.
const demoLights = new Object3D();
demoLights.add(new AmbientLight('#ffffff', 0.15));
const fill = new DirectionalLight('#dfe8ff', 0.4);
fill.position.set(-3, 5, 2);
fill.lookAt(new Vector(0, 0, 0));
demoLights.add(fill);
scene.add(demoLights);
const headlight = new DirectionalLight('#fff4e6', 0.9);
camera.add(headlight);
document.getElementById('lights').addEventListener('change', (e) => {
  demoLights.visible = headlight.visible = e.target.checked;
});

// --------------------------------------------------------- framing

// Centre the model under the pivot and back the camera off so that
// its bounding sphere fits the vertical field of view: a sphere of
// radius r fills a field of view fov from a distance of
// r / sin(fov / 2). The loader filled every geometry's bounding box
// from the file, so this costs one pass over the vertices for the
// sphere radii and a few matrix multiplications per mesh.
function frame(model) {
  const sphere = computeBoundingSphere(model);
  if (sphere.isEmpty) sphere.set(new Vector(0, 0, 0), 1);
  const { center, radius } = sphere;
  model.position.set(-center.x, -center.y, -center.z);
  const halfFov = (camera.fov / 2) * (Math.PI / 180);
  const distance = (radius / Math.sin(halfFov)) * 1.1;
  camera.position.set(0, radius * 0.25, distance);
  camera.near = distance / 100;
  camera.far = distance + radius * 4;
  camera.updateProjectionMatrix();
  camera.lookAt(new Vector(0, 0, 0));
}

// --------------------------------------------------------- loading

const status = document.getElementById('status');
let current = null;

function describe(name, result) {
  let meshes = 0;
  let vertices = 0;
  let triangles = 0;
  result.scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    meshes++;
    const { geometry } = object;
    vertices += geometry.attributes.position?.count ?? 0;
    if (object.material.drawMode === 'triangles') {
      triangles += geometry.count / 3;
    }
  });
  const plural = (n, word) =>
    `${n} ${n === 1 ? word : word + (word.endsWith('sh') ? 'es' : 's')}`;
  const parts = [
    plural(meshes, 'mesh'),
    `${vertices.toLocaleString()} vertices`,
    `${Math.round(triangles).toLocaleString()} triangles`,
    plural(result.materials.length, 'material'),
    plural(result.textures.length, 'texture'),
    plural(result.cameras.length, 'camera'),
    plural(result.lights.length, 'light'),
  ];
  return `${name}: ${parts.join(', ')}`;
}

// GPU resources belong to the renderer; free the previous model's
// before swapping it out.
function unload() {
  if (!current) return;
  current.scene.traverse((object) => {
    if (object instanceof Mesh) {
      renderer.dispose(object.geometry);
      renderer.dispose(object.material);
    }
  });
  for (const texture of current.textures) renderer.dispose(texture);
  pivot.remove(current.scene);
  current = null;
}

let loading = 0;
async function show(name, load) {
  const token = ++loading;
  status.textContent = `Loading ${name}…`;
  try {
    const result = await load();
    if (token !== loading) return; // superseded by a newer request
    unload();
    current = result;
    // measure the model while it is still a root, so its own space
    // is world space, then hang it off the (reset) pivot
    frame(result.scene);
    pivot.rotation.set(0, 0, 0);
    pivot.add(result.scene);
    status.textContent = describe(name, result);
  } catch (error) {
    status.textContent = `${name}: ${error.message}`;
    console.error(error);
  }
}

function showSample() {
  const model = MODELS[Number(select.value)];
  show(model.name, model.load);
}
select.addEventListener('change', showSample);
showSample();

// Dropped files never touch the network: a `fetch` that answers from
// the dropped `File`s by name serves the .gltf, its buffers and its
// images alike (the loader's default image decoder goes through it).
function showDropped(files) {
  console.log(
    'dropped',
    files.map((f) => f.name)
  );
  const byName = new Map(files.map((file) => [file.name, file]));
  const main = files.find((file) => /\.(gltf|glb)$/i.test(file.name));
  if (!main) {
    status.textContent = files.length
      ? `Drop a .glb or .gltf file (got ${files.map((f) => f.name).join(', ')})`
      : 'Drop a .glb or .gltf file';
    return;
  }
  const fetch = async (url) => {
    const name = decodeURIComponent(String(url).split('/').pop());
    const file = byName.get(name);
    return file
      ? new Response(file)
      : new Response(null, { status: 404, statusText: 'not dropped' });
  };
  show(main.name, () => loadGltf(main.name, { fetch, ...decoderOptions() }));
}
// A browser only allows a drop once `dragenter` is cancelled, not
// only `dragover`; without this listener some browsers silently
// refuse the drop (no `drop` event at all, so nothing to catch).
document.addEventListener('dragenter', (e) => {
  e.preventDefault();
  document.body.classList.add('dragging');
});
document.addEventListener('dragover', (e) => {
  e.preventDefault();
  document.body.classList.add('dragging');
});
document.addEventListener('dragleave', () => {
  document.body.classList.remove('dragging');
});
document.addEventListener('drop', (e) => {
  e.preventDefault();
  document.body.classList.remove('dragging');
  showDropped([...e.dataTransfer.files]);
});

// ----------------------------------------------------- interaction

let dragging = null;
let spin = true;
canvas.addEventListener('pointerdown', (e) => {
  dragging = { x: e.clientX, y: e.clientY };
  spin = false;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  pivot.rotation.y += (e.clientX - dragging.x) * 0.01;
  pivot.rotation.x += (e.clientY - dragging.y) * 0.01;
  dragging = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerup', () => (dragging = null));

function resize() {
  const { innerWidth: width, innerHeight: height } = window;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)).setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const clock = new Stopwatch().start();
let last = 0;
function tick() {
  const t = clock.elapsedTime / 1000;
  if (spin) pivot.rotation.y += (t - last) * 0.3;
  last = t;
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
