import { BufferAttribute, BufferGeometry } from '../../geometries';
import { denormalize } from '../../geometries/buffer-geometry';
import type { TypedArray } from '../../geometries/buffer-geometry';
import { Box3, Color, Vector, calculateSurfaceNormal } from '../../utils';
import {
  AlphaMode,
  ColorSpace,
  DirectionalLight,
  DrawMode,
  Filter,
  Mesh,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  PointLight,
  Scene,
  Texture,
  Wrapping,
  createPbrMaterial,
} from '../../scene';
import type {
  Camera,
  Light,
  Material,
  PbrMap,
  PbrMaterialOptions,
  TextureData,
} from '../../scene';
import { getBufferView, readAccessor, readIndices } from './accessors';
import type { GltfBuffers } from './accessors';
import { isGlb, parseGlb } from './glb';
import type {
  GltfJson,
  GltfMesh,
  GltfNode,
  GltfPrimitive,
  GltfTextureInfo,
} from './types';

/**
 * Options of {@link loadGltf} and {@link parseGltf}. Everything is
 * optional; the defaults load a file from the network in a browser.
 */
export type GltfLoaderOptions = {
  /**
   * URL that relative `uri`s of buffers and images are resolved against.
   * `loadGltf` defaults it to the file's own URL; `parseGltf` has no
   * default, so relative URIs are passed to `fetch` as they are.
   */
  baseUrl?: string;
  /** `fetch` implementation for buffers and images; the global one by default */
  fetch?: typeof globalThis.fetch;
  /**
   * Decode an image into something a {@link Texture} accepts. Called with a
   * `Blob` for images embedded in a buffer or a data URI, and with the
   * resolved URL otherwise. The default fetches URLs and decodes with
   * `createImageBitmap`; tests inject a stub so Node needs no DOM.
   */
  loadImage?: (source: Blob | string) => Promise<TextureData>;
};

/** What {@link loadGltf} and {@link parseGltf} return */
export type GltfResult = {
  /** the default scene of the file (or its first scene; empty if it has none) */
  scene: Scene;
  /** every scene of the file, by glTF index */
  scenes: Scene[];
  /** every node of the file as a scene graph object, by glTF index */
  nodes: Object3D[];
  /** the cameras found on nodes, in node order */
  cameras: Camera[];
  /** the `KHR_lights_punctual` lights found on nodes, in node order */
  lights: Light[];
  /**
   * every material the loader created: one per glTF material and per
   * combination of draw mode and vertex attributes it is used with (map
   * presence and vertex colours are baked into the shader source)
   */
  materials: Material[];
  /** every texture the loader created: one per glTF texture and colour space */
  textures: Texture[];
  /** the parsed JSON document, for anything the loader does not map */
  json: GltfJson;
};

/** Extensions the loader understands; others are warned about or rejected */
export const SUPPORTED_EXTENSIONS = [
  'KHR_lights_punctual',
  'KHR_materials_emissive_strength',
  'KHR_materials_unlit',
  'KHR_mesh_quantization',
];

/** glTF attribute semantics to magic-pixels attribute names */
const ATTRIBUTE_NAMES: Record<string, string> = {
  POSITION: 'position',
  NORMAL: 'normal',
  TANGENT: 'tangent',
  TEXCOORD_0: 'uv',
  TEXCOORD_1: 'uv1',
  COLOR_0: 'color',
  JOINTS_0: 'joints',
  WEIGHTS_0: 'weights',
};

/** glTF primitive `mode` to draw mode, by value (0..6) */
const DRAW_MODES: DrawMode[] = [
  DrawMode.POINTS,
  DrawMode.LINES,
  DrawMode.LINE_LOOP,
  DrawMode.LINE_STRIP,
  DrawMode.TRIANGLES,
  DrawMode.TRIANGLE_STRIP,
  DrawMode.TRIANGLE_FAN,
];

const FILTERS: Record<number, Filter> = {
  9728: Filter.NEAREST,
  9729: Filter.LINEAR,
  9984: Filter.NEAREST_MIPMAP_NEAREST,
  9985: Filter.LINEAR_MIPMAP_NEAREST,
  9986: Filter.NEAREST_MIPMAP_LINEAR,
  9987: Filter.LINEAR_MIPMAP_LINEAR,
};

