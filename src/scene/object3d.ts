import { Mat4, Quaternion, Vector } from '../utils';

const DEFAULT_UP = new Vector(0, 1, 0);

/**
 * Base class of everything in the scene graph. An object has a transform
 * relative to its parent (`position`, `quaternion` or `rotation`, `scale`,
 * composed into `localMatrix`) and a list of `children`. `worldMatrix` is
 * the transform relative to the scene root,
 * `parent.worldMatrix × localMatrix`, computed by `updateWorldMatrix()` in a
 * tree walk before each render.
 *
 * The rotation is stored twice, as a {@link Quaternion} and as Euler angles,
 * and either can be written to. `updateLocalMatrix()` compares both against
 * their values at the last update and converts whichever changed into the
 * other (the quaternion wins if both changed).
 *
 * A child inherits its parent's transform, so `planet.add(moon)` and
 * `moon.position.set(2, 0, 0)` make the moon orbit when `planet.rotation.y`
 * changes. To orbit without spinning the parent, put an empty `Object3D` in
 * between as a pivot.
 */
export class Object3D {
  /** an optional label, e.g. the node name from a glTF file; empty by default */
  name = '';
  /** translation relative to the parent */
  position = new Vector(0, 0, 0);
  /** rotation relative to the parent, as a unit quaternion */
  quaternion = new Quaternion();
  /**
   * rotation relative to the parent, as Euler angles in radians applied in
   * XYZ order; kept in sync with `quaternion`
   */
  rotation = new Vector(0, 0, 0);
  /** scale factors per axis */
  scale = new Vector(1, 1, 1);

  /** `quaternion` and `rotation` as of the last `updateLocalMatrix()` */
  private readonly lastQuaternion = new Quaternion();
  private readonly lastRotation = new Vector(0, 0, 0);

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

  /**
   * Recompose `localMatrix` from `position`, `quaternion` and `scale`, after
   * bringing `quaternion` and `rotation` in sync (see the class description).
   */
  updateLocalMatrix(): this {
    this.syncRotation();
    this.localMatrix.compose(this.position, this.quaternion, this.scale);
    this.worldMatrixNeedsUpdate = true;
    return this;
  }

  /**
   * Convert whichever of `quaternion` and `rotation` changed since the last
   * call into the other one. The quaternion wins if both changed.
   */
  private syncRotation(): void {
    const { quaternion, rotation, lastQuaternion, lastRotation } = this;
    if (!quaternion.equals(lastQuaternion)) {
      quaternion.toEuler(rotation);
    } else if (
      rotation.x !== lastRotation.x ||
      rotation.y !== lastRotation.y ||
      rotation.z !== lastRotation.z
    ) {
      quaternion.setFromEuler(rotation);
    } else {
      return;
    }
    lastQuaternion.copy(quaternion);
    lastRotation.set(rotation.x, rotation.y, rotation.z);
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
   * Set `quaternion` (and with it `rotation`) from the rotation part of a
   * matrix. The matrix must not contain scaling.
   */
  setRotationFromMatrix(matrix: Mat4): this {
    this.quaternion.setFromRotationMatrix(matrix);
    this.quaternion.toEuler(this.rotation);
    this.lastQuaternion.copy(this.quaternion);
    this.lastRotation.set(this.rotation.x, this.rotation.y, this.rotation.z);
    return this;
  }
}
