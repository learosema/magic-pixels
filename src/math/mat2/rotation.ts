import { Matrix } from '../matrix';

/**
 * create rotation matrix
 * @param angle angle in radians
 */
export function rotation(angle: number): Matrix {
  const S = Math.sin(angle);
  const C = Math.cos(angle);
  // prettier-ignore
  return new Matrix([
     C, S, 
    -S, C
  ]);
}
