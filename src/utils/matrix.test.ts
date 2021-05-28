import { Vector } from './vector';
import { Matrix } from './matrix';
import * as Mat4 from './mat4';

describe('generic matrix arithmetics', () => {
  test('2x3 matrix initialization', () => {
    const m = new Matrix([1, 2, 3, 4, 5, 6], { numRows: 2, numCols: 3 });
    expect(m.numRows).toBe(2);
    expect(m.numCols).toBe(3);
    expect(m.valueAt(0, 0)).toBe(1);
    expect(m.valueAt(1, 0)).toBe(2);
    expect(m.valueAt(0, 1)).toBe(3);
    expect(m.valueAt(1, 1)).toBe(4);
    expect(m.valueAt(0, 2)).toBe(5);
    expect(m.valueAt(1, 2)).toBe(6);
  });

  test('3x2 matrix rowAt and colAt', () => {
    const m = new Matrix([1, 2, 3, 4, 5, 6], { numRows: 3, numCols: 2 });
    expect(m.colAt(0)).toEqual([1, 2, 3]);
    expect(m.colAt(1)).toEqual([4, 5, 6]);

    expect(m.rowAt(0)).toEqual([1, 4]);
    expect(m.rowAt(1)).toEqual([2, 5]);
    expect(m.rowAt(2)).toEqual([3, 6]);
  });

  test('3x2 matrix equality', () => {
    const a = new Matrix([1, 2, 3, 4, 5, 6], { numRows: 3, numCols: 2 });
    const b = new Matrix([1, 2, 3, 4, 5, 6], { numRows: 3, numCols: 2 });
    const c = new Matrix([1, 2, 3, 4, 5, 6], { numRows: 2, numCols: 3 });
    expect(a.equals(b)).toBeTruthy();
    expect(!a.equals(c)).toBeTruthy();
  });

  test('vector to matrix', () => {
    const a = new Vector(1, 2, 3);
    const expected = new Matrix([1, 2, 3], { numRows: 3, numCols: 1 });
    const result = Matrix.fromVector(a);
    expect(result.equals(expected)).toBe(true);
  });

  test('vectors to matrix', () => {
    const a = new Vector(1, 2, 3);
    const b = new Vector(4, 5, 6);
    const expected = new Matrix([1, 4, 2, 5, 3, 6], { numRows: 3, numCols: 2 });
    const result = Matrix.fromVectors([a, b]);
    expect(result.equals(expected)).toBe(true);
  });

  test('vectors to matrix should throw an exception when no vectors are provided', () => {
    // as this is compiled to JS and the library can be used in JS, the argument type checks may not be available
    // this is why there is a ts-ignore statement in our test to check what happens when the function is called
    // with arguments other than specified.
    //@ts-ignore undefined check
    expect(() => Matrix.fromVectors(undefined)).toThrowError();
    expect(() => Matrix.fromVectors([])).toThrowError();
  });

  test('matrix transposition', () => {
    // prettier-ignore
    const a = new Matrix([
      1, 2, 3, 
      4, 5, 6
    ], { numRows: 3, numCols: 2 });
    // prettier-ignore
    const aT = new Matrix([
      1, 4, 
      2, 5, 
      3, 6
    ], { numRows: 2, numCols: 3 });
    const transposedOnce = a.transpose();
    const transposedTwice = a.transpose().transpose();
    expect(transposedOnce.equals(aT)).toBe(true);
    expect(transposedTwice.equals(a)).toBe(true);
  });

  test('3x2 matrix addition', () => {
    const a = new Matrix([1, 2, 3, 4, 5, 6], { numRows: 3, numCols: 2 });
    const b = new Matrix([10, 20, 30, 40, 50, 60], { numRows: 3, numCols: 2 });
    const c = a.add(b);
    expect(c.colAt(0)).toEqual([11, 22, 33]);
    expect(c.colAt(1)).toEqual([44, 55, 66]);
  });

  test('3x2 matrix substraction', () => {
    const a = new Matrix([10, 20, 30, 40, 50, 60], { numRows: 3, numCols: 2 });
    const b = new Matrix([1, 2, 3, 4, 5, 6], { numRows: 3, numCols: 2 });
    const c = a.sub(b);
    expect(c.colAt(0)).toEqual([9, 18, 27]);
    expect(c.colAt(1)).toEqual([36, 45, 54]);
  });

  test('2x3 * 3x2 matrix multiplication', () => {
    const a = new Matrix([1, 2, 3, 4, 5, 6], { numRows: 3, numCols: 2 });

    const b = new Matrix([7, 8, -4, -2, -3, -5], { numRows: 2, numCols: 3 });
    //
    //      7 -4   -3
    //      8 -2   -5
    // 1 4 39 -12 -23
    // 2 5 54 -18 -31
    // 3 6 69 -24 -39
    const c = a.mul(b) as Matrix;
    expect(c.numCols).toBe(3);
    expect(c.numRows).toBe(3);

    expect(c.toArray()).toEqual([39, 54, 69, -12, -18, -24, -23, -31, -39]);
    //
    //           1   4
    //           2   5
    //           3   6
    // 7 -4 -3 -10 -10
    // 8 -2 -5 -11  -8
    const d = b.mul(a) as Matrix;
    expect(d.numCols).toBe(2);
    expect(d.numRows).toBe(2);
    expect(d.toArray()).toEqual([-10, -11, -10, -8]);
  });

  test('mat3 determinant', () => {
    const m = new Matrix([2, 3, 1, 5, -3, 4, 2, 1, -4]);
    expect(m.determinant()).toBe(111);
  });

  test('matrix vector multiplication', () => {
    const m = new Matrix([1, 0, -1, -3, 2, 1], { numRows: 2, numCols: 3 });
    const v = new Vector(2, 1, -5);
    const result = m.mul(v) as Vector;
    expect(result.dim).toBe(2);
    expect(result.x).toBe(-9);
    expect(result.y).toBe(-8);
  });

  test('Mat2 inverse', () => {
    const a = new Matrix([2, 3, 5, 7]);
    // 2 5 ^-1    -7  5
    // 3 7      =  3 -2
    const expected = new Matrix([-7, 3, 5, -2]);
    const result = a.inverse();
    expect(result.toArray()).toEqual(expected.toArray());
  });

  test('Mat3 inverse', () => {
    // prettier-ignore
    const a = new Matrix([
      2, 3, 5, 
      7, 11, 13, 
      17, 19, 23
    ]);

    // prettier-ignore
    const expected = new Matrix([
      -1/13, -1/3, 8/39,
      -10/13, 1/2, -3/26,
      9/13, -1/6, -1/78
    ]);

    const result = a.inverse();
    expect(result.toArray()).toEqual(expected.toArray());
  });

  test('Mat4 inverse', () => {
    // prettier-ignore
    const a = new Matrix([
       2,  3,  5,  7,
      11, 13, 17, 19,
      23, 29, 31, 37,
      41, 43, 47, 53
    ]);

    // prettier-ignore
    const expected = new Matrix([
       3/11,  -12/55,  -1/5,   2/11,
      -5/11,   -2/55,   3/10, -3/22,
      -13/22, 307/440, -1/10, -9/88,
       15/22, -37/88,      0,  7/88
    ]);
    const result = a.inverse();
    expect(result.toArray()).toEqual(expected.toArray());
  });

  test('Mat4 multiplication and division', () => {
    const a = Mat4.identity();
    const b = Mat4.translation(-1, -2, -3);
    const c = Mat4.scaling(2, 4, 6);
    const d = a.mul(b) as Matrix;
    expect(d.equals(b)).toBeTruthy();
    const e = d.mul(c) as Matrix;
    const f = e.div(c) as Matrix;
    expect(f.isFinite()).toBeTruthy();
    expect(f.equals(d)).toBeTruthy();
  });

  test('Rough Equality', () => {
    // prettier-ignore
    const m = new Matrix([
      1, 2, 3,
      4, 5, 6,
      7, 0, 9
    ]);
    const mInv = m.inverse();
    const mI = Matrix.identity(3);
    const mResult = m.mul(mInv) as Matrix;
    expect(mInv.isFinite()).toBeTruthy();
    expect(mResult.roughlyEquals(mI)).toBeTruthy();
  });

  test('Mat4 isFinite', () => {
    const a = Matrix.identity(4);
    const b = a.div(0);
    expect(b.isFinite()).toBe(false);
  });

  test('Mat4 isNaN', () => {
    const a = Matrix.identity(4);
    const b = a.mul(NaN) as Matrix;
    expect(b.isNaN()).toBe(true);
  });
});

