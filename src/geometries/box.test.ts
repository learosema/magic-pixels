import { createBoxGeometry } from './box';
import { BufferGeometry } from './buffer-geometry';

describe('Box geometry tests', () => {
  test('createBoxGeometry test', () => {
    const geometry = createBoxGeometry();
    expect(geometry).toBeInstanceOf(BufferGeometry);

    // the position and normal buffer should contain 4 (x,y,z)-triples per side, 72 in total
    expect(geometry.attributes.position.data.length).toBe(72);
    expect(geometry.attributes.normal.data.length).toBe(72);

    // prettier-ignore
    const expectedPositionBuffer = [
       0.5,  0.5,  0.5,  0.5,  0.5, -0.5,  0.5, -0.5,  0.5,  0.5, -0.5, -0.5,  // positive X
      -0.5,  0.5, -0.5, -0.5,  0.5,  0.5, -0.5, -0.5, -0.5, -0.5, -0.5,  0.5,  // negative X
      -0.5,  0.5, -0.5,  0.5,  0.5, -0.5, -0.5,  0.5,  0.5,  0.5,  0.5,  0.5,  // positive Y
      -0.5, -0.5,  0.5,  0.5, -0.5,  0.5, -0.5, -0.5, -0.5,  0.5, -0.5, -0.5,  // negative Y
      -0.5,  0.5,  0.5,  0.5,  0.5,  0.5, -0.5, -0.5,  0.5,  0.5, -0.5,  0.5,  // positive Z
       0.5,  0.5, -0.5, -0.5,  0.5, -0.5,  0.5, -0.5, -0.5, -0.5, -0.5, -0.5   // negative Z
    ];

    const normals = {
      px: [1, 0, 0],
      nx: [-1, 0, 0],
      py: [0, 1, 0],
      ny: [0, -1, 0],
      pz: [0, 0, 1],
      nz: [0, 0, -1],
    };

    const expectedNormalBuffer = [
      ...Array(4).fill(normals.px),
      ...Array(4).fill(normals.nx),
      ...Array(4).fill(normals.py),
      ...Array(4).fill(normals.ny),
      ...Array(4).fill(normals.pz),
      ...Array(4).fill(normals.nz),
    ].flat();

    expect([...geometry.attributes.position.data]).toEqual(
      expectedPositionBuffer
    );
    expect([...geometry.attributes.normal.data]).toEqual(expectedNormalBuffer);

    const expectedUvData = Array(6).fill([0, 1, 1, 1, 0, 0, 1, 0]).flat();
    expect([...geometry.attributes.uv.data]).toEqual(expectedUvData);
  });
});
