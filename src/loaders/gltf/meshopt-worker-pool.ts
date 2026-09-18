import type { GltfMeshoptCompression } from './types';
import type {
  MeshoptWorkerRequest,
  MeshoptWorkerResponse,
} from './meshopt-worker-protocol';
import { WorkerPool } from './worker-pool';

/**
 * Runs `EXT_meshopt_compression` decoding in a pool of Web Workers instead
 * of the main thread. meshopt's own decode is cheap per call, but a file
 * can carry many compressed bufferViews (one per attribute stream); a
 * pool decodes them concurrently and keeps the main thread free for
 * everything else loading in parallel - other bufferViews, images.
 * Spawns workers lazily, up to `workerLimit`, running
 * `dist/meshopt-worker.js`, which `import()`s the actual decoder module
 * from `moduleUrl` (never bundled by magic-pixels) the first time it is
 * asked to decode.
 */
export type MeshoptWorkerOptions = {
  /** passed to `meshopt-worker.ts`'s `import()`, e.g. meshoptimizer's `meshopt_decoder.mjs` CDN URL */
  moduleUrl: string;
  /** how many workers to spawn at most, default 4 */
  workerLimit?: number;
};

export class MeshoptWorkerPool {
  private readonly pool: WorkerPool<MeshoptWorkerResponse>;

  constructor(
    private readonly options: MeshoptWorkerOptions,
    workerUrl: string | URL = new URL('./meshopt-worker.js', import.meta.url)
  ) {
    this.pool = new WorkerPool(workerUrl, { workerLimit: options.workerLimit });
  }

  /** Decode one bufferView on the next available worker */
  async decode(
    count: number,
    size: number,
    source: Uint8Array,
    mode: GltfMeshoptCompression['mode'],
    filter: GltfMeshoptCompression['filter']
  ): Promise<Uint8Array> {
    const id = this.pool.nextRequestId();
    // a fresh, exclusively-owned copy: `source` is a view into a buffer
    // shared with other bufferViews of the same glTF file, which
    // `postMessage`'s transfer list would otherwise detach from under them
    const bytes = source.slice();
    const message: MeshoptWorkerRequest = {
      type: 'decode',
      id,
      moduleUrl: this.options.moduleUrl,
      count,
      size,
      source: bytes,
      mode,
      filter,
    };
    const response = await this.pool.send(message, [bytes.buffer]);
    if (response.type === 'error') {
      throw Error(response.message);
    }
    return response.target;
  }

  /** Terminate every spawned worker; further `decode()` calls spawn fresh ones */
  dispose(): void {
    this.pool.dispose();
  }
}
