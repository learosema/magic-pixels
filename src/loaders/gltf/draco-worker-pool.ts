import type { DracoRequest, DracoResult } from './draco';
import type {
  DracoWorkerRequest,
  DracoWorkerResponse,
} from './draco-worker-protocol';
import { WorkerPool } from './worker-pool';

/**
 * Runs `KHR_draco_mesh_compression` decoding in a pool of Web Workers
 * instead of blocking the main thread, the way three.js's `DRACOLoader`
 * does. Spawns workers lazily, up to `workerLimit`, running
 * `dist/draco-worker.js` - a small bundle of `draco-worker.ts` that
 * `importScripts()`s the actual Draco decoder from `decoderPath` (never
 * bundled by magic-pixels) the first time it is asked to decode.
 */
export type DracoWorkerOptions = {
  /** passed to `draco-worker.ts`'s `importScripts()`, e.g. a Draco CDN URL */
  decoderPath: string;
  /** how many workers to spawn at most, default 4 */
  workerLimit?: number;
};

export class DracoWorkerPool {
  private readonly pool: WorkerPool<DracoWorkerResponse>;

  constructor(
    private readonly options: DracoWorkerOptions,
    workerUrl: string | URL = new URL('./draco-worker.js', import.meta.url)
  ) {
    this.pool = new WorkerPool(workerUrl, { workerLimit: options.workerLimit });
  }

  /** Decode one primitive on the next available worker */
  async decode(request: DracoRequest): Promise<DracoResult> {
    const id = this.pool.nextRequestId();
    // a fresh, exclusively-owned copy: `request.bytes` is a view into a
    // buffer shared with other bufferViews of the same glTF file, which
    // `postMessage`'s transfer list would otherwise detach from under them
    const bytes = request.bytes.slice();
    const message: DracoWorkerRequest = {
      type: 'decode',
      id,
      decoderPath: this.options.decoderPath,
      bytes,
      attributes: request.attributes,
      indexComponentType: request.indexComponentType,
    };
    const response = await this.pool.send(message, [bytes.buffer]);
    if (response.type === 'error') {
      throw Error(response.message);
    }
    return { attributes: response.attributes, indices: response.indices };
  }

  /** Terminate every spawned worker; further `decode()` calls spawn fresh ones */
  dispose(): void {
    this.pool.dispose();
  }
}
