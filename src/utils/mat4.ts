import { Float32Matrix } from './float32-matrix';
import type { Matrix } from './matrix';
import { Quaternion } from './quaternion';
import { Vector } from './vector';

const ZERO = new Vector(0, 0, 0);
const ONE = new Vector(1, 1, 1);

/**
 * A 4x4 matrix of 32-bit floats in column-major order, for transforms.
 * All operations work in place and return `this`; use `clone()` first if the
 * original is still needed.
 */
export class Mat4 extends Float32Matrix {
  readonly dimension = 4;

  /** @param values 16 values in column-major order; identity if omitted */
  constructor(values?: ArrayLike<number>) {
    super(16);
    if (values) {
      this.set(values);
    } else {
      this.identity();
    }
  }

  static identity(): Mat4 {
    return new Mat4();
  }

  /** copy a 4x4 `Matrix` */
  static fromMatrix(matrix: Matrix): Mat4 {
    return new Mat4(matrix.values);
  }

  /**
   * create translation matrix
   * @param x translation in X direction
   * @param y translation in Y direction
   * @param z translation in Z direction
   */
  static translation(x: number, y: number, z: number): Mat4 {
    return new Mat4().setTranslation(x, y, z);
  }

  /**
   * create scaling matrix
   * @param sx X-scale factor
   * @param sy Y-scale factor
   * @param sz Z-scale factor
   */
  static scaling(sx: number, sy: number, sz: number): Mat4 {
    return new Mat4().setScaling(sx, sy, sz);
  }

  /**
   * create x-rotation matrix
   * @param angle angle in radians
   */
  static rotX(angle: number): Mat4 {
    return new Mat4().setRotationX(angle);
  }

  /**
   * create y-rotation matrix
   * @param angle angle in radians
   */
  static rotY(angle: number): Mat4 {
    return new Mat4().setRotationY(angle);
  }

  /**
   * create z-rotation matrix
   * @param angle angle in radians
   */
  static rotZ(angle: number): Mat4 {
    return new Mat4().setRotationZ(angle);
  }

  /** create a rotation matrix from a unit quaternion */
  static rotationFromQuaternion(quaternion: Quaternion): Mat4 {
    return new Mat4().setRotationFromQuaternion(quaternion);
  }

  /**
   * Create a camera matrix: the transform of an object at `position` whose
   * -Z axis points at `target`. Its inverse is the view matrix.
   */
  static lookAt(position: Vector, target: Vector, up: Vector): Mat4 {
    return new Mat4().setLookAt(position, target, up);
  }

  /**
   * create a perspective projection matrix
   * @param fieldOfView vertical field of view in degrees
   * @param aspectRatio width / height
   * @param zNear distance to the near clipping plane (positive)
   * @param zFar distance to the far clipping plane (positive)
   */
  static perspective(
    fieldOfView: number,
    aspectRatio: number,
    zNear: number,
    zFar: number
  ): Mat4 {
    return new Mat4().setPerspective(fieldOfView, aspectRatio, zNear, zFar);
  }

  /**
   * create a perspective projection matrix from a viewing frustum
   * @see https://www.khronos.org/registry/OpenGL-Refpages/gl2.1/xhtml/glFrustum.xml
   */
  static frustum(
    left: number,
    right: number,
    bottom: number,
    top: number,
    zNear: number,
    zFar: number
  ): Mat4 {
    return new Mat4().setFrustum(left, right, bottom, top, zNear, zFar);
  }

  /**
   * create an orthographic projection matrix
   * @see https://www.khronos.org/registry/OpenGL-Refpages/gl2.1/xhtml/glOrtho.xml
   */
  static ortho(
    left: number,
    right: number,
    bottom: number,
    top: number,
    zNear: number,
    zFar: number
  ): Mat4 {
    return new Mat4().setOrtho(left, right, bottom, top, zNear, zFar);
  }

  setTranslation(x: number, y: number, z: number): this {
    // prettier-ignore
    return this.set([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      x, y, z, 1
    ]);
  }

