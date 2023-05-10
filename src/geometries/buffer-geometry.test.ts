import { BufferAttribute, BufferGeometry } from './buffer-geometry';

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
});
