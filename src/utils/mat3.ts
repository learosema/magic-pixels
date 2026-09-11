import { Float32Matrix } from './float32-matrix';
import type { Mat4 } from './mat4';
import type { Matrix } from './matrix';

/**
 * A 3x3 matrix of 32-bit floats in column-major order.
 * All operations work in place and return `this`.
 */
export class Mat3 extends Float32Matrix {
  readonly dimension = 3;

  /** @param values 9 values in column-major order; identity if omitted */
  constructor(values?: ArrayLike<number>) {
    super(9);
    if (values) {
      this.set(values);
    } else {
      this.identity();
    }
  }

  static identity(): Mat3 {
    return new Mat3();
  }

  /** copy a 3x3 `Matrix` */
  static fromMatrix(matrix: Matrix): Mat3 {
    return new Mat3(matrix.values);
  }

  /** the upper-left 3x3 part of a 4x4 matrix */
  static fromMat4(matrix: Mat4): Mat3 {
    return new Mat3().setFromMat4(matrix);
  }

  /**
   * create 2D translation matrix
   * @param x translation in x-direction
   * @param y translation in y-direction
   */
  static translation(x: number, y: number): Mat3 {
    return new Mat3().setTranslation(x, y);
  }

  /**
   * create scaling matrix
   * @param sx scale X factor
   * @param sy scale Y factor
   * @param sz scale Z factor
   */
  static scaling(sx: number, sy: number, sz: number): Mat3 {
    return new Mat3().setScaling(sx, sy, sz);
  }

  /**
   * create X-rotation matrix
   * @param angle rotation in radians
   */
  static rotX(angle: number): Mat3 {
    return new Mat3().setRotationX(angle);
  }

  /**
   * create Y-rotation matrix
   * @param angle angle in radians
   */
  static rotY(angle: number): Mat3 {
    return new Mat3().setRotationY(angle);
  }

  /**
   * create Z-rotation matrix
   * @param angle angle in radians
   */
  static rotZ(angle: number): Mat3 {
    return new Mat3().setRotationZ(angle);
  }

  setFromMat4(matrix: Mat4): this {
    const me = matrix.values;
    // prettier-ignore
    return this.set([
      me[0], me[1], me[2],
      me[4], me[5], me[6],
      me[8], me[9], me[10]
    ]);
  }

  setTranslation(x: number, y: number): this {
    // prettier-ignore
    return this.set([
      1, 0, 0,
      0, 1, 0,
      x, y, 1
    ]);
  }

  setScaling(sx: number, sy: number, sz: number): this {
    // prettier-ignore
    return this.set([
      sx,  0,  0,
       0, sy,  0,
       0,  0, sz
    ]);
  }

  setRotationX(angle: number): this {
    const S = Math.sin(angle);
    const C = Math.cos(angle);
    // prettier-ignore
    return this.set([
      1, 0, 0,
      0, C, S,
      0,-S, C
    ]);
  }

  setRotationY(angle: number): this {
    const S = Math.sin(angle);
    const C = Math.cos(angle);
    // prettier-ignore
    return this.set([
      C, 0,-S,
      0, 1, 0,
      S, 0, C
    ]);
  }

  setRotationZ(angle: number): this {
    const S = Math.sin(angle);
    const C = Math.cos(angle);
    // prettier-ignore
    return this.set([
       C, S, 0,
      -S, C, 0,
       0, 0, 1
    ]);
  }

  /**
   * Set this to the normal matrix of a model(-view) matrix: the inverse
   * transpose of its upper-left 3x3 part. Transforms normals correctly even
   * when the model matrix contains non-uniform scaling.
   */
  setNormalMatrix(matrix: Mat4): this {
    return this.setFromMat4(matrix).invert().transpose();
  }

  clone(): Mat3 {
    return new Mat3(this.values);
  }

  /** this = this × other */
  multiply(other: Mat3): this {
    return this.multiplyMatrices(this, other);
  }

  /** this = other × this */
  premultiply(other: Mat3): this {
    return this.multiplyMatrices(other, this);
  }

  /** this = a × b */
  multiplyMatrices(a: Mat3, b: Mat3): this {
    const ae = a.values;
    const be = b.values;
    const te = this.values;
    // a{column}{row}
    const a00 = ae[0],
      a01 = ae[1],
      a02 = ae[2];
    const a10 = ae[3],
      a11 = ae[4],
      a12 = ae[5];
    const a20 = ae[6],
      a21 = ae[7],
      a22 = ae[8];
    const b00 = be[0],
      b01 = be[1],
      b02 = be[2];
    const b10 = be[3],
      b11 = be[4],
      b12 = be[5];
    const b20 = be[6],
      b21 = be[7],
      b22 = be[8];

    te[0] = b00 * a00 + b01 * a10 + b02 * a20;
    te[1] = b00 * a01 + b01 * a11 + b02 * a21;
    te[2] = b00 * a02 + b01 * a12 + b02 * a22;

    te[3] = b10 * a00 + b11 * a10 + b12 * a20;
    te[4] = b10 * a01 + b11 * a11 + b12 * a21;
    te[5] = b10 * a02 + b11 * a12 + b12 * a22;

    te[6] = b20 * a00 + b21 * a10 + b22 * a20;
    te[7] = b20 * a01 + b21 * a11 + b22 * a21;
    te[8] = b20 * a02 + b21 * a12 + b22 * a22;
    return this;
  }

  determinant(): number {
    const te = this.values;
    const a00 = te[0],
      a01 = te[1],
      a02 = te[2];
    const a10 = te[3],
      a11 = te[4],
      a12 = te[5];
    const a20 = te[6],
      a21 = te[7],
      a22 = te[8];
    return (
      a00 * (a22 * a11 - a12 * a21) +
      a01 * (-a22 * a10 + a12 * a20) +
      a02 * (a21 * a10 - a11 * a20)
    );
  }

  transpose(): this {
    const te = this.values;
    let tmp: number;
    tmp = te[1];
    te[1] = te[3];
    te[3] = tmp;
    tmp = te[2];
    te[2] = te[6];
    te[6] = tmp;
    tmp = te[5];
    te[5] = te[7];
    te[7] = tmp;
    return this;
  }

  /** Invert in place. A singular matrix becomes the zero matrix. */
  invert(): this {
    const te = this.values;
    const a00 = te[0],
      a01 = te[1],
      a02 = te[2];
    const a10 = te[3],
      a11 = te[4],
      a12 = te[5];
    const a20 = te[6],
      a21 = te[7],
      a22 = te[8];

    const b01 = a22 * a11 - a12 * a21;
    const b11 = -a22 * a10 + a12 * a20;
    const b21 = a21 * a10 - a11 * a20;

    const det = a00 * b01 + a01 * b11 + a02 * b21;
    if (det === 0) {
      te.fill(0);
      return this;
    }
    const inv = 1 / det;

    te[0] = b01 * inv;
    te[1] = (-a22 * a01 + a02 * a21) * inv;
    te[2] = (a12 * a01 - a02 * a11) * inv;
    te[3] = b11 * inv;
    te[4] = (a22 * a00 - a02 * a20) * inv;
    te[5] = (-a12 * a00 + a02 * a10) * inv;
    te[6] = b21 * inv;
    te[7] = (-a21 * a00 + a01 * a20) * inv;
    te[8] = (a11 * a00 - a01 * a10) * inv;
    return this;
  }
}