  setScaling(sx: number, sy: number, sz: number): this {
    // prettier-ignore
    return this.set([
      sx,  0,  0, 0,
       0, sy,  0, 0,
       0,  0, sz, 0,
       0,  0,  0, 1
    ]);
  }

  setRotationX(angle: number): this {
    const S = Math.sin(angle);
    const C = Math.cos(angle);
    // prettier-ignore
    return this.set([
      1, 0, 0, 0,
      0, C, S, 0,
      0,-S, C, 0,
      0, 0, 0, 1
    ]);
  }

  setRotationY(angle: number): this {
    const S = Math.sin(angle);
    const C = Math.cos(angle);
    // prettier-ignore
    return this.set([
      C, 0,-S, 0,
      0, 1, 0, 0,
      S, 0, C, 0,
      0, 0, 0, 1
    ]);
  }

  setRotationZ(angle: number): this {
    const S = Math.sin(angle);
    const C = Math.cos(angle);
    // prettier-ignore
    return this.set([
       C, S, 0, 0,
      -S, C, 0, 0,
       0, 0, 1, 0,
       0, 0, 0, 1
    ]);
  }

  /** @see Mat4.rotationFromQuaternion */
  setRotationFromQuaternion(quaternion: Quaternion): this {
    return this.compose(ZERO, quaternion, ONE);
  }

  /** @see Mat4.lookAt */
  setLookAt(position: Vector, target: Vector, up: Vector): this {
    const te = this.values;
    // z axis: from the target towards the position (the camera looks down -Z)
    let zx = position.x - target.x;
    let zy = position.y - target.y;
    let zz = position.z - target.z;
    let len = Math.hypot(zx, zy, zz);
    if (len === 0) {
      // position and target coincide
      zz = 1;
      len = 1;
    }
    zx /= len;
    zy /= len;
    zz /= len;

    // x axis = up × z
    let xx = up.y * zz - up.z * zy;
    let xy = up.z * zx - up.x * zz;
    let xz = up.x * zy - up.y * zx;
    len = Math.hypot(xx, xy, xz);
    if (len === 0) {
      // up is parallel to the viewing direction: nudge z a little
      if (Math.abs(up.z) === 1) {
        zx += 0.0001;
      } else {
        zz += 0.0001;
      }
      len = Math.hypot(zx, zy, zz);
      zx /= len;
      zy /= len;
      zz /= len;
      xx = up.y * zz - up.z * zy;
      xy = up.z * zx - up.x * zz;
      xz = up.x * zy - up.y * zx;
      len = Math.hypot(xx, xy, xz);
    }
    xx /= len;
    xy /= len;
    xz /= len;

    // y axis = z × x
    const yx = zy * xz - zz * xy;
    const yy = zz * xx - zx * xz;
    const yz = zx * xy - zy * xx;

    // prettier-ignore
    te.set([
      xx, xy, xz, 0,
      yx, yy, yz, 0,
      zx, zy, zz, 0,
      position.x, position.y, position.z, 1
    ]);
    return this;
  }

  /** @see Mat4.perspective */
  setPerspective(
    fieldOfView: number,
    aspectRatio: number,
    zNear: number,
    zFar: number
  ): this {
    const y = zNear * Math.tan((fieldOfView * Math.PI) / 360);
    const x = y * aspectRatio;
    return this.setFrustum(-x, x, -y, y, zNear, zFar);
  }

  /** @see Mat4.frustum */
  setFrustum(
    left: number,
    right: number,
    bottom: number,
    top: number,
    zNear: number,
    zFar: number
  ): this {
    const t1 = 2 * zNear;
    const t2 = right - left;
    const t3 = top - bottom;
    const t4 = zFar - zNear;
    // prettier-ignore
    return this.set([
      t1 / t2, 0, 0, 0,
      0, t1 / t3, 0, 0,
      (right + left) / t2, (top + bottom) / t3, (-zFar - zNear) / t4, -1,
      0, 0, (-t1 * zFar) / t4, 0
    ]);
  }