describe('2x2 matrix arithmetics', () => {
  test('Mat2 identity', () => {
    const m = Matrix.identity(2);
    expect(m.valueAt(0, 0)).toBe(1);
    expect(m.valueAt(1, 1)).toBe(1);
    expect(m.valueAt(1, 0)).toBe(0);
    expect(m.valueAt(0, 1)).toBe(0);
  });

  test('Mat2 rowAt and colAt', () => {
    // prettier-ignore
    const mat = new Matrix([
      1, 2, // column 1
      3, 4  // column 2
    ]);
    const row = mat.rowAt(1);
    expect(row).toEqual([2, 4]);

    const col = mat.colAt(1);
    expect(col).toEqual([3, 4]);
  });

  test('Mat2 determinant', () => {
    const mat = new Matrix([1, 2, 3, 4]);
    expect(mat.determinant()).toBe(-2);
  });

  test('Mat3 determinant', () => {
    const mat = new Matrix([2, 3, 5, 7, 11, 13, 17, 19, 23]);
    expect(mat.determinant()).toBe(-78);
  });

  test('Mat4 determinant', () => {
    // prettier-ignore
    const mat = new Matrix([
       2,  3,  5,  7,
      11, 13, 17, 19,
      23, 29, 31, 37,
      41, 43, 47, 53
    ]);
    expect(mat.determinant()).toBe(880);
  });

  test('Mat2 multiplication with identity matrix', () => {
    const a = new Matrix([2, 3, 5, 7]);
    const b = Matrix.identity(2) as Matrix;
    const c = a.mul(b) as Matrix;
    expect(a.equals(c)).toBeTruthy();
  });

  test('Mat2 multiplication', () => {
    const a = new Matrix([2, 3, 5, 7]);
    const b = new Matrix([-1, 4, 6, 8]);
    const c = a.mul(b) as Matrix;
    //    -1 6  a = -1 * 2 + 4 * 5 = 18
    //     4 8  b =  2 * 6 + 5 * 8 = 52
    // 2 5 a b  c = -1 * 3 + 7 * 4 = 25
    // 3 7 c d  d =  3 * 6 + 7 * 8 = 74
    const d = new Matrix([18, 25, 52, 74]);
    expect(c.equals(d)).toBeTruthy();
  });

  test('Mat2 toString()', () => {
    const a = new Matrix([2, 3, 5, 7]);
    expect(a.toString()).toBe('mat2x2(2, 3, 5, 7)');
  });
});
