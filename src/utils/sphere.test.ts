import { Box3 } from './box3';
import { Mat4 } from './mat4';
import { Sphere } from './sphere';
import { Vector } from './vector';

describe('Sphere', () => {
  test('starts empty', () => {
    const sphere = new Sphere();
    expect(sphere.isEmpty).toBe(true);
    expect(sphere.containsPoint(new Vector(0, 0, 0))).toBe(false);
  });

  test('setFromBox takes the centre and half the diagonal', () => {
    const sphere = new Sphere().setFromBox(
      new Box3(new Vector(0, 0, 0), new Vector(2, 2, 2))
    );
    expect(sphere.center.toArray()).toEqual([1, 1, 1]);
    expect(sphere.radius).toBeCloseTo(Math.sqrt(3));
    expect(new Sphere().setFromBox(new Box3()).isEmpty).toBe(true);
  });

  test('expandByPoint keeps the centre and grows the radius', () => {
    const sphere = new Sphere();
    sphere.expandByPoint(new Vector(1, 0, 0));
    expect(sphere.center.toArray()).toEqual([1, 0, 0]);
    expect(sphere.radius).toBe(0);
    sphere.expandByPoint(new Vector(4, 4, 0));
    expect(sphere.center.toArray()).toEqual([1, 0, 0]);
    expect(sphere.radius).toBe(5);
    sphere.expandByPoint(new Vector(2, 0, 0));
    expect(sphere.radius).toBe(5);
    expect(sphere.containsPoint(new Vector(-4, 0, 0))).toBe(true);
    expect(sphere.containsPoint(new Vector(-4.1, 0, 0))).toBe(false);
  });

  test('expandBySphere contains the other sphere', () => {
    const sphere = new Sphere(new Vector(0, 0, 0), 1);
    sphere.expandBySphere(new Sphere(new Vector(3, 0, 0), 2));
    expect(sphere.center.toArray()).toEqual([0, 0, 0]);
    expect(sphere.radius).toBe(5);
    // a contained sphere changes nothing
    sphere.expandBySphere(new Sphere(new Vector(1, 0, 0), 1));
    expect(sphere.radius).toBe(5);
    // an empty one neither
    sphere.expandBySphere(new Sphere());
    expect(sphere.radius).toBe(5);
    // an empty sphere becomes the other one
    const empty = new Sphere().expandBySphere(sphere);
    expect(empty.equals(sphere)).toBe(true);
  });

  test('applyMat4 moves the centre and scales the radius by the largest axis', () => {
    const sphere = new Sphere(new Vector(1, 0, 0), 2);
    sphere.applyMat4(Mat4.translation(0, 5, 0).multiply(Mat4.scaling(1, 3, 2)));
    expect(sphere.center.toArray()).toEqual([1, 5, 0]);
    expect(sphere.radius).toBe(6);
    // rotation leaves the radius alone
    const rotated = new Sphere(new Vector(1, 0, 0), 2).applyMat4(
      Mat4.rotZ(Math.PI / 2)
    );
    expect(rotated.center.x).toBeCloseTo(0);
    expect(rotated.center.y).toBeCloseTo(1);
    expect(rotated.radius).toBeCloseTo(2);
    expect(new Sphere().applyMat4(Mat4.scaling(2, 2, 2)).isEmpty).toBe(true);
  });

  test('clone, copy and makeEmpty', () => {
    const sphere = new Sphere(new Vector(1, 2, 3), 4);
    const copy = sphere.clone();
    expect(copy.equals(sphere)).toBe(true);
    copy.makeEmpty();
    expect(copy.isEmpty).toBe(true);
    expect(sphere.radius).toBe(4);
    expect(new Sphere().copy(sphere).equals(sphere)).toBe(true);
  });
});
