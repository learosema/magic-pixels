import type { GltfBuffers } from './accessors';
import { MeshoptWorkerPool } from './meshopt-worker-pool';
import type { MeshoptWorkerOptions } from './meshopt-worker-pool';
import type { GltfBufferView, GltfJson, GltfMeshoptCompression } from './types';

/**
 * Minimal structural interface for `EXT_meshopt_compression` decoding,
 * exactly the shape of `MeshoptDecoder` from the `meshoptimizer` npm
 * package. magic-pixels never imports or bundles `meshoptimizer`; the
 * caller passes a ready decoder in.
 */
export type MeshoptDecoder = {
  ready: Promise<void>;
  decodeGltfBuffer(
    target: Uint8Array,
    count: number,
    size: number,
    source: Uint8Array,
    mode: string,
    filter?: string
  ): void;
};

/** `MeshoptWorkerOptions` is the only shape of `options.meshopt` with a `moduleUrl` */
function isMeshoptWorkerOptions(
  decoder: MeshoptDecoder | MeshoptWorkerOptions
): decoder is MeshoptWorkerOptions {
  return 'moduleUrl' in decoder;
}

/** One decode call, however it actually runs - synchronously or on a worker */
type DecodeOne = (
  count: number,
  size: number,
  source: Uint8Array,
  mode: GltfMeshoptCompression['mode'],
  filter: GltfMeshoptCompression['filter']
) => Promise<Uint8Array>;

/**
 * Decode every bufferView carrying `EXT_meshopt_compression` into a plain
 * `Uint8Array`, appended to `buffers`, and return a patched `json` whose
 * bufferViews point at the decoded bytes instead of the compressed ones -
 * from there on, accessors read a meshopt-compressed file exactly like an
 * uncompressed one. Neither `json` nor `buffers` is mutated; both are
 * returned unchanged (same references) if the file has nothing to decode.
 */
export async function decodeMeshoptBufferViews(
  json: GltfJson,
  buffers: GltfBuffers,
  decoder: MeshoptDecoder | MeshoptWorkerOptions | undefined
): Promise<{ json: GltfJson; buffers: GltfBuffers }> {
  const bufferViews = json.bufferViews ?? [];
  const compressed = bufferViews
    .map((bufferView, index) => [index, bufferView] as const)
    .filter(([, bufferView]) => bufferView.extensions?.EXT_meshopt_compression);
  if (!compressed.length) {
    return { json, buffers };
  }
  if (!decoder) {
    throw Error(
      'glTF: the file uses EXT_meshopt_compression; pass options.meshopt'
    );
  }
  const patchedViews = [...bufferViews];
  const patchedBuffers = [...buffers];

  const decodeEntry = async (
    index: number,
    bufferView: GltfBufferView,
    decodeOne: DecodeOne
  ): Promise<void> => {
    const ext = bufferView.extensions!.EXT_meshopt_compression!;
    const source = buffers[ext.buffer];
    if (!source) {
      throw Error(
        `glTF: bufferView ${index} (EXT_meshopt_compression) references missing buffer ${ext.buffer}`
      );
    }
    const start = ext.byteOffset ?? 0;
    const end = start + ext.byteLength;
    if (end > source.byteLength) {
      throw Error(
        `glTF: bufferView ${index} (EXT_meshopt_compression) exceeds its buffer`
      );
    }
    const compressedBytes = source.subarray(start, end);
    const target = await decodeOne(
      ext.count,
      ext.byteStride,
      compressedBytes,
      ext.mode,
      ext.filter
    );
    // one synchronous step, so this is safe even when several bufferViews
    // decode concurrently: whichever resolves first sees, and claims, the
    // current length before anything else can run
    patchedViews[index] = {
      ...bufferView,
      buffer: patchedBuffers.length,
      byteOffset: 0,
      byteLength: target.byteLength,
    };
    patchedBuffers.push(target);
  };

  if (isMeshoptWorkerOptions(decoder)) {
    const pool = new MeshoptWorkerPool(decoder);
    try {
      await Promise.all(
        compressed.map(([index, bufferView]) =>
          decodeEntry(index, bufferView, (count, size, source, mode, filter) =>
            pool.decode(count, size, source, mode, filter)
          )
        )
      );
    } finally {
      pool.dispose();
    }
  } else {
    await decoder.ready;
    for (const [index, bufferView] of compressed) {
      await decodeEntry(
        index,
        bufferView,
        async (count, size, source, mode, filter) => {
          const target = new Uint8Array(count * size);
          decoder.decodeGltfBuffer(target, count, size, source, mode, filter);
          return target;
        }
      );
    }
  }

  return {
    json: { ...json, bufferViews: patchedViews },
    buffers: patchedBuffers,
  };
}
