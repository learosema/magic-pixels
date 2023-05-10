import { Matrix } from '../matrix';

/**
 * create scaling matrix
 * @param sx scale X factor
 * @param sy scale Y factor
 * @param sz scale Z factor
 * @returns 3x3 scale matrix
 */
export function scaling(sx: number, sy: number, sz: number): Matrix {
  // prettier-ignore
  return new Matrix([
    sx,  0,  0, 
     0, sy,  0, 
     0,  0, sz
  ]);
}
