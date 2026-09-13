import { Mat3 } from './mat3';
import { Mat4 } from './mat4';
import { Quaternion } from './quaternion';
import { Vector } from './vector';

function expectClose(actual: ArrayLike<number>, expected: ArrayLike<number>) {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], 5);
  }
}

/** rotate a point by a quaternion, via its rotation matrix */
function rotate(q: Quaternion, x: number, y: number, z: number): number[] {
  const m = Mat4.rotationFromQuaternion(q).toMatrix();
  return (m.mul(new Vector(x, y, z, 1)) as Vector).xyz.values;
}

const X_AXIS = new Vector(1, 0, 0);
const Y_AXIS = new Vector(0, 1, 0);
const Z_AXIS = new Vector(0, 0, 1);

describe('Quaternion', () => {
  test('defaults to the identity; set, copy, clone, equals, arrays', () => {
    const q = new Quaternion();
    expect(q.toArray()).toEqual([0, 0, 0, 1]);
    expect(Quaternion.identity().equals(q)).toBe(true);
    q.set(1, 2, 3, 4);
    expect(q.clone().toArray()).toEqual([1, 2, 3, 4]);
    expect(new Quaternion().copy(q).equals(q)).toBe(true);
    expect(q.identity().equals(new Quaternion())).toBe(true);
    expect(Quaternion.fromArray([9, 1, 2, 3, 4], 1).toArray()).toEqual([
      1, 2, 3, 4,
    ]);
    expect(new Quaternion(1, 2, 3, 4).toString()).toBe('quat(1, 2, 3, 4)');
  });

  test('normalize, length, dot, invert', () => {
    const q = new Quaternion(0, 3, 0, 4);
    expect(q.length).toBe(5);
    expect(q.normalize().toArray()).toEqual([0, 0.6, 0, 0.8]);
    expect(q.dot(q)).toBeCloseTo(1, 10);
    expect(new Quaternion(0, 0, 0, 0).normalize().toArray()).toEqual([
      0, 0, 0, 1,
    ]);

    // q × q⁻¹ = identity, for unit and non-unit quaternions
    const unit = Quaternion.fromAxisAngle(Y_AXIS, 0.7);
    expectClose(
      unit.clone().multiply(unit.clone().invert()).toArray(),
      [0, 0, 0, 1]
    );
    const scaled = new Quaternion(1, 2, 3, 4);
    expectClose(
      scaled.clone().multiply(scaled.clone().invert()).toArray(),
      [0, 0, 0, 1]
    );
  });

  test('setFromAxisAngle rotates counter-clockwise around the axis', () => {
    const q = Quaternion.fromAxisAngle(Z_AXIS, Math.PI / 2);
    expectClose(q.toArray(), [0, 0, Math.SQRT1_2, Math.SQRT1_2]);
    expectClose(rotate(q, 1, 0, 0), [0, 1, 0]);
    expectClose(
      rotate(Quaternion.fromAxisAngle(X_AXIS, Math.PI / 2), 0, 1, 0),
      [0, 0, 1]
    );
    expectClose(
      rotate(Quaternion.fromAxisAngle(Y_AXIS, Math.PI / 2), 0, 0, 1),
      [1, 0, 0]
    );
  });

  test('the rotation matrix matches Mat4.rotX/rotY/rotZ', () => {
    expectClose(
      Mat4.rotationFromQuaternion(Quaternion.fromAxisAngle(X_AXIS, 0.4)).values,
      Mat4.rotX(0.4).values
    );
    expectClose(
      Mat4.rotationFromQuaternion(Quaternion.fromAxisAngle(Y_AXIS, -1.1))
        .values,
      Mat4.rotY(-1.1).values
    );
    expectClose(
      Mat4.rotationFromQuaternion(Quaternion.fromAxisAngle(Z_AXIS, 2.5)).values,
      Mat4.rotZ(2.5).values
    );
  });

  test('multiply composes rotations in matrix order', () => {
    const a = Quaternion.fromAxisAngle(X_AXIS, 0.3);
    const b = Quaternion.fromAxisAngle(Y_AXIS, -0.8);
    const ab = a.clone().multiply(b);
    expectClose(
      Mat4.rotationFromQuaternion(ab).values,
      Mat4.rotX(0.3).multiply(Mat4.rotY(-0.8)).values
    );
    expectClose(b.clone().premultiply(a).toArray(), ab.toArray());
    expectClose(
      new Quaternion().multiplyQuaternions(a, b).toArray(),
      ab.toArray()
    );
    // the same axis: angles add
    const twice = a.clone().multiply(a);
    expectClose(
      twice.toArray(),
      Quaternion.fromAxisAngle(X_AXIS, 0.6).toArray()
    );
  });

  test('setFromEuler matches Mat4.compose with Euler angles', () => {
    const euler = new Vector(0.3, -0.8, 1.7);
    const q = Quaternion.fromEuler(euler);
    expect(q.length).toBeCloseTo(1, 10);
    expectClose(
      Mat4.rotationFromQuaternion(q).values,
      new Mat4().compose(new Vector(0, 0, 0), euler, new Vector(1, 1, 1)).values
    );
    // XYZ order: qx × qy × qz
    const expected = Quaternion.fromAxisAngle(X_AXIS, 0.3)
      .multiply(Quaternion.fromAxisAngle(Y_AXIS, -0.8))
      .multiply(Quaternion.fromAxisAngle(Z_AXIS, 1.7));
    expectClose(q.toArray(), expected.toArray());
  });

  test('Euler -> quaternion -> Euler round trips', () => {
    const cases = [
      [0, 0, 0],
      [0.3, -0.5, 1.2],
      [-2.5, 1.2, -3],
      [3, -1.5, 0.1],
      [0.1, Math.PI / 2 - 1e-3, 0.2],
    ];
    for (const angles of cases) {
      const euler = new Vector(...angles);
      const back = Quaternion.fromEuler(euler).toEuler(new Vector());
      expectClose(back.values, angles);
    }
  });

  test('toEuler in gimbal lock gives the same rotation with z = 0', () => {
    const euler = new Vector(0.4, Math.PI / 2, 0.9);
    const q = Quaternion.fromEuler(euler);
    const back = q.toEuler(new Vector());
    expect(back.z).toBe(0);
    expect(back.y).toBeCloseTo(Math.PI / 2, 5);
    expectClose(
      Mat4.rotationFromQuaternion(Quaternion.fromEuler(back)).values,
      Mat4.rotationFromQuaternion(q).values
    );
  });

  test('setFromRotationMatrix reads Mat4 and Mat3 rotations back', () => {
    const cases = [
      new Vector(0.3, -0.5, 1.2),
      new Vector(3, 0.2, 0.1), // trace <= 0, x dominant
      new Vector(0.2, 3, 0.1), // y dominant
      new Vector(0.1, 0.2, 3), // z dominant
      new Vector(0, 0, 0),
    ];
    for (const euler of cases) {
      const expected = Quaternion.fromEuler(euler);
      const m = new Mat4().compose(
        new Vector(1, 2, 3), // translation is ignored
        euler,
        new Vector(1, 1, 1)
      );
      const q = Quaternion.fromRotationMatrix(m);
      expect(q.length).toBeCloseTo(1, 5);
      // q and -q are the same rotation
      expect(Math.abs(q.dot(expected))).toBeCloseTo(1, 5);
      expectClose(
        Mat4.rotationFromQuaternion(q).values,
        Mat4.rotationFromQuaternion(expected).values
      );
      const q3 = Quaternion.fromRotationMatrix(Mat3.fromMat4(m));
      expectClose(q3.toArray(), q.toArray());
    }
  });

  test('slerp hits its endpoints and the midpoint', () => {
    const a = Quaternion.fromAxisAngle(Y_AXIS, 0);
    const b = Quaternion.fromAxisAngle(Y_AXIS, 1);
    expectClose(a.clone().slerp(b, 0).toArray(), a.toArray());
    expectClose(a.clone().slerp(b, 1).toArray(), b.toArray());
    expectClose(
      a.clone().slerp(b, 0.5).toArray(),
      Quaternion.fromAxisAngle(Y_AXIS, 0.5).toArray()
    );
    // constant angular speed: a quarter of the way is a quarter of the angle
    expectClose(
      new Quaternion().slerpQuaternions(a, b, 0.25).toArray(),
      Quaternion.fromAxisAngle(Y_AXIS, 0.25).toArray()
    );
  });

  test('slerp takes the short way round and copes with equal inputs', () => {
    // 350° is 10° the other way; halfway is -5°, not 175°
    const a = Quaternion.fromAxisAngle(Z_AXIS, 0);
    const b = Quaternion.fromAxisAngle(Z_AXIS, (350 * Math.PI) / 180);
    const mid = a.clone().slerp(b, 0.5);
    expectClose(
      Mat4.rotationFromQuaternion(mid).values,
      Mat4.rotZ((-5 * Math.PI) / 180).values
    );
    expectClose(a.clone().slerp(a, 0.3).toArray(), a.toArray());
    const nearly = Quaternion.fromAxisAngle(Z_AXIS, 1e-9);
    const q = a.clone().slerp(nearly, 0.5);
    expect(q.length).toBeCloseTo(1, 10);
    expectClose(q.toArray(), a.toArray());
  });
});
