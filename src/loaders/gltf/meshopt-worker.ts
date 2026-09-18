import type { MeshoptDecoder } from './meshopt';
import type {
  MeshoptWorkerRequest,
  MeshoptWorkerResponse,
} from './meshopt-worker-protocol';

/**
 * Entry point of the meshopt worker, bundled on its own to
 * `dist/meshopt-worker.js` (see `build.js`) and spawned by
 * `MeshoptWorkerPool`. A classic (non-module) worker, like `draco-worker.ts`
 * - not because it needs to be (meshoptimizer's decoder is a real ES
 * module, unlike Draco's), but so both workers build and load the same
 * way. Dynamic `import()` works in a classic script too, so the module is
 * still loaded as ESM. `self` is declared by hand, narrowed to just what
 * this file uses, rather than by pulling in the `webworker` lib, which
 * TypeScript cannot combine with the `dom` lib the rest of the project
 * already uses.
 */
declare const self: {
  onmessage: ((event: { data: MeshoptWorkerRequest }) => void) | null;
  postMessage(message: MeshoptWorkerResponse, transfer?: Transferable[]): void;
};

let modulePromise: Promise<MeshoptDecoder> | undefined;
let modulePath: string | undefined;

/** Import and await `.ready` once per `moduleUrl`, cached */
function getModule(moduleUrl: string): Promise<MeshoptDecoder> {
  if (!modulePromise || modulePath !== moduleUrl) {
    modulePath = moduleUrl;
    modulePromise = import(moduleUrl).then(
      async (module: { MeshoptDecoder: MeshoptDecoder }) => {
        const decoder = module.MeshoptDecoder;
        await decoder.ready;
        return decoder;
      }
    );
  }
  return modulePromise;
}

self.onmessage = (event) => {
  const request = event.data;
  getModule(request.moduleUrl).then(
    (decoder) => {
      try {
        const target = new Uint8Array(request.count * request.size);
        decoder.decodeGltfBuffer(
          target,
          request.count,
          request.size,
          request.source,
          request.mode,
          request.filter
        );
        const response: MeshoptWorkerResponse = {
          type: 'decoded',
          id: request.id,
          target,
        };
        self.postMessage(response, [target.buffer]);
      } catch (error) {
        respondWithError(request.id, error);
      }
    },
    (error: unknown) => respondWithError(request.id, error)
  );
};

function respondWithError(id: number, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const response: MeshoptWorkerResponse = { type: 'error', id, message };
  self.postMessage(response);
}
