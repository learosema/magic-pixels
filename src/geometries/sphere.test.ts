import { BufferGeometry } from '.';
import { createSphereGeometry } from './sphere';

describe('Geometry for a sphere', () => {
  test('createSphereGeometry returns an indexed geometry', () => {
    const sides = 6;
    const segments = 6;
    const sphere = createSphereGeometry(10, sides, segments);
    expect(sphere).toBeInstanceOf(BufferGeometry);
    const { position, normal, uv } = sphere.attributes;

    const vertexCount = (sides + 1) * (segments + 1);
    expect(position.count).toBe(vertexCount);
    expect(normal.count).toBe(vertexCount);
    expect(uv.count).toBe(vertexCount);

    // top and bottom segments are triangles, the others quads
    const faceCount = sides * 2 + sides * (segments - 2) * 2;
    expect(sphere.index).toHaveLength(faceCount * 3);
    expect(sphere.count).toBe(faceCount * 3);
    expect(sphere.indexType).toBe(16);
    expect(Math.max(...(sphere.index as number[]))).toBeLessThan(vertexCount);

    // every vertex lies on the sphere
    for (let i = 0; i < vertexCount; i++) {
      const [x, y, z] = position.data.slice(i * 3, i * 3 + 3);
      expect(Math.hypot(x, y, z)).toBeCloseTo(10);
    }
  });
});
