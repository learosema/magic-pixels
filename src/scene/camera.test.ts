import { Mat4, Vector } from '../utils';
import { Camera, OrthographicCamera, PerspectiveCamera } from './camera';
import { Object3D } from './object3d';
import { prepareScene } from './renderer';
import { Scene } from './scene';

function expectClose(actual: ArrayLike<number>, expected: ArrayLike<number>) {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], 5);
  }
}

function project(m: Mat4, x: number, y: number, z: number): number[] {
  const v = m.toMatrix().mul(new Vector(x, y, z, 1)) as Vector;
  return [v.x / v.w, v.y / v.w, v.z / v.w];
}

describe('Camera', () => {
  test('the view matrix is the inverse of the world matrix', () => {
    const camera = new Camera();
    camera.position.set(1, 2, 5);
    camera.rotation.y = 0.4;
    camera.updateWorldMatrix();
    expectClose(
      camera.viewMatrix.values,
      camera.worldMatrix.clone().invert().values
    );
    expectClose(project(camera.viewMatrix, 1, 2, 5), [0, 0, 0]);
    expect(camera.projectionMatrix.equals(new Mat4())).toBe(true);
  });

  test('lookAt points the viewing direction (-Z) at the target', () => {
    const camera = new Camera();
    camera.position.set(0, 0, 5);
    camera.lookAt(new Vector(0, 0, 0));
    expectClose(camera.rotation.values, [0, 0, 0]);

    camera.position.set(5, 0, 0);
    camera.lookAt(new Vector(0, 0, 0));
    camera.updateWorldMatrix();
    // the origin ends up straight ahead, 5 units away
    expectClose(project(camera.viewMatrix, 0, 0, 0), [0, 0, -5]);
    // up stays up
    expectClose(project(camera.viewMatrix, 5, 1, 0), [0, 1, 0]);
  });

  test('a camera inside the scene graph inherits its parent transform', () => {
    const scene = new Scene();
    const rig = new Object3D();
    const camera = new Camera();
    camera.position.set(0, 0, 5);
    rig.add(camera);
    scene.add(rig);
    rig.rotation.y = Math.PI / 2;

    prepareScene(scene, camera);
    expectClose(camera.worldMatrix.getPosition(new Vector()).values, [5, 0, 0]);
    expectClose(project(camera.viewMatrix, 0, 0, 0), [0, 0, -5]);
  });

  test('a camera outside the scene graph is updated by prepareScene', () => {
    const scene = new Scene();
    const camera = new Camera();
    camera.position.set(0, 0, 3);
    prepareScene(scene, camera);
    expectClose(project(camera.viewMatrix, 0, 0, 0), [0, 0, -3]);
  });
});

describe('PerspectiveCamera', () => {
  test('projects with the given parameters', () => {
    const camera = new PerspectiveCamera(90, 2, 1, 10);
    expect(camera.projectionMatrix.equals(Mat4.perspective(90, 2, 1, 10))).toBe(
      true
    );
    expectClose(project(camera.projectionMatrix, 0, 0, -1), [0, 0, -1]);
    expectClose(project(camera.projectionMatrix, 0, 0, -10), [0, 0, 1]);
  });

  test('has three.js-like defaults and updates on demand', () => {
    const camera = new PerspectiveCamera();
    expect([camera.fov, camera.aspect, camera.near, camera.far]).toEqual([
      50, 1, 0.1, 2000,
    ]);
    camera.aspect = 16 / 9;
    camera.updateProjectionMatrix();
    expect(
      camera.projectionMatrix.equals(Mat4.perspective(50, 16 / 9, 0.1, 2000))
    ).toBe(true);
  });
});

describe('OrthographicCamera', () => {
  test('maps the given box to clip space', () => {
    const camera = new OrthographicCamera(-2, 2, 1, -1, 1, 10);
    expect(
      camera.projectionMatrix.equals(Mat4.ortho(-2, 2, -1, 1, 1, 10))
    ).toBe(true);
    expectClose(project(camera.projectionMatrix, -2, -1, -1), [-1, -1, -1]);
    expectClose(project(camera.projectionMatrix, 2, 1, -10), [1, 1, 1]);
    camera.left = -4;
    camera.updateProjectionMatrix();
    expectClose(project(camera.projectionMatrix, -4, -1, -1), [-1, -1, -1]);
  });
});