const WRAPPINGS: Record<number, Wrapping> = {
  33071: Wrapping.CLAMP_TO_EDGE,
  33648: Wrapping.MIRRORED_REPEAT,
  10497: Wrapping.REPEAT,
};

const ALPHA_MODES: Record<string, AlphaMode> = {
  OPAQUE: AlphaMode.OPAQUE,
  MASK: AlphaMode.MASK,
  BLEND: AlphaMode.BLEND,
};

const RAD2DEG = 180 / Math.PI;

/**
 * Fetch a `.gltf` or `.glb` file and turn it into a scene. Relative URIs
 * inside the file are resolved against the file's URL unless
 * `options.baseUrl` says otherwise.
 */
export async function loadGltf(
  url: string,
  options: GltfLoaderOptions = {}
): Promise<GltfResult> {
  const response = await getFetch(options)(url);
  if (!response.ok) {
    throw Error(`glTF: fetching ${url} failed (${response.status})`);
  }
  const data = await response.arrayBuffer();
  return parseGltf(data, { ...options, baseUrl: options.baseUrl ?? url });
}

/**
 * Turn glTF data that is already in memory into a scene: the bytes of a
 * `.glb`, the bytes or text of a `.gltf`, or its parsed JSON. Buffers and
 * images referenced by URI are fetched relative to `options.baseUrl`.
 */
export async function parseGltf(
  data: string | ArrayBuffer | Uint8Array | GltfJson,
  options: GltfLoaderOptions = {}
): Promise<GltfResult> {
  let json: GltfJson;
  let bin: Uint8Array | null = null;
  if (typeof data === 'string') {
    json = JSON.parse(data) as GltfJson;
  } else if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
    if (isGlb(data)) {
      ({ json, bin } = parseGlb(data));
    } else {
      json = JSON.parse(new TextDecoder().decode(data)) as GltfJson;
    }
  } else {
    json = data;
  }
  return new GltfParser(json, bin, options).parse();
}

/**
 * Resolve a URI from a glTF file against the URL of the file. Data URIs
 * and absolute URLs pass through; a relative `baseUrl` (no scheme) is
 * joined textually so `fetch` resolves the result against the page.
 */
export function resolveUri(uri: string, baseUrl: string | undefined): string {
  if (baseUrl === undefined || isDataUri(uri)) {
    return uri;
  }
  try {
    return new URL(uri).href;
  } catch {
    // relative
  }
  try {
    return new URL(uri, baseUrl).href;
  } catch {
    return baseUrl.slice(0, baseUrl.lastIndexOf('/') + 1) + uri;
  }
}

function isDataUri(uri: string): boolean {
  return /^data:/i.test(uri);
}

/** Decode a data URI into its MIME type and bytes; `null` if it is not one */
export function parseDataUri(
  uri: string
): { mimeType: string; bytes: Uint8Array } | null {
  if (!isDataUri(uri)) {
    return null;
  }
  const comma = uri.indexOf(',');
  if (comma === -1) {
    throw Error('glTF: malformed data URI');
  }
  const parameters = uri.slice(5, comma).split(';');
  const mimeType = parameters[0] || 'text/plain';
  const payload = uri.slice(comma + 1);
  if (parameters.includes('base64')) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return { mimeType, bytes };
  }
  return {
    mimeType,
    bytes: new TextEncoder().encode(decodeURIComponent(payload)),
  };
}

function getFetch(options: GltfLoaderOptions): typeof globalThis.fetch {
  if (options.fetch) {
    return options.fetch;
  }
  if (typeof globalThis.fetch !== 'function') {
    throw Error('glTF: no fetch available; pass options.fetch');
  }
  return globalThis.fetch.bind(globalThis);
}

/** Copy bytes into a `Blob` (a `Blob` never aliases the source anyway) */
function toBlob(bytes: Uint8Array, type: string | undefined): Blob {
  return new Blob([bytes.slice()], type ? { type } : undefined);
}

