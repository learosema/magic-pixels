import { Vector } from '../types';

/**
 * Calculate the surface normal of a triangle
 * @param p1 3d vector of point 1
 * @param p2 3d vector of point 2
 * @param p3 3d vector of point 3
 */
export function calculateSurfaceNormal(
  p1: Vector,
  p2: Vector,
  p3: Vector
): Vector {
  const u = p2.sub(p1);
  const v = p3.sub(p1);
  return u.cross(v).normalized;
}
