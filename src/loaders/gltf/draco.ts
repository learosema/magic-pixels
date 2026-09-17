import { BufferAttribute } from '../../geometries';
import type { TypedArray } from '../../geometries/buffer-geometry';
import { COMPONENT_ARRAYS, TYPE_SIZES, getBufferView } from './accessors';
import type { GltfBuffers } from './accessors';
import type {
  GltfAccessorType,
  GltfComponentType,
  GltfDracoMeshCompression,
  GltfJson,
  GltfPrimitive,
} from './types';

/**
 * Minimal structural interface for a Draco decoder module: the result of
 * `createDecoderModule()` from the `draco3d` npm package, or the
 * `DracoDecoderModule` global of the CDN build. magic-pixels never
 * imports or bundles Draco; the caller passes an initialized module in.
 * Attribute data is read through the module's Emscripten heap (`_malloc`,
 * the `HEAP*` views), the same low-level path three.js's `GLTFLoader`
 * uses, because it is the only Draco API that supports every glTF
 * component type - the `Get*ForAllPoints` wrappers only cover floats.
 * Every field here is inlined (rather than named and exported
 * separately) since none of it is meant to be used on its own.
 */
export type DracoDecoderModule = {
  Decoder: new () => {
    GetEncodedGeometryType(buffer: {
      Init(data: Uint8Array, length: number): void;
    }): number;
    DecodeBufferToMesh(
      buffer: { Init(data: Uint8Array, length: number): void },
      mesh: { num_points(): number; num_faces(): number }
    ): { ok(): boolean; error_msg(): string };
    GetAttributeByUniqueId(
      mesh: { num_points(): number; num_faces(): number },
      uniqueId: number
    ): object;
    GetAttributeDataArrayForAllPoints(
      mesh: { num_points(): number; num_faces(): number },
      attribute: object,
      dataType: number,
      byteLength: number,
      outPointer: number
    ): boolean;
    GetTrianglesUInt16Array(
      mesh: { num_points(): number; num_faces(): number },
      byteLength: number,
      outPointer: number
    ): boolean;
    GetTrianglesUInt32Array(
      mesh: { num_points(): number; num_faces(): number },
      byteLength: number,
      outPointer: number
    ): boolean;
  };
  DecoderBuffer: new () => { Init(data: Uint8Array, length: number): void };
  Mesh: new () => { num_points(): number; num_faces(): number };
  TRIANGULAR_MESH: number;
  destroy(object: unknown): void;
  _malloc(bytes: number): number;
  _free(pointer: number): void;
  HEAP8: Int8Array;
  HEAPU8: Uint8Array;
  HEAP16: Int16Array;
  HEAPU16: Uint16Array;
  HEAPU32: Uint32Array;
  HEAPF32: Float32Array;
  DT_INT8: number;
  DT_UINT8: number;
  DT_INT16: number;
  DT_UINT16: number;
  DT_UINT32: number;
  DT_FLOAT32: number;
};

// Internal aliases, derived from the public type above rather than
// declared a second time, so there is exactly one definition of the
// Draco shape this module relies on.
type DracoMesh = InstanceType<DracoDecoderModule['Mesh']>;
type DracoDecoder = InstanceType<DracoDecoderModule['Decoder']>;
type DracoAttribute = ReturnType<DracoDecoder['GetAttributeByUniqueId']>;

/** Shape of one Draco-compressed attribute, independent of the glTF JSON it came from */
export type DracoAttributeSpec = {
  /** id passed to `GetAttributeByUniqueId`, from `KHR_draco_mesh_compression.attributes` */
  uniqueId: number;
  type: GltfAccessorType;
  componentType: GltfComponentType;
  normalized: boolean;
};

/**
 * Everything {@link decodeDraco} needs to decode one primitive: the raw
 * compressed bytes and the shape of each attribute, both already resolved
 * from the glTF JSON. Doing that resolution separately (in
 * {@link extractDracoRequest}) means the decode step itself only touches
 * typed arrays and the Draco module, so it can run on the main thread or
 * inside a worker unchanged.
 */
export type DracoRequest = {
  bytes: Uint8Array;
  /** glTF attribute semantic (`POSITION`, `NORMAL`, ...) to its Draco shape */
  attributes: Record<string, DracoAttributeSpec>;
  /** the primitive's index accessor componentType, if any (decides 16 vs 32 bit indices) */
  indexComponentType: GltfComponentType | undefined;
};

