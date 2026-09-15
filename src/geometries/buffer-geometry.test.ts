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

describe('BufferAttribute.getComponent', () => {
  test('returns stored values for floats and non-normalized integers', () => {
    const floats = new BufferAttribute(new Float32Array([0.5, -2, 7]), 3);
    expect(floats.getComponent(0, 1)).toBe(-2);
    const ints = new BufferAttribute(new Int16Array([100, 200, 300, 400]), 2);
    expect(ints.getComponent(1, 1)).toBe(400);
  });

  test('maps normalized integers to 0..1 and -1..1', () => {
    expect(
      new BufferAttribute(new Uint8Array([0, 255, 51]), 3, true).getComponent(
        0,
        1
      )
    ).toBe(1);
    expect(
      new BufferAttribute(new Uint8Array([0, 255, 51]), 3, true).getComponent(
        0,
        2
      )
    ).toBeCloseTo(0.2);
    expect(
      new BufferAttribute(
        new Int16Array([32767, -32768]),
        1,
        true
      ).getComponent(0, 0)
    ).toBe(1);
    // the most negative value clamps to -1 (WebGL's rule for signed types)
    expect(
      new BufferAttribute(
        new Int16Array([32767, -32768]),
        1,
        true
      ).getComponent(1, 0)
    ).toBe(-1);
    expect(
      new BufferAttribute(new Int8Array([-127]), 1, true).getComponent(0, 0)
    ).toBe(-1);
    expect(
      new BufferAttribute(new Uint16Array([65535]), 1, true).getComponent(0, 0)
    ).toBe(1);
  });
});

describe('bounding volumes', () => {
  function triangle(): BufferGeometry {
    return new BufferGeometry().setAttribute(
      'position',
      new BufferAttribute(new Float32Array([0, 0, 0, 4, 0, 0, 0, 3, 0]), 3)
    );
  }

  test('computeBoundingBox spans the positions and caches the result', () => {
    const geometry = triangle();
    expect(geometry.boundingBox).toBeNull();
    const box = geometry.computeBoundingBox();
    expect(box.min.toArray()).toEqual([0, 0, 0]);
    expect(box.max.toArray()).toEqual([4, 3, 0]);
    expect(geometry.boundingBox).toBe(box);
    // recomputing reuses the object
    expect(geometry.computeBoundingBox()).toBe(box);
  });

  test('computeBoundingBox honours normalized integer positions', () => {
    const geometry = new BufferGeometry().setAttribute(
      'position',
      new BufferAttribute(
        new Int16Array([-32767, 0, 0, 32767, 16383, 0]),
        3,
        true
      )
    );
    const box = geometry.computeBoundingBox();
    expect(box.min.x).toBe(-1);
    expect(box.max.x).toBe(1);
    expect(box.max.y).toBeCloseTo(0.5, 3);
  });

  test('computeBoundingBox is empty without positions and handles 2D positions', () => {
    expect(new BufferGeometry().computeBoundingBox().isEmpty).toBe(true);
    const flat = new BufferGeometry().setAttribute(
      'position',
      new BufferAttribute(new Float32Array([-1, -1, 1, 2]), 2)
    );
    const box = flat.computeBoundingBox();
    expect(box.min.toArray()).toEqual([-1, -1, 0]);
    expect(box.max.toArray()).toEqual([1, 2, 0]);
  });

  test('computeBoundingSphere is centred on the box with the farthest vertex as radius', () => {
    const geometry = triangle();
    const sphere = geometry.computeBoundingSphere();
    expect(geometry.boundingBox).not.toBeNull();
    expect(sphere.center.toArray()).toEqual([2, 1.5, 0]);
    expect(sphere.radius).toBe(2.5);
    expect(geometry.boundingSphere).toBe(sphere);
    expect(new BufferGeometry().computeBoundingSphere().isEmpty).toBe(true);
  });
});
