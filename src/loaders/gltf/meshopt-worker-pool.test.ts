import { MeshoptWorkerPool } from './meshopt-worker-pool';
import { createFakeMeshoptWorkerClass } from './fixtures';

afterEach(() => {
  vi.unstubAllGlobals();
});

test('decode() spawns a worker and resolves with its decoded result', async () => {
  const { FakeWorker } = createFakeMeshoptWorkerClass();
  vi.stubGlobal('Worker', FakeWorker);

  const pool = new MeshoptWorkerPool({
    moduleUrl: 'https://example.test/meshopt_decoder.mjs',
  });
  const source = new Uint8Array([1, 2, 3, 4]);
  const result = await pool.decode(1, 4, source, 'ATTRIBUTES', undefined);

  expect(result).toEqual(source);
});

test("decode() copies bytes so the transfer list never detaches the caller's buffer", async () => {
  const { FakeWorker } = createFakeMeshoptWorkerClass();
  vi.stubGlobal('Worker', FakeWorker);

  const pool = new MeshoptWorkerPool({
    moduleUrl: 'https://example.test/meshopt_decoder.mjs',
  });
  const source = new Uint8Array([1, 2, 3, 4]);
  await pool.decode(1, 4, source, 'ATTRIBUTES', undefined);

  expect(source.byteLength).toBe(4);
  expect(Array.from(source)).toEqual([1, 2, 3, 4]);
});

test('a decode error in the worker rejects only that request', async () => {
  const { FakeWorker } = createFakeMeshoptWorkerClass();
  vi.stubGlobal('Worker', FakeWorker);

  const pool = new MeshoptWorkerPool({
    moduleUrl: 'https://example.test/meshopt_decoder.mjs',
  });
  await expect(
    pool.decode(-1, 4, new Uint8Array([1]), 'ATTRIBUTES', undefined)
  ).rejects.toThrow(/negative count/);
});

test('dispose() terminates every spawned worker', async () => {
  const { FakeWorker, calls } = createFakeMeshoptWorkerClass();
  vi.stubGlobal('Worker', FakeWorker);

  const pool = new MeshoptWorkerPool({
    moduleUrl: 'https://example.test/meshopt_decoder.mjs',
    workerLimit: 2,
  });
  await Promise.all([
    pool.decode(1, 4, new Uint8Array([1, 2, 3, 4]), 'ATTRIBUTES', undefined),
    pool.decode(1, 4, new Uint8Array([5, 6, 7, 8]), 'ATTRIBUTES', undefined),
  ]);
  pool.dispose();

  expect(calls.constructed).toBe(2);
  expect(calls.terminated).toBe(2);
});
