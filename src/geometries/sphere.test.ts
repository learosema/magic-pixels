import { BufferGeometry } from '.';
import { createSphereGeometry } from './sphere';

describe('Geometry for a sphere', () => {
  test('createSphereGeometry', () => {
    const sphere = createSphereGeometry(10, 6, 6);
    expect(sphere).toBeInstanceOf(BufferGeometry);
    expect(sphere.attributes.position).toBeDefined();
    expect(sphere.attributes.normal).toBeDefined();
    expect(sphere.attributes.uv).toBeDefined();
  });
});
