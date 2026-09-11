import { Float32Matrix } from './float32-matrix';
import type { Matrix } from './matrix';

/**
 * A 2x2 matrix of 32-bit floats in column-major order.
 * All operations work in place and return `this`.
 */
export class Mat2 extends Float32Matrix {
  readonly dimension = 2;

  /** @param values 4 values in column-major order; identity if omitted */
  constructor(values?: ArrayLike<number>) {
    super(4);
    if (values) {
      this.set(values);
    } else {
      this.identity();
    }
  }

  static identity(): Mat2 {
    return new Mat2();
  }

  /** copy a 2x2 `Matrix` */
  static fromMatrix(matrix: Matrix): Mat2 {
    return new Mat2(matrix.values);
  }

  /**
   * create rotation matrix
   * @param angle angle in radians
   */
  static rotation(angle: number): Mat2 {
    return new Mat2().setRotation(angle);
  }

  /**
   * create scaling matrix
   * @param sx X-scale factor
   * @param sy Y-scale factor
   */
  static scaling(sx: number, sy: number): Mat2 {
    return new Mat2().setScaling(sx, sy);
  }

  setRotation(angle: number): this {
    const S = Math.sin(angle);
    const C = Math.cos(angle);
    // prettier-ignore
    return this.set([
       C, S,
      -S, C
    ]);
  }

  setScaling(sx: number, sy: number): this {
    // prettier-ignore
    return this.set([
      sx, 0,
      0, sy
    ]);
  }

  clone(): Mat2 {
    return new Mat2(this.values);
  }

  /** this = this × other */
  multiply(other: Mat2): this {
    return this.multiplyMatrices(this, other);
  }

  /** this = other × this */
  premultiply(other: Mat2): this {
    return this.multiplyMatrices(other, this);
  }

  /** this = a × b */
  multiplyMatrices(a: Mat2, b: Mat2): this {
    const ae = a.values;
    const be = b.values;
    const te = this.values;
    const a00 = ae[0],
      a01 = ae[1],
      a10 = ae[2],
      a11 = ae[3];
    const b00 = be[0],
      b01 = be[1],
      b10 = be[2],
      b11 = be[3];
    te[0] = a00 * b00 + a10 * b01;
    te[1] = a01 * b00 + a11 * b01;
    te[2] = a00 * b10 + a10 * b11;
    te[3] = a01 * b10 + a11 * b11;
    return this;
  }

  determinant(): number {
    const [a, b, c, d] = this.values;
    return a * d - b * c;
  }

  transpose(): this {
    const te = this.values;
    const tmp = te[1];
    te[1] = te[2];
    te[2] = tmp;
    return this;
  }

  /** Invert in place. A singular matrix becomes the zero matrix. */
  invert(): this {
    const te = this.values;
    const a = te[0],
      b = te[1],
      c = te[2],
      d = te[3];
    const det = a * d - b * c;
    if (det === 0) {
      te.fill(0);
      return this;
    }
    const inv = 1 / det;
    te[0] = d * inv;
    te[1] = -b * inv;
    te[2] = -c * inv;
    te[3] = a * inv;
    return this;
  }
}
