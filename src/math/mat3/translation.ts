import { Matrix } from '../matrix';

/**
 * create translation matrix
 * @param x translation in x-direction
 * @param y translation in y-direction
 * @returns 3x3 translation matrix
 */
export function translation(x: number, y: number): Matrix {
  // prettier-ignore
  return new Matrix([
    1, 0, 0,
    0, 1, 0,
    x, y, 1
  ]);
}