  /** @see Mat4.ortho */
  setOrtho(
    left: number,
    right: number,
    bottom: number,
    top: number,
    zNear: number,
    zFar: number
  ): this {
    const tx = -(right + left) / (right - left);
    const ty = -(top + bottom) / (top - bottom);
    const tz = -(zFar + zNear) / (zFar - zNear);
    // prettier-ignore
    return this.set([
      2 / (right - left), 0, 0, 0,
      0, 2 / (top - bottom), 0, 0,
      0, 0, -2 / (zFar - zNear), 0,
      tx, ty, tz, 1
    ]);
  }

  /**
   * Set this to translation × rotation × scale.
   * @param position translation
   * @param rotation the rotation as a unit {@link Quaternion}, or as Euler
   * angles in radians applied in XYZ order
   * @param scale scale factors per axis
   */
  compose(
    position: Vector,
    rotation: Quaternion | Vector,
    scale: Vector
  ): this {
    if (rotation instanceof Quaternion) {
      return this.composeQuaternion(position, rotation, scale);
    }
    return this.composeEuler(position, rotation, scale);
  }

  private composeEuler(
    position: Vector,
    rotation: Vector,
    scale: Vector
  ): this {
    const te = this.values;
    const a = Math.cos(rotation.x);
    const b = Math.sin(rotation.x);
    const c = Math.cos(rotation.y);
    const d = Math.sin(rotation.y);
    const e = Math.cos(rotation.z);
    const f = Math.sin(rotation.z);
    const ae = a * e;
    const af = a * f;
    const be = b * e;
    const bf = b * f;
    const sx = scale.x;
    const sy = scale.y;
    const sz = scale.z;

    // rotation = Rx × Ry × Rz, each column scaled
    te[0] = c * e * sx;
    te[1] = (af + be * d) * sx;
    te[2] = (bf - ae * d) * sx;
    te[3] = 0;

    te[4] = -c * f * sy;
    te[5] = (ae - bf * d) * sy;
    te[6] = (be + af * d) * sy;
    te[7] = 0;

    te[8] = d * sz;
    te[9] = -b * c * sz;
    te[10] = a * c * sz;
    te[11] = 0;

    te[12] = position.x;
    te[13] = position.y;
    te[14] = position.z;
    te[15] = 1;
    return this;
  }

  private composeQuaternion(
    position: Vector,
    quaternion: Quaternion,
    scale: Vector
  ): this {
    const te = this.values;
    const { x, y, z, w } = quaternion;
    const x2 = x + x;
    const y2 = y + y;
    const z2 = z + z;
    const xx = x * x2;
    const xy = x * y2;
    const xz = x * z2;
    const yy = y * y2;
    const yz = y * z2;
    const zz = z * z2;
    const wx = w * x2;
    const wy = w * y2;
    const wz = w * z2;
    const sx = scale.x;
    const sy = scale.y;
    const sz = scale.z;

    // the rotation matrix of a unit quaternion, each column scaled
    te[0] = (1 - (yy + zz)) * sx;
    te[1] = (xy + wz) * sx;
    te[2] = (xz - wy) * sx;
    te[3] = 0;

    te[4] = (xy - wz) * sy;
    te[5] = (1 - (xx + zz)) * sy;
    te[6] = (yz + wx) * sy;
    te[7] = 0;

    te[8] = (xz + wy) * sz;
    te[9] = (yz - wx) * sz;
    te[10] = (1 - (xx + yy)) * sz;
    te[11] = 0;

    te[12] = position.x;
    te[13] = position.y;
    te[14] = position.z;
    te[15] = 1;
    return this;
  }

  /** the translation part as a vector */
  getPosition(target: Vector): Vector {
    const te = this.values;
    return target.set(te[12], te[13], te[14]);
  }

  clone(): Mat4 {
    return new Mat4(this.values);
  }

  /** this = this × other */
  multiply(other: Mat4): this {
    return this.multiplyMatrices(this, other);
  }

  /** this = other × this */
  premultiply(other: Mat4): this {
    return this.multiplyMatrices(other, this);
  }