/** Result of {@link decodeDraco}: plain typed arrays, not yet {@link BufferAttribute}s */
export type DracoResult = {
  attributes: Record<
    string,
    { data: TypedArray; recordSize: number; normalized: boolean }
  >;
  indices: Uint16Array | Uint32Array;
};

/** glTF `componentType` to the module's `DT_*` constant and `HEAP*` view */
const COMPONENT_INFO: Record<
  number,
  { dt: keyof DracoDecoderModule; heap: keyof DracoDecoderModule }
> = {
  5120: { dt: 'DT_INT8', heap: 'HEAP8' },
  5121: { dt: 'DT_UINT8', heap: 'HEAPU8' },
  5122: { dt: 'DT_INT16', heap: 'HEAP16' },
  5123: { dt: 'DT_UINT16', heap: 'HEAPU16' },
  5125: { dt: 'DT_UINT32', heap: 'HEAPU32' },
  5126: { dt: 'DT_FLOAT32', heap: 'HEAPF32' },
};

/**
 * Copy `count` elements out of the module's heap at a malloc'd pointer -
 * a copy, since the heap is reused once that pointer is freed.
 */
function readHeap(
  module: DracoDecoderModule,
  heapKey: keyof DracoDecoderModule,
  bytesPerElement: number,
  pointer: number,
  count: number
): TypedArray {
  const heap = module[heapKey] as TypedArray;
  const start = pointer / bytesPerElement;
  return heap.slice(start, start + count);
}

function readAttribute(
  module: DracoDecoderModule,
  decoder: DracoDecoder,
  mesh: DracoMesh,
  attribute: DracoAttribute,
  spec: DracoAttributeSpec
): TypedArray {
  const info = COMPONENT_INFO[spec.componentType];
  const Ctor = COMPONENT_ARRAYS[spec.componentType];
  if (!info || !Ctor) {
    throw Error(
      `glTF: Draco attribute has unsupported componentType ${spec.componentType}`
    );
  }
  // `GetAttributeDataArrayForAllPoints` writes exactly one value per
  // Draco point; some real-world exporters (Blender's Draco path among
  // them) write an accessor `count` that does not quite match the
  // decoded mesh's own point count, so `mesh.num_points()` - not the
  // accessor - is what decides how many elements come back. The accessor
  // still supplies the *shape* (componentType, type, normalized).
  const count = mesh.num_points() * TYPE_SIZES[spec.type];
  const byteLength = count * Ctor.BYTES_PER_ELEMENT;
  const pointer = module._malloc(byteLength);
  try {
    const ok = decoder.GetAttributeDataArrayForAllPoints(
      mesh,
      attribute,
      module[info.dt] as number,
      byteLength,
      pointer
    );
    if (!ok) {
      throw Error('glTF: Draco attribute decoding failed');
    }
    return readHeap(module, info.heap, Ctor.BYTES_PER_ELEMENT, pointer, count);
  } finally {
    module._free(pointer);
  }
}

function readIndices(
  module: DracoDecoderModule,
  decoder: DracoDecoder,
  mesh: DracoMesh,
  wide: boolean
): Uint16Array | Uint32Array {
  const count = mesh.num_faces() * 3;
  const Ctor = wide ? Uint32Array : Uint16Array;
  const byteLength = count * Ctor.BYTES_PER_ELEMENT;
  const pointer = module._malloc(byteLength);
  try {
    const ok = wide
      ? decoder.GetTrianglesUInt32Array(mesh, byteLength, pointer)
      : decoder.GetTrianglesUInt16Array(mesh, byteLength, pointer);
    if (!ok) {
      throw Error('glTF: Draco index decoding failed');
    }
    return readHeap(
      module,
      wide ? 'HEAPU32' : 'HEAPU16',
      Ctor.BYTES_PER_ELEMENT,
      pointer,
      count
    ) as Uint16Array | Uint32Array;
  } finally {
    module._free(pointer);
  }
}

/**
 * Resolve a `KHR_draco_mesh_compression` primitive against the glTF JSON
 * into a self-contained {@link DracoRequest}: the compressed bytes and the
 * shape of every attribute the extension lists (an attribute missing its
 * accessor is skipped). This is the only part of decoding that needs the
 * document and runs on the main thread, whether the actual decode happens
 * there too or is handed to a worker.
 */
