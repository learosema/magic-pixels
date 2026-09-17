import {
  AlphaMode,
  ColorSpace,
  DirectionalLight,
  DrawMode,
  Filter,
  Mesh,
  NullRenderer,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  PointLight,
  Scene,
  Side,
  Texture,
  Wrapping,
} from '../../scene';
import type { Material, TextureData } from '../../scene';
import {
  loadGltf,
  parseDataUri,
  parseGltf,
  resolveUri,
  SUPPORTED_EXTENSIONS,
} from './loader';
import type { GltfLoaderOptions } from './loader';
import {
  FAKE_PNG,
  GltfBuilder,
  TRIANGLE_POSITIONS,
  camerasAndLights,
  createDracoStub,
  createFakeDracoWorkerClass,
  dracoCompressed,
  dracoCompressedPointCountMismatch,
  dracoCompressedWithTangent,
  interleaved,
  materials,
  meshoptCompressed,
  nodeTree,
  quadWithoutNormals,
  quantized,
  triangle,
} from './fixtures';
import type { MeshoptDecoder } from './meshopt';

function fakeImage(): TextureData {
  return { width: 1, height: 1, data: new Uint8ClampedArray(4) } as ImageData;
}

/** An image loader stub that records what it was asked to decode */
function imageStub() {
  return vi.fn(async (_source: Blob | string) => fakeImage());
}

/** A `fetch` stub serving the given files by URL */
function fetchStub(files: Record<string, Uint8Array | object>) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    const file = files[url];
    if (file === undefined) {
      return new Response(null, { status: 404 });
    }
    const body =
      file instanceof Uint8Array ? file.slice() : JSON.stringify(file);
    return new Response(body, { status: 200 });
  }) as unknown as typeof fetch;
}

function defines(material: Material): string[] {
  return [
    ...material.glsl!.fragment.matchAll(/^#define (\S+)(?: (\S+))?$/gm),
  ].map(([, name, value]) => (value ? `${name} ${value}` : name));
}

function render(scene: Scene) {
  const renderer = new NullRenderer();
  renderer.render(scene, new PerspectiveCamera());
  return renderer.lastFrame!;
}

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  warn.mockRestore();
});

describe('parseGltf', () => {
  test('a triangle .gltf with a data URI buffer becomes one mesh', async () => {
    const result = await parseGltf(triangle().toJson());
    expect(result.scene).toBeInstanceOf(Scene);
    expect(result.scene.name).toBe('Main');
    expect(result.scenes).toHaveLength(1);
    expect(result.nodes).toHaveLength(1);
    expect(result.materials).toHaveLength(1);
    expect(result.textures).toHaveLength(0);
    expect(result.json.asset.version).toBe('2.0');

    const mesh = result.scene.children[0] as Mesh;
    expect(mesh).toBeInstanceOf(Mesh);
    expect(mesh).toBe(result.nodes[0]);
    expect(mesh.name).toBe('TriangleNode');
    const { geometry, material } = mesh;
    expect(Array.from(geometry.attributes.position.data)).toEqual(
      Array.from(TRIANGLE_POSITIONS)
    );
    expect(geometry.attributes.normal.count).toBe(3);
    expect(geometry.index).toBeInstanceOf(Uint16Array);
    expect(Array.from(geometry.index!)).toEqual([0, 1, 2]);
    expect(geometry.count).toBe(3);

    // the glTF default material: white, fully metallic, fully rough
    expect(material.uniforms.baseColorFactor).toEqual([1, 1, 1, 1]);
    expect(material.uniforms.metallicFactor).toBe(1);
    expect(material.uniforms.roughnessFactor).toBe(1);
    expect(material.drawMode).toBe(DrawMode.TRIANGLES);
    expect(material.side).toBe(Side.FRONT);
    expect(material.transparent).toBe(false);

    expect(render(result.scene).meshes).toEqual([mesh]);
    expect(warn).not.toHaveBeenCalled();
  });

  test('accepts JSON text, JSON bytes and a GLB', async () => {
    const builder = triangle();
    for (const data of [
      JSON.stringify(builder.toJson()),
      new TextEncoder().encode(JSON.stringify(builder.toJson())),
      builder.toGlb(),
      new Uint8Array(builder.toGlb()),
    ]) {
      const result = await parseGltf(data);
      const mesh = result.scene.children[0] as Mesh;
      expect(Array.from(mesh.geometry.attributes.position.data)).toEqual(
        Array.from(TRIANGLE_POSITIONS)
      );
    }
  });

  test('a buffer without a uri needs a GLB binary chunk', async () => {
    const json = triangle().toJsonWithUri('x.bin');
    delete json.buffers![0].uri;
    await expect(parseGltf(json)).rejects.toThrow(/binary chunk/);
  });

  test('rejects other asset versions and unsupported required extensions', async () => {
    await expect(parseGltf({ asset: { version: '1.0' } })).rejects.toThrow(
      /version 1.0/
    );
    await expect(
      parseGltf({
        asset: { version: '2.0' },
        extensionsRequired: ['KHR_texture_transform'],
      })
    ).rejects.toThrow(/KHR_texture_transform/);
  });

  test('warns about unsupported optional extensions, animations and skins', async () => {
    await parseGltf({
      asset: { version: '2.0' },
      extensionsUsed: [...SUPPORTED_EXTENSIONS, 'KHR_texture_transform'],
      animations: [{}],
    });
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).toMatch(/KHR_texture_transform/);
    expect(warn.mock.calls[1][0]).toMatch(/animations/);
  });

  test('a file without scenes yields an empty scene', async () => {
    const result = await parseGltf({ asset: { version: '2.0' } });
    expect(result.scene.children).toHaveLength(0);
    expect(result.scenes).toHaveLength(0);
  });
});

