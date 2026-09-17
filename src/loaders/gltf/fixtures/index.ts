/**
 * Hand-written glTF documents for the loader tests, built with
 * {@link GltfBuilder}. Each function returns a fresh builder so a test can
 * take the document as JSON, as JSON with an external buffer, or as `.glb`.
 */
import { GltfBuilder, toDataUri } from './builder';
import type { DracoStubMesh } from './draco-stub';
import type { GltfJson } from '../types';

export { GltfBuilder, buildGlb, toDataUri, componentTypeOf } from './builder';
export { createDracoStub } from './draco-stub';
export type { DracoStubAttribute, DracoStubMesh } from './draco-stub';
export { createFakeDracoWorkerClass } from './draco-worker-stub';

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

/**
 * `KHR_mesh_quantization`: normalized `Int16` positions and `Uint8` UVs.
 * Quantization needs nothing beyond the typed attributes step (step 2);
 * this fixture only pins down that the loader accepts the extension
 * without warning and reads the quantized data correctly end to end.
 */
export function quantized(): GltfBuilder {
  const builder = new GltfBuilder({
    extensionsUsed: ['KHR_mesh_quantization'],
  });
  const position = builder.addData(
    new Int16Array([0, 0, 0, 32767, 0, 0, 0, 32767, 0]),
    'VEC3',
    { normalized: true, min: [0, 0, 0], max: [32767, 32767, 0] }
  );
  const uv = builder.addData(new Uint8Array([0, 0, 255, 0, 0, 255]), 'VEC2', {
    normalized: true,
  });
  const indices = builder.addData(new Uint16Array([0, 1, 2]), 'SCALAR');
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
 * `EXT_meshopt_compression`: one triangle, shaped like the bufferViews
 * `gltfpack -cc` produces (verified against real `gltfpack` output while
 * building this fixture) - an ATTRIBUTES view each for position and
 * normal, and a TRIANGLES view for the indices, every one redirected from
 * a data-less "fallback" buffer to the real, compressed one. The
 * "compressed" bytes here are just the decoded bytes themselves, so a
 * stub decoder that copies its `source` into `target` unchanged
 * reproduces the triangle; only the plumbing (which bufferView, which
 * buffer, which arguments) is under test, not meshopt's actual bitstream.
 * A NORMAL attribute keeps the loader from de-indexing the primitive
 * (normal-less triangles get flat normals computed, which drops the
 * index), so the decoded indices stay visible to assert on.
 */
export function meshoptCompressed(): GltfJson {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
  const indices = new Uint16Array([0, 1, 2]);
  const toBytes = (data: Float32Array | Uint16Array) =>
    new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const [positionBytes, normalBytes, indexBytes] = [
    toBytes(positions),
    toBytes(normals),
    toBytes(indices),
  ];
  const compressed = new Uint8Array(
    positionBytes.byteLength + normalBytes.byteLength + indexBytes.byteLength
  );
  compressed.set(positionBytes, 0);
  compressed.set(normalBytes, positionBytes.byteLength);
  compressed.set(indexBytes, positionBytes.byteLength + normalBytes.byteLength);
  const normalOffset = positionBytes.byteLength;
  const indexOffset = normalOffset + normalBytes.byteLength;
  return {
    asset: { version: '2.0' },
    extensionsUsed: ['EXT_meshopt_compression'],
    extensionsRequired: ['EXT_meshopt_compression'],
    buffers: [
      {
        byteLength: compressed.byteLength,
        uri: toDataUri(compressed, 'application/octet-stream'),
      },
      {
        // a fallback buffer with no data of its own: every bufferView
        // below is redirected to buffer 0 by its own extension
        byteLength: compressed.byteLength,
        extensions: { EXT_meshopt_compression: { fallback: true } },
      },
    ],
    bufferViews: [
      {
        buffer: 1,
        byteOffset: 0,
        byteLength: positionBytes.byteLength,
        byteStride: 12,
        target: 34962,
        extensions: {
          EXT_meshopt_compression: {
            buffer: 0,
            byteOffset: 0,
            byteLength: positionBytes.byteLength,
            byteStride: 12,
            mode: 'ATTRIBUTES',
            count: 3,
          },
        },
      },
      {
        buffer: 1,
        byteOffset: normalOffset,
        byteLength: normalBytes.byteLength,
        byteStride: 12,
        target: 34962,
        extensions: {
          EXT_meshopt_compression: {
            buffer: 0,
            byteOffset: normalOffset,
            byteLength: normalBytes.byteLength,
            byteStride: 12,
            mode: 'ATTRIBUTES',
            filter: 'OCTAHEDRAL',
            count: 3,
          },
        },
      },
      {
        buffer: 1,
        byteOffset: indexOffset,
        byteLength: indexBytes.byteLength,
        target: 34963,
        extensions: {
          EXT_meshopt_compression: {
            buffer: 0,
            byteOffset: indexOffset,
            byteLength: indexBytes.byteLength,
            byteStride: 2,
            mode: 'TRIANGLES',
            count: 3,
          },
        },
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
      { bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
    meshes: [
      {
        primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2 }],
      },
    ],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  };
}

/**
 * `KHR_draco_mesh_compression`: one triangle, shaped like real Draco
 * output (verified against `gltfpack`'s Draco Box sample) - the accessors
 * for `POSITION`/`NORMAL`/the indices carry shape (count, type) but no
 * `bufferView`, and the primitive's `KHR_draco_mesh_compression`
 * extension names the compressed bufferView and maps each semantic to its
 * Draco attribute id (`1` for position, `0` for normal, matching the
 * Khronos sample assets). The compressed bytes are a placeholder: the
 * matching `stubMesh` tells {@link createDracoStub} what to "decode"
 * regardless of bufferView content, so no real `.drc` bitstream is needed.
 */
export function dracoCompressed(): {
  document: GltfJson;
  stubMesh: DracoStubMesh;
} {
  const placeholder = new Uint8Array([0xda, 0xc0, 0x00]);
  const document: GltfJson = {
    asset: { version: '2.0' },
    extensionsUsed: ['KHR_draco_mesh_compression'],
    extensionsRequired: ['KHR_draco_mesh_compression'],
    buffers: [
      {
        byteLength: placeholder.byteLength,
        uri: toDataUri(placeholder, 'application/octet-stream'),
      },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: placeholder.byteLength },
    ],
    accessors: [
      { componentType: 5123, count: 3, type: 'SCALAR' },
      {
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
      { componentType: 5126, count: 3, type: 'VEC3' },
    ],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 1, NORMAL: 2 },
            indices: 0,
            extensions: {
              KHR_draco_mesh_compression: {
                bufferView: 0,
                attributes: { POSITION: 1, NORMAL: 0 },
              },
            },
          },
        ],
      },
    ],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  };
  const stubMesh: DracoStubMesh = {
    numPoints: 3,
    indices: [0, 1, 2],
    attributes: {
      1: {
        values: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        componentType: 5126,
        itemSize: 3,
      },
      0: {
        values: [0, 0, 1, 0, 0, 1, 0, 0, 1],
        componentType: 5126,
        itemSize: 3,
      },
    },
  };
  return { document, stubMesh };
}

