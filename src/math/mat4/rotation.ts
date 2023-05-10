import { Matrix } from '../matrix';

/**
 * create x-rotation matrix
 * @param angle angle in radians
 */
export function rotX(angle: number): Matrix {
  const { sin, cos } = Math;
  const S = sin(angle);
  const C = cos(angle);
  // prettier-ignore
  return new Matrix([
    1, 0, 0, 0,
    0, C, S, 0,
    0,-S, C, 0,
    0, 0, 0, 1
  ]);
}

/**
 * create y-rotation matrix
 * @param angle angle in radians
 */
export function rotY(angle: number): Matrix {
  const { sin, cos } = Math;
  const S = sin(angle);
  const C = cos(angle);
  // prettier-ignore
  return new Matrix([
    C, 0,-S, 0,
    0, 1, 0, 0,
    S, 0, C, 0,
    0, 0, 0, 1
  ]);
}

/**
 * create z-rotation matrix
 * @param angle angle in radians
 */
export function rotZ(angle: number): Matrix {
  const { sin, cos } = Math;
  const S = sin(angle);
  const C = cos(angle);
  // prettier-ignore
  return new Matrix([
    C, S, 0, 0,
   -S, C, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]);
}