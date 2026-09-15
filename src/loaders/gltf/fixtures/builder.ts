import type { TypedArray } from '../../../geometries/buffer-geometry';
import { GLB_CHUNK_BIN, GLB_CHUNK_JSON, GLB_MAGIC } from '../glb';
import { TYPE_SIZES } from '../accessors';
import type {
  GltfAccessor,
  GltfAccessorType,
  GltfComponentType,
  GltfJson,
} from '../types';

const COMPONENT_TYPES: [new (n: number) => TypedArray, GltfComponentType][] = [
  [Int8Array, 5120],
  [Uint8Array, 5121],
  [Int16Array, 5122],
  [Uint16Array, 5123],
  [Uint32Array, 5125],
  [Float32Array, 5126],
];

/** The glTF component type of a typed array */
export function componentTypeOf(data: TypedArray): GltfComponentType {
  const entry = COMPONENT_TYPES.find(([Ctor]) => data instanceof Ctor);
  if (!entry) {
    throw Error('unsupported typed array');
  }
  return entry[1];
}

/** Encode bytes as a base64 data URI */
export function toDataUri(bytes: Uint8Array, mimeType: string): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

function pad4(length: number): number {
  return Math.ceil(length / 4) * 4;
}

/** Assemble a `.glb` container from a document and an optional binary chunk */
export function buildGlb(json: object, bin: Uint8Array | null): ArrayBuffer {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = pad4(jsonBytes.byteLength);
  const binLength = bin ? pad4(bin.byteLength) : 0;
  const total = 12 + 8 + jsonLength + (bin ? 8 + binLength : 0);
  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, GLB_CHUNK_JSON, true);
  bytes.set(jsonBytes, 20);
  // JSON chunks are padded with spaces
  bytes.fill(0x20, 20 + jsonBytes.byteLength, 20 + jsonLength);
  if (bin) {
    const offset = 20 + jsonLength;
    view.setUint32(offset, binLength, true);
    view.setUint32(offset + 4, GLB_CHUNK_BIN, true);
    bytes.set(bin, offset + 8);
  }
  return buffer;
}

/**
 * Builds a glTF document and its binary buffer side by side: typed arrays
 * are appended to the buffer (4 byte aligned) as buffer views, accessors
 * point at them, and the result can be taken as JSON with the buffer
 * embedded as a data URI, as JSON with an external buffer, or as a `.glb`.
 */
export class GltfBuilder {
  readonly json: GltfJson;
  private readonly chunks: Uint8Array[] = [];
  private byteLength = 0;

  constructor(json: Partial<GltfJson> = {}) {
    this.json = {
      asset: { version: '2.0' },
      bufferViews: [],
      accessors: [],
      ...json,
    };
  }

  /** Append bytes to the buffer as a new buffer view; returns its index */
  addBufferView(data: TypedArray | Uint8Array, byteStride?: number): number {
    const padding = pad4(this.byteLength) - this.byteLength;
    if (padding) {
      this.chunks.push(new Uint8Array(padding));
      this.byteLength += padding;
    }
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const views = this.json.bufferViews!;
    views.push({
      buffer: 0,
      byteOffset: this.byteLength,
      byteLength: bytes.byteLength,
      ...(byteStride !== undefined ? { byteStride } : {}),
    });
    this.chunks.push(bytes);
    this.byteLength += bytes.byteLength;
    return views.length - 1;
  }

  addAccessor(accessor: GltfAccessor): number {
    this.json.accessors!.push(accessor);
    return this.json.accessors!.length - 1;
  }

  /** Tightly packed data as its own buffer view plus an accessor for it */
  addData(
    data: TypedArray,
    type: GltfAccessorType,
    options: Partial<GltfAccessor> = {}
  ): number {
    return this.addAccessor({
      bufferView: this.addBufferView(data),
      componentType: componentTypeOf(data),
      count: data.length / TYPE_SIZES[type],
      type,
      ...options,
    });
  }

  /** The binary buffer so far */
  get bin(): Uint8Array {
    const result = new Uint8Array(this.byteLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result;
  }

  private withBuffers(uri: string | undefined): GltfJson {
    const { byteLength } = this;
    return {
      ...this.json,
      buffers:
        byteLength === 0
          ? []
          : [uri === undefined ? { byteLength } : { byteLength, uri }],
    };
  }

  /** The document with the buffer embedded as a data URI */
  toJson(): GltfJson {
    return this.withBuffers(toDataUri(this.bin, 'application/octet-stream'));
  }

  /** The document with the buffer as an external file at `uri` */
  toJsonWithUri(uri: string): GltfJson {
    return this.withBuffers(uri);
  }

  /** The document and buffer as a `.glb` container */
  toGlb(): ArrayBuffer {
    return buildGlb(
      this.withBuffers(undefined),
      this.byteLength ? this.bin : null
    );
  }
}