describe('loadGltf', () => {
  test('fetches the file and resolves relative URIs against it', async () => {
    const builder = triangle();
    const fetch = fetchStub({
      'https://example.com/models/tri.gltf': builder.toJsonWithUri('tri.bin'),
      'https://example.com/models/tri.bin': builder.bin,
    });
    const result = await loadGltf('https://example.com/models/tri.gltf', {
      fetch,
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenLastCalledWith(
      'https://example.com/models/tri.bin'
    );
    const mesh = result.scene.children[0] as Mesh;
    expect(Array.from(mesh.geometry.attributes.position.data)).toEqual(
      Array.from(TRIANGLE_POSITIONS)
    );
  });

  test('a relative file URL is joined textually', async () => {
    const builder = triangle();
    const fetch = fetchStub({
      'models/tri.gltf': builder.toJsonWithUri('data/tri.bin'),
      'models/data/tri.bin': builder.bin,
    });
    await loadGltf('models/tri.gltf', { fetch });
    expect(fetch).toHaveBeenLastCalledWith('models/data/tri.bin');
  });

  test('baseUrl overrides where buffers come from', async () => {
    const builder = triangle();
    const fetch = fetchStub({
      'https://a.example/tri.gltf': builder.toJsonWithUri('tri.bin'),
      'https://b.example/assets/tri.bin': builder.bin,
    });
    await loadGltf('https://a.example/tri.gltf', {
      fetch,
      baseUrl: 'https://b.example/assets/',
    });
    expect(fetch).toHaveBeenLastCalledWith('https://b.example/assets/tri.bin');
  });

  test('a failed fetch rejects with the status', async () => {
    const fetch = fetchStub({});
    await expect(
      loadGltf('https://example.com/nope.gltf', { fetch })
    ).rejects.toThrow(/404/);
    const builder = triangle();
    const partial = fetchStub({
      'https://example.com/tri.gltf': builder.toJsonWithUri('tri.bin'),
    });
    await expect(
      loadGltf('https://example.com/tri.gltf', { fetch: partial })
    ).rejects.toThrow(/tri.bin failed \(404\)/);
  });
});

describe('nodes', () => {
  test('TRS and matrix nodes, children and names', async () => {
    const { nodes, scene, scenes } = await parseGltf(nodeTree().toJson());
    expect(nodes).toHaveLength(5);
    const [root, matrixChild, twoPrimitives, instanceA, instanceB] = nodes;

    expect(root.name).toBe('Root');
    expect(root.position.toArray()).toEqual([1, 2, 3]);
    expect(root.quaternion.toArray()).toEqual([0, 0.7071068, 0, 0.7071068]);
    expect(root.scale.toArray()).toEqual([2, 2, 2]);
    expect(root.children).toEqual([matrixChild, twoPrimitives]);
    expect(root.matrixAutoUpdate).toBe(true);

    expect(matrixChild.matrixAutoUpdate).toBe(false);
    expect(matrixChild.worldMatrixNeedsUpdate).toBe(true);
    expect(matrixChild.localMatrix.values[13]).toBe(5);
    expect(matrixChild.children).toEqual([instanceA]);

    expect(scenes).toHaveLength(2);
    expect(scene).toBe(scenes[0]);
    expect(scene.name).toBe('Everything');
    expect(scene.children).toEqual([root, instanceB]);
    expect(scenes[1].children).toEqual([]);
  });

  test('a multi-primitive mesh becomes an Object3D with Mesh children', async () => {
    const { nodes } = await parseGltf(nodeTree().toJson());
    const pair = nodes[2];
    expect(pair).not.toBeInstanceOf(Mesh);
    expect(pair).toBeInstanceOf(Object3D);
    expect(pair.name).toBe('TwoPrimitives');
    expect(pair.children).toHaveLength(2);
    const [triangles, points] = pair.children as Mesh[];
    expect(triangles).toBeInstanceOf(Mesh);
    expect(triangles.name).toBe('Pair');
    expect(triangles.material.drawMode).toBe(DrawMode.TRIANGLES);
    // no NORMAL: flat normals were computed for the triangles ...
    expect(triangles.geometry.attributes.normal.count).toBe(3);
    // ... and the points, which cannot be lit, got the unlit variant
    expect(points.material.drawMode).toBe(DrawMode.POINTS);
    expect(defines(points.material)).toContain('UNLIT');
    expect(points.geometry.attributes.normal).toBeUndefined();
  });

  test('nodes instancing the same mesh share geometry and material', async () => {
    const { nodes, materials } = await parseGltf(nodeTree().toJson());
    const a = nodes[3] as Mesh;
    const b = nodes[4] as Mesh;
    expect(a.geometry).toBe(b.geometry);
    expect(a.material).toBe(b.material);
    expect(a.name).toBe('InstanceA');
    expect(b.name).toBe('InstanceB');
    // the default material in two variants: lit triangles (the flat
    // normals make the normal-less primitive a lit one too), unlit points
    expect(materials).toHaveLength(2);
  });

  test('world matrices compose through the tree', async () => {
    const { scene, nodes } = await parseGltf(nodeTree().toJson());
    const frame = render(scene);
    expect(frame.meshes).toHaveLength(4);
    // (0, 5, 0) scaled by 2, rotated 90° about Y, moved by (1, 2, 3)
    const [x, y, z] = Array.from(nodes[3].worldMatrix.values.slice(12, 15));
    expect(x).toBeCloseTo(1);
    expect(y).toBeCloseTo(12);
    expect(z).toBeCloseTo(3);
  });
});

describe('geometry', () => {
  test('a primitive without normals is de-indexed and gets flat normals', async () => {
    const { scene } = await parseGltf(quadWithoutNormals().toJson());
    const { geometry } = scene.children[0] as Mesh;
    expect(geometry.index).toBeNull();
    expect(geometry.count).toBe(6);
    const { position, normal, uv } = geometry.attributes;
    expect(position.count).toBe(6);
    expect(Array.from(position.data.slice(0, 9))).toEqual([
      0, 0, 0, 1, 0, 0, 1, 1, 0,
    ]);
    expect(normal.data).toBeInstanceOf(Float32Array);
    expect(Array.from(normal.data)).toEqual([
      0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
    ]);
    // other attributes keep their type and flags
    expect(uv.data).toBeInstanceOf(Uint8Array);
    expect(uv.normalized).toBe(true);
    expect(Array.from(uv.data)).toEqual([
      0, 0, 255, 0, 255, 255, 0, 0, 255, 255, 0, 255,
    ]);
  });

  test('interleaved attributes come out tightly packed', async () => {
    const { scene } = await parseGltf(interleaved().toJson());
    const { geometry } = scene.children[0] as Mesh;
    expect(geometry.attributes.position.count).toBe(3);
    expect(geometry.attributes.uv.count).toBe(3);
    expect(Array.from(geometry.attributes.uv.data)).toEqual([0, 0, 1, 0, 0, 1]);
  });
});

describe('materials and textures', () => {
  async function load(options: GltfLoaderOptions = {}) {
    const loadImage = imageStub();
    const result = await parseGltf(materials().toJson(), {
      loadImage,
      ...options,
    });
    const meshes = result.nodes as Mesh[];
    return { ...result, loadImage, meshes };
  }

  test('factors, maps and colour spaces of a material with every map', async () => {
    const { meshes } = await load();
    const material = meshes[0].material;
    const { uniforms } = material;
    expect(uniforms.baseColorFactor).toEqual([0.5, 0.25, 0.125, 1]);
    expect(uniforms.metallicFactor).toBe(0.25);
    expect(uniforms.roughnessFactor).toBe(0.75);
    expect(uniforms.normalScale).toBe(0.5);
    expect(uniforms.occlusionStrength).toBe(0.8);
    // KHR_materials_emissive_strength multiplies the factor
    expect(uniforms.emissiveFactor).toEqual([4, 2, 1]);

    const baseColor = uniforms.baseColorMap as Texture;
    const metallicRoughness = uniforms.metallicRoughnessMap as Texture;
    expect(baseColor).toBeInstanceOf(Texture);
    expect(baseColor.colorSpace).toBe(ColorSpace.SRGB);
    expect(metallicRoughness.colorSpace).toBe(ColorSpace.LINEAR);
    // the same glTF texture in two colour spaces: two textures, one image
    expect(baseColor).not.toBe(metallicRoughness);
    expect(baseColor.image).toBe(metallicRoughness.image);
    expect((uniforms.normalMap as Texture).colorSpace).toBe(ColorSpace.LINEAR);
    expect((uniforms.occlusionMap as Texture).colorSpace).toBe(
      ColorSpace.LINEAR
    );
    expect((uniforms.emissiveMap as Texture).colorSpace).toBe(ColorSpace.SRGB);
    expect(defines(material)).toContain('OCCLUSION_UV vUv1');
    expect(defines(material)).toContain('BASE_COLOR_UV vUv');
    expect(material.side).toBe(Side.FRONT);
    expect(material.transparent).toBe(false);
  });

  test('samplers map to filters and wrapping, with glTF defaults', async () => {
    const { meshes } = await load();
    const { uniforms } = meshes[0].material;
    const sampled = uniforms.baseColorMap as Texture;
    expect(sampled.magFilter).toBe(Filter.NEAREST);
    expect(sampled.minFilter).toBe(Filter.NEAREST_MIPMAP_NEAREST);
    expect(sampled.wrapS).toBe(Wrapping.CLAMP_TO_EDGE);
    expect(sampled.wrapT).toBe(Wrapping.MIRRORED_REPEAT);
    expect(sampled.flipY).toBe(false);
    const unsampled = uniforms.normalMap as Texture;
    expect(unsampled.magFilter).toBe(Filter.LINEAR);
    expect(unsampled.minFilter).toBe(Filter.LINEAR_MIPMAP_LINEAR);
    expect(unsampled.wrapS).toBe(Wrapping.REPEAT);
    expect(unsampled.wrapT).toBe(Wrapping.REPEAT);
  });

  test('images from a buffer view, a data URI and a URL', async () => {
    const { loadImage, textures } = await load({
      baseUrl: 'https://example.com/m/scene.gltf',
    });
    // three images, each decoded once however many textures use them
    expect(loadImage).toHaveBeenCalledTimes(3);
    const [embedded, external, inline] = loadImage.mock.calls.map(
      ([source]) => source
    );
    expect(embedded).toBeInstanceOf(Blob);
    expect((embedded as Blob).type).toBe('image/png');
    expect(new Uint8Array(await (embedded as Blob).arrayBuffer())).toEqual(
      FAKE_PNG
    );
    expect(external).toBe('https://example.com/m/textures/normal.png');
    expect(inline).toBeInstanceOf(Blob);
    expect((inline as Blob).type).toBe('image/png');
    expect(new Uint8Array(await (inline as Blob).arrayBuffer())).toEqual(
      FAKE_PNG
    );
    // one texture per glTF texture and colour space
    expect(textures).toHaveLength(5);
  });

  test('an embedded image is read out of a GLB binary chunk', async () => {
    const loadImage = imageStub();
    await parseGltf(materials().toGlb(), { loadImage });
    const blob = loadImage.mock.calls[0][0] as Blob;
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(FAKE_PNG);
  });

  test('unlit and blended: KHR_materials_unlit and alphaMode BLEND', async () => {
    const { meshes, scene } = await load();
    const material = meshes[1].material;
    expect(material.uniforms.baseColorFactor).toEqual([1, 0, 0, 0.5]);
    expect(material.transparent).toBe(true);
    expect(defines(material)).toContain('UNLIT');
    expect(defines(material)).toContain('ALPHA_BLEND');
    const frame = render(scene);
    expect(frame.transparent).toEqual([meshes[1]]);
    expect(frame.meshes).toHaveLength(3);
  });

  test('masked and double sided', async () => {
    const { meshes } = await load();
    const material = meshes[2].material;
    expect(material.uniforms.alphaCutoff).toBe(0.25);
    expect(material.side).toBe(Side.DOUBLE);
    expect(defines(material)).toContain('ALPHA_MASK');
    expect(defines(material)).toContain('DOUBLE_SIDED');
    expect(material.transparent).toBe(false);
  });

  test('vertex colours and tangents make a separate material variant', async () => {
    const { meshes, materials: all } = await load();
    const plain = meshes[0].material;
    const colored = meshes[3].material;
    expect(colored).not.toBe(plain);
    expect(defines(colored)).toContain('HAS_VERTEX_COLOR');
    expect(defines(colored)).toContain('HAS_TANGENT');
    expect(defines(plain)).not.toContain('HAS_VERTEX_COLOR');
    expect(defines(plain)).not.toContain('HAS_TANGENT');
    // both variants sample the same textures
    expect(colored.uniforms.baseColorMap).toBe(plain.uniforms.baseColorMap);
    expect(meshes[3].geometry.attributes.color.normalized).toBe(true);
    expect(meshes[3].geometry.attributes.tangent.recordSize).toBe(4);
    expect(meshes[3].geometry.attributes.uv1.count).toBe(3);
    // 2 variants of material 0, plus the unlit and the cutout one
    expect(all).toHaveLength(4);
  });

  test('the alpha mode of the default material is opaque', async () => {
    const { scene } = await parseGltf(triangle().toJson());
    const { material } = scene.children[0] as Mesh;
    expect(defines(material)).not.toContain('ALPHA_MASK');
    expect(defines(material)).not.toContain('ALPHA_BLEND');
    expect(material.uniforms.alphaCutoff).toBe(0.5);
    expect(AlphaMode.OPAQUE).toBe('opaque');
  });
});

describe('cameras and lights', () => {
  test('perspective and orthographic cameras', async () => {
    const { cameras, nodes } = await parseGltf(camerasAndLights().toJson());
    expect(cameras).toHaveLength(3);
    const persp = cameras[0] as PerspectiveCamera;
    expect(persp).toBeInstanceOf(PerspectiveCamera);
    expect(persp).toBe(nodes[0]);
    expect(persp.name).toBe('CameraNode');
    expect(persp.fov).toBeCloseTo(90);
    expect(persp.aspect).toBe(1.5);
    expect(persp.near).toBe(0.5);
    expect(persp.far).toBe(50);
    expect(persp.position.z).toBe(5);
    const ortho = cameras[1] as OrthographicCamera;
    expect(ortho).toBeInstanceOf(OrthographicCamera);
    expect([ortho.left, ortho.right, ortho.top, ortho.bottom]).toEqual([
      -4, 4, 3, -3,
    ]);
    expect(ortho.near).toBe(1);
    expect(ortho.far).toBe(10);
  });

  test('a perspective camera without zfar gets the default far plane', async () => {
    const builder = camerasAndLights();
    delete builder.json.cameras![0].perspective!.zfar;
    const { cameras } = await parseGltf(builder.toJson());
    expect((cameras[0] as PerspectiveCamera).far).toBe(
      new PerspectiveCamera().far
    );
  });

  test('KHR_lights_punctual lights, intensities divided by π', async () => {
    const { lights, nodes, scene } = await parseGltf(
      camerasAndLights().toJson()
    );
    expect(lights).toHaveLength(4);
    const sun = lights[0] as DirectionalLight;
    expect(sun).toBeInstanceOf(DirectionalLight);
    expect(sun).toBe(nodes[2]);
    expect(sun.name).toBe('SunNode');
    expect(sun.color.toVec3().map((c) => Math.round(c * 1000) / 1000)).toEqual([
      1, 0.5, 0.25,
    ]);
    expect(sun.intensity).toBeCloseTo(1);
    const bulb = lights[1] as PointLight;
    expect(bulb).toBeInstanceOf(PointLight);
    expect(bulb.intensity).toBeCloseTo(2);
    expect(bulb.range).toBe(8);
    expect(bulb.color.toVec3()).toEqual([1, 1, 1]);
    // spot lights are loaded as point lights, with a warning
    const spot = lights[2] as PointLight;
    expect(spot).toBeInstanceOf(PointLight);
    expect(spot.range).toBe(0);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/spot/));
    expect(render(scene).lights).toHaveLength(4);
  });

  test('a node holding a camera and a light becomes a group', async () => {
    const { nodes, cameras, lights } = await parseGltf(
      camerasAndLights().toJson()
    );
    const both = nodes[5];
    expect(both.constructor).toBe(Object3D);
    expect(both.name).toBe('Both');
    expect(both.children).toEqual([cameras[2], lights[3]]);
  });
});