/**
 * `KHR_draco_mesh_compression` where the accessor `count` of a
 * Draco-compressed attribute does not match the decoded mesh's own point
 * count - a real quirk of some exporters (seen from Blender's glTF/Draco
 * export path). `decodeDracoPrimitive()` must size its reads from the
 * decoder's own `num_points()`, not the accessor.
 */
export function dracoCompressedPointCountMismatch(): {
  document: GltfJson;
  stubMesh: DracoStubMesh;
} {
  const { document, stubMesh } = dracoCompressed();
  // the accessors claim 3 points; the stub mesh actually decodes to 4
  stubMesh.numPoints = 4;
  stubMesh.indices = [0, 1, 2, 1, 2, 3];
  stubMesh.attributes[1] = {
    values: [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0],
    componentType: 5126,
    itemSize: 3,
  };
  stubMesh.attributes[0] = {
    values: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    componentType: 5126,
    itemSize: 3,
  };
  return { document, stubMesh };
}

/**
 * `KHR_draco_mesh_compression` with a `TANGENT` accessor that sits
 * outside the extension's `attributes` map - a regular, uncompressed
 * accessor alongside the Draco-compressed `POSITION`/`NORMAL`, which is
 * what Blender's glTF exporter produces. `matchingCount: false` gives the
 * `TANGENT` accessor a different `count` than the Draco-decoded points,
 * another real quirk of the same exporter, which the loader must drop
 * (with a warning) rather than read out of bounds.
 */
export function dracoCompressedWithTangent(
  options: { matchingCount?: boolean } = {}
): { document: GltfJson; stubMesh: DracoStubMesh } {
  const { document, stubMesh } = dracoCompressed();
  const tangentCount = options.matchingCount === false ? 2 : 3;
  const tangents = new Float32Array(
    Array.from({ length: tangentCount }, () => [1, 0, 0, 1]).flat()
  );
  const tangentBytes = new Uint8Array(
    tangents.buffer,
    tangents.byteOffset,
    tangents.byteLength
  );
  // a second buffer, so this stays independent of the placeholder Draco
  // bytes in buffer 0
  document.buffers!.push({
    byteLength: tangentBytes.byteLength,
    uri: toDataUri(tangentBytes, 'application/octet-stream'),
  });
  const bufferView = document.bufferViews!.push({
    buffer: 1,
    byteOffset: 0,
    byteLength: tangentBytes.byteLength,
  });
  const accessor = document.accessors!.push({
    bufferView: bufferView - 1,
    componentType: 5126,
    count: tangentCount,
    type: 'VEC4',
  });
  document.meshes![0].primitives[0].attributes.TANGENT = accessor - 1;
  return { document, stubMesh };
}
