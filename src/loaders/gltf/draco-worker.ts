import { decodeDraco } from './draco';
import type { DracoDecoderModule as DracoModule } from './draco';
import type {
  DracoWorkerRequest,
  DracoWorkerResponse,
} from './draco-worker-protocol';

/**
 * Entry point of the Draco worker, bundled on its own to `dist/draco-worker.js`
 * (see `build.js`) and spawned by {@link DracoWorkerPool}. A classic
 * (non-module) worker, not an ES module one: the Draco decoder script is
 * only published as a classic script, and `importScripts()` - the only way
 * to pull a classic script into a worker - does not exist in module workers.
 * `self` is declared by hand, narrowed to just what this file uses, rather
 * than by pulling in the `webworker` lib, which TypeScript cannot combine
 * with the `dom` lib the rest of the project already uses.
 */
declare const self: {
  onmessage: ((event: { data: DracoWorkerRequest }) => void) | null;
  postMessage(message: DracoWorkerResponse, transfer?: Transferable[]): void;
  importScripts(...urls: string[]): void;
};
declare const DracoDecoderModule: (config: object) => Promise<DracoModule>;

let modulePromise: Promise<DracoModule> | undefined;
let modulePath: string | undefined;

/** Load and initialize the decoder script once per `decoderPath`, cached */
function getModule(decoderPath: string): Promise<DracoModule> {
  if (!modulePromise || modulePath !== decoderPath) {
    modulePath = decoderPath;
    modulePromise = Promise.resolve().then(() => {
      self.importScripts(`${decoderPath}draco_decoder.js`);
      return DracoDecoderModule({});
    });
  }
  return modulePromise;
}

self.onmessage = (event) => {
  const request = event.data;
  getModule(request.decoderPath).then(
    (module) => {
      try {
        const result = decodeDraco(module, request);
        const transfer: Transferable[] = [result.indices.buffer];
        for (const attribute of Object.values(result.attributes)) {
          transfer.push(attribute.data.buffer);
        }
        const response: DracoWorkerResponse = {
          type: 'decoded',
          id: request.id,
          ...result,
        };
        self.postMessage(response, transfer);
      } catch (error) {
        respondWithError(request.id, error);
      }
    },
    (error: unknown) => respondWithError(request.id, error)
  );
};

function respondWithError(id: number, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const response: DracoWorkerResponse = { type: 'error', id, message };
  self.postMessage(response);
}