  /** this = a × b */
  multiplyMatrices(a: Mat4, b: Mat4): this {
    const ae = a.values;
    const be = b.values;
    const te = this.values;
    // a{column}{row}
    const a00 = ae[0],
      a01 = ae[1],
      a02 = ae[2],
      a03 = ae[3];
    const a10 = ae[4],
      a11 = ae[5],
      a12 = ae[6],
      a13 = ae[7];
    const a20 = ae[8],
      a21 = ae[9],
      a22 = ae[10],
      a23 = ae[11];
    const a30 = ae[12],
      a31 = ae[13],
      a32 = ae[14],
      a33 = ae[15];

    let b0 = be[0],
      b1 = be[1],
      b2 = be[2],
      b3 = be[3];
    te[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    te[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    te[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    te[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = be[4];
    b1 = be[5];
    b2 = be[6];
    b3 = be[7];
    te[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    te[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    te[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    te[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = be[8];
    b1 = be[9];
    b2 = be[10];
    b3 = be[11];
    te[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    te[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    te[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    te[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = be[12];
    b1 = be[13];
    b2 = be[14];
    b3 = be[15];
    te[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    te[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    te[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    te[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    return this;
  }

  determinant(): number {
    const te = this.values;
    const a00 = te[0],
      a01 = te[1],
      a02 = te[2],
      a03 = te[3];
    const a10 = te[4],
      a11 = te[5],
      a12 = te[6],
      a13 = te[7];
    const a20 = te[8],
      a21 = te[9],
      a22 = te[10],
      a23 = te[11];
    const a30 = te[12],
      a31 = te[13],
      a32 = te[14],
      a33 = te[15];

    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;
    return (
      b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06
    );
  }

  transpose(): this {
    const te = this.values;
    let tmp: number;
    tmp = te[1];
    te[1] = te[4];
    te[4] = tmp;
    tmp = te[2];
    te[2] = te[8];
    te[8] = tmp;
    tmp = te[3];
    te[3] = te[12];
    te[12] = tmp;
    tmp = te[6];
    te[6] = te[9];
    te[9] = tmp;
    tmp = te[7];
    te[7] = te[13];
    te[13] = tmp;
    tmp = te[11];
    te[11] = te[14];
    te[14] = tmp;
    return this;
  }

  /** Invert in place. A singular matrix becomes the zero matrix. */
  invert(): this {
    const te = this.values;
    const a00 = te[0],
      a01 = te[1],
      a02 = te[2],
      a03 = te[3];
    const a10 = te[4],
      a11 = te[5],
      a12 = te[6],
      a13 = te[7];
    const a20 = te[8],
      a21 = te[9],
      a22 = te[10],
      a23 = te[11];
    const a30 = te[12],
      a31 = te[13],
      a32 = te[14],
      a33 = te[15];

    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;

    const det =
      b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (det === 0) {
      te.fill(0);
      return this;
    }
    const inv = 1 / det;

    te[0] = (a11 * b11 - a12 * b10 + a13 * b09) * inv;
    te[1] = (a02 * b10 - a01 * b11 - a03 * b09) * inv;
    te[2] = (a31 * b05 - a32 * b04 + a33 * b03) * inv;
    te[3] = (a22 * b04 - a21 * b05 - a23 * b03) * inv;
    te[4] = (a12 * b08 - a10 * b11 - a13 * b07) * inv;
    te[5] = (a00 * b11 - a02 * b08 + a03 * b07) * inv;
    te[6] = (a32 * b02 - a30 * b05 - a33 * b01) * inv;
    te[7] = (a20 * b05 - a22 * b02 + a23 * b01) * inv;
    te[8] = (a10 * b10 - a11 * b08 + a13 * b06) * inv;
    te[9] = (a01 * b08 - a00 * b10 - a03 * b06) * inv;
    te[10] = (a30 * b04 - a31 * b02 + a33 * b00) * inv;
    te[11] = (a21 * b02 - a20 * b04 - a23 * b00) * inv;
    te[12] = (a11 * b07 - a10 * b09 - a12 * b06) * inv;
    te[13] = (a00 * b09 - a01 * b07 + a02 * b06) * inv;
    te[14] = (a31 * b01 - a30 * b03 - a32 * b00) * inv;
    te[15] = (a20 * b03 - a21 * b01 + a22 * b00) * inv;
    return this;
  }
}
