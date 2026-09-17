import type { TypedArray } from '../../geometries/buffer-geometry';
import type { DracoRequest } from './draco';

/**
 * Message shapes exchanged between {@link DracoWorkerPool} (main thread)
 * and `draco-worker.ts` (the worker). Both sides import this module, so
 * there is exactly one definition of the protocol.
 */
export type DracoWorkerRequest = DracoRequest & {
  type: 'decode';
  id: number;
  /** where the worker `importScripts()`s the Draco decoder script from */
  decoderPath: string;
};

export type DracoWorkerResponse =
  | {
      type: 'decoded';
      id: number;
      attributes: Record<
        string,
        { data: TypedArray; recordSize: number; normalized: boolean }
      >;
      indices: Uint16Array | Uint32Array;
    }
  | { type: 'error'; id: number; message: string };
