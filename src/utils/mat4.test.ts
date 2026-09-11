import { Mat2 } from './mat2';
import { Mat3 } from './mat3';
import { Mat4 } from './mat4';
import { Matrix } from './matrix';
import { Vector } from './vector';
import { frustum, ortho, perspective } from './perspective';

function expectClose(actual: ArrayLike<number>, expected: ArrayLike<number>) {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], 5);
  }
}

/** apply a matrix to a point (w = 1) and divide by w */
function project(m: Mat4, x: number, y: number, z: number): number[] {
  const v = m.toMatrix().mul(new Vector(x, y, z, 1)) as Vector;
  return [v.x / v.w, v.y / v.w, v.z / v.w];
}

describe('Mat4', () => {
  test('defaults to the identity and copies values', () => {
    expect(new Mat4().toArray()).toEqual(Matrix.identity(4).values);
    expect(Mat4.identity().values).toBeInstanceOf(Float32Array);
    const m = new Mat4([...Array(16).keys()]);
    expect(m.valueAt(1, 2)).toBe(9);
    expect(m.clone().equals(m)).toBe(true);
    expect(new Mat4().copy(m).equals(m)).toBe(true);
    expect(Mat4.fromMatrix(m.toMatrix()).equals(m)).toBe(true);
    expect(() => new Mat4([1, 2, 3])).toThrow();
  });

  test('multiplies like Matrix.mul', () => {
    const a = Mat4.rotX(0.3).multiply(Mat4.translation(1, 2, 3));
    const b = Mat4.scaling(2, 3, 4).multiply(Mat4.rotZ(-1.2));
    const expected = a.toMatrix().mul(b.toMatrix()) as Matrix;
    expectClose(a.clone().multiply(b).values, expected.values);
    expectClose(b.clone().premultiply(a).values, expected.values);
    expectClose(new Mat4().multiplyMatrices(a, b).values, expected.values);
    // aliasing: the target may be one of the factors
    expectClose(
      a.clone().multiplyMatrices(b, a).values,
      (b.toMatrix().mul(a.toMatrix()) as Matrix).values
    );
  });

  test('inverts in place; a singular matrix becomes zero', () => {
    const m = Mat4.translation(1, 2, 3)
      .multiply(Mat4.rotY(0.7))
      .multiply(Mat4.scaling(2, 2, 2));
    const inverse = m.clone().invert();
    expectClose(inverse.values, m.toMatrix().inverse().values);
    expectClose(m.clone().multiply(inverse).values, new Mat4().values);
    expect(Mat4.scaling(0, 1, 1).invert().toArray()).toEqual(Array(16).fill(0));
  });

  test('determinant and transpose match Matrix', () => {
    const m = Mat4.rotX(0.5).multiply(Mat4.scaling(2, 3, 4));
    expect(m.determinant()).toBeCloseTo(24, 4);
    expect(m.determinant()).toBeCloseTo(m.toMatrix().determinant(), 4);
    expectClose(m.clone().transpose().values, m.toMatrix().transpose().values);
    expect(m.clone().transpose().transpose().equals(m)).toBe(true);
  });

  test('compose builds translation × rotation (XYZ) × scale', () => {
    const position = new Vector(1, -2, 3);
    const rotation = new Vector(0.3, -0.8, 1.7);
    const scale = new Vector(2, 3, 4);
    const expected = Mat4.translation(1, -2, 3)
      .multiply(Mat4.rotX(0.3))
      .multiply(Mat4.rotY(-0.8))
      .multiply(Mat4.rotZ(1.7))
      .multiply(Mat4.scaling(2, 3, 4));
    const m = new Mat4().compose(position, rotation, scale);
    expectClose(m.values, expected.values);
    expect(m.getPosition(new Vector()).toArray()).toEqual([1, -2, 3]);
  });

  test('lookAt builds a camera matrix looking down -Z', () => {
    const eye = new Vector(0, 0, 5);
    const m = Mat4.lookAt(eye, new Vector(0, 0, 0), new Vector(0, 1, 0));
    expectClose(m.values, Mat4.translation(0, 0, 5).values);

    // a camera on +X looking at the origin: its -Z axis points to -X
    const side = Mat4.lookAt(
      new Vector(5, 0, 0),
      new Vector(0, 0, 0),
      new Vector(0, 1, 0)
    );
    const view = side.clone().invert();
    expectClose(project(view, 0, 0, 0), [0, 0, -5]);
    // up stays up
    expectClose(project(view, 5, 1, 0), [0, 1, 0]);
  });

  test('lookAt copes with a degenerate up vector', () => {
    const m = Mat4.lookAt(
      new Vector(0, 5, 0),
      new Vector(0, 0, 0),
      new Vector(0, 1, 0)
    );
    expect(m.isFinite()).toBe(true);
    expect(m.determinant()).toBeCloseTo(1, 3);
  });

  test('perspective maps the near and far planes to -1 and 1', () => {
    const m = Mat4.perspective(90, 2, 1, 10);
    expectClose(project(m, 0, 0, -1), [0, 0, -1]);
    expectClose(project(m, 0, 0, -10), [0, 0, 1]);
    // 90° fov: the top edge of the near plane is at y = 1, the right edge at x = 2
    expectClose(project(m, 2, 1, -1), [1, 1, -1]);
    expect(m.toArray()).toEqual(perspective(90, 2, 1, 10).values);
    expect(Mat4.frustum(-1, 1, -1, 1, 1, 10).toArray()).toEqual(
      frustum(-1, 1, -1, 1, 1, 10).values
    );
  });

  test('ortho maps the box to clip space', () => {
    const m = Mat4.ortho(-2, 2, -1, 1, 1, 10);
    expectClose(project(m, -2, -1, -1), [-1, -1, -1]);
    expectClose(project(m, 2, 1, -10), [1, 1, 1]);
    expect(m.toArray()).toEqual(ortho(-2, 2, -1, 1, 1, 10).values);
  });

  test('roughlyEquals and toString', () => {
    const a = Mat4.rotZ(1);
    const b = Mat4.rotZ(1 + 1e-8);
    expect(a.roughlyEquals(b)).toBe(true);
    expect(a.equals(Mat4.rotZ(2))).toBe(false);
    expect(new Mat4().toString()).toBe(
      'mat4(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)'
    );
  });
});

