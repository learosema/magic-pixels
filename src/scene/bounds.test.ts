import {
  BufferAttribute,
  BufferGeometry,
  createBoxGeometry,
} from '../geometries';
import { Box3, Sphere, Vector } from '../utils';
import { computeBoundingBox, computeBoundingSphere } from './bounds';
import { createBasicMaterial } from './material';
import { Mesh } from './mesh';
import { Object3D } from './object3d';
import { Scene } from './scene';

function unitCube(): Mesh {
  return new Mesh(createBoxGeometry(1, 1, 1, 1, 1, 1), createBasicMaterial());
}

describe('computeBoundingBox', () => {
  test('is empty without meshes', () => {
    expect(computeBoundingBox(new Scene()).isEmpty).toBe(true);
  });

  test('transforms each geometry box by its world matrix and unions them', () => {
    const scene = new Scene();
    const pivot = new Object3D();
    pivot.position.set(10, 0, 0);
    pivot.scale.set(2, 2, 2);
    scene.add(pivot);
    const a = unitCube();
    a.position.set(1, 0, 0); // world: centre (12, 0, 0), size 2
    pivot.add(a);
    const b = unitCube();
    b.position.set(0, 5, 0); // world: centre (0, 5, 0), size 1
    scene.add(b);

    const box = computeBoundingBox(scene);
    expect(box.min.toArray()).toEqual([-0.5, -1, -1]);
    expect(box.max.toArray()).toEqual([13, 5.5, 1]);
    // world matrices were brought up to date on the way
    expect(a.worldMatrix.values[12]).toBe(12);
    // the geometry boxes are cached in local space
    expect(a.geometry.boundingBox!.max.toArray()).toEqual([0.5, 0.5, 0.5]);
  });

  test('a subtree is measured relative to its parent’s world matrix', () => {
    const scene = new Scene();
    const parent = new Object3D();
    parent.position.set(0, 0, -3);
    scene.add(parent);
    const mesh = unitCube();
    parent.add(mesh);
    scene.updateWorldMatrix();
    const box = computeBoundingBox(parent);
    expect(box.getCenter().toArray()).toEqual([0, 0, -3]);
  });

  test('a rotated mesh gets the box around its transformed corners', () => {
    const mesh = unitCube();
    mesh.rotation.y = Math.PI / 4;
    const box = computeBoundingBox(mesh);
    expect(box.max.x).toBeCloseTo(Math.SQRT1_2);
    expect(box.max.y).toBeCloseTo(0.5);
  });

  test('reuses a target and includes invisible meshes', () => {
    const scene = new Scene();
    const mesh = unitCube();
    mesh.visible = false;
    scene.add(mesh);
    const target = new Box3();
    expect(computeBoundingBox(scene, target)).toBe(target);
    expect(target.isEmpty).toBe(false);
  });
});

describe('computeBoundingSphere', () => {
  test('is centred on the world box and contains every mesh sphere', () => {
    const scene = new Scene();
    const a = unitCube();
    a.position.set(-4, 0, 0);
    const b = unitCube();
    b.position.set(4, 0, 0);
    b.scale.set(2, 2, 2);
    scene.add(a, b);
    const sphere = computeBoundingSphere(scene);
    expect(sphere.center.toArray()).toEqual([0.25, 0, 0]);
    // b's sphere: centre (4, 0, 0), radius √3 (half diagonal of the 2-cube)
    expect(sphere.radius).toBeCloseTo(3.75 + Math.sqrt(3));
  });

  test('is tight for a single centred mesh', () => {
    const geometry = new BufferGeometry().setAttribute(
      'position',
      new BufferAttribute(
        new Float32Array([
          1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1,
        ]),
        3
      )
    );
    const mesh = new Mesh(geometry, createBasicMaterial());
    const sphere = computeBoundingSphere(mesh);
    expect(sphere.center.toArray()).toEqual([0, 0, 0]);
    // the box-derived sphere would be √3; the true one is 1
    expect(sphere.radius).toBe(1);
    expect(new Sphere().setFromBox(geometry.boundingBox!).radius).toBeCloseTo(
      Math.sqrt(3)
    );
  });

  test('is empty without meshes and reuses a target', () => {
    const target = new Sphere(new Vector(1, 1, 1), 1);
    expect(computeBoundingSphere(new Scene(), target)).toBe(target);
    expect(target.isEmpty).toBe(true);
  });
});
