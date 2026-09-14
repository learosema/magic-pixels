import { PerspectiveCamera } from '../scene/camera';
import { AmbientLight, DirectionalLight, PointLight } from '../scene/light';
import { Object3D } from '../scene/object3d';
import { prepareScene } from '../scene/renderer';
import { Scene } from '../scene/scene';
import { Color, Vector } from '../utils';
import { collectLightUniforms, createLightUniforms } from './light-uniforms';

function expectClose(actual: ArrayLike<number>, expected: ArrayLike<number>) {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], 5);
  }
}

/** update the matrices and collect the light uniforms of a scene */
function collect(scene: Scene, camera: PerspectiveCamera) {
  const { lights } = prepareScene(scene, camera);
  return collectLightUniforms(lights, camera);
}

describe('collectLightUniforms', () => {
  test('sums ambient lights, premultiplied by intensity', () => {
    const scene = new Scene();
    scene.add(
      new AmbientLight(new Color(255, 0, 0), 0.5),
      new AmbientLight('#0000ff', 2)
    );
    const uniforms = collect(scene, new PerspectiveCamera());
    expectClose(uniforms.ambientLightColor, [0.5, 0, 2]);
    expect(uniforms.directionalLightCount).toBe(0);
    expect(uniforms.pointLightCount).toBe(0);
  });

  test('a directional light shines along its -Z axis, given in view space', () => {
    const scene = new Scene();
    const camera = new PerspectiveCamera();
    const sun = new DirectionalLight('#ff8000', 2);
    scene.add(sun);

    // unrotated: straight along -Z, which is also the camera's -Z
    let uniforms = collect(scene, camera);
    expectClose(uniforms.directionalLightDirections, [0, 0, -1]);
    expectClose(uniforms.directionalLightColors, [2, (2 * 128) / 255, 0]);
    expect(uniforms.directionalLightCount).toBe(1);

    // aimed at the origin from above and in front
    sun.position.set(0, 5, 5);
    sun.lookAt(new Vector(0, 0, 0));
    uniforms = collect(scene, camera);
    expectClose(uniforms.directionalLightDirections, [
      0,
      -Math.SQRT1_2,
      -Math.SQRT1_2,
    ]);

    // camera and light both turned to look along world -X: in view space
    // the light shines along the camera's own viewing direction again
    sun.position.set(0, 0, 0);
    sun.rotation.set(0, Math.PI / 2, 0);
    camera.rotation.y = Math.PI / 2;
    uniforms = collect(scene, camera);
    expectClose(uniforms.directionalLightDirections, [0, 0, -1]);
  });

  test('a directional light is unaffected by position and scale', () => {
    const scene = new Scene();
    const sun = new DirectionalLight();
    sun.position.set(3, 4, 5);
    sun.scale.set(2, 2, 2);
    scene.add(sun);
    const uniforms = collect(scene, new PerspectiveCamera());
    expectClose(uniforms.directionalLightDirections, [0, 0, -1]);
  });

  test('a point light is its world position in view space, with colour and range', () => {
    const scene = new Scene();
    const camera = new PerspectiveCamera();
    camera.position.set(0, 0, 5);
    const parent = new Object3D();
    parent.position.set(1, 0, 0);
    const bulb = new PointLight('#00ff00', 3, 10);
    bulb.position.set(0, 2, 0);
    parent.add(bulb);
    scene.add(parent);

    const uniforms = collect(scene, camera);
    expectClose(uniforms.pointLightPositions, [1, 2, -5]);
    expectClose(uniforms.pointLightColors, [0, 3, 0]);
    expect(uniforms.pointLightRanges).toEqual([10]);
    expect(uniforms.pointLightCount).toBe(1);
  });

  test('fills the arrays per light type and resets a reused target', () => {
    const scene = new Scene();
    const camera = new PerspectiveCamera();
    scene.add(
      new PointLight(),
      new DirectionalLight(),
      new AmbientLight(),
      new PointLight()
    );
    const target = createLightUniforms();
    let uniforms = collectLightUniforms(
      prepareScene(scene, camera).lights,
      camera,
      target
    );
    expect(uniforms).toBe(target);
    expect(uniforms.pointLightCount).toBe(2);
    expect(uniforms.pointLightPositions).toHaveLength(6);
    expect(uniforms.directionalLightCount).toBe(1);
    expectClose(uniforms.ambientLightColor, [1, 1, 1]);

    scene.children.forEach((light) => (light.visible = false));
    uniforms = collectLightUniforms(
      prepareScene(scene, camera).lights,
      camera,
      target
    );
    expect(uniforms).toEqual(createLightUniforms());
  });
});
