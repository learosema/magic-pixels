import type { Box3 } from './box3';
import type { Mat4 } from './mat4';
import { Vector } from './vector';

/**
 * A bounding sphere: a `center` and a `radius`. A negative radius marks an
 * _empty_ sphere, which is what a new sphere starts as. Unlike a box, a
 * sphere is unchanged by rotation, which makes it the cheap choice for
 * anything that happens in world space: framing a camera, culling, a
 * first pass of picking.
 *
 * Operations work in place and return `this`.
 */
export class Sphere {
  constructor(
    public center = new Vector(0, 0, 0),
    public radius = -1
  ) {}

  get isEmpty(): boolean {
    return this.radius < 0;
  }

  set(center: Vector, radius: number): this {
    this.center.set(center.x, center.y, center.z);
    this.radius = radius;
    return this;
  }

  copy(other: Sphere): this {
    return this.set(other.center, other.radius);
  }

  clone(): Sphere {
    return new Sphere().copy(this);
  }

  makeEmpty(): this {
    this.center.set(0, 0, 0);
    this.radius = -1;
    return this;
  }

  equals(other: Sphere): boolean {
    return this.center.equals(other.center) && this.radius === other.radius;
  }

  /**
   * The sphere around a box: its centre and half its diagonal. Loose for
   * round shapes (up to `√3` times the true radius); see
   * `BufferGeometry.computeBoundingSphere()` for the tight version.
   */
  setFromBox(box: Box3): this {
    if (box.isEmpty) {
      return this.makeEmpty();
    }
    box.getCenter(this.center);
    this.radius = box.getSize().length / 2;
    return this;
  }

  /** Grow the radius, keeping the centre, until the sphere contains `point` */
  expandByPoint(point: Vector): this {
    if (this.isEmpty) {
      this.center.set(point.x, point.y, point.z);
      this.radius = 0;
      return this;
    }
    const distance = point.sub(this.center).length;
    if (distance > this.radius) {
      this.radius = distance;
    }
    return this;
  }

  /** Grow the radius, keeping the centre, until the sphere contains `other` */
  expandBySphere(other: Sphere): this {
    if (other.isEmpty) {
      return this;
    }
    if (this.isEmpty) {
      return this.copy(other);
    }
    const distance = other.center.sub(this.center).length + other.radius;
    if (distance > this.radius) {
      this.radius = distance;
    }
    return this;
  }

  containsPoint(point: Vector): boolean {
    return !this.isEmpty && point.sub(this.center).length <= this.radius;
  }

  /**
   * Transform the sphere by a matrix: the centre like a point, the radius
   * by the largest scale factor of the matrix (the length of its longest
   * column). Exact for uniform scale, a safe overestimate otherwise.
   */
  applyMat4(matrix: Mat4): this {
    if (this.isEmpty) {
      return this;
    }
    const m = matrix.values;
    const { x, y, z } = this.center;
    this.center.set(
      m[0] * x + m[4] * y + m[8] * z + m[12],
      m[1] * x + m[5] * y + m[9] * z + m[13],
      m[2] * x + m[6] * y + m[10] * z + m[14]
    );
    const scale = Math.sqrt(
      Math.max(
        m[0] * m[0] + m[1] * m[1] + m[2] * m[2],
        m[4] * m[4] + m[5] * m[5] + m[6] * m[6],
        m[8] * m[8] + m[9] * m[9] + m[10] * m[10]
      )
    );
    this.radius *= scale;
    return this;
  }

  toString(): string {
    return `Sphere(${this.center}, ${this.radius})`;
  }
}