export function extractDracoRequest(
  json: GltfJson,
  primitive: GltfPrimitive,
  ext: GltfDracoMeshCompression,
  buffers: GltfBuffers
): DracoRequest {
  const bytes = getBufferView(json, ext.bufferView, buffers);
  const attributes: Record<string, DracoAttributeSpec> = {};
  for (const [semantic, uniqueId] of Object.entries(ext.attributes)) {
    const accessorIndex = primitive.attributes[semantic];
    const accessor =
      accessorIndex !== undefined ? json.accessors?.[accessorIndex] : undefined;
    if (!accessor) {
      continue;
    }
    attributes[semantic] = {
      uniqueId,
      type: accessor.type,
      componentType: accessor.componentType,
      normalized: accessor.normalized ?? false,
    };
  }
  const indexAccessor =
    primitive.indices !== undefined
      ? json.accessors?.[primitive.indices]
      : undefined;
  return {
    bytes,
    attributes,
    indexComponentType: indexAccessor?.componentType,
  };
}

/**
 * Decode a Draco-compressed mesh: every attribute {@link DracoRequest}
 * lists, keyed by its glTF semantic (`POSITION`, `NORMAL`, ...), plus the
 * triangle indices. Every Draco object is destroyed before returning,
 * decoded or not. Touches only typed arrays and the decoder module, so it
 * runs unchanged on the main thread or inside a worker.
 */
export function decodeDraco(
  module: DracoDecoderModule,
  request: DracoRequest
): DracoResult {
  const decoderBuffer = new module.DecoderBuffer();
  decoderBuffer.Init(request.bytes, request.bytes.byteLength);
  const decoder = new module.Decoder();
  const geometryType = decoder.GetEncodedGeometryType(decoderBuffer);
  if (geometryType !== module.TRIANGULAR_MESH) {
    module.destroy(decoder);
    module.destroy(decoderBuffer);
    throw Error('glTF: only Draco-compressed triangle meshes are supported');
  }
  const mesh = new module.Mesh();
  const status = decoder.DecodeBufferToMesh(decoderBuffer, mesh);
  if (!status.ok()) {
    const message = status.error_msg();
    module.destroy(mesh);
    module.destroy(decoder);
    module.destroy(decoderBuffer);
    throw Error(`glTF: Draco decoding failed: ${message}`);
  }
  try {
    const attributes: DracoResult['attributes'] = {};
    for (const [semantic, spec] of Object.entries(request.attributes)) {
      const attribute = decoder.GetAttributeByUniqueId(mesh, spec.uniqueId);
      const data = readAttribute(module, decoder, mesh, attribute, spec);
      attributes[semantic] = {
        data,
        recordSize: TYPE_SIZES[spec.type],
        normalized: spec.normalized,
      };
    }
    const wide =
      request.indexComponentType === 5125 || mesh.num_points() > 65535;
    const indices = readIndices(module, decoder, mesh, wide);
    return { attributes, indices };
  } finally {
    module.destroy(mesh);
    module.destroy(decoder);
    module.destroy(decoderBuffer);
  }
}

/** Turn a {@link DracoResult}'s plain typed arrays into {@link BufferAttribute}s */
export function wrapDracoResult(raw: DracoResult): {
  attributes: Record<string, BufferAttribute>;
  indices: Uint16Array | Uint32Array;
} {
  const attributes: Record<string, BufferAttribute> = {};
  for (const [semantic, { data, recordSize, normalized }] of Object.entries(
    raw.attributes
  )) {
    attributes[semantic] = new BufferAttribute(data, recordSize, normalized);
  }
  return { attributes, indices: raw.indices };
}

/**
 * Decode a `KHR_draco_mesh_compression` primitive on the main thread:
 * {@link extractDracoRequest} plus {@link decodeDraco} plus
 * {@link wrapDracoResult}. {@link DracoWorkerPool} runs the same two
 * middle steps inside a worker instead.
 */
export function decodeDracoPrimitive(
  json: GltfJson,
  primitive: GltfPrimitive,
  ext: GltfDracoMeshCompression,
  buffers: GltfBuffers,
  module: DracoDecoderModule
): {
  attributes: Record<string, BufferAttribute>;
  indices: Uint16Array | Uint32Array;
} {
  const request = extractDracoRequest(json, primitive, ext, buffers);
  return wrapDracoResult(decodeDraco(module, request));
}
