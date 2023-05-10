import { Matrix } from '../matrix';

/**
 * create scaling matrix
 * @param sx X-scale factor
 * @param sy Y-scale factor
 */
export function scaling(sx: number, sy: number): Matrix {
  // prettier-ignore
  return new Matrix([
    sx, 0, 
    0, sy
  ]);
}
