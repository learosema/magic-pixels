/**
 * Hand-written glTF documents for the loader tests, built with
 * {@link GltfBuilder}. Each function returns a fresh builder so a test can
 * take the document as JSON, as JSON with an external buffer, or as `.glb`.
 */
import { GltfBuilder, toDataUri } from './builder';

export { GltfBuilder, buildGlb, toDataUri, componentTypeOf } from './builder';

/** A right triangle in the XY plane, counter-clockwise */
export const TRIANGLE_POSITIONS = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);

/** Four bytes that stand in for an image file (the loader never decodes them) */
export const FAKE_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

/**
 * Add a mesh with one indexed triangle primitive (positions and normals,
 * 16 bit indices); returns the mesh index.
 */
export function addTriangleMesh(
  builder: GltfBuilder,
  options: { material?: number; name?: string } = {}
): number {
  const position = builder.addData(TRIANGLE_POSITIONS, 'VEC3', {
    min: [0, 0, 0],
    max: [1, 1, 0],
  });
  const normal = builder.addData(
    new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    'VEC3'
  );
  const indices = builder.addData(new Uint16Array([0, 1, 2]), 'SCALAR');
  builder.json.meshes ??= [];
  builder.json.meshes.push({
    name: options.name,
    primitives: [
      {
        attributes: { POSITION: position, NORMAL: normal },
        indices,
        ...(options.material !== undefined
          ? { material: options.material }
          : {}),
      },
    ],
  });
  return builder.json.meshes.length - 1;
}

/** One triangle, one node, one scene: the smallest useful file */
export function triangle(): GltfBuilder {
  const builder = new GltfBuilder();
  const mesh = addTriangleMesh(builder, { name: 'Triangle' });
  builder.json.nodes = [{ mesh, name: 'TriangleNode' }];
  builder.json.scenes = [{ nodes: [0], name: 'Main' }];
  builder.json.scene = 0;
  return builder;
}

/** A quad of two triangles sharing an edge, indexed, without normals */
export function quadWithoutNormals(): GltfBuilder {
  const builder = new GltfBuilder();
  const position = builder.addData(
    new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
    'VEC3'
  );
  const uv = builder.addData(
    new Uint8Array([0, 0, 255, 0, 255, 255, 0, 255]),
    'VEC2',
    {
      normalized: true,
    }
  );
  const indices = builder.addData(new Uint8Array([0, 1, 2, 0, 2, 3]), 'SCALAR');
  builder.json.meshes = [
    {
      primitives: [
        { attributes: { POSITION: position, TEXCOORD_0: uv }, indices },
      ],
    },
  ];
  builder.json.nodes = [{ mesh: 0 }];
  builder.json.scenes = [{ nodes: [0] }];
  return builder;
}

/**
 * Positions and UVs interleaved in one buffer view with a 20 byte stride:
 * `x y z u v | x y z u v | ...`
 */
export function interleaved(): GltfBuilder {
  const builder = new GltfBuilder();
  const vertices = new Float32Array([
    0,
    0,
    0,
    0,
    0, //
    1,
    0,
    0,
    1,
    0, //
    0,
    1,
    0,
    0,
    1,
  ]);
  const bufferView = builder.addBufferView(vertices, 20);
  const position = builder.addAccessor({
    bufferView,
    byteOffset: 0,
    componentType: 5126,
    count: 3,
    type: 'VEC3',
  });
  const uv = builder.addAccessor({
    bufferView,
    byteOffset: 12,
    componentType: 5126,
    count: 3,
    type: 'VEC2',
  });
  builder.json.meshes = [
    { primitives: [{ attributes: { POSITION: position, TEXCOORD_0: uv } }] },
  ];
  builder.json.nodes = [{ mesh: 0 }];
  builder.json.scenes = [{ nodes: [0] }];
  return builder;
}

/**
 * A sparse accessor: five zero vectors as the base (no buffer view), with
 * elements 1 and 3 replaced.
 */
export function sparse(): GltfBuilder {
  const builder = new GltfBuilder();
  const indices = builder.addBufferView(new Uint8Array([1, 3]));
  const values = builder.addBufferView(
    new Float32Array([10, 11, 12, 30, 31, 32])
  );
  builder.addAccessor({
    componentType: 5126,
    count: 5,
    type: 'VEC3',
    sparse: {
      count: 2,
      indices: { bufferView: indices, componentType: 5121 },
      values: { bufferView: values },
    },
  });
  return builder;
}

/**
 * A node tree: a root with a TRS transform, a child with a `matrix`, a
 * node with a two-primitive mesh, and two nodes instancing the same mesh.
 *
 * ```
 * Root (TRS)
 * ├── MatrixChild (matrix)
 * │   └── Instance A (mesh 0)
 * └── TwoPrimitives (mesh 1)
 * Instance B (mesh 0)
 * ```
 *
 * plus a second, empty scene.
 */
export function nodeTree(): GltfBuilder {
  const builder = new GltfBuilder();
  const triangle = addTriangleMesh(builder, { name: 'Tri' });
  const position = builder.addData(TRIANGLE_POSITIONS, 'VEC3');
  const points = builder.addData(new Float32Array([0, 0, 0, 1, 1, 1]), 'VEC3');
  builder.json.meshes!.push({
    name: 'Pair',
    primitives: [
      { attributes: { POSITION: position } },
      { attributes: { POSITION: points }, mode: 0 },
    ],
  });
  builder.json.nodes = [
    {
      name: 'Root',
      translation: [1, 2, 3],
      rotation: [0, 0.7071068, 0, 0.7071068],
      scale: [2, 2, 2],
      children: [1, 2],
    },
    {
      name: 'MatrixChild',
      // translation by (0, 5, 0), column-major
      matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 5, 0, 1],
      children: [3],
    },
    { name: 'TwoPrimitives', mesh: 1 },
    { name: 'InstanceA', mesh: triangle },
    { name: 'InstanceB', mesh: triangle, translation: [-1, 0, 0] },
  ];
  builder.json.scenes = [
    { name: 'Everything', nodes: [0, 4] },
    { name: 'Empty', nodes: [] },
  ];
  builder.json.scene = 0;
  return builder;
}

