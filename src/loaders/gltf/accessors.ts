import { BufferAttribute } from '../../geometries';
import type { TypedArray } from '../../geometries/buffer-geometry';
import type {
  GltfAccessor,
  GltfAccessorType,
  GltfBufferView,
  GltfComponentType,
  GltfJson,
} from './types';

/** Typed array constructor per glTF component type */
export const COMPONENT_ARRAYS: Record<
  GltfComponentType,
  | Int8ArrayConstructor
  | Uint8ArrayConstructor
  | Int16ArrayConstructor
  | Uint16ArrayConstructor
  | Uint32ArrayConstructor
  | Float32ArrayConstructor
> = {
  5120: Int8Array,
  5121: Uint8Array,
  5122: Int16Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array,
};

/** Number of components per element per accessor type */
export const TYPE_SIZES: Record<GltfAccessorType, number> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
};

/**
 * The loaded buffers of a document, by buffer index. A buffer is a byte
 * view, so a `.glb`'s binary chunk needs no copy.
 */
export type GltfBuffers = Uint8Array[];

/**
 * The bytes of a buffer view: a `byteLength` long window into its buffer
 * starting at `byteOffset`, as a view (no copy).
 */
export function getBufferView(
  json: GltfJson,
  index: number,
  buffers: GltfBuffers
): Uint8Array {
  const bufferView = bufferViewDef(json, index);
  const buffer = buffers[bufferView.buffer];
  if (!buffer) {
    throw Error(`glTF: buffer ${bufferView.buffer} was not loaded`);
  }
  const start = bufferView.byteOffset ?? 0;
  const end = start + bufferView.byteLength;
  if (end > buffer.byteLength) {
    throw Error(`glTF: bufferView ${index} exceeds its buffer`);
  }
  return buffer.subarray(start, end);
}

function bufferViewDef(json: GltfJson, index: number): GltfBufferView {
  const bufferView = json.bufferViews?.[index];
  if (!bufferView) {
    throw Error(`glTF: bufferView ${index} does not exist`);
  }
  return bufferView;
}

function accessorDef(json: GltfJson, index: number): GltfAccessor {
  const accessor = json.accessors?.[index];
  if (!accessor) {
    throw Error(`glTF: accessor ${index} does not exist`);
  }
  return accessor;
}

/**
 * Read the elements of an accessor into a new, tightly packed typed array
 * of the accessor's component type. Interleaved data (a buffer view with a
 * `byteStride` larger than one element) is de-interleaved on the way,
 * sparse substitutions are applied, and an accessor without a buffer view
 * yields zeros (the base of a sparse accessor). The result is always a
 * copy, so alignment of the source bytes does not matter.
 */
export function readAccessorData(
  json: GltfJson,
  index: number,
  buffers: GltfBuffers
): TypedArray {
  const accessor = accessorDef(json, index);
  const Ctor = COMPONENT_ARRAYS[accessor.componentType];
  if (!Ctor) {
    throw Error(
      `glTF: accessor ${index} has unknown componentType ${accessor.componentType}`
    );
  }
  const size = TYPE_SIZES[accessor.type];
  if (!size) {
    throw Error(`glTF: accessor ${index} has unknown type ${accessor.type}`);
  }
  const elementBytes = size * Ctor.BYTES_PER_ELEMENT;
  const target = new Ctor(accessor.count * size);

  if (accessor.bufferView !== undefined) {
    const bufferView = bufferViewDef(json, accessor.bufferView);
    const bytes = getBufferView(json, accessor.bufferView, buffers);
    const stride = bufferView.byteStride ?? elementBytes;
    copyElements(
      target,
      bytes,
      accessor.byteOffset ?? 0,
      accessor.count,
      elementBytes,
      stride
    );
  }

  if (accessor.sparse) {
    applySparse(json, accessor, target, size, buffers);
  }
  return target;
}