describe('Mat3', () => {
  test('multiplies and inverts like Matrix', () => {
    const a = Mat3.rotX(0.4).multiply(Mat3.scaling(1, 2, 3));
    const b = Mat3.rotZ(-0.9).multiply(Mat3.translation(2, 3));
    expectClose(
      a.clone().multiply(b).values,
      (a.toMatrix().mul(b.toMatrix()) as Matrix).values
    );
    expectClose(a.clone().invert().values, a.toMatrix().inverse().values);
    expectClose(
      a.clone().multiply(a.clone().invert()).values,
      new Mat3().values
    );
    expect(a.determinant()).toBeCloseTo(a.toMatrix().determinant(), 5);
    expectClose(a.clone().transpose().values, a.toMatrix().transpose().values);
    expect(Mat3.scaling(0, 1, 1).invert().toArray()).toEqual(Array(9).fill(0));
  });

  test('fromMat4 takes the upper-left 3x3 part', () => {
    const m = Mat4.rotY(0.6).multiply(Mat4.translation(1, 2, 3));
    expectClose(Mat3.fromMat4(m).values, Mat3.rotY(0.6).values);
    expect(Mat3.fromMatrix(Matrix.identity(3)).equals(new Mat3())).toBe(true);
  });

  test('setNormalMatrix is the inverse transpose of the upper 3x3', () => {
    const model = Mat4.translation(5, 6, 7)
      .multiply(Mat4.rotZ(0.5))
      .multiply(Mat4.scaling(1, 2, 4));
    const normal = new Mat3().setNormalMatrix(model);
    const expected = Mat3.rotZ(0.5).multiply(Mat3.scaling(1, 0.5, 0.25));
    expectClose(normal.values, expected.values);
    // a normal along +Y on a surface scaled by 2 in Y stays along +Y
    const n = normal.toMatrix().mul(new Vector(0, 1, 0)) as Vector;
    expectClose(n.normalized.values, [-Math.sin(0.5), Math.cos(0.5), 0]);
  });
});

describe('Mat2', () => {
  test('rotation, scaling, multiply, invert', () => {
    const r = Mat2.rotation(Math.PI / 2);
    const v = r.toMatrix().mul(new Vector(1, 0)) as Vector;
    expectClose(v.values, [0, 1]);
    const m = Mat2.scaling(2, 4).multiply(r);
    expectClose(
      m.values,
      (Mat2.scaling(2, 4).toMatrix().mul(r.toMatrix()) as Matrix).values
    );
    expect(m.determinant()).toBeCloseTo(8, 5);
    expectClose(m.clone().invert().values, m.toMatrix().inverse().values);
    expectClose(m.clone().transpose().values, m.toMatrix().transpose().values);
    expect(new Mat2([1, 2, 3, 4]).clone().transpose().toArray()).toEqual([
      1, 3, 2, 4,
    ]);
    expect(Mat2.scaling(0, 1).invert().toArray()).toEqual([0, 0, 0, 0]);
    expect(Mat2.fromMatrix(Matrix.identity(2)).equals(Mat2.identity())).toBe(
      true
    );
  });
});
