import { BufferAttribute } from '../../geometries';
import type { TypedArray } from '../../geometries/buffer-geometry';
import { COMPONENT_ARRAYS, TYPE_SIZES, getBufferView } from './accessors';
import type { GltfBuffers } from './accessors';
import type {
  GltfAccessor,
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
  accessor: GltfAccessor
): TypedArray {
  const info = COMPONENT_INFO[accessor.componentType];
  const Ctor = COMPONENT_ARRAYS[accessor.componentType];
  if (!info || !Ctor) {
    throw Error(
      `glTF: Draco attribute has unsupported componentType ${accessor.componentType}`
    );
  }
  // `GetAttributeDataArrayForAllPoints` writes exactly one value per
  // Draco point; some real-world exporters (Blender's Draco path among
  // them) write an accessor `count` that does not quite match the
  // decoded mesh's own point count, so `mesh.num_points()` - not the
  // accessor - is what decides how many elements come back. The accessor
  // still supplies the *shape* (componentType, type, normalized).
  const count = mesh.num_points() * TYPE_SIZES[accessor.type];
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
 * Decode a `KHR_draco_mesh_compression` primitive: every attribute the
 * extension lists, keyed by its glTF semantic (`POSITION`, `NORMAL`, ...)
 * and shaped like the primitive's own accessor (count, type, normalized
 * come from the JSON accessor, not from Draco), plus the triangle indices.
 * Every Draco object is destroyed before returning, decoded or not.
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
  const bytes = getBufferView(json, ext.bufferView, buffers);
  const decoderBuffer = new module.DecoderBuffer();
  decoderBuffer.Init(bytes, bytes.byteLength);
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
    const attributes: Record<string, BufferAttribute> = {};
    for (const [semantic, uniqueId] of Object.entries(ext.attributes)) {
      const accessorIndex = primitive.attributes[semantic];
      const accessor =
        accessorIndex !== undefined
          ? json.accessors?.[accessorIndex]
          : undefined;
      if (!accessor) {
        continue;
      }
      const attribute = decoder.GetAttributeByUniqueId(mesh, uniqueId);
      const data = readAttribute(module, decoder, mesh, attribute, accessor);
      attributes[semantic] = new BufferAttribute(
        data,
        TYPE_SIZES[accessor.type],
        accessor.normalized ?? false
      );
    }
    const indexAccessor =
      primitive.indices !== undefined
        ? json.accessors?.[primitive.indices]
        : undefined;
    const wide =
      indexAccessor?.componentType === 5125 || mesh.num_points() > 65535;
    const indices = readIndices(module, decoder, mesh, wide);
    return { attributes, indices };
  } finally {
    module.destroy(mesh);
    module.destroy(decoder);
    module.destroy(decoderBuffer);
  }
}
