import { Matrix } from './matrix';
import { Vector } from './vector';

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

/***
 * Create a lookup matrix
 */
export function lookAt(position: Vector, target: Vector, up: Vector): Matrix {
  const zAxis = position.sub(target).normalized;
  const xAxis = up.cross(zAxis).normalized;
  const yAxis = zAxis.cross(xAxis).normalized;
  return new Matrix([
    xAxis.x,
    xAxis.y,
    xAxis.z,
    0,
    yAxis.x,
    yAxis.y,
    yAxis.z,
    0,
    zAxis.x,
    zAxis.y,
    zAxis.z,
    0,
    position.x,
    position.y,
    position.z,
    1,
  ]);
}
