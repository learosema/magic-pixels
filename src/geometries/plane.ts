import { Vector } from '../types';
import { facesToBuffer } from './faces-to-buffer';
import { BufferGeometry, BufferAttribute } from './buffer-geometry';

/**
 * create a plane grid mesh
 * @param width width of the plane
 * @param height height of the plane
 * @param rows number of rows
 * @param cols number of columns
 */
export function createPlaneGeometry(
  width = 2,
  height = 2,
  rows = 1,
  cols = 1
): BufferGeometry {
  const cols1 = cols + 1;
  const rows1 = rows + 1;
  const deltaX = width / cols;
  const deltaY = height / rows;
  const vertices: Vector[] = Array(cols1 * rows1)
    .fill(0)
    .map((_, i) => {
      const ix = i % cols1;
      const iy = (i / cols1) | 0;
      return new Vector(ix * deltaX - width / 2, iy * deltaY - height / 2, 0);
    });
  const uvs: Vector[] = Array(cols1 * rows1)
    .fill(0)
    .map((_, i) => {
      const ix = i % cols1;
      const iy = (i / cols1) | 0;
      return new Vector(ix / cols, 1 - iy / rows);
    });

  // array of 3 vertex indexes forming a triangle each
  const faces: number[][] = Array(rows * cols)
    .fill(0)
    .map((_, i) => {
      // each square consists of 2 triangles
      const ix = i % cols;
      const iy = (i / cols) | 0;
      const idx = iy * rows1 + ix;
      return [
        [idx, idx + 1, idx + rows1],
        [idx + 1, idx + rows1 + 1, idx + rows1],
      ];
    })
    .flat(1);

  const normals = new Float32Array(
    faces
      .map(() => {
        const n = [0, 0, 1];
        return [n, n, n].flat(1);
      })
      .flat(1)
  );

  const geometry = new BufferGeometry();
  const positionBuffer = new Float32Array(facesToBuffer(faces, vertices));
  const uvBuffer = new Float32Array(facesToBuffer(faces, uvs));
  geometry.setAttribute('position', new BufferAttribute(positionBuffer, 3));
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvBuffer, 2));
  return geometry;
}
