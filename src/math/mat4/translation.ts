import { Matrix } from '../matrix';

/**
 * create translation matrix
 * @param x translation in X direction
 * @param y translation in Y direction
 * @param z translation in Z direction
 */
export function translation(x: number, y: number, z: number): Matrix {
  // prettier-ignore
  return new Matrix([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1
  ]);
}