/** The attributes of a primitive that change the material's shader */
type MaterialVariant = {
  drawMode: DrawMode;
  vertexColors: boolean;
  tangents: boolean;
  unlit: boolean;
};

/** A primitive turned into reusable geometry and material */
type PrimitiveParts = { geometry: BufferGeometry; material: Material };

/**
 * One parse of one document. Holds the caches that make instances share
 * geometries, materials and textures.
 */
class GltfParser {
  private readonly fetch: typeof globalThis.fetch | null;
  private readonly loadImage: (source: Blob | string) => Promise<TextureData>;
  private readonly baseUrl: string | undefined;

  private buffers: GltfBuffers = [];
  private readonly materials = new Map<string, Promise<Material>>();
  private readonly textures = new Map<string, Promise<Texture>>();
  private readonly images = new Map<number, Promise<TextureData>>();
  private readonly cameras: Camera[] = [];
  private readonly lights: Light[] = [];
  private readonly warnings = new Set<string>();

  constructor(
    private readonly json: GltfJson,
    private readonly bin: Uint8Array | null,
    options: GltfLoaderOptions
  ) {
    this.baseUrl = options.baseUrl;
    this.fetch =
      options.fetch ??
      (typeof globalThis.fetch === 'function'
        ? globalThis.fetch.bind(globalThis)
        : null);
    this.loadImage = options.loadImage ?? this.defaultLoadImage.bind(this);
  }

  async parse(): Promise<GltfResult> {
    const { json } = this;
    this.checkAsset();
    this.checkExtensions();
    this.buffers = await this.loadBuffers();

    // geometries first, and every material they need in parallel
    const meshes = await Promise.all(
      (json.meshes ?? []).map((mesh) =>
        Promise.all(mesh.primitives.map((p) => this.loadPrimitive(mesh, p)))
      )
    );
    const nodes = this.createNodes(meshes);
    const scenes = (json.scenes ?? []).map((def) => {
      const scene = new Scene();
      scene.name = def.name ?? '';
      for (const index of def.nodes ?? []) {
        scene.add(this.node(nodes, index));
      }
      return scene;
    });

    return {
      scene: scenes[json.scene ?? 0] ?? new Scene(),
      scenes,
      nodes,
      cameras: this.cameras,
      lights: this.lights,
      materials: await Promise.all(this.materials.values()),
      textures: await Promise.all(this.textures.values()),
      json,
    };
  }

  private warn(message: string): void {
    if (!this.warnings.has(message)) {
      this.warnings.add(message);
      console.warn(`glTF: ${message}`);
    }
  }

  private checkAsset(): void {
    const version = this.json.asset?.version;
    if (typeof version !== 'string' || version.split('.')[0] !== '2') {
      throw Error(`glTF: unsupported asset version ${version}`);
    }
  }

  private checkExtensions(): void {
    const { json } = this;
    for (const name of json.extensionsRequired ?? []) {
      if (!SUPPORTED_EXTENSIONS.includes(name)) {
        throw Error(
          `glTF: the file requires the unsupported extension ${name}`
        );
      }
    }
    for (const name of json.extensionsUsed ?? []) {
      if (!SUPPORTED_EXTENSIONS.includes(name)) {
        this.warn(`extension ${name} is not supported and is ignored`);
      }
    }
    if (json.animations?.length || json.skins?.length) {
      this.warn('animations and skins are not supported yet and are ignored');
    }
  }

  // ------------------------------------------------------------ resources

