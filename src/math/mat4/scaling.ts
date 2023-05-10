import { Matrix } from '../matrix';

/**
 * create scaling matrix
 * @param sx X-scale factor
 * @param sy Y-scale factor
 * @param sz Z-scale factor
 */
export function scaling(sx: number, sy: number, sz: number): Matrix {
  // prettier-ignore
  return new Matrix([
    sx,  0,  0, 0,
     0, sy,  0, 0,
     0,  0, sz, 0,
     0,  0,  0, 1
  ]);
}
