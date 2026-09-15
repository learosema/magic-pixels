import { Box3 } from './box3';
import { Mat4 } from './mat4';
import { Vector } from './vector';

describe('Box3', () => {
  test('starts empty and grows around points', () => {
    const box = new Box3();
    expect(box.isEmpty).toBe(true);
    expect(box.getCenter().toArray()).toEqual([0, 0, 0]);
    expect(box.getSize().toArray()).toEqual([0, 0, 0]);
    box.expandByPoint(new Vector(1, 2, 3));
    expect(box.isEmpty).toBe(false);
    expect(box.min.toArray()).toEqual([1, 2, 3]);
    expect(box.max.toArray()).toEqual([1, 2, 3]);
    box.expandByCoordinates(-1, 4, 0);
    expect(box.min.toArray()).toEqual([-1, 2, 0]);
    expect(box.max.toArray()).toEqual([1, 4, 3]);
    expect(box.getCenter().toArray()).toEqual([0, 3, 1.5]);
    expect(box.getSize().toArray()).toEqual([2, 2, 3]);
  });

  test('setFromPoints, containsPoint, union and equals', () => {
    const box = new Box3().setFromPoints([
      new Vector(0, 0, 0),
      new Vector(2, 1, 1),
      new Vector(1, 3, -1),
    ]);
    expect(box.min.toArray()).toEqual([0, 0, -1]);
    expect(box.max.toArray()).toEqual([2, 3, 1]);
    expect(box.containsPoint(new Vector(1, 1, 0))).toBe(true);
    expect(box.containsPoint(new Vector(3, 1, 0))).toBe(false);

    const other = new Box3(new Vector(-5, 0, 0), new Vector(0, 0, 5));
    box.union(other);
    expect(box.min.toArray()).toEqual([-5, 0, -1]);
    expect(box.max.toArray()).toEqual([2, 3, 5]);
    // an empty box adds nothing
    const before = box.clone();
    box.union(new Box3());
    expect(box.equals(before)).toBe(true);
    expect(new Box3().union(other).equals(other)).toBe(true);
  });

  test('clone, copy and makeEmpty', () => {
    const box = new Box3(new Vector(1, 1, 1), new Vector(2, 2, 2));
    const copy = box.clone();
    expect(copy.equals(box)).toBe(true);
    copy.makeEmpty();
    expect(copy.isEmpty).toBe(true);
    expect(box.isEmpty).toBe(false);
    expect(new Box3().copy(box).equals(box)).toBe(true);
  });

  test('applyMat4 translates and scales exactly', () => {
    const box = new Box3(new Vector(-1, -1, -1), new Vector(1, 1, 1));
    box.applyMat4(Mat4.translation(10, 0, 0).multiply(Mat4.scaling(2, 3, 4)));
    expect(box.min.toArray()).toEqual([8, -3, -4]);
    expect(box.max.toArray()).toEqual([12, 3, 4]);
  });

  test('applyMat4 refits a rotated box around its corners', () => {
    // a unit cube rotated 45° about Y: its x/z extent becomes the diagonal
    const box = new Box3(new Vector(-1, -1, -1), new Vector(1, 1, 1));
    box.applyMat4(Mat4.rotY(Math.PI / 4));
    expect(box.min.x).toBeCloseTo(-Math.SQRT2);
    expect(box.max.x).toBeCloseTo(Math.SQRT2);
    expect(box.min.z).toBeCloseTo(-Math.SQRT2);
    expect(box.max.z).toBeCloseTo(Math.SQRT2);
    expect(box.min.y).toBeCloseTo(-1);
    expect(box.max.y).toBeCloseTo(1);
  });

  test('applyMat4 leaves an empty box empty', () => {
    expect(new Box3().applyMat4(Mat4.translation(1, 2, 3)).isEmpty).toBe(true);
  });
});
