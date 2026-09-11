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

describe('Plane geometry with rows !== cols', () => {
  test('face indices stay inside the vertex grid', () => {
    const rows = 1;
    const cols = 3;
    const geometry = createPlaneGeometry(2, 2, rows, cols);
    const { position, uv } = geometry.attributes;
    expect(geometry.count).toBe(rows * cols * 6);
    expect(position.count).toBe(rows * cols * 6);
    expect(uv.count).toBe(rows * cols * 6);
    // every vertex lies on the plane inside the given bounds
    for (let i = 0; i < position.count; i++) {
      const x = position.data[i * 3];
      const y = position.data[i * 3 + 1];
      expect(Number.isNaN(x)).toBe(false);
      expect(Math.abs(x)).toBeLessThanOrEqual(1);
      expect(Math.abs(y)).toBeLessThanOrEqual(1);
    }
    // each triangle covers a non-empty area
    for (let i = 0; i < position.count; i += 3) {
      const [ax, ay] = [position.data[i * 3], position.data[i * 3 + 1]];
      const [bx, by] = [position.data[i * 3 + 3], position.data[i * 3 + 4]];
      const [cx, cy] = [position.data[i * 3 + 6], position.data[i * 3 + 7]];
      const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
      expect(Math.abs(area)).toBeCloseTo((2 / cols) * (2 / rows));
    }
  });
});
