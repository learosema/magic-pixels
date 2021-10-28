import { Matrix } from '../matrix';
import { Vector } from '../vector';

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
