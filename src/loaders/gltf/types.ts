/**
 * Typings for the subset of the glTF 2.0 JSON the loader reads. Every array
 * is optional in the file, indices point into the arrays of the same
 * document, and every object may carry `extensions` and `extras` that are
 * passed through untouched.
 *
 * See the glTF 2.0 specification for the meaning of each property:
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
 */

/** `{ index }` reference to a texture plus the UV set it samples */
export type GltfTextureInfo = {
  index: number;
  /** which `TEXCOORD_n` attribute the texture is mapped with, default 0 */
  texCoord?: number;
  extensions?: Record<string, unknown>;
};

export type GltfNormalTextureInfo = GltfTextureInfo & { scale?: number };
export type GltfOcclusionTextureInfo = GltfTextureInfo & { strength?: number };

export type GltfPbrMetallicRoughness = {
  baseColorFactor?: number[];
  baseColorTexture?: GltfTextureInfo;
  metallicFactor?: number;
  roughnessFactor?: number;
  metallicRoughnessTexture?: GltfTextureInfo;
};

export type GltfAlphaMode = 'OPAQUE' | 'MASK' | 'BLEND';

export type GltfMaterial = {
  name?: string;
  pbrMetallicRoughness?: GltfPbrMetallicRoughness;
  normalTexture?: GltfNormalTextureInfo;
  occlusionTexture?: GltfOcclusionTextureInfo;
  emissiveTexture?: GltfTextureInfo;
  emissiveFactor?: number[];
  alphaMode?: GltfAlphaMode;
  alphaCutoff?: number;
  doubleSided?: boolean;
  extensions?: {
    KHR_materials_unlit?: Record<string, never>;
    KHR_materials_emissive_strength?: { emissiveStrength?: number };
    [name: string]: unknown;
  };
};

export type GltfTexture = {
  name?: string;
  sampler?: number;
  source?: number;
  extensions?: Record<string, unknown>;
};

export type GltfImage = {
  name?: string;
  uri?: string;
  mimeType?: string;
  bufferView?: number;
};

export type GltfSampler = {
  name?: string;
  /** 9728 (nearest) or 9729 (linear) */
  magFilter?: number;
  /** 9728, 9729 or one of the mipmap variants 9984..9987 */
  minFilter?: number;
  /** 33071 (clamp to edge), 33648 (mirrored repeat) or 10497 (repeat) */
  wrapS?: number;
  wrapT?: number;
};

export type GltfBuffer = {
  name?: string;
  /** relative URL or data URI; absent for the binary chunk of a `.glb` */
  uri?: string;
  byteLength: number;
};

export type GltfBufferView = {
  name?: string;
  buffer: number;
  byteOffset?: number;
  byteLength: number;
  /** distance between the starts of two elements when attributes are interleaved */
  byteStride?: number;
  target?: number;
  extensions?: Record<string, unknown>;
};

/** `5120` byte, `5121` unsigned byte, `5122` short, `5123` unsigned short, `5125` unsigned int, `5126` float */
export type GltfComponentType = 5120 | 5121 | 5122 | 5123 | 5125 | 5126;

export type GltfAccessorType =
  'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4' | 'MAT2' | 'MAT3' | 'MAT4';

export type GltfSparseAccessor = {
  count: number;
  indices: {
    bufferView: number;
    byteOffset?: number;
    componentType: 5121 | 5123 | 5125;
  };
  values: {
    bufferView: number;
    byteOffset?: number;
  };
};

export type GltfAccessor = {
  name?: string;
  /** absent for a sparse accessor whose base values are all zero */
  bufferView?: number;
  byteOffset?: number;
  componentType: GltfComponentType;
  normalized?: boolean;
  count: number;
  type: GltfAccessorType;
  max?: number[];
  min?: number[];
  sparse?: GltfSparseAccessor;
};

/** `0` points, `1` lines, `2` line loop, `3` line strip, `4` triangles, `5` triangle strip, `6` triangle fan */
export type GltfPrimitiveMode = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type GltfPrimitive = {
  /** attribute semantic (`POSITION`, `NORMAL`, `TEXCOORD_0`, ...) to accessor index */
  attributes: Record<string, number>;
  indices?: number;
  material?: number;
  /** default 4 (triangles) */
  mode?: GltfPrimitiveMode;
  /** morph targets; read but not supported yet */
  targets?: Record<string, number>[];
  extensions?: Record<string, unknown>;
};

export type GltfMesh = {
  name?: string;
  primitives: GltfPrimitive[];
  weights?: number[];
};

export type GltfPerspectiveCamera = {
  aspectRatio?: number;
  /** vertical field of view in radians */
  yfov: number;
  zfar?: number;
  znear: number;
};

export type GltfOrthographicCamera = {
  /** half width of the view volume */
  xmag: number;
  /** half height of the view volume */
  ymag: number;
  zfar: number;
  znear: number;
};

export type GltfCamera = {
  name?: string;
  type: 'perspective' | 'orthographic';
  perspective?: GltfPerspectiveCamera;
  orthographic?: GltfOrthographicCamera;
};

export type GltfNode = {
  name?: string;
  children?: number[];
  mesh?: number;
  camera?: number;
  skin?: number;
  /** 16 values in column-major order; exclusive with the TRS properties */
  matrix?: number[];
  translation?: number[];
  /** unit quaternion as `[x, y, z, w]` */
  rotation?: number[];
  scale?: number[];
  weights?: number[];
  extensions?: {
    KHR_lights_punctual?: { light: number };
    [name: string]: unknown;
  };
};

export type GltfScene = {
  name?: string;
  /** indices of the root nodes */
  nodes?: number[];
};

/** A light of the `KHR_lights_punctual` extension */
export type GltfLight = {
  name?: string;
  type: 'directional' | 'point' | 'spot';
  /** linear RGB, default white */
  color?: number[];
  /** default 1; lux for directional lights, candela for point and spot lights */
  intensity?: number;
  /** cutoff distance for point and spot lights; absent means infinite */
  range?: number;
  spot?: {
    innerConeAngle?: number;
    outerConeAngle?: number;
  };
};

export type GltfAsset = {
  version: string;
  minVersion?: string;
  generator?: string;
  copyright?: string;
};

/** The root object of a glTF 2.0 document */
export type GltfJson = {
  asset: GltfAsset;
  extensionsUsed?: string[];
  extensionsRequired?: string[];
  /** index of the default scene */
  scene?: number;
  scenes?: GltfScene[];
  nodes?: GltfNode[];
  meshes?: GltfMesh[];
  accessors?: GltfAccessor[];
  bufferViews?: GltfBufferView[];
  buffers?: GltfBuffer[];
  materials?: GltfMaterial[];
  textures?: GltfTexture[];
  images?: GltfImage[];
  samplers?: GltfSampler[];
  cameras?: GltfCamera[];
  skins?: unknown[];
  animations?: unknown[];
  extensions?: {
    KHR_lights_punctual?: { lights: GltfLight[] };
    [name: string]: unknown;
  };
  extras?: unknown;
};
