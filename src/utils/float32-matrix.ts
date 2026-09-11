import { Matrix } from './matrix';

/**
 * Base class of the fixed-size, `Float32Array`-backed matrices `Mat2`, `Mat3`
 * and `Mat4`. Values are stored column-major, the layout GLSL and the
 * `uniformMatrix*fv` calls expect. Operations work in place and allocate
 * nothing, which suits per-frame transform updates; `Matrix` remains the
 * general-purpose class for arbitrary dimensions.
 */
export abstract class Float32Matrix {
  /** the values in column-major order */
  readonly values: Float32Array;

  /** number of rows (= number of columns) */
  abstract readonly dimension: number;

  protected constructor(size: number) {
    this.values = new Float32Array(size);
  }

  /**
   * Overwrite all values.
   * @param values `dimension²` values in column-major order
   */
  set(values: ArrayLike<number>): this {
    if (values.length !== this.values.length) {
      throw Error('ArgumentError');
    }
    this.values.set(values);
    return this;
  }

  /** Copy the values of another matrix of the same size into this one */
  copy(other: this): this {
    this.values.set(other.values);
    return this;
  }

  /** Reset to the identity matrix */
  identity(): this {
    const { values, dimension } = this;
    values.fill(0);
    for (let i = 0; i < dimension; i++) {
      values[i * dimension + i] = 1;
    }
    return this;
  }

  /**
   * value at a given position
   * @param row row index starting from 0
   * @param column column index starting from 0
   */
  valueAt(row: number, column: number): number {
    return this.values[column * this.dimension + row];
  }

  /** exact element-wise equality */
  equals(other: this): boolean {
    const a = this.values;
    const b = other.values;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * element-wise equality within a tolerance
   * @param delta tolerance, 1e-6 by default (the values are 32-bit floats)
   */
  roughlyEquals(other: this, delta = 1e-6): boolean {
    const a = this.values;
    const b = other.values;
    for (let i = 0; i < a.length; i++) {
      if (Math.abs(a[i] - b[i]) > delta) {
        return false;
      }
    }
    return true;
  }

  /** true if all values are finite (neither NaN nor Infinity) */
  isFinite(): boolean {
    return this.values.every((value) => Number.isFinite(value));
  }

  /** the values as a plain array, column-major */
  toArray(): number[] {
    return Array.from(this.values);
  }

  /** convert to the general-purpose `Matrix` class */
  toMatrix(): Matrix {
    return new Matrix(this.toArray());
  }

  toString(): string {
    return `mat${this.dimension}(${this.toArray().join(', ')})`;
  }
}
