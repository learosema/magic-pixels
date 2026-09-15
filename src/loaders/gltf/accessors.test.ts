import { BufferAttribute } from '../../geometries';
import {
  getBufferView,
  readAccessor,
  readAccessorData,
  readIndices,
} from './accessors';
import { GltfBuilder, interleaved, sparse } from './fixtures';

function buffersOf(builder: GltfBuilder): Uint8Array[] {
  return [builder.bin];
}

describe('getBufferView', () => {
  test('returns the byte window of the view without copying', () => {
    const builder = new GltfBuilder();
    builder.addBufferView(new Uint8Array([1, 2, 3]));
    const view = builder.addBufferView(new Uint8Array([4, 5]));
    const [buffer] = buffersOf(builder);
    const bytes = getBufferView(builder.json, view, [buffer]);
    expect(Array.from(bytes)).toEqual([4, 5]);
    expect(bytes.buffer).toBe(buffer.buffer);
    // the second view starts on a 4 byte boundary
    expect(bytes.byteOffset).toBe(4);
  });

  test('rejects missing views, buffers and overruns', () => {
    const builder = new GltfBuilder();
    builder.addBufferView(new Uint8Array(8));
    expect(() => getBufferView(builder.json, 1, buffersOf(builder))).toThrow(
      /bufferView 1/
    );
    expect(() => getBufferView(builder.json, 0, [])).toThrow(/buffer 0/);
    expect(() => getBufferView(builder.json, 0, [new Uint8Array(4)])).toThrow(
      /exceeds/
    );
  });
});

