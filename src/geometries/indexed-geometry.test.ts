import { createPlaneGeometry } from './plane';
import { createIndexedGeometry } from './indexed-geometry';

describe('createIndexedGeometry tests', () => {
  test('createIndexedGeometry creates an indexed geometry from a non-indexed one', () => {
    const plane = createPlaneGeometry(2, 2, 1, 1);
    const indexedPlane = createIndexedGeometry(plane);
    expect(indexedPlane.index).not.toBeNull();
    expect(indexedPlane.indexType).toBe(16);
    expect(indexedPlane.attributes.position.recordSize).toEqual(
      plane.attributes.position.recordSize
    );
    expect(indexedPlane.attributes.position.data.length).toBe(
      4 * indexedPlane.attributes.position.recordSize
    );
    expect(indexedPlane.count).toBe(6);
    //prettier-ignore
    expect(Array.from(indexedPlane.attributes.position.data)).toEqual([
      -1, -1, 0, // bottom left
       1, -1, 0, // bottom right
      -1,  1, 0, // top left
       1,  1, 0, // top right
    ]);

    // triangle vertices are arranged in a counter-clockwise way

    //prettier-ignore
    expect(indexedPlane.index).toEqual([
      0, 1, 2, // triangle 1
      1, 3, 2, // triangle 2
    ]);
  });

  test('createIndexedGeometry throws an error if the geometry is already indexed', () => {
    const plane = createPlaneGeometry(2, 2, 1, 1);
    const indexedPlane = createIndexedGeometry(plane);
    expect(() => createIndexedGeometry(indexedPlane)).toThrowError();
  });
});
