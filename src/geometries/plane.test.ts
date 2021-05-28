import { BufferGeometry } from './buffer-geometry';
import { createPlaneGeometry } from './plane';

describe('Plane geometry tests', () => {
  test('simple plane geometry', () => {
    const geometry = createPlaneGeometry(2, 2);

    //prettier-ignore
    expect([...geometry.attributes.position.data]).toEqual([
      -1, -1, 0,  1, -1, 0, -1, 1, 0,
       1, -1, 0,  1,  1, 0,  -1, 1, 0
    ]);
    //prettier-ignore
    expect([...geometry.attributes.normal.data]).toEqual([
      0,0,1, 0,0,1, 0,0,1, 0,0,1, 0,0,1, 0,0,1
    ]);

    //prettier-ignore
    expect([...geometry.attributes.uv.data]).toEqual([
      0,1, 1,1, 0,0, 1,1, 1,0, 0,0
    ]);
  });

  test('subdivided plane geometry', () => {
    const geometry = createPlaneGeometry(2, 2, 2, 2);
    // prettier-ignore
    const expectedPositionData = [
      -1, -1, 0,  0, -1, 0, -1,  0, 0, 0, -1, 0,
       0,  0, 0, -1,  0, 0,  0, -1, 0, 1, -1, 0,
       0,  0, 0,  1, -1, 0,  1,  0, 0, 0,  0, 0,
      -1,  0, 0,  0,  0, 0, -1,  1, 0, 0,  0, 0,
       0,  1, 0, -1,  1, 0,  0,  0, 0, 1,  0, 0,
       0,  1, 0,  1,  0, 0,  1,  1, 0, 0,  1, 0
    ];
    expect([...geometry.attributes.position.data]).toEqual(
      expectedPositionData
    );
    expect(geometry).toBeInstanceOf(BufferGeometry);
  });
});
