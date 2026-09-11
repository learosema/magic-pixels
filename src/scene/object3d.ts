import { Mat4, Vector } from '../utils';

const DEFAULT_UP = new Vector(0, 1, 0);

/**
 * Base class of everything in the scene graph. An object has a transform
 * relative to its parent (`position`, `rotation`, `scale`, composed into
 * `localMatrix`) and a list of `children`. `worldMatrix` is the transform
 * relative to the scene root, `parent.worldMatrix × localMatrix`, computed
 * by `updateWorldMatrix()` in a tree walk before each render.
 *
 * A child inherits its parent's transform, so `planet.add(moon)` and
 * `moon.position.set(2, 0, 0)` make the moon orbit when `planet.rotation.y`
 * changes. To orbit without spinning the parent, put an empty `Object3D` in
 * between as a pivot.
 */
export class Object3D {
  /** translation relative to the parent */
  position = new Vector(0, 0, 0);
  /** Euler angles in radians, applied in XYZ order */
  rotation = new Vector(0, 0, 0);
  /** scale factors per axis */
  scale = new Vector(1, 1, 1);

  parent: Object3D | null = null;
  readonly children: Object3D[] = [];

  /** transform relative to the parent */
  readonly localMatrix = new Mat4();
  /** transform relative to the scene root */
  readonly worldMatrix = new Mat4();

  /**
   * When true (the default), `updateWorldMatrix()` recomposes `localMatrix`
   * from `position`, `rotation` and `scale`. Set to false to write
   * `localMatrix` yourself; flag changes with `worldMatrixNeedsUpdate`.
   */
  matrixAutoUpdate = true;
  /** set to true after changing `localMatrix` manually */
  worldMatrixNeedsUpdate = false;

  /** invisible objects and their children are not rendered */
  visible = true;

  /**
   * Add children. An object that already has a parent is moved.
   * @returns this instance
   */
  add(...objects: Object3D[]): this {
    for (const object of objects) {
      if (object === this) {
        throw Error('an object cannot be added to itself');
      }
      if (object.isAncestorOf(this)) {
        throw Error('an object cannot be added to one of its descendants');
      }
      object.removeFromParent();
      object.parent = this;
      this.children.push(object);
    }
    return this;
  }

  /**
   * Remove children. Objects that are not children are ignored.
   * @returns this instance
   */
  remove(...objects: Object3D[]): this {
    for (const object of objects) {
      const index = this.children.indexOf(object);
      if (index !== -1) {
        this.children.splice(index, 1);
        object.parent = null;
      }
    }
    return this;
  }

  /** Detach from the parent, if any */
  removeFromParent(): this {
    this.parent?.remove(this);
    return this;
  }

  /** true if this object is a (transitive) parent of `object` */
  isAncestorOf(object: Object3D): boolean {
    for (let node = object.parent; node !== null; node = node.parent) {
      if (node === this) {
        return true;
      }
    }
    return false;
  }

  /** Call `callback` for this object and all its descendants, depth-first */
  traverse(callback: (object: Object3D) => void): void {
    callback(this);
    for (const child of this.children) {
      child.traverse(callback);
    }
  }

  /** Recompose `localMatrix` from `position`, `rotation` and `scale` */
  updateLocalMatrix(): this {
    this.localMatrix.compose(this.position, this.rotation, this.scale);
    this.worldMatrixNeedsUpdate = true;
    return this;
  }

  /**
   * Update the world matrices of this object and its descendants.
   * @param force recompute even if nothing was flagged as changed
   */
  updateWorldMatrix(force = false): void {
    if (this.matrixAutoUpdate) {
      this.updateLocalMatrix();
    }
    if (this.worldMatrixNeedsUpdate || force) {
      if (this.parent) {
        this.worldMatrix.multiplyMatrices(
          this.parent.worldMatrix,
          this.localMatrix
        );
      } else {
        this.worldMatrix.copy(this.localMatrix);
      }
      this.worldMatrixNeedsUpdate = false;
      this.onWorldMatrixChanged();
      force = true;
    }
    for (const child of this.children) {
      child.updateWorldMatrix(force);
    }
  }

  /** Called after `worldMatrix` was recomputed */
  protected onWorldMatrixChanged(): void {
    // hook for subclasses
  }

  /**
   * Rotate so that the object's +Z axis points at `target`. Cameras
   * override this and point their -Z axis (the viewing direction) instead.
   * @param target a point in the parent's coordinate system
   * @param up the up direction, +Y by default
   */
  lookAt(target: Vector, up: Vector = DEFAULT_UP): this {
    return this.setRotationFromMatrix(Mat4.lookAt(target, this.position, up));
  }

  /**
   * Set `rotation` from the rotation part of a matrix (Euler XYZ). The
   * matrix must not contain scaling.
   */
  setRotationFromMatrix(matrix: Mat4): this {
    const te = matrix.values;
    const m11 = te[0],
      m12 = te[4],
      m13 = te[8];
    const m22 = te[5],
      m23 = te[9];
    const m32 = te[6],
      m33 = te[10];
    const y = Math.asin(Math.min(1, Math.max(-1, m13)));
    if (Math.abs(m13) < 0.9999999) {
      this.rotation.set(Math.atan2(-m23, m33), y, Math.atan2(-m12, m11));
    } else {
      this.rotation.set(Math.atan2(m32, m22), y, 0);
    }
    return this;
  }
}
