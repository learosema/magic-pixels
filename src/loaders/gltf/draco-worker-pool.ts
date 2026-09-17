import type { DracoRequest, DracoResult } from './draco';
import type {
  DracoWorkerRequest,
  DracoWorkerResponse,
} from './draco-worker-protocol';

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
  private readonly workers: Worker[] = [];
  private nextWorker = 0;
  private nextId = 1;
  private readonly pending = new Map<
    number,
    { resolve: (result: DracoResult) => void; reject: (error: Error) => void }
  >();

  constructor(
    private readonly options: DracoWorkerOptions,
    private readonly workerUrl: string | URL = new URL(
      './draco-worker.js',
      import.meta.url
    )
  ) {}

  /** Decode one primitive on the next available worker */
  decode(request: DracoRequest): Promise<DracoResult> {
    const worker = this.getWorker();
    const id = this.nextId++;
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
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage(message, [bytes.buffer]);
    });
  }

  /** Terminate every spawned worker; further `decode()` calls spawn fresh ones */
  dispose(): void {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers.length = 0;
    this.nextWorker = 0;
    this.pending.clear();
  }

  private getWorker(): Worker {
    const limit = this.options.workerLimit ?? 4;
    if (this.workers.length < limit) {
      const worker = new Worker(this.workerUrl);
      worker.onmessage = (event: MessageEvent<DracoWorkerResponse>) =>
        this.handleMessage(event.data);
      worker.onerror = (event: ErrorEvent) => this.handleFatal(event);
      this.workers.push(worker);
      return worker;
    }
    const worker = this.workers[this.nextWorker];
    this.nextWorker = (this.nextWorker + 1) % this.workers.length;
    return worker;
  }

  private handleMessage(response: DracoWorkerResponse): void {
    const pending = this.pending.get(response.id);
    if (!pending) {
      return;
    }
    this.pending.delete(response.id);
    if (response.type === 'error') {
      pending.reject(Error(response.message));
    } else {
      pending.resolve({
        attributes: response.attributes,
        indices: response.indices,
      });
    }
  }

  /** A worker itself failed (e.g. `decoderPath` is wrong): fail every request in flight */
  private handleFatal(event: ErrorEvent): void {
    const error = Error(`glTF: Draco worker error: ${event.message}`);
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }
}