/**
 * Materials: one with every map (with an occlusion map on `TEXCOORD_1`),
 * an unlit blended one, a masked double-sided one, and a primitive with
 * vertex colours and tangents. Image 0 lives in a buffer view, image 1 is
 * an external file, image 2 a data URI.
 */
export function materials(): GltfBuilder {
  const builder = new GltfBuilder();
  const imageView = builder.addBufferView(FAKE_PNG);
  builder.json.images = [
    { bufferView: imageView, mimeType: 'image/png', name: 'embedded' },
    { uri: 'textures/normal.png', name: 'external' },
    { uri: toDataUri(FAKE_PNG, 'image/png'), name: 'inline' },
  ];
  builder.json.samplers = [
    { magFilter: 9728, minFilter: 9984, wrapS: 33071, wrapT: 33648 },
  ];
  builder.json.textures = [
    { source: 0, sampler: 0 },
    { source: 1 },
    { source: 2 },
  ];
  builder.json.materials = [
    {
      name: 'Everything',
      pbrMetallicRoughness: {
        baseColorFactor: [0.5, 0.25, 0.125, 1],
        baseColorTexture: { index: 0 },
        metallicFactor: 0.25,
        roughnessFactor: 0.75,
        metallicRoughnessTexture: { index: 0 },
      },
      normalTexture: { index: 1, scale: 0.5 },
      occlusionTexture: { index: 2, texCoord: 1, strength: 0.8 },
      emissiveTexture: { index: 2 },
      emissiveFactor: [1, 0.5, 0.25],
      extensions: { KHR_materials_emissive_strength: { emissiveStrength: 4 } },
    },
    {
      name: 'Unlit',
      pbrMetallicRoughness: { baseColorFactor: [1, 0, 0, 0.5] },
      alphaMode: 'BLEND',
      extensions: { KHR_materials_unlit: {} },
    },
    {
      name: 'Cutout',
      alphaMode: 'MASK',
      alphaCutoff: 0.25,
      doubleSided: true,
    },
  ];
  builder.json.extensionsUsed = [
    'KHR_materials_unlit',
    'KHR_materials_emissive_strength',
  ];
  const everything = addTriangleMesh(builder, { material: 0 });
  const unlit = addTriangleMesh(builder, { material: 1 });
  const cutout = addTriangleMesh(builder, { material: 2 });
  // a fourth mesh with vertex colours, tangents and a second UV set
  const position = builder.addData(TRIANGLE_POSITIONS, 'VEC3');
  const normal = builder.addData(
    new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    'VEC3'
  );
  const color = builder.addData(
    new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255]),
    'VEC3',
    { normalized: true }
  );
  const tangent = builder.addData(
    new Float32Array([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1]),
    'VEC4'
  );
  const uv1 = builder.addData(new Float32Array([0, 0, 1, 0, 0, 1]), 'VEC2');
  builder.json.meshes!.push({
    name: 'Colored',
    primitives: [
      {
        attributes: {
          POSITION: position,
          NORMAL: normal,
          COLOR_0: color,
          TANGENT: tangent,
          TEXCOORD_1: uv1,
        },
        material: 0,
      },
    ],
  });
  builder.json.nodes = [
    { mesh: everything },
    { mesh: unlit },
    { mesh: cutout },
    { mesh: 3 },
  ];
  builder.json.scenes = [{ nodes: [0, 1, 2, 3] }];
  return builder;
}

/** A perspective and an orthographic camera and the three punctual light types */
export function camerasAndLights(): GltfBuilder {
  const builder = new GltfBuilder({
    extensionsUsed: ['KHR_lights_punctual'],
    cameras: [
      {
        name: 'Persp',
        type: 'perspective',
        perspective: {
          yfov: Math.PI / 2,
          aspectRatio: 1.5,
          znear: 0.5,
          zfar: 50,
        },
      },
      {
        name: 'Ortho',
        type: 'orthographic',
        orthographic: { xmag: 4, ymag: 3, znear: 1, zfar: 10 },
      },
    ],
    extensions: {
      KHR_lights_punctual: {
        lights: [
          {
            name: 'Sun',
            type: 'directional',
            color: [1, 0.5, 0.25],
            intensity: Math.PI,
          },
          { name: 'Bulb', type: 'point', intensity: 2 * Math.PI, range: 8 },
          { name: 'Spot', type: 'spot', spot: { outerConeAngle: 0.5 } },
        ],
      },
    },
    nodes: [
      { name: 'CameraNode', camera: 0, translation: [0, 0, 5] },
      { name: 'OrthoNode', camera: 1 },
      { name: 'SunNode', extensions: { KHR_lights_punctual: { light: 0 } } },
      { name: 'BulbNode', extensions: { KHR_lights_punctual: { light: 1 } } },
      { name: 'SpotNode', extensions: { KHR_lights_punctual: { light: 2 } } },
      // a node that is a camera and a light at once becomes a group
      {
        name: 'Both',
        camera: 0,
        extensions: { KHR_lights_punctual: { light: 1 } },
      },
    ],
    scenes: [{ nodes: [0, 1, 2, 3, 4, 5] }],
  });
  return builder;
}
