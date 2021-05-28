import { Vector } from './vector';

describe('2D Vectortor arithmetics', () => {
  test('Vector constructor', () => {
    const vector = new Vector(1, 2);
    expect(vector.x).toBe(1);
    expect(vector.y).toBe(2);
  });

  test('Vector clone', () => {
    const vector = new Vector(1, 2);
    const copied = vector.clone();
    expect(copied.x).toBe(1);
    expect(copied.y).toBe(2);
  });

  test('Vector fromNumber factory', () => {
    const vector = Vector.fromNumber(3, 2);
    expect(vector.x).toBe(3);
    expect(vector.y).toBe(3);
  });

  test('Vector fromArray factory', () => {
    const vector = Vector.fromArray([3, 5]);
    expect(vector.x).toBe(3);
    expect(vector.y).toBe(5);
  });

  test('Vector addition', () => {
    const v1 = new Vector(1, 2);
    const v2 = new Vector(3, 5);
    const v3 = v1.add(v2);
    expect(v3.x).toBe(4);
    expect(v3.y).toBe(7);
  });

  test('Vector substraction', () => {
    const v1 = new Vector(1, 2);
    const v2 = new Vector(3, 5);
    const v3 = v1.sub(v2);
    expect(v3.x).toBe(-2);
    expect(v3.y).toBe(-3);
  });

  test('Vector multiplication', () => {
    const v1 = new Vector(1, 2);
    const v2 = v1.mul(7);
    expect(v2.x).toBe(7);
    expect(v2.y).toBe(14);
  });

  test('Vector division', () => {
    const v1 = new Vector(7, 14);
    const v2 = v1.div(7);
    expect(v2.x).toBe(1);
    expect(v2.y).toBe(2);
  });

  test('Vector length', () => {
    const vector = new Vector(3, 4);
    expect(vector.length).toBe(5);
  });

  test('Vector equality', () => {
    const v1 = new Vector(1, 1);
    const v2 = new Vector(1, 1);
    expect(v1.equals(v2)).toBe(true);
  });

  test('Vector dot product', () => {
    const v1 = new Vector(2, 3);
    const v2 = new Vector(5, 7);
    expect(v1.dot(v2)).toBe(31);
  });

  test('Vector toArray conversion', () => {
    const v = new Vector(3, -2);
    expect(v.toArray()).toEqual([3, -2]);
  });

  test('Vector toString conversion', () => {
    const vector = new Vector(3, -2);
    expect(vector.toString()).toBe('(3, -2)');
  });
});

describe('3D Vectortor arithmetics', () => {
  test('Vector constructor with 3 values', () => {
    const vector = new Vector(1, 2, 3);
    expect(vector.x).toBe(1);
    expect(vector.y).toBe(2);
    expect(vector.z).toBe(3);
  });

  test('Vector constructor with array as argument', () => {
    const vector = Vector.fromArray([1, 2, 3]);
    expect(vector.x).toBe(1);
    expect(vector.y).toBe(2);
    expect(vector.z).toBe(3);
  });

  test('Vector clone', () => {
    const vector = new Vector(1, 2, 3).clone();
    expect(vector.x).toBe(1);
    expect(vector.y).toBe(2);
    expect(vector.z).toBe(3);
  });

  test('Vector fromNumber factory', () => {
    const vector = Vector.fromNumber(3, 3);
    expect(vector.x).toBe(3);
    expect(vector.y).toBe(3);
    expect(vector.z).toBe(3);
  });

  test('Vector addition', () => {
    const v1 = new Vector(1, 2, 3);
    const v2 = new Vector(3, 5, 7);
    const v3 = v1.add(v2);
    expect(v3.x).toBe(4);
    expect(v3.y).toBe(7);
    expect(v3.z).toBe(10);
  });

  test('Vector substraction', () => {
    const v1 = new Vector(1, 2, 3);
    const v2 = new Vector(3, 5, 7);
    const v3 = v1.sub(v2);
    expect(v3.x).toBe(-2);
    expect(v3.y).toBe(-3);
    expect(v3.z).toBe(-4);
  });

  test('Vector multiplication', () => {
    const v1 = new Vector(1, 2, 3);
    const v2 = v1.mul(7);
    expect(v2.x).toBe(7);
    expect(v2.y).toBe(14);
    expect(v2.z).toBe(21);
  });

  test('Vector division', () => {
    const v1 = new Vector(7, 14, 21);
    const v2 = v1.div(7);
    expect(v2.x).toBe(1);
    expect(v2.y).toBe(2);
    expect(v2.z).toBe(3);
  });

  test('Vector length', () => {
    const vector = new Vector(3, 4, 5);
    expect(vector.length).toBeCloseTo(7.071, 3);
  });

  test('Vector normalized', () => {
    const vector = new Vector(3, 4, 5);
    const expected = new Vector(0.42, 0.57, 0.71);
    const actual = vector.normalized;
    expect(actual.x).toBeCloseTo(expected.x);
    expect(actual.y).toBeCloseTo(expected.y);
    expect(actual.z).toBeCloseTo(expected.z);
  });

  test('Vector equality', () => {
    const v1 = new Vector(1, 3, 4);
    const v2 = new Vector(1, 3, 4);
    expect(v1.equals(v2)).toBe(true);
  });

  test('Vector dot product', () => {
    const v1 = new Vector(2, 3, 4);
    const v2 = new Vector(5, 7, 6);
    expect(v1.dot(v2)).toBe(55);
  });

  test('Vector cross product', () => {
    const v1 = new Vector(2, 3, 4);
    const v2 = new Vector(5, 7, 6);
    const v3 = new Vector(-10, 8, -1);
    expect(v1.cross(v2).equals(v3)).toBe(true);
  });

  test('Vector toArray conversion', () => {
    const vector = new Vector(3, -2, 1);
    expect(vector.toArray()).toEqual([3, -2, 1]);
  });

  test('Vector toString conversion', () => {
    const vector = new Vector(3, -2, 1);
    expect(vector.toString()).toBe('(3, -2, 1)');
  });
});

describe('Vector 4D tests', () => {
  test('Vector constructor', () => {
    const vec = new Vector(1, 2, 3, 4);
    expect(vec.toArray()).toEqual([1, 2, 3, 4]);
  });

  test('Vector clone', () => {
    const vec = new Vector(1, 2, 3, 4);
    const clone = vec.clone();
    expect(clone.toArray()).toEqual([1, 2, 3, 4]);
  });

  test('Vector fromArray factory', () => {
    const vec = Vector.fromArray([1, 2, 3, 4]);
    expect(vec.toArray()).toEqual([1, 2, 3, 4]);
  });

  test('Vector fromNumber factory', () => {
    const vec = Vector.fromNumber(1, 4);
    expect(vec.toArray()).toEqual([1, 1, 1, 1]);
  });
});
