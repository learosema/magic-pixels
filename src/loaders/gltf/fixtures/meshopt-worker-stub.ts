/**
 * A fake `Worker` for `MeshoptWorkerPool` tests: "decodes" the same way
 * `loader.test.ts`'s `meshoptStub()` does on the main thread - a plain
 * byte pass-through, since the fixtures only need a decode that is
 * deterministic, not a real meshopt bitstream - round tripped through
 * `postMessage`/`onmessage` so the pool's message protocol is exercised
 * without spawning a real thread or bundling `meshopt-worker.ts`.
 */
import type {
  MeshoptWorkerRequest,
  MeshoptWorkerResponse,
} from '../meshopt-worker-protocol';

export function createFakeMeshoptWorkerClass(): {
  FakeWorker: new (url: string | URL) => Worker;
  calls: { constructed: number; terminated: number };
} {
  const calls = { constructed: 0, terminated: 0 };

  class FakeWorker {
    onmessage: ((event: { data: MeshoptWorkerResponse }) => void) | null = null;
    onerror: ((event: { message: string }) => void) | null = null;

    constructor(public readonly url: string | URL) {
      calls.constructed++;
    }

    postMessage(message: MeshoptWorkerRequest): void {
      queueMicrotask(() => {
        try {
          if (message.count < 0) {
            throw Error('meshopt worker stub: negative count');
          }
          const target = new Uint8Array(message.count * message.size);
          target.set(message.source.subarray(0, target.byteLength));
          this.onmessage?.({
            data: { type: 'decoded', id: message.id, target },
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
