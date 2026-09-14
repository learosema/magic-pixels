import { BufferGeometry } from '../geometries';
import { Color, Vector } from '../utils';
import { PerspectiveCamera } from './camera';
import { AmbientLight, DirectionalLight, Light, PointLight } from './light';
import { createDefaultMaterial } from './material';
import { Mesh } from './mesh';
import { NullRenderer } from './null-renderer';
import { Object3D } from './object3d';
import { Scene } from './scene';

function expectClose(actual: ArrayLike<number>, expected: ArrayLike<number>) {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], 5);
  }
}

describe('Light', () => {
  test('is white with intensity 1 by default and accepts hex colours', () => {
    const light = new Light();
    expect(light).toBeInstanceOf(Object3D);
    expect(light.color).toEqual(new Color(255, 255, 255));
    expect(light.intensity).toBe(1);

    const warm = new DirectionalLight('#fff4e0', 2);
    expect(warm.color).toEqual(Color.fromHex('#fff4e0'));
    expect(warm.intensity).toBe(2);

    const bulb = new PointLight(new Color(255, 0, 0), 3, 10);
    expect(bulb.color).toEqual(new Color(255, 0, 0));
    expect(bulb.range).toBe(10);
    expect(new PointLight().range).toBe(0);
  });

  test('a directional light aims its -Z axis with lookAt, like a camera', () => {
    const light = new DirectionalLight();
    light.position.set(0, 5, 5);
    light.lookAt(new Vector(0, 0, 0));
    light.updateWorldMatrix();
    // the third column of the world matrix is the local +Z axis in world
    // space; the light shines along -Z, so it points down and forward
    const m = light.worldMatrix.values;
    expectClose([-m[8], -m[9], -m[10]], [0, -Math.SQRT1_2, -Math.SQRT1_2]);
  });

  test('prepareScene collects visible lights in tree order, skipping invisible subtrees', () => {
    const renderer = new NullRenderer();
    const scene = new Scene();
    const camera = new PerspectiveCamera();
    const ambient = new AmbientLight();
    const sun = new DirectionalLight();
    const bulb = new PointLight();
    const hiddenBulb = new PointLight();
    const childOfHidden = new PointLight();
    const group = new Object3D();
    const hidden = new Object3D();
    hidden.visible = false;
    hidden.add(childOfHidden);
    hiddenBulb.visible = false;
    group.add(sun, hidden, bulb);
    scene.add(
      ambient,
      new Mesh(new BufferGeometry(), createDefaultMaterial()),
      group,
      hiddenBulb
    );

    renderer.render(scene, camera);
    expect(renderer.lastFrame!.lights).toEqual([ambient, sun, bulb]);
    expect(renderer.lastFrame!.meshes).toHaveLength(1);
  });

  test('a light parented to a moving object follows it', () => {
    const renderer = new NullRenderer();
    const scene = new Scene();
    const pivot = new Object3D();
    const bulb = new PointLight();
    bulb.position.set(2, 0, 0);
    pivot.add(bulb);
    scene.add(pivot);
    pivot.rotation.y = Math.PI / 2;

    renderer.render(scene, new PerspectiveCamera());
    expectClose(bulb.worldMatrix.getPosition(new Vector()).values, [0, 0, -2]);
  });
});
