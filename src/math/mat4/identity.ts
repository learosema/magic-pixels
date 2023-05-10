import { Matrix } from '../matrix';

/**
 * create 4x4 identity matrix
 */
export function identity(): Matrix {
  // prettier-ignore
  return new Matrix([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]);
}
