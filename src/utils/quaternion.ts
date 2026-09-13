import type { Mat3 } from './mat3';
import type { Mat4 } from './mat4';
import type { Vector } from './vector';

/**
 * A rotation as a unit quaternion `(x, y, z, w)`: the rotation by `angle`
 * around a unit `axis` is `(axis * sin(angle / 2), cos(angle / 2))`.
 *
 * Multiplying two quaternions composes their rotations in the same order
 * as matrices (`a.multiply(b)` applies `b` first), and `slerp` interpolates
 * between two rotations along the shortest arc. Operations work in place
 * and return `this`; use `clone()` first if the original is still needed.
 *
 * The methods that produce a rotation (`setFromAxisAngle`, `setFromEuler`,
 * `setFromRotationMatrix`, `slerp`) return a unit quaternion for unit
 * inputs. After many `multiply` calls, `normalize()` removes accumulated
 * rounding error.
 */
export class Quaternion {
  /**
   * @param x vector part, X
   * @param y vector part, Y
   * @param z vector part, Z
   * @param w scalar part; the identity rotation is `(0, 0, 0, 1)`
   */
  constructor(
    public x = 0,
    public y = 0,
    public z = 0,
    public w = 1
  ) {}

  /** the identity rotation */
  static identity(): Quaternion {
    return new Quaternion();
  }

  /** the rotation by `angle` radians around a unit `axis` */
  static fromAxisAngle(axis: Vector, angle: number): Quaternion {
    return new Quaternion().setFromAxisAngle(axis, angle);
  }

  /** the rotation given by Euler angles in radians, XYZ order */
  static fromEuler(rotation: Vector): Quaternion {
    return new Quaternion().setFromEuler(rotation);
  }

  /** the rotation part of a matrix without scaling */
  static fromRotationMatrix(matrix: Mat3 | Mat4): Quaternion {
    return new Quaternion().setFromRotationMatrix(matrix);
  }

  /**
   * @param values `[x, y, z, w]`, as stored in a glTF node
   * @param offset index of `x` in `values`
   */
  static fromArray(values: ArrayLike<number>, offset = 0): Quaternion {
    return new Quaternion(
      values[offset],
      values[offset + 1],
      values[offset + 2],
      values[offset + 3]
    );
  }

  set(x: number, y: number, z: number, w: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }

  copy(other: Quaternion): this {
    return this.set(other.x, other.y, other.z, other.w);
  }

  clone(): Quaternion {
    return new Quaternion(this.x, this.y, this.z, this.w);
  }

  /** Reset to the identity rotation `(0, 0, 0, 1)` */
  identity(): this {
    return this.set(0, 0, 0, 1);
  }

  /** exact element-wise equality */
  equals(other: Quaternion): boolean {
    return (
      this.x === other.x &&
      this.y === other.y &&
      this.z === other.z &&
      this.w === other.w
    );
  }

  /** the four-dimensional dot product; `1` for two equal unit quaternions */
  dot(other: Quaternion): number {
    return (
      this.x * other.x + this.y * other.y + this.z * other.z + this.w * other.w
    );
  }

  get length(): number {
    return Math.hypot(this.x, this.y, this.z, this.w);
  }

  /** Scale to unit length. The zero quaternion becomes the identity. */
  normalize(): this {
    const length = this.length;
    if (length === 0) {
      return this.identity();
    }
    return this.set(
      this.x / length,
      this.y / length,
      this.z / length,
      this.w / length
    );
  }

  /**
   * Replace by the inverse rotation. For a unit quaternion that is the
   * conjugate `(-x, -y, -z, w)`; a non-unit quaternion is also divided by
   * its squared length.
   */
  invert(): this {
    const { x, y, z, w } = this;
    const lengthSq = x * x + y * y + z * z + w * w;
    return this.set(-x / lengthSq, -y / lengthSq, -z / lengthSq, w / lengthSq);
  }

  /** this = this × other: apply `other` first, then this rotation */
  multiply(other: Quaternion): this {
    return this.multiplyQuaternions(this, other);
  }

  /** this = other × this: apply this rotation first, then `other` */
  premultiply(other: Quaternion): this {
    return this.multiplyQuaternions(other, this);
  }

  /** this = a × b (the Hamilton product) */
  multiplyQuaternions(a: Quaternion, b: Quaternion): this {
    const { x: ax, y: ay, z: az, w: aw } = a;
    const { x: bx, y: by, z: bz, w: bw } = b;
    return this.set(
      ax * bw + aw * bx + ay * bz - az * by,
      ay * bw + aw * by + az * bx - ax * bz,
      az * bw + aw * bz + ax * by - ay * bx,
      aw * bw - ax * bx - ay * by - az * bz
    );
  }

  /**
   * Set to the rotation by `angle` radians around `axis`.
   * @param axis a unit vector
   * @param angle in radians, counter-clockwise when looking down the axis
   */
  setFromAxisAngle(axis: Vector, angle: number): this {
    const half = angle / 2;
    const s = Math.sin(half);
    return this.set(axis.x * s, axis.y * s, axis.z * s, Math.cos(half));
  }

