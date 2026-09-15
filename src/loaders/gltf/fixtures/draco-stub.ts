/**
 * A stub Draco decoder module for the loader tests: implements just the
 * surface `decodeDracoPrimitive()` (`src/loaders/gltf/draco.ts`) calls,
 * backed by a fixed "decoded" mesh instead of a real `.drc` bitstream, so
 * tests never link `draco3d`. Every attribute is looked up by the unique
 * id the caller passes to `GetAttributeByUniqueId`, matching how
 * `KHR_draco_mesh_compression`'s `attributes` map works in a real file.
 */
import type { GltfComponentType } from '../types';
import type { DracoDecoderModule } from '../draco';

export type DracoStubAttribute = {
  /** flat, `itemSize` components per point, in the accessor's componentType */
  values: number[];
  componentType: GltfComponentType;
  itemSize: number;
};

export type DracoStubMesh = {
  /** unique id (as used in `KHR_draco_mesh_compression.attributes`) to data */
  attributes: Record<number, DracoStubAttribute>;
  numPoints: number;
  /** flat triangle indices, three per face */
  indices: number[];
};

type HeapKey =
  'HEAP8' | 'HEAPU8' | 'HEAP16' | 'HEAPU16' | 'HEAPU32' | 'HEAPF32';
type DtKey =
  | 'DT_INT8'
  | 'DT_UINT8'
  | 'DT_INT16'
  | 'DT_UINT16'
  | 'DT_UINT32'
  | 'DT_FLOAT32';

const HEAP_KEYS: Record<GltfComponentType, HeapKey> = {
  5120: 'HEAP8',
  5121: 'HEAPU8',
  5122: 'HEAP16',
  5123: 'HEAPU16',
  5125: 'HEAPU32',
  5126: 'HEAPF32',
};

const DT_KEYS: Record<GltfComponentType, DtKey> = {
  5120: 'DT_INT8',
  5121: 'DT_UINT8',
  5122: 'DT_INT16',
  5123: 'DT_UINT16',
  5125: 'DT_UINT32',
  5126: 'DT_FLOAT32',
};

/** Creates a fresh stub module and records the calls made on it */
export function createDracoStub(mesh: DracoStubMesh): {
  module: DracoDecoderModule;
  calls: {
    init: Uint8Array[];
    attributeIds: number[];
    destroyed: number;
    freed: number;
  };
} {
  const heap = new ArrayBuffer(1 << 16);
  const heaps: Record<
    HeapKey,
    | Int8Array
    | Uint8Array
    | Int16Array
    | Uint16Array
    | Uint32Array
    | Float32Array
  > = {
    HEAP8: new Int8Array(heap),
    HEAPU8: new Uint8Array(heap),
    HEAP16: new Int16Array(heap),
    HEAPU16: new Uint16Array(heap),
    HEAPU32: new Uint32Array(heap),
    HEAPF32: new Float32Array(heap),
  };
  const calls = {
    init: [] as Uint8Array[],
    attributeIds: [] as number[],
    destroyed: 0,
    freed: 0,
  };
  let allocated = 0;

  class DecoderBuffer {
    Init(data: Uint8Array): void {
      calls.init.push(data);
    }
  }
  class Mesh {
    num_points(): number {
      return mesh.numPoints;
    }
    num_faces(): number {
      return mesh.indices.length / 3;
    }
  }
  class Decoder {
    GetEncodedGeometryType(): number {
      return module.TRIANGULAR_MESH;
    }
    DecodeBufferToMesh() {
      return { ok: () => true, error_msg: () => '' };
    }
    GetAttributeByUniqueId(_mesh: Mesh, uniqueId: number): number {
      calls.attributeIds.push(uniqueId);
      if (!(uniqueId in mesh.attributes)) {
        throw Error(`draco stub: no attribute with unique id ${uniqueId}`);
      }
      return uniqueId;
    }
    GetAttributeDataArrayForAllPoints(
      _mesh: Mesh,
      uniqueId: number,
      dataType: number,
      byteLength: number,
      pointer: number
    ): boolean {
      const attribute = mesh.attributes[uniqueId];
      const expectedDt = (module as unknown as Record<string, number>)[
        DT_KEYS[attribute.componentType]
      ];
      if (dataType !== expectedDt) {
        throw Error(
          `draco stub: attribute ${uniqueId} requested with the wrong DT_* constant`
        );
      }
      const heapView = heaps[HEAP_KEYS[attribute.componentType]];
      const start = pointer / heapView.BYTES_PER_ELEMENT;
      const count = mesh.numPoints * attribute.itemSize;
      if (byteLength !== count * heapView.BYTES_PER_ELEMENT) {
        throw Error(
          `draco stub: unexpected byteLength for attribute ${uniqueId}`
        );
      }
      (heapView as Float32Array).set(attribute.values.slice(0, count), start);
      return true;
    }
    GetTrianglesUInt16Array(
      _mesh: Mesh,
      byteLength: number,
      pointer: number
    ): boolean {
      if (byteLength !== mesh.indices.length * 2) {
        throw Error('draco stub: unexpected byteLength for indices');
      }
      heaps.HEAPU16.set(mesh.indices, pointer / 2);
      return true;
    }
    GetTrianglesUInt32Array(
      _mesh: Mesh,
      byteLength: number,
      pointer: number
    ): boolean {
      if (byteLength !== mesh.indices.length * 4) {
        throw Error('draco stub: unexpected byteLength for indices');
      }
      heaps.HEAPU32.set(mesh.indices, pointer / 4);
      return true;
    }
  }

  const stub = {
    Decoder,
    DecoderBuffer,
    Mesh,
    TRIANGULAR_MESH: 1,
    destroy: () => {
      calls.destroyed++;
    },
    _malloc: (bytes: number) => {
      const pointer = allocated;
      allocated += bytes + (8 - (bytes % 8 || 8)); // keep pointers 8 byte aligned
      return pointer;
    },
    _free: () => {
      calls.freed++;
    },
    HEAP8: heaps.HEAP8,
    HEAPU8: heaps.HEAPU8,
    HEAP16: heaps.HEAP16,
    HEAPU16: heaps.HEAPU16,
    HEAPU32: heaps.HEAPU32,
    HEAPF32: heaps.HEAPF32,
    DT_INT8: 1,
    DT_UINT8: 2,
    DT_INT16: 3,
    DT_UINT16: 4,
    DT_UINT32: 6,
    DT_FLOAT32: 9,
  };
  const module = stub as unknown as DracoDecoderModule;

  return { module, calls };
}