describe('resolveUri', () => {
  test('resolves relative URIs against an absolute base', () => {
    expect(resolveUri('a.bin', 'https://x.example/m/s.gltf')).toBe(
      'https://x.example/m/a.bin'
    );
    expect(resolveUri('../a.bin', 'https://x.example/m/s.gltf')).toBe(
      'https://x.example/a.bin'
    );
  });

  test('joins textually with a relative base', () => {
    expect(resolveUri('a.bin', 'm/s.gltf')).toBe('m/a.bin');
    expect(resolveUri('a.bin', 's.gltf')).toBe('a.bin');
  });

  test('passes absolute URLs, data URIs and no base through', () => {
    expect(resolveUri('https://y.example/a.bin', 'm/s.gltf')).toBe(
      'https://y.example/a.bin'
    );
    expect(resolveUri('data:,x', 'https://x.example/s.gltf')).toBe('data:,x');
    expect(resolveUri('a.bin', undefined)).toBe('a.bin');
  });
});

describe('parseDataUri', () => {
  test('decodes base64 and percent-encoded payloads', () => {
    const b64 = parseDataUri('data:application/octet-stream;base64,AAEC');
    expect(b64?.mimeType).toBe('application/octet-stream');
    expect(Array.from(b64!.bytes)).toEqual([0, 1, 2]);
    const text = parseDataUri('data:,a%20b');
    expect(text?.mimeType).toBe('text/plain');
    expect(new TextDecoder().decode(text!.bytes)).toBe('a b');
  });

  test('returns null for other URIs', () => {
    expect(parseDataUri('a.bin')).toBeNull();
    expect(() => parseDataUri('data:nope')).toThrow(/malformed/);
  });
});

