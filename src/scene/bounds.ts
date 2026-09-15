import { Box3, Sphere } from '../utils';
import { Mesh } from './mesh';
import type { Object3D } from './object3d';

const scratchBox = new Box3();
const scratchSphere = new Sphere();
const worldBox = new Box3();

/**
 * The world-space bounding box of an object and everything below it: the
 * union of every mesh's geometry box, each transformed by the mesh's
 * world matrix (eight corners, refitted). Invisible objects count too.
 *
 * The subtree's world matrices are updated from the object's parent
 * first, so the parent's `worldMatrix` must be current (it is after a
 * render, or after `scene.updateWorldMatrix()`).
 */
export function computeBoundingBox(
  object: Object3D,
  target = new Box3()
): Box3 {
  object.updateWorldMatrix(true);
  target.makeEmpty();
  object.traverse((node) => {
    if (!(node instanceof Mesh)) {
      return;
    }
    const box = node.geometry.boundingBox ?? node.geometry.computeBoundingBox();
    target.union(scratchBox.copy(box).applyMat4(node.worldMatrix));
  });
  return target;
}

/**
 * The world-space bounding sphere of an object and everything below it,
 * centred on the world-space bounding box and just large enough to
 * contain every mesh's transformed geometry sphere. The result is what a
 * camera needs to frame the object: the distance that fits a sphere of
 * radius `r` into a vertical field of view `fov` is `r / sin(fov / 2)`.
 *
 * Same requirement on world matrices as {@link computeBoundingBox}.
 */
export function computeBoundingSphere(
  object: Object3D,
  target = new Sphere()
): Sphere {
  const box = computeBoundingBox(object, worldBox);
  target.makeEmpty();
  if (box.isEmpty) {
    return target;
  }
  target.set(box.getCenter(), 0);
  object.traverse((node) => {
    if (!(node instanceof Mesh)) {
      return;
    }
    const sphere =
      node.geometry.boundingSphere ?? node.geometry.computeBoundingSphere();
    target.expandBySphere(
      scratchSphere.copy(sphere).applyMat4(node.worldMatrix)
    );
  });
  return target;
}
