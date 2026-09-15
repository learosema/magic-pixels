import type { Mat4 } from './mat4';
import { Vector } from './vector';

/**
 * An axis-aligned bounding box: the smallest box with sides parallel to
 * the coordinate axes that contains a set of points. It is stored as its
 * `min` and `max` corners. A box with `min > max` is _empty_, contains
 * nothing and is what a new box starts as, so points can be added with
 * `expandByPoint()` without a special first step.
 *
 * Operations work in place and return `this`.
 */
export class Box3 {
  constructor(
    public min = new Vector(Infinity, Infinity, Infinity),
    public max = new Vector(-Infinity, -Infinity, -Infinity)
  ) {}

  /** true if the box contains no points at all */
  get isEmpty(): boolean {
    return (
      this.min.x > this.max.x ||
      this.min.y > this.max.y ||
      this.min.z > this.max.z
    );
  }

  set(min: Vector, max: Vector): this {
    this.min.set(min.x, min.y, min.z);
    this.max.set(max.x, max.y, max.z);
    return this;
  }

  copy(other: Box3): this {
    return this.set(other.min, other.max);
  }

  clone(): Box3 {
    return new Box3().copy(this);
  }

  makeEmpty(): this {
    this.min.set(Infinity, Infinity, Infinity);
    this.max.set(-Infinity, -Infinity, -Infinity);
    return this;
  }

  equals(other: Box3): boolean {
    return this.min.equals(other.min) && this.max.equals(other.max);
  }

  /** Grow the box so that it contains the point `(x, y, z)` */
  expandByCoordinates(x: number, y: number, z: number): this {
    const { min, max } = this;
    if (x < min.x) min.x = x;
    if (y < min.y) min.y = y;
    if (z < min.z) min.z = z;
    if (x > max.x) max.x = x;
    if (y > max.y) max.y = y;
    if (z > max.z) max.z = z;
    return this;
  }

  /** Grow the box so that it contains `point` */
  expandByPoint(point: Vector): this {
    return this.expandByCoordinates(point.x, point.y, point.z);
  }

  /** Replace the box by the smallest one containing all `points` */
  setFromPoints(points: Vector[]): this {
    this.makeEmpty();
    for (const point of points) {
      this.expandByPoint(point);
    }
    return this;
  }

  /** Grow the box so that it contains `other` as well */
  union(other: Box3): this {
    if (other.isEmpty) {
      return this;
    }
    this.expandByPoint(other.min);
    this.expandByPoint(other.max);
    return this;
  }

  containsPoint(point: Vector): boolean {
    const { min, max } = this;
    return (
      point.x >= min.x &&
      point.x <= max.x &&
      point.y >= min.y &&
      point.y <= max.y &&
      point.z >= min.z &&
      point.z <= max.z
    );
  }

  /** The centre of the box; `(0, 0, 0)` for an empty box */
  getCenter(target = new Vector(0, 0, 0)): Vector {
    if (this.isEmpty) {
      return target.set(0, 0, 0);
    }
    const { min, max } = this;
    return target.set(
      (min.x + max.x) / 2,
      (min.y + max.y) / 2,
      (min.z + max.z) / 2
    );
  }

  /** The extent of the box along each axis; `(0, 0, 0)` for an empty box */
  getSize(target = new Vector(0, 0, 0)): Vector {
    if (this.isEmpty) {
      return target.set(0, 0, 0);
    }
    const { min, max } = this;
    return target.set(max.x - min.x, max.y - min.y, max.z - min.z);
  }

  /**
   * Transform the box by a matrix. A rotated box is no longer axis-aligned,
   * so the result is the axis-aligned box around the eight transformed
   * corners: never smaller than the true extent, but larger after a
   * rotation.
   */
  applyMat4(matrix: Mat4): this {
    if (this.isEmpty) {
      return this;
    }
    const { min, max } = this;
    const m = matrix.values;
    const corners = [min.x, max.x];
    const xs = [min.y, max.y];
    const zs = [min.z, max.z];
    const result = new Box3();
    for (const x of corners) {
      for (const y of xs) {
        for (const z of zs) {
          result.expandByCoordinates(
            m[0] * x + m[4] * y + m[8] * z + m[12],
            m[1] * x + m[5] * y + m[9] * z + m[13],
            m[2] * x + m[6] * y + m[10] * z + m[14]
          );
        }
      }
    }
    return this.copy(result);
  }

  toString(): string {
    return `Box3(${this.min}, ${this.max})`;
  }
}
