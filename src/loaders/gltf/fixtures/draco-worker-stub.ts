/**
 * A fake `Worker` for {@link DracoWorkerPool} tests: decodes with the same
 * {@link createDracoStub} module the synchronous Draco tests use, round
 * tripped through `postMessage`/`onmessage` so the pool's message protocol
 * is exercised without spawning a real thread or bundling `draco-worker.ts`.
 */
import { decodeDraco } from '../draco';
import type {
  DracoWorkerRequest,
  DracoWorkerResponse,
} from '../draco-worker-protocol';
import { createDracoStub } from './draco-stub';
import type { DracoStubMesh } from './draco-stub';

export function createFakeDracoWorkerClass(mesh: DracoStubMesh): {
  FakeWorker: new (url: string | URL) => Worker;
  calls: { constructed: number; terminated: number };
} {
  const { module } = createDracoStub(mesh);
  const calls = { constructed: 0, terminated: 0 };

  class FakeWorker {
    onmessage: ((event: { data: DracoWorkerResponse }) => void) | null = null;
    onerror: ((event: { message: string }) => void) | null = null;

    constructor(public readonly url: string | URL) {
      calls.constructed++;
    }

    postMessage(message: DracoWorkerRequest): void {
      queueMicrotask(() => {
        try {
          const result = decodeDraco(module, message);
          this.onmessage?.({
            data: { type: 'decoded', id: message.id, ...result },
          });
        } catch (error) {
          this.onmessage?.({
            data: {
              type: 'error',
              id: message.id,
              message: error instanceof Error ? error.message : String(error),
            },
          });
        }
      });
    }

    terminate(): void {
      calls.terminated++;
    }
  }

  return {
    FakeWorker: FakeWorker as unknown as new (url: string | URL) => Worker,
    calls,
  };
}
