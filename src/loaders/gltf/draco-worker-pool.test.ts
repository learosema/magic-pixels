import { DracoWorkerPool } from './draco-worker-pool';
import type { DracoRequest } from './draco';
import { createFakeDracoWorkerClass } from './fixtures';

function request(): DracoRequest {
  return {
    bytes: new Uint8Array([1, 2, 3]),
    attributes: {
      POSITION: {
        uniqueId: 0,
        type: 'VEC3',
        componentType: 5126,
        normalized: false,
      },
    },
    indexComponentType: undefined,
  };
}

function emptyRequest(): DracoRequest {
  return {
    bytes: new Uint8Array([1, 2, 3]),
    attributes: {},
    indexComponentType: undefined,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test('decode() spawns a worker and resolves with its decoded result', async () => {
  const { FakeWorker } = createFakeDracoWorkerClass({
    attributes: {
      0: {
        values: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        componentType: 5126,
        itemSize: 3,
      },
    },
    numPoints: 3,
    indices: [0, 1, 2],
  });
  vi.stubGlobal('Worker', FakeWorker);

  const pool = new DracoWorkerPool({ decoderPath: 'https://example.test/' });
  const result = await pool.decode(request());

  expect(result.attributes.POSITION.data).toEqual(
    new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])
  );
  expect(result.indices).toEqual(new Uint16Array([0, 1, 2]));
});

test("decode() copies bytes so the transfer list never detaches the caller's buffer", async () => {
  const { FakeWorker } = createFakeDracoWorkerClass({
    attributes: {},
    numPoints: 0,
    indices: [],
  });
  vi.stubGlobal('Worker', FakeWorker);

  const pool = new DracoWorkerPool({ decoderPath: 'https://example.test/' });
  const req = emptyRequest();
  const originalBytes = req.bytes;
  await pool.decode(req);

  expect(req.bytes).toBe(originalBytes);
  expect(originalBytes.byteLength).toBe(3);
});

test('spawns at most workerLimit workers and round-robins beyond it', async () => {
  const { FakeWorker, calls } = createFakeDracoWorkerClass({
    attributes: {},
    numPoints: 0,
    indices: [],
  });
  vi.stubGlobal('Worker', FakeWorker);

  const pool = new DracoWorkerPool({
    decoderPath: 'https://example.test/',
    workerLimit: 2,
  });
  await Promise.all([
    pool.decode(emptyRequest()),
    pool.decode(emptyRequest()),
    pool.decode(emptyRequest()),
    pool.decode(emptyRequest()),
  ]);

  expect(calls.constructed).toBe(2);
});

test('a Draco error in the worker rejects only that request', async () => {
  const { FakeWorker } = createFakeDracoWorkerClass({
    attributes: {},
    numPoints: 0,
    indices: [],
  });
  vi.stubGlobal('Worker', FakeWorker);

  const pool = new DracoWorkerPool({ decoderPath: 'https://example.test/' });
  await expect(
    pool.decode({
      bytes: new Uint8Array([1]),
      attributes: {
        POSITION: {
          uniqueId: 99,
          type: 'VEC3',
          componentType: 5126,
          normalized: false,
        },
      },
      indexComponentType: undefined,
    })
  ).rejects.toThrow(/no attribute with unique id 99/);
});

test('dispose() terminates every spawned worker', async () => {
  const { FakeWorker, calls } = createFakeDracoWorkerClass({
    attributes: {},
    numPoints: 0,
    indices: [],
  });
  vi.stubGlobal('Worker', FakeWorker);

  const pool = new DracoWorkerPool({
    decoderPath: 'https://example.test/',
    workerLimit: 2,
  });
  await Promise.all([pool.decode(emptyRequest()), pool.decode(emptyRequest())]);
  pool.dispose();

  expect(calls.terminated).toBe(2);
});