describe('readAccessor', () => {
  test('float vec3 becomes a Float32Array attribute of record size 3', () => {
    const builder = new GltfBuilder();
    const index = builder.addData(new Float32Array([1, 2, 3, 4, 5, 6]), 'VEC3');
    const attribute = readAccessor(builder.json, index, buffersOf(builder));
    expect(attribute).toBeInstanceOf(BufferAttribute);
    expect(attribute.data).toBeInstanceOf(Float32Array);
    expect(Array.from(attribute.data)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(attribute.recordSize).toBe(3);
    expect(attribute.count).toBe(2);
    expect(attribute.normalized).toBe(false);
  });

  test('every component type maps to its typed array', () => {
    const builder = new GltfBuilder();
    const cases: [ArrayLike<number> & { constructor: unknown }, unknown][] = [
      [new Int8Array([-1, 1]), Int8Array],
      [new Uint8Array([1, 2]), Uint8Array],
      [new Int16Array([-300, 300]), Int16Array],
      [new Uint16Array([300, 400]), Uint16Array],
      [new Uint32Array([70000, 1]), Uint32Array],
      [new Float32Array([0.5, 1.5]), Float32Array],
    ];
    for (const [data, Ctor] of cases) {
      const index = builder.addData(data as Float32Array, 'SCALAR');
      const attribute = readAccessor(builder.json, index, buffersOf(builder));
      expect(attribute.data.constructor).toBe(Ctor);
      expect(Array.from(attribute.data)).toEqual(Array.from(data));
    }
  });

  test('passes normalized through and honours the accessor byteOffset', () => {
    const builder = new GltfBuilder();
    const view = builder.addBufferView(
      new Uint8Array([9, 9, 9, 9, 0, 128, 255, 64])
    );
    const index = builder.addAccessor({
      bufferView: view,
      byteOffset: 4,
      componentType: 5121,
      normalized: true,
      count: 2,
      type: 'VEC2',
    });
    const attribute = readAccessor(builder.json, index, buffersOf(builder));
    expect(attribute.normalized).toBe(true);
    expect(Array.from(attribute.data)).toEqual([0, 128, 255, 64]);
  });

  test('de-interleaves a strided buffer view into tightly packed arrays', () => {
    const builder = interleaved();
    const buffers = buffersOf(builder);
    const { POSITION, TEXCOORD_0 } =
      builder.json.meshes![0].primitives[0].attributes;
    const position = readAccessor(builder.json, POSITION, buffers);
    const uv = readAccessor(builder.json, TEXCOORD_0, buffers);
    expect(Array.from(position.data)).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    expect(Array.from(uv.data)).toEqual([0, 0, 1, 0, 0, 1]);
    expect(position.data.byteLength).toBe(36);
  });

  test('copies unaligned data instead of aliasing it', () => {
    const builder = new GltfBuilder();
    // three padding bytes put the floats at an odd offset
    const view = builder.addBufferView(
      new Uint8Array([0, 0, 0, 0, 0, 128, 63, 0, 0, 0, 64])
    );
    const index = builder.addAccessor({
      bufferView: view,
      byteOffset: 3,
      componentType: 5126,
      count: 2,
      type: 'SCALAR',
    });
    const data = readAccessorData(builder.json, index, buffersOf(builder));
    expect(Array.from(data)).toEqual([1, 2]);
  });

  test('applies sparse substitutions over a zero base', () => {
    const builder = sparse();
    const data = readAccessorData(builder.json, 0, buffersOf(builder));
    expect(Array.from(data)).toEqual([
      0, 0, 0, 10, 11, 12, 0, 0, 0, 30, 31, 32, 0, 0, 0,
    ]);
  });

  test('applies sparse substitutions over buffer view data', () => {
    const builder = new GltfBuilder();
    const base = builder.addBufferView(new Uint16Array([1, 2, 3, 4]));
    const indices = builder.addBufferView(new Uint16Array([3]));
    const values = builder.addBufferView(new Uint16Array([40]));
    const index = builder.addAccessor({
      bufferView: base,
      componentType: 5123,
      count: 4,
      type: 'SCALAR',
      sparse: {
        count: 1,
        indices: { bufferView: indices, componentType: 5123 },
        values: { bufferView: values },
      },
    });
    const data = readAccessorData(builder.json, index, buffersOf(builder));
    expect(Array.from(data)).toEqual([1, 2, 3, 40]);
  });

  test('rejects an accessor that overruns its buffer view', () => {
    const builder = new GltfBuilder();
    const view = builder.addBufferView(new Float32Array(2));
    const index = builder.addAccessor({
      bufferView: view,
      componentType: 5126,
      count: 3,
      type: 'SCALAR',
    });
    expect(() =>
      readAccessorData(builder.json, index, buffersOf(builder))
    ).toThrow(/exceeds/);
  });
});

describe('readIndices', () => {
  test('16 and 32 bit indices are returned as they are', () => {
    const builder = new GltfBuilder();
    const short = builder.addData(new Uint16Array([0, 1, 2]), 'SCALAR');
    const int = builder.addData(new Uint32Array([0, 70000, 2]), 'SCALAR');
    const buffers = buffersOf(builder);
    expect(readIndices(builder.json, short, buffers)).toBeInstanceOf(
      Uint16Array
    );
    const wide = readIndices(builder.json, int, buffers);
    expect(wide).toBeInstanceOf(Uint32Array);
    expect(Array.from(wide)).toEqual([0, 70000, 2]);
  });

  test('8 bit indices are widened to 16 bits', () => {
    const builder = new GltfBuilder();
    const index = builder.addData(new Uint8Array([2, 1, 0]), 'SCALAR');
    const indices = readIndices(builder.json, index, buffersOf(builder));
    expect(indices).toBeInstanceOf(Uint16Array);
    expect(Array.from(indices)).toEqual([2, 1, 0]);
  });

  test('rejects float and non-scalar index accessors', () => {
    const builder = new GltfBuilder();
    const float = builder.addData(new Float32Array([0, 1, 2]), 'SCALAR');
    const vec = builder.addData(new Uint16Array([0, 1, 2]), 'VEC3');
    expect(() => readIndices(builder.json, float, buffersOf(builder))).toThrow(
      /componentType 5126/
    );
    expect(() => readIndices(builder.json, vec, buffersOf(builder))).toThrow(
      /SCALAR/
    );
  });
});
