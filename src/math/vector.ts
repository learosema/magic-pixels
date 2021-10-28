export class Vector {
  readonly values: number[];

  constructor(...values: number[]) {
    this.values = values;
  }

  get dim(): number {
    return this.values.length;
  }

  get x(): number {
    return this.values[0];
  }

  set x(value: number) {
    this.values[0] = value;
  }

  get y(): number {
    return this.values[1];
  }

  set y(value: number) {
    this.values[1] = value;
  }

  get z(): number {
    return this.values[2];
  }

  set z(value: number) {
    this.values[2] = value;
  }

  get w(): number {
    return this.values[3];
  }

  set w(value: number) {
    this.values[3] = value;
  }

  get xy(): Vector {
    return new Vector(this.values[0], this.values[1]);
  }

  get xz(): Vector {
    return new Vector(this.values[0], this.values[2]);
  }

  get yz(): Vector {
    return new Vector(this.values[1], this.values[2]);
  }

  get xyz(): Vector {
    return new Vector(this.values[0], this.values[1], this.values[2]);
  }

  /**
   * Sets the values of this vector
   * @param values
   * @returns
   */
  set(...values: number[]): Vector {
    this.values.splice(0, this.values.length, ...values);
    return this;
  }

  /**
   * Create vector from Array
   * @param arr array of numbers
   */
  static fromArray(arr: number[]): Vector {
    return new Vector(...arr);
  }

  /**
   * Create vector with x = y = n
   * @param n the number
   * @param dim the dimension
   */
  static fromNumber(n: number, dim: number): Vector {
    return new Vector(...Array(dim).fill(n));
  }

  /**
   * clone vector
   */
  clone(): Vector {
    return new Vector(...this.values);
  }

  /**
   * add vector
   * @param otherVec addend
   * @returns addition result
   */
  add(otherVec: Vector): Vector {
    return new Vector(...this.values.map((v, idx) => v + otherVec.values[idx]));
  }

  /**
   * subtract vector
   * @param otherVec addend
   * @returns subtraction result
   */
  sub(otherVec: Vector): Vector {
    return new Vector(...this.values.map((v, idx) => v - otherVec.values[idx]));
  }

  /**
   * multiply vector with scalar
   * @param value scalar
   * @returns multiplication result
   */
  mul(value: number): Vector {
    return new Vector(...this.values.map((v) => v * value));
  }

  /**
   * divide vector with scalar
   * @param value scalar
   * @returns multiplication result
   */
  div(value: number): Vector {
    return new Vector(...this.values.map((x) => x / value));
  }

  /**
   * dot product
   * @param otherVec
   */
  dot(otherVec: Vector): number {
    return this.values
      .map((x, idx) => x * otherVec.values[idx])
      .reduce((a, b) => a + b);
  }

  /**
   * check for equality
   * @param otherVec
   */
  equals(otherVec: Vector): boolean {
    return this.values
      .map((v, idx) => v === otherVec.values[idx])
      .reduce((a, b) => a === b);
  }

  /**
   * Calculate length
   */
  get length(): number {
    return Math.sqrt(this.values.map((v) => v ** 2).reduce((a, b) => a + b));
  }

  /**
   * Convert to array
   */
  toArray(): number[] {
    return this.values.slice(0);
  }

  /**
   * Convert to string, in the form of `(x, y)`
   */
  toString(): string {
    return `(${this.values.join(', ')})`;
  }

  /**
   * cross product
   * @param otherVec
   * @returns new Vec3 instance containing cross product
   */
  cross(otherVec: Vector): Vector {
    if (this.dim !== 3 || otherVec.dim !== 3) {
      throw Error('dimension not supported');
    }
    return new Vector(
      this.y * otherVec.z - this.z * otherVec.y,
      this.z * otherVec.x - this.x * otherVec.z,
      this.x * otherVec.y - this.y * otherVec.x
    );
  }

  /**
   * normalized vector,
   * @returns vector normalized to length = 1
   */
  get normalized(): Vector {
    return this.div(this.length);
  }
}
