import { Mat4 } from './mat4';
import type { Matrix } from './matrix';

/**
 * creates a transformation that produces a parallel projection
 * @param left coordinate for the left vertical clipping planes.
 * @param right coordinate for the right vertical clipping planes.
 * @param bottom coordinate for the bottom horizontal clippling pane.
 * @param top coordinate for the top horizontal clipping pane
 * @param zNear Specify the distances to the nearer and farther depth clipping planes. These values are negative if the plane is to be behind the viewer.
 * @param zFar Specify the distances to the nearer and farther depth clipping planes. These values are negative if the plane is to be behind the viewer.
 * @returns 4x4 orthographic transformation matrix (see `Mat4.ortho` for the `Mat4` variant)
 * @see https://www.khronos.org/registry/OpenGL-Refpages/gl2.1/xhtml/glOrtho.xml
 */
export function ortho(
  left: number,
  right: number,
  bottom: number,
  top: number,
  zNear: number,
  zFar: number
): Matrix {
  return Mat4.ortho(left, right, bottom, top, zNear, zFar).toMatrix();
}

/**
 * creates a perspective matrix that produces a perspective projection
 * @param left coordinates for the vertical left clipping pane
 * @param right coordinates for the vertical right clipping pane
 * @param bottom coordinates for the horizontal bottom clipping pane
 * @param top coodinates for the top horizontal clipping pane
 * @param zNear Specify the distances to the near depth clipping plane. Must be positive.
 * @param zFar Specify the distances to the far depth clipping planes. Must be positive.
 * @returns 4x4 perspective projection matrix (see `Mat4.frustum` for the `Mat4` variant)
 * @see https://www.khronos.org/registry/OpenGL-Refpages/gl2.1/xhtml/glFrustum.xml
 */
export function frustum(
  left: number,
  right: number,
  bottom: number,
  top: number,
  zNear: number,
  zFar: number
): Matrix {
  return Mat4.frustum(left, right, bottom, top, zNear, zFar).toMatrix();
}

/**
 * creates a perspective projection matrix
 * @param fieldOfView Specifies the field of view angle, in degrees, in the y direction.
 * @param aspectRatio Specifies the aspect ratio that determines the field of view in the x direction. The aspect ratio is the ratio of x (width) to y (height).
 * @param zNear Specifies the distance from the viewer to the near clipping plane (always positive).
 * @param zFar Specifies the distance from the viewer to the far clipping plane (always positive).
 * @returns 4x4 perspective projection matrix (see `Mat4.perspective` for the `Mat4` variant)
 */
export function perspective(
  fieldOfView: number,
  aspectRatio: number,
  zNear: number,
  zFar: number
): Matrix {
  return Mat4.perspective(fieldOfView, aspectRatio, zNear, zFar).toMatrix();
}
