import { BufferAttribute, BufferGeometry, createPlaneGeometry } from '.';
import { mergeGeometries } from './merge-geometries';

describe('mergeGeometries tests', () => {
  test('merging two non-indexed geometries', () => {
    const plane1 = createPlaneGeometry(2, 2);
    const plane2 = createPlaneGeometry(4, 4);
    const merged = mergeGeometries(plane1, plane2);
    expect(merged.attributes.position).toBeDefined();
    expect(merged.attributes.position.recordSize).toEqual(
      plane1.attributes.position.recordSize
    );
    expect(merged.attributes.position.recordSize).toEqual(
      plane2.attributes.position.recordSize
    );
    expect(merged.attributes.position.data.length).toBe(
      merged.attributes.position.recordSize * 12
    );
    //prettier-ignore
    expect(Array.from(merged.attributes.position.data)).toEqual([
      // first plane
      -1, -1, 0, // bottom left
       1, -1, 0, // bottom right
      -1,  1, 0, // top left
       1, -1, 0, // bottom right
       1,  1, 0, // top right
      -1,  1, 0, // top left 
      // second plane
      -2, -2, 0, // bottom left
       2, -2, 0, // bottom right
      -2,  2, 0, // top left
       2, -2, 0, // bottom right
       2,  2, 0, // top right
      -2,  2, 0, // top left
    ]);
    expect(merged.groups).toEqual([
      { startIndex: 0, count: 6 },
      { startIndex: 6, count: 6 },
    ]);
  });

  test('merging two indexed geometries', () => {
    const triangle1 = new BufferGeometry();
    const triangle2 = new BufferGeometry();
    triangle1.setAttribute(
      'position',
      new BufferAttribute(new Float32Array([-1, -1, 1, -1, -1, 1]), 2)
    );
    //prettier-ignore
    triangle2.setAttribute('position', new BufferAttribute(new Float32Array([ 
       1, -1, 0, // bottom right
       1,  1, 0, // top right
      -1,  1, 0  // top left
    ]), 3));
    triangle1.setIndex([0, 1, 2]);
    triangle2.setIndex([2, 1, 0]);
    const merged = mergeGeometries(triangle1, triangle2);
    expect(merged.attributes.position.recordSize).toEqual(3);
    //prettier-ignore
    expect(Array.from(merged.attributes.position.data)).toEqual([
      -1, -1, 0, // bottom left
       1, -1, 0, // bottom right
      -1,  1, 0, // top left
       1, -1, 0, // bottom right
       1,  1, 0, // top right
      -1,  1, 0  // top left
    ]);
    expect(merged.index).toEqual([0, 1, 2, 5, 4, 3]);
    expect(merged.groups).toEqual([
      { startIndex: 0, count: 3 },
      { startIndex: 3, count: 3 },
    ]);
  });
});