/**
 * Copy `count` elements of `elementBytes` bytes each, `stride` bytes
 * apart, from `source` (starting at `offset`) into the tightly packed
 * `target`. A single `set` when the source is already tightly packed, one
 * per element otherwise.
 */
function copyElements(
  target: TypedArray,
  source: Uint8Array,
  offset: number,
  count: number,
  elementBytes: number,
  stride: number
): void {
  if (count === 0) {
    return;
  }
  const end = offset + (count - 1) * stride + elementBytes;
  if (end > source.byteLength) {
    throw Error('glTF: accessor exceeds its bufferView');
  }
  const targetBytes = new Uint8Array(
    target.buffer,
    target.byteOffset,
    target.byteLength
  );
  if (stride === elementBytes) {
    targetBytes.set(source.subarray(offset, end));
    return;
  }
  for (let i = 0; i < count; i++) {
    const start = offset + i * stride;
    targetBytes.set(
      source.subarray(start, start + elementBytes),
      i * elementBytes
    );
  }
}

/**
 * Overwrite the elements listed in `sparse.indices` with the values from
 * `sparse.values`. Both are tightly packed by specification.
 */
function applySparse(
  json: GltfJson,
  accessor: GltfAccessor,
  target: TypedArray,
  size: number,
  buffers: GltfBuffers
): void {
  const { sparse } = accessor;
  if (!sparse) {
    return;
  }
  const IndexCtor = COMPONENT_ARRAYS[sparse.indices.componentType];
  const indices = new IndexCtor(sparse.count);
  copyElements(
    indices,
    getBufferView(json, sparse.indices.bufferView, buffers),
    sparse.indices.byteOffset ?? 0,
    sparse.count,
    IndexCtor.BYTES_PER_ELEMENT,
    IndexCtor.BYTES_PER_ELEMENT
  );
  const ValueCtor = COMPONENT_ARRAYS[accessor.componentType];
  const values = new ValueCtor(sparse.count * size);
  copyElements(
    values,
    getBufferView(json, sparse.values.bufferView, buffers),
    sparse.values.byteOffset ?? 0,
    sparse.count,
    size * ValueCtor.BYTES_PER_ELEMENT,
    size * ValueCtor.BYTES_PER_ELEMENT
  );
  for (let i = 0; i < sparse.count; i++) {
    const element = indices[i];
    if (element >= accessor.count) {
      throw Error('glTF: sparse index out of range');
    }
    target.set(values.subarray(i * size, (i + 1) * size), element * size);
  }
}

/**
 * Read a vertex attribute accessor into a {@link BufferAttribute}: the
 * component type becomes the typed array type, `type` the record size and
 * `normalized` is passed through.
 */
export function readAccessor(
  json: GltfJson,
  index: number,
  buffers: GltfBuffers
): BufferAttribute {
  const accessor = accessorDef(json, index);
  const data = readAccessorData(json, index, buffers);
  return new BufferAttribute(
    data,
    TYPE_SIZES[accessor.type],
    accessor.normalized ?? false
  );
}

/**
 * Read an index accessor as a `Uint16Array` or `Uint32Array`, ready for
 * `BufferGeometry.setIndex`. glTF also allows 8 bit indices;
 * `BufferGeometry` keeps 16 or 32 bit ones, so they are widened.
 */
export function readIndices(
  json: GltfJson,
  index: number,
  buffers: GltfBuffers
): Uint16Array | Uint32Array {
  const accessor = accessorDef(json, index);
  if (accessor.type !== 'SCALAR') {
    throw Error(`glTF: index accessor ${index} must be SCALAR`);
  }
  const data = readAccessorData(json, index, buffers);
  if (data instanceof Uint32Array || data instanceof Uint16Array) {
    return data;
  }
  if (data instanceof Uint8Array) {
    return new Uint16Array(data);
  }
  throw Error(
    `glTF: index accessor ${index} has an unsupported componentType ${accessor.componentType}`
  );
}