  private async fetchBytes(url: string): Promise<Uint8Array> {
    if (!this.fetch) {
      throw Error(
        `glTF: no fetch available to load ${url}; pass options.fetch`
      );
    }
    const response = await this.fetch(url);
    if (!response.ok) {
      throw Error(`glTF: fetching ${url} failed (${response.status})`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  private loadBuffers(): Promise<GltfBuffers> {
    return Promise.all(
      (this.json.buffers ?? []).map(async (buffer, index) => {
        if (buffer.uri === undefined) {
          if (!this.bin) {
            throw Error(
              `glTF: buffer ${index} has no uri and there is no GLB binary chunk`
            );
          }
          return this.bin;
        }
        const data = parseDataUri(buffer.uri);
        if (data) {
          return data.bytes;
        }
        return this.fetchBytes(resolveUri(buffer.uri, this.baseUrl));
      })
    );
  }

  private async defaultLoadImage(source: Blob | string): Promise<TextureData> {
    const blob =
      typeof source === 'string'
        ? toBlob(await this.fetchBytes(source), undefined)
        : source;
    return createImageBitmap(blob, {
      colorSpaceConversion: 'none',
      premultiplyAlpha: 'none',
    });
  }

  private getImage(index: number): Promise<TextureData> {
    let image = this.images.get(index);
    if (!image) {
      image = this.createImage(index);
      this.images.set(index, image);
    }
    return image;
  }

  private createImage(index: number): Promise<TextureData> {
    const def = this.json.images?.[index];
    if (!def) {
      throw Error(`glTF: image ${index} does not exist`);
    }
    if (def.bufferView !== undefined) {
      const bytes = getBufferView(this.json, def.bufferView, this.buffers);
      return this.loadImage(toBlob(bytes, def.mimeType));
    }
    if (def.uri !== undefined) {
      const data = parseDataUri(def.uri);
      if (data) {
        return this.loadImage(
          toBlob(data.bytes, def.mimeType ?? data.mimeType)
        );
      }
      return this.loadImage(resolveUri(def.uri, this.baseUrl));
    }
    throw Error(`glTF: image ${index} has neither a uri nor a bufferView`);
  }

  /** One `Texture` per glTF texture and colour space */
  private getTexture(index: number, colorSpace: ColorSpace): Promise<Texture> {
    const key = `${index}:${colorSpace}`;
    let texture = this.textures.get(key);
    if (!texture) {
      texture = this.createTexture(index, colorSpace);
      this.textures.set(key, texture);
    }
    return texture;
  }

  private async createTexture(
    index: number,
    colorSpace: ColorSpace
  ): Promise<Texture> {
    const def = this.json.textures?.[index];
    if (!def) {
      throw Error(`glTF: texture ${index} does not exist`);
    }
    if (def.source === undefined) {
      throw Error(`glTF: texture ${index} has no source image`);
    }
    const sampler =
      def.sampler !== undefined ? this.json.samplers?.[def.sampler] : undefined;
    const image = await this.getImage(def.source);
    return new Texture(image, {
      magFilter: lookup(FILTERS, sampler?.magFilter ?? 9729, 'magFilter'),
      minFilter: lookup(FILTERS, sampler?.minFilter ?? 9987, 'minFilter'),
      wrapS: lookup(WRAPPINGS, sampler?.wrapS ?? 10497, 'wrapS'),
      wrapT: lookup(WRAPPINGS, sampler?.wrapT ?? 10497, 'wrapT'),
      colorSpace,
      flipY: false,
    });
  }

  private async getMap(
    info: GltfTextureInfo | undefined,
    colorSpace: ColorSpace
  ): Promise<PbrMap | undefined> {
    if (!info) {
      return undefined;
    }
    const texture = await this.getTexture(info.index, colorSpace);
    const texCoord = info.texCoord ?? 0;
    if (texCoord !== 0 && texCoord !== 1) {
      this.warn(`texCoord ${texCoord} is not supported, using TEXCOORD_0`);
    }
    return { texture, uv: texCoord === 1 ? 1 : 0 };
  }

  // ------------------------------------------------------------ materials

  /** One material per glTF material and variant */
  private getMaterial(
    index: number | undefined,
    variant: MaterialVariant
  ): Promise<Material> {
    const key = [
      index ?? 'default',
      variant.drawMode,
      +variant.vertexColors,
      +variant.tangents,
      +variant.unlit,
    ].join(':');
    let material = this.materials.get(key);
    if (!material) {
      material = this.createMaterial(index, variant);
      this.materials.set(key, material);
    }
    return material;
  }

  private async createMaterial(
    index: number | undefined,
    variant: MaterialVariant
  ): Promise<Material> {
    const def = index !== undefined ? this.json.materials?.[index] : undefined;
    if (index !== undefined && !def) {
      throw Error(`glTF: material ${index} does not exist`);
    }
    const pbr = def?.pbrMetallicRoughness ?? {};
    const extensions = def?.extensions ?? {};
    const emissiveStrength =
      extensions.KHR_materials_emissive_strength?.emissiveStrength ?? 1;
    const alphaMode = def?.alphaMode ?? 'OPAQUE';
    if (!(alphaMode in ALPHA_MODES)) {
      throw Error(
        `glTF: material ${index} has an unknown alphaMode ${alphaMode}`
      );
    }
    const [
      baseColorMap,
      metallicRoughnessMap,
      normalMap,
      occlusionMap,
      emissiveMap,
    ] = await Promise.all([
      this.getMap(pbr.baseColorTexture, ColorSpace.SRGB),
      this.getMap(pbr.metallicRoughnessTexture, ColorSpace.LINEAR),
      this.getMap(def?.normalTexture, ColorSpace.LINEAR),
      this.getMap(def?.occlusionTexture, ColorSpace.LINEAR),
      this.getMap(def?.emissiveTexture, ColorSpace.SRGB),
    ]);
    const options: PbrMaterialOptions = {
      baseColorFactor: pbr.baseColorFactor,
      baseColorMap,
      metallicFactor: pbr.metallicFactor,
      roughnessFactor: pbr.roughnessFactor,
      metallicRoughnessMap,
      normalMap,
      normalScale: def?.normalTexture?.scale,
      occlusionMap,
      occlusionStrength: def?.occlusionTexture?.strength,
      emissiveFactor: (def?.emissiveFactor ?? [0, 0, 0]).map(
        (c) => c * emissiveStrength
      ),
      emissiveMap,
      alphaMode: ALPHA_MODES[alphaMode],
      alphaCutoff: def?.alphaCutoff,
      doubleSided: def?.doubleSided,
      unlit: variant.unlit || extensions.KHR_materials_unlit !== undefined,
      vertexColors: variant.vertexColors,
      tangents: variant.tangents,
    };
    const material = createPbrMaterial(options);
    material.drawMode = variant.drawMode;
    return material;
  }

  // ------------------------------------------------------------ geometry

  private async loadPrimitive(
    mesh: GltfMesh,
    primitive: GltfPrimitive
  ): Promise<PrimitiveParts> {
    const mode = primitive.mode ?? 4;
    const drawMode = DRAW_MODES[mode];
    if (!drawMode) {
      throw Error(
        `glTF: mesh "${mesh.name ?? ''}" uses unknown primitive mode ${mode}`
      );
    }
    const geometry = new BufferGeometry();
    for (const [semantic, accessor] of Object.entries(primitive.attributes)) {
      const name = ATTRIBUTE_NAMES[semantic] ?? semantic.toLowerCase();
      geometry.setAttribute(
        name,
        readAccessor(this.json, accessor, this.buffers)
      );
    }
    if (primitive.indices !== undefined) {
      const indices = readIndices(this.json, primitive.indices, this.buffers);
      geometry.setIndex(indices, indices instanceof Uint32Array ? 32 : 16);
    }
    if (!geometry.attributes.position) {
      this.warn(`mesh "${mesh.name ?? ''}" has a primitive without POSITION`);
    }
    if (primitive.targets?.length) {
      this.warn('morph targets are not supported yet and are ignored');
    }
    const hasNormals = 'normal' in geometry.attributes;
    if (!hasNormals && drawMode === DrawMode.TRIANGLES) {
      computeFlatNormals(geometry);
    }
    setBoundingBox(geometry, this.json, primitive.attributes.POSITION);
    const materialDef =
      primitive.material !== undefined
        ? this.json.materials?.[primitive.material]
        : undefined;
    const material = await this.getMaterial(primitive.material, {
      drawMode,
      vertexColors: 'color' in geometry.attributes,
      tangents:
        'tangent' in geometry.attributes &&
        materialDef?.normalTexture !== undefined,
      // points and lines without normals cannot be lit
      unlit: !hasNormals && !('normal' in geometry.attributes),
    });
    return { geometry, material };
  }

  // ------------------------------------------------------------ nodes

  private createNodes(meshes: PrimitiveParts[][]): Object3D[] {
    const defs = this.json.nodes ?? [];
    const nodes = defs.map((def, index) => this.createNode(def, index, meshes));
    defs.forEach((def, index) => {
      for (const child of def.children ?? []) {
        nodes[index].add(this.node(nodes, child));
      }
    });
    return nodes;
  }

  private node(nodes: Object3D[], index: number): Object3D {
    const node = nodes[index];
    if (!node) {
      throw Error(`glTF: node ${index} does not exist`);
    }
    return node;
  }

  /**
   * A node with a single part (one mesh primitive, a camera or a light)
   * becomes that part; anything else becomes an `Object3D` with the parts
   * as children.
   */
  private createNode(
    def: GltfNode,
    index: number,
    meshes: PrimitiveParts[][]
  ): Object3D {
    const parts: Object3D[] = [];
    if (def.mesh !== undefined) {
      const meshDef = this.json.meshes?.[def.mesh];
      const primitives = meshes[def.mesh];
      if (!meshDef || !primitives) {
        throw Error(`glTF: node ${index} references missing mesh ${def.mesh}`);
      }
      for (const { geometry, material } of primitives) {
        const mesh = new Mesh(geometry, material);
        mesh.name = meshDef.name ?? '';
        parts.push(mesh);
      }
    }
    if (def.camera !== undefined) {
      const camera = this.createCamera(def.camera);
      this.cameras.push(camera);
      parts.push(camera);
    }
    const lightIndex = def.extensions?.KHR_lights_punctual?.light;
    if (lightIndex !== undefined) {
      const light = this.createLight(lightIndex);
      this.lights.push(light);
      parts.push(light);
    }
    let object: Object3D;
    if (parts.length === 1) {
      object = parts[0];
    } else {
      object = new Object3D();
      object.add(...parts);
    }
    if (def.name !== undefined) {
      object.name = def.name;
    }
    applyTransform(object, def);
    return object;
  }

  private createCamera(index: number): Camera {
    const def = this.json.cameras?.[index];
    if (!def) {
      throw Error(`glTF: camera ${index} does not exist`);
    }
    let camera: Camera;
    if (def.type === 'perspective' && def.perspective) {
      const { yfov, aspectRatio, znear, zfar } = def.perspective;
      camera = new PerspectiveCamera(
        yfov * RAD2DEG,
        aspectRatio ?? 1,
        znear,
        zfar
      );
    } else if (def.type === 'orthographic' && def.orthographic) {
      const { xmag, ymag, znear, zfar } = def.orthographic;
      camera = new OrthographicCamera(-xmag, xmag, ymag, -ymag, znear, zfar);
    } else {
      throw Error(`glTF: camera ${index} has an unknown type ${def.type}`);
    }
    camera.name = def.name ?? '';
    return camera;
  }

  private createLight(index: number): Light {
    const def = this.json.extensions?.KHR_lights_punctual?.lights?.[index];
    if (!def) {
      throw Error(`glTF: KHR_lights_punctual light ${index} does not exist`);
    }
    const [r, g, b] = def.color ?? [1, 1, 1];
    const color = new Color(r * 255, g * 255, b * 255);
    // the PBR shader leaves out the BRDF's 1/π, so intensities are divided
    // by π to render as the specification intends
    const intensity = (def.intensity ?? 1) / Math.PI;
    let light: Light;
    switch (def.type) {
      case 'directional':
        light = new DirectionalLight(color, intensity);
        break;
      case 'spot':
        this.warn(
          `spot lights are not supported; light ${index} is loaded as a point light`
        );
        light = new PointLight(color, intensity, def.range ?? 0);
        break;
      case 'point':
        light = new PointLight(color, intensity, def.range ?? 0);
        break;
      default:
        throw Error(`glTF: light ${index} has an unknown type ${def.type}`);
    }
    light.name = def.name ?? '';
    return light;
  }
}

function lookup<T>(table: Record<number, T>, value: number, what: string): T {
  const result = table[value];
  if (result === undefined) {
    throw Error(`glTF: unknown ${what} value ${value}`);
  }
  return result;
}

/**
 * glTF requires `min` and `max` on every position accessor, so the
 * geometry's bounding box comes for free, without a pass over the
 * vertices. The values are stored in the accessor's component type, so a
 * quantized accessor's box is mapped like its data.
 */
function setBoundingBox(
  geometry: BufferGeometry,
  json: GltfJson,
  accessorIndex: number | undefined
): void {
  const accessor =
    accessorIndex !== undefined ? json.accessors?.[accessorIndex] : undefined;
  const position = geometry.attributes.position;
  if (!accessor?.min || !accessor.max || !position) {
    return;
  }
  const map = (values: number[]) =>
    values.map((v) => denormalize(v, position.data, position.normalized));
  const [x0, y0, z0] = map(accessor.min);
  const [x1, y1, z1] = map(accessor.max);
  if (![x0, y0, z0, x1, y1, z1].every(Number.isFinite)) {
    return;
  }
  geometry.boundingBox = new Box3(
    new Vector(x0, y0, z0),
    new Vector(x1, y1, z1)
  );
}

/**
 * Apply a node's transform: TRS into `position`, `quaternion` and `scale`,
 * or a `matrix` straight into `localMatrix` with automatic updates off.
 */
function applyTransform(object: Object3D, def: GltfNode): void {
  if (def.matrix) {
    object.matrixAutoUpdate = false;
    object.localMatrix.set(def.matrix);
    object.worldMatrixNeedsUpdate = true;
    return;
  }
  if (def.translation) {
    const [x, y, z] = def.translation;
    object.position.set(x, y, z);
  }
  if (def.rotation) {
    const [x, y, z, w] = def.rotation;
    object.quaternion.set(x, y, z, w);
  }
  if (def.scale) {
    const [x, y, z] = def.scale;
    object.scale.set(x, y, z);
  }
}

/**
 * Give a triangle geometry without normals flat ones: every vertex gets
 * the normal of its triangle. Vertices shared between triangles cannot
 * hold two normals, so an indexed geometry is expanded into one vertex
 * per index first.
 */
export function computeFlatNormals(geometry: BufferGeometry): void {
  if (geometry.index) {
    deindex(geometry);
  }
  const position = geometry.attributes.position;
  if (!position || position.recordSize !== 3) {
    return;
  }
  const p = position.data;
  const count = position.count;
  const normals = new Float32Array(count * 3);
  for (let i = 0; i + 2 < count; i += 3) {
    const normal = calculateSurfaceNormal(
      new Vector(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]),
      new Vector(p[i * 3 + 3], p[i * 3 + 4], p[i * 3 + 5]),
      new Vector(p[i * 3 + 6], p[i * 3 + 7], p[i * 3 + 8])
    );
    // a degenerate triangle has no normal; leave it at zero
    const values = Number.isFinite(normal.x)
      ? [normal.x, normal.y, normal.z]
      : [0, 0, 0];
    for (let v = 0; v < 3; v++) {
      normals.set(values, (i + v) * 3);
    }
  }
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
}

/** Expand every attribute so that each index becomes its own vertex */
function deindex(geometry: BufferGeometry): void {
  const index = geometry.index;
  if (!index) {
    return;
  }
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    const { data, recordSize } = attribute;
    const Ctor = data.constructor as new (length: number) => TypedArray;
    const expanded = new Ctor(index.length * recordSize);
    for (let i = 0; i < index.length; i++) {
      const start = index[i] * recordSize;
      expanded.set(data.subarray(start, start + recordSize), i * recordSize);
    }
    geometry.setAttribute(
      name,
      new BufferAttribute(expanded, recordSize, attribute.normalized)
    );
  }
  geometry.index = null;
  geometry.indexType = 0;
  geometry.count = index.length;
  geometry.version++;
}