describe('bounding boxes', () => {
  test('come from the accessor min/max without a vertex scan', async () => {
    const { scene } = await parseGltf(triangle().toJson());
    const { geometry } = scene.children[0] as Mesh;
    expect(geometry.boundingBox).not.toBeNull();
    expect(geometry.boundingBox!.min.toArray()).toEqual([0, 0, 0]);
    expect(geometry.boundingBox!.max.toArray()).toEqual([1, 1, 0]);
    expect(geometry.boundingSphere).toBeNull();
  });

  test('are mapped for normalized (quantized) positions', async () => {
    const builder = new GltfBuilder();
    const position = builder.addData(
      new Int16Array([-32767, 0, 0, 32767, 0, 0, 0, 32767, 0]),
      'VEC3',
      { normalized: true, min: [-32767, 0, 0], max: [32767, 32767, 0] }
    );
    builder.json.meshes = [
      { primitives: [{ attributes: { POSITION: position } }] },
    ];
    builder.json.nodes = [{ mesh: 0 }];
    builder.json.scenes = [{ nodes: [0] }];
    const { scene } = await parseGltf(builder.toJson());
    const { geometry } = scene.children[0] as Mesh;
    expect(geometry.boundingBox!.min.toArray()).toEqual([-1, 0, 0]);
    expect(geometry.boundingBox!.max.toArray()).toEqual([1, 1, 0]);
  });

  test('are left for computeBoundingBox when the accessor has no min/max', async () => {
    const builder = interleaved();
    const { scene } = await parseGltf(builder.toJson());
    const { geometry } = scene.children[0] as Mesh;
    expect(geometry.boundingBox).toBeNull();
    expect(geometry.computeBoundingBox().max.toArray()).toEqual([1, 1, 0]);
  });
});

