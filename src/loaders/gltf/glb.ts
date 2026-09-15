import type { GltfJson } from './types';

/** `'glTF'` as a little-endian 32 bit integer */
export const GLB_MAGIC = 0x46546c67;
/** `'JSON'` */
export const GLB_CHUNK_JSON = 0x4e4f534a;
/** `'BIN\0'` */
export const GLB_CHUNK_BIN = 0x004e4942;

const HEADER_LENGTH = 12;
const CHUNK_HEADER_LENGTH = 8;

/** The two chunks of a `.glb` file */
export type Glb = {
  json: GltfJson;
  /** the binary chunk, referenced by the buffer without a `uri`; `null` if absent */
  bin: Uint8Array | null;
};

/**
 * True if the bytes start with the GLB magic, i.e. the data is a binary
 * glTF container rather than JSON text.
 */
export function isGlb(data: ArrayBuffer | Uint8Array): boolean {
  const bytes = toBytes(data);
  return (
    bytes.byteLength >= HEADER_LENGTH &&
    new DataView(bytes.buffer, bytes.byteOffset).getUint32(0, true) ===
      GLB_MAGIC
  );
}

/**
 * Split a `.glb` container into its JSON document and its binary chunk.
 *
 * The layout is a 12 byte header (magic `glTF`, version, total length)
 * followed by chunks, each with an 8 byte header (length, type) and data
 * padded to a multiple of 4 bytes. The first chunk is the JSON, the
 * optional second one is the binary buffer. The binary chunk is returned
 * as a view into `data`, not a copy.
 */
export function parseGlb(data: ArrayBuffer | Uint8Array): Glb {
  const bytes = toBytes(data);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    bytes.byteLength < HEADER_LENGTH ||
    view.getUint32(0, true) !== GLB_MAGIC
  ) {
    throw Error('glTF: not a GLB file (bad magic)');
  }
  const version = view.getUint32(4, true);
  if (version !== 2) {
    throw Error(`glTF: unsupported GLB version ${version}`);
  }
  const length = Math.min(view.getUint32(8, true), bytes.byteLength);

  let json: GltfJson | undefined;
  let bin: Uint8Array | null = null;
  let offset = HEADER_LENGTH;
  while (offset + CHUNK_HEADER_LENGTH <= length) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const start = offset + CHUNK_HEADER_LENGTH;
    if (start + chunkLength > length) {
      throw Error('glTF: GLB chunk exceeds the file length');
    }
    const chunk = bytes.subarray(start, start + chunkLength);
    if (chunkType === GLB_CHUNK_JSON && json === undefined) {
      json = JSON.parse(new TextDecoder().decode(chunk)) as GltfJson;
    } else if (chunkType === GLB_CHUNK_BIN && bin === null) {
      bin = chunk;
    }
    // chunks are padded to 4 byte boundaries
    offset = start + Math.ceil(chunkLength / 4) * 4;
  }
  if (json === undefined) {
    throw Error('glTF: GLB file has no JSON chunk');
  }
  return { json, bin };
}

function toBytes(data: ArrayBuffer | Uint8Array): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}
