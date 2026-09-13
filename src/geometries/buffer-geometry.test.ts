import { BufferAttribute, BufferGeometry } from '.';

describe('BufferGeometry tests', () => {
  test('setAttribute create an attribute on the geometry', () => {
    const triangle = new BufferGeometry();
    triangle.setAttribute(
      'position',
      new BufferAttribute(new Float32Array([-1, -1, 1, -1, -1, 1]), 2)
    );
    expect(triangle.attributes.position).toBeDefined();
    expect(triangle.count).toEqual(3);
  });

  test('setIndex stores a typed array sized by the bits argument', () => {
    const geometry = new BufferGeometry();
    geometry.setIndex([0, 1, 2]);
    expect(geometry.index).toBeInstanceOf(Uint16Array);
    expect(geometry.indexType).toBe(16);

    geometry.setIndex([0, 1, 2], 32);
    expect(geometry.index).toBeInstanceOf(Uint32Array);
    expect(geometry.indexType).toBe(32);
  });
});

describe('BufferAttribute tests', () => {
  test('count works with any typed array kind', () => {
    expect(new BufferAttribute(new Uint8Array(8), 2).count).toBe(4);
    expect(new BufferAttribute(new Int16Array(9), 3).count).toBe(3);
  });

  test('normalized defaults to false and can be set explicitly', () => {
    expect(new BufferAttribute(new Float32Array(3), 3).normalized).toBe(false);
    expect(new BufferAttribute(new Int16Array(3), 3, true).normalized).toBe(
      true
    );
  });
});