  /**
   * Set from Euler angles in radians, applied in XYZ order: the same
   * rotation as `Mat4.compose(position, rotation, scale)` builds.
   */
  setFromEuler(rotation: Vector): this {
    const c1 = Math.cos(rotation.x / 2);
    const s1 = Math.sin(rotation.x / 2);
    const c2 = Math.cos(rotation.y / 2);
    const s2 = Math.sin(rotation.y / 2);
    const c3 = Math.cos(rotation.z / 2);
    const s3 = Math.sin(rotation.z / 2);
    // qx × qy × qz, multiplied out
    return this.set(
      s1 * c2 * c3 + c1 * s2 * s3,
      c1 * s2 * c3 - s1 * c2 * s3,
      c1 * c2 * s3 + s1 * s2 * c3,
      c1 * c2 * c3 - s1 * s2 * s3
    );
  }

  /**
   * Set from the rotation part of a matrix. The matrix must be a pure
   * rotation (orthonormal axes, no scaling); a `Mat4` may carry a
   * translation, which is ignored.
   */
  setFromRotationMatrix(matrix: Mat3 | Mat4): this {
    const te = matrix.values;
    const n = matrix.dimension;
    // m{row}{column}, 1-based like in the math texts
    const m11 = te[0],
      m12 = te[n],
      m13 = te[2 * n];
    const m21 = te[1],
      m22 = te[n + 1],
      m23 = te[2 * n + 1];
    const m31 = te[2],
      m32 = te[n + 2],
      m33 = te[2 * n + 2];
    const trace = m11 + m22 + m33;

    // pick the largest of w, x, y, z to divide by, for numerical stability
    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1);
      return this.set(
        (m32 - m23) * s,
        (m13 - m31) * s,
        (m21 - m12) * s,
        0.25 / s
      );
    }
    if (m11 > m22 && m11 > m33) {
      const s = 2 * Math.sqrt(1 + m11 - m22 - m33);
      return this.set(
        0.25 * s,
        (m12 + m21) / s,
        (m13 + m31) / s,
        (m32 - m23) / s
      );
    }
    if (m22 > m33) {
      const s = 2 * Math.sqrt(1 + m22 - m11 - m33);
      return this.set(
        (m12 + m21) / s,
        0.25 * s,
        (m23 + m32) / s,
        (m13 - m31) / s
      );
    }
    const s = 2 * Math.sqrt(1 + m33 - m11 - m22);
    return this.set(
      (m13 + m31) / s,
      (m23 + m32) / s,
      0.25 * s,
      (m21 - m12) / s
    );
  }

  /**
   * Write the equivalent Euler angles in radians, XYZ order, into `target`.
   * Angles are in the range `-π..π` (`y` in `-π/2..π/2`), so a rotation that
   * was set from Euler angles outside that range comes back wrapped.
   * @returns `target`
   */
  toEuler(target: Vector): Vector {
    const { x, y, z, w } = this;
    // the entries of the rotation matrix that the angles are read off
    const m11 = 1 - 2 * (y * y + z * z);
    const m12 = 2 * (x * y - w * z);
    const m13 = 2 * (x * z + w * y);
    const m22 = 1 - 2 * (x * x + z * z);
    const m23 = 2 * (y * z - w * x);
    const m32 = 2 * (y * z + w * x);
    const m33 = 1 - 2 * (x * x + y * y);
    const ry = Math.asin(Math.min(1, Math.max(-1, m13)));
    if (Math.abs(m13) < 0.9999999) {
      return target.set(Math.atan2(-m23, m33), ry, Math.atan2(-m12, m11));
    }
    // gimbal lock: y is ±90°, x and z rotate around the same axis
    return target.set(Math.atan2(m32, m22), ry, 0);
  }

  /**
   * Spherical linear interpolation: move this rotation towards `other`
   * along the shortest arc, at constant angular speed.
   * @param other the rotation at `t = 1`
   * @param t interpolation factor from 0 (this) to 1 (`other`)
   */
  slerp(other: Quaternion, t: number): this {
    return this.slerpQuaternions(this, other, t);
  }

  /** this = slerp(a, b, t) */
  slerpQuaternions(a: Quaternion, b: Quaternion, t: number): this {
    if (t === 0) {
      return this.copy(a);
    }
    if (t === 1) {
      return this.copy(b);
    }
    const { x: ax, y: ay, z: az, w: aw } = a;
    let { x: bx, y: by, z: bz, w: bw } = b;

    // q and -q are the same rotation: flip b so the arc is the short one
    let cosHalfTheta = ax * bx + ay * by + az * bz + aw * bw;
    if (cosHalfTheta < 0) {
      bx = -bx;
      by = -by;
      bz = -bz;
      bw = -bw;
      cosHalfTheta = -cosHalfTheta;
    }
    if (cosHalfTheta >= 1) {
      return this.copy(a);
    }

    const sinHalfThetaSq = 1 - cosHalfTheta * cosHalfTheta;
    let ratioA: number;
    let ratioB: number;
    if (sinHalfThetaSq <= Number.EPSILON) {
      // nearly the same rotation: a plain lerp is accurate enough
      ratioA = 1 - t;
      ratioB = t;
    } else {
      const sinHalfTheta = Math.sqrt(sinHalfThetaSq);
      const halfTheta = Math.atan2(sinHalfTheta, cosHalfTheta);
      ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
      ratioB = Math.sin(t * halfTheta) / sinHalfTheta;
    }
    return this.set(
      ax * ratioA + bx * ratioB,
      ay * ratioA + by * ratioB,
      az * ratioA + bz * ratioB,
      aw * ratioA + bw * ratioB
    ).normalize();
  }

  /** `[x, y, z, w]` */
  toArray(): number[] {
    return [this.x, this.y, this.z, this.w];
  }

  toString(): string {
    return `quat(${this.x}, ${this.y}, ${this.z}, ${this.w})`;
  }
}
