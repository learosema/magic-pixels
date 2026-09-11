import { Mat4, Vector } from '../utils';
import { Object3D } from './object3d';

function expectClose(actual: ArrayLike<number>, expected: ArrayLike<number>) {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], 5);
  }
}

const worldPosition = (object: Object3D) =>
  object.worldMatrix.getPosition(new Vector()).values;

describe('Object3D', () => {
  test('add and remove maintain parent and children', () => {
    const parent = new Object3D();
    const other = new Object3D();
    const a = new Object3D();
    const b = new Object3D();
    parent.add(a, b);
    expect(parent.children).toEqual([a, b]);
    expect(a.parent).toBe(parent);

    // adding to another parent moves the object
    other.add(a);
    expect(parent.children).toEqual([b]);
    expect(other.children).toEqual([a]);
    expect(a.parent).toBe(other);

    parent.remove(b);
    parent.remove(b); // not a child any more: ignored
    expect(parent.children).toEqual([]);
    expect(b.parent).toBeNull();

    a.removeFromParent();
    expect(other.children).toEqual([]);
    expect(a.parent).toBeNull();
  });

  test('refuses cycles', () => {
    const a = new Object3D();
    const b = new Object3D();
    a.add(b);
    expect(() => a.add(a)).toThrow();
    expect(() => b.add(a)).toThrow();
    expect(a.isAncestorOf(b)).toBe(true);
    expect(b.isAncestorOf(a)).toBe(false);
  });

  test('traverse visits depth-first', () => {
    const root = new Object3D();
    const a = new Object3D();
    const b = new Object3D();
    const c = new Object3D();
    root.add(a, c);
    a.add(b);
    const visited: Object3D[] = [];
    root.traverse((object) => visited.push(object));
    expect(visited).toEqual([root, a, b, c]);
  });

  test('world matrix is parent world matrix × local matrix', () => {
    const parent = new Object3D();
    const child = new Object3D();
    parent.add(child);
    parent.position.set(1, 0, 0);
    parent.scale.set(2, 2, 2);
    child.position.set(0, 1, 0);

    parent.updateWorldMatrix();
    expectClose(
      parent.localMatrix.values,
      Mat4.translation(1, 0, 0).multiply(Mat4.scaling(2, 2, 2)).values
    );
    expect(parent.worldMatrix.equals(parent.localMatrix)).toBe(true);
    expectClose(worldPosition(child), [1, 2, 0]);
  });

  test('a child orbits when its parent rotates', () => {
    const planet = new Object3D();
    const moon = new Object3D();
    planet.add(moon);
    moon.position.set(2, 0, 0);

    planet.rotation.y = Math.PI / 2;
    planet.updateWorldMatrix();
    expectClose(worldPosition(moon), [0, 0, -2]);

    planet.rotation.y = Math.PI;
    planet.updateWorldMatrix();
    expectClose(worldPosition(moon), [-2, 0, 0]);
  });

  test('an empty pivot orbits a child without rotating the parent', () => {
    const planet = new Object3D();
    const pivot = new Object3D();
    const moon = new Object3D();
    planet.add(pivot);
    pivot.add(moon);
    moon.position.set(2, 0, 0);
    pivot.rotation.y = Math.PI / 2;

    planet.updateWorldMatrix();
    expect(planet.worldMatrix.equals(new Mat4())).toBe(true);
    expectClose(worldPosition(moon), [0, 0, -2]);
  });

  test('a manual local matrix is used when matrixAutoUpdate is off', () => {
    const object = new Object3D();
    object.matrixAutoUpdate = false;
    object.localMatrix.setTranslation(0, 0, 7);
    object.worldMatrixNeedsUpdate = true;
    object.updateWorldMatrix();
    expectClose(worldPosition(object), [0, 0, 7]);

    // not flagged: the world matrix stays as it is
    object.localMatrix.setTranslation(0, 0, 8);
    object.updateWorldMatrix();
    expectClose(worldPosition(object), [0, 0, 7]);

    // ...until an update is forced
    object.updateWorldMatrix(true);
    expectClose(worldPosition(object), [0, 0, 8]);

    // an auto-updating parent always propagates its transform
    const parent = new Object3D();
    parent.add(object);
    parent.position.x = 1;
    object.localMatrix.setTranslation(0, 0, 9);
    parent.updateWorldMatrix();
    expectClose(worldPosition(object), [1, 0, 9]);
  });

  test('lookAt points the +Z axis at the target', () => {
    const object = new Object3D();
    object.lookAt(new Vector(0, 0, 5));
    expectClose(object.rotation.values, [0, 0, 0]);
    object.lookAt(new Vector(5, 0, 0));
    expectClose(object.rotation.values, [0, Math.PI / 2, 0]);

    object.position.set(0, 0, 5);
    object.lookAt(new Vector(0, 0, 0));
    object.updateWorldMatrix();
    const forward = object.worldMatrix
      .toMatrix()
      .mul(new Vector(0, 0, 1, 0)) as Vector;
    expectClose(forward.xyz.values, [0, 0, -1]);
  });

  test('setRotationFromMatrix recovers Euler XYZ angles', () => {
    const angles = new Vector(0.3, -0.5, 1.2);
    const m = new Mat4().compose(
      new Vector(1, 2, 3),
      angles,
      new Vector(1, 1, 1)
    );
    const object = new Object3D();
    object.setRotationFromMatrix(m);
    expectClose(object.rotation.values, angles.values);
  });
});
