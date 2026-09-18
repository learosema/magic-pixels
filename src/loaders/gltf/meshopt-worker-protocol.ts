import type { GltfMeshoptCompression } from './types';

/**
 * Message shapes exchanged between `MeshoptWorkerPool` (main thread) and
 * `meshopt-worker.ts` (the worker). Both sides import this module, so
 * there is exactly one definition of the protocol.
 */
export type MeshoptWorkerRequest = {
  type: 'decode';
  id: number;
  /** the worker `import()`s the decoder module from this URL */
  moduleUrl: string;
  count: number;
  size: number;
  source: Uint8Array;
  mode: GltfMeshoptCompression['mode'];
  filter: GltfMeshoptCompression['filter'];
};

export type MeshoptWorkerResponse =
  | { type: 'decoded'; id: number; target: Uint8Array }
  | { type: 'error'; id: number; message: string };