describe('compression', () => {
  test('KHR_mesh_quantization needs nothing beyond typed attributes', async () => {
    const result = await parseGltf(quantized().toJson());
    const { geometry } = result.scene.children[0] as Mesh;
    const { position, uv } = geometry.attributes;
    expect(position.data).toBeInstanceOf(Int16Array);
    expect(position.normalized).toBe(true);
    expect(Array.from(position.data)).toEqual([
      0, 0, 0, 32767, 0, 0, 0, 32767, 0,
    ]);
    // WebGL maps the stored Int16 to -1..1
    expect(position.getComponent(1, 0)).toBeCloseTo(1);
    expect(uv.data).toBeInstanceOf(Uint8Array);
    expect(Array.from(uv.data)).toEqual([0, 0, 255, 0, 0, 255]);
    expect(warn).not.toHaveBeenCalled();
  });

  function meshoptStub() {
    const calls: {
      count: number;
      size: number;
      source: Uint8Array;
      mode: string;
      filter?: string;
    }[] = [];
    const decoder: MeshoptDecoder = {
      ready: Promise.resolve(),
      decodeGltfBuffer(target, count, size, source, mode, filter) {
        calls.push({ count, size, source: source.slice(), mode, filter });
        target.set(source.subarray(0, target.byteLength));
      },
    };
    return { decoder, calls };
  }

  test('EXT_meshopt_compression decodes every compressed bufferView once', async () => {
    const { decoder, calls } = meshoptStub();
    const document = meshoptCompressed();
    const result = await parseGltf(document, { meshopt: decoder });
    const { geometry } = result.scene.children[0] as Mesh;
    expect(Array.from(geometry.attributes.position.data)).toEqual([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
    ]);
    expect(Array.from(geometry.attributes.normal.data)).toEqual([
      0, 0, 1, 0, 0, 1, 0, 0, 1,
    ]);
    expect(geometry.index).toBeInstanceOf(Uint16Array);
    expect(Array.from(geometry.index!)).toEqual([0, 1, 2]);

    expect(calls).toHaveLength(3);
    expect(calls[0]).toMatchObject({ mode: 'ATTRIBUTES', count: 3, size: 12 });
    expect(calls[1]).toMatchObject({
      mode: 'ATTRIBUTES',
      count: 3,
      size: 12,
      filter: 'OCTAHEDRAL',
    });
    expect(calls[2]).toMatchObject({ mode: 'TRIANGLES', count: 3, size: 2 });

    // the returned json is the original, compressed document, untouched
    expect(result.json).toBe(document);
    expect(
      result.json.bufferViews![0].extensions?.EXT_meshopt_compression
    ).toBeDefined();
  });

  test('a required EXT_meshopt_compression without a decoder names the option', async () => {
    await expect(parseGltf(meshoptCompressed())).rejects.toThrow(
      /options\.meshopt/
    );
  });

  test('KHR_draco_mesh_compression decodes attributes and indices, and frees every object', async () => {
    const { document, stubMesh } = dracoCompressed();
    const { module, calls } = createDracoStub(stubMesh);
    const result = await parseGltf(document, { draco: module });
    const { geometry } = result.scene.children[0] as Mesh;

    expect(Array.from(geometry.attributes.position.data)).toEqual([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
    ]);
    expect(Array.from(geometry.attributes.normal.data)).toEqual([
      0, 0, 1, 0, 0, 1, 0, 0, 1,
    ]);
    expect(geometry.index).toBeInstanceOf(Uint16Array);
    expect(Array.from(geometry.index!)).toEqual([0, 1, 2]);
    expect(geometry.boundingBox!.max.toArray()).toEqual([1, 1, 0]);

    // attributes were looked up by the extension's unique ids (1, 0)
    expect([...calls.attributeIds].sort()).toEqual([0, 1]);
    // the DecoderBuffer, the Decoder and the Mesh are each destroy()ed once
    expect(calls.destroyed).toBe(3);
    // one malloc/free per attribute plus one for the indices
    expect(calls.freed).toBe(3);
  });

  test('a required KHR_draco_mesh_compression without a decoder names the option', async () => {
    const { document } = dracoCompressed();
    await expect(parseGltf(document)).rejects.toThrow(/options\.draco/);
  });

  test('KHR_draco_mesh_compression decodes through a worker pool given { decoderPath }', async () => {
    const { document, stubMesh } = dracoCompressed();
    const { FakeWorker, calls } = createFakeDracoWorkerClass(stubMesh);
    vi.stubGlobal('Worker', FakeWorker);
    try {
      const result = await parseGltf(document, {
        draco: { decoderPath: 'https://example.test/' },
      });
      const { geometry } = result.scene.children[0] as Mesh;

      expect(Array.from(geometry.attributes.position.data)).toEqual([
        0, 0, 0, 1, 0, 0, 0, 1, 0,
      ]);
      expect(Array.from(geometry.index!)).toEqual([0, 1, 2]);
      expect(calls.constructed).toBe(1);
      // the pool is disposed once parseGltf's own primitives are all decoded
      expect(calls.terminated).toBe(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('Draco attributes are sized from the decoded mesh, not the accessor count', async () => {
    // some exporters write an accessor `count` that does not match the
    // number of points the Draco data actually decodes to
    const { document, stubMesh } = dracoCompressedPointCountMismatch();
    const { module } = createDracoStub(stubMesh);
    const result = await parseGltf(document, { draco: module });
    const { geometry } = result.scene.children[0] as Mesh;
    expect(geometry.attributes.position.count).toBe(4);
    expect(Array.from(geometry.attributes.position.data)).toEqual([
      0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0,
    ]);
    expect(Array.from(geometry.index!)).toEqual([0, 1, 2, 1, 2, 3]);
  });

  test('a plain accessor alongside Draco-compressed ones is read normally', async () => {
    // e.g. Blender's glTF exporter keeps TANGENT uncompressed
    const { document, stubMesh } = dracoCompressedWithTangent();
    const { module } = createDracoStub(stubMesh);
    const result = await parseGltf(document, { draco: module });
    const { geometry } = result.scene.children[0] as Mesh;
    expect(geometry.attributes.tangent.recordSize).toBe(4);
    expect(Array.from(geometry.attributes.tangent.data)).toEqual([
      1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1,
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  test('a mismatched plain accessor next to Draco-compressed ones is dropped with a warning', async () => {
    const { document, stubMesh } = dracoCompressedWithTangent({
      matchingCount: false,
    });
    const { module } = createDracoStub(stubMesh);
    const result = await parseGltf(document, { draco: module });
    const { geometry } = result.scene.children[0] as Mesh;
    expect(geometry.attributes.tangent).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/TANGENT.*dropped/)
    );
  });
});
