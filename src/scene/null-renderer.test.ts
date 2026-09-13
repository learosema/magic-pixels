import { BufferGeometry } from '../geometries';
import { Color } from '../utils';
import { PerspectiveCamera } from './camera';
import { createDefaultMaterial } from './material';
import { Mesh } from './mesh';
import { NullRenderer } from './null-renderer';
import { Object3D } from './object3d';
import type { Renderer } from './renderer';
import { Scene } from './scene';

function createTransparentMaterial() {
  return { ...createDefaultMaterial(), transparent: true };
}

describe('NullRenderer', () => {
  test('records rendered frames with the visible meshes in draw order', () => {
    const renderer: Renderer = new NullRenderer();
    const scene = new Scene();
    const camera = new PerspectiveCamera();
    const group = new Object3D();
    const a = new Mesh(new BufferGeometry(), createDefaultMaterial());
    const b = new Mesh(new BufferGeometry(), createDefaultMaterial());
    const hidden = new Mesh(new BufferGeometry(), createDefaultMaterial());
    hidden.visible = false;
    group.add(a, hidden);
    scene.add(group, b);

    renderer.render(scene, camera);
    b.visible = false;
    renderer.render(scene, camera);

    const { frames, lastFrame } = renderer as NullRenderer;
    expect(frames.map((frame) => frame.meshes)).toEqual([[a, b], [a]]);
    expect(lastFrame).toEqual({
      scene,
      camera,
      meshes: [a],
      transparent: [],
      lights: [],
    });
  });

  test('sorts transparent meshes back to front by view-space depth, after the opaque ones', () => {
    const renderer = new NullRenderer();
    const scene = new Scene();
    const camera = new PerspectiveCamera();
    camera.position.set(0, 0, 10);
    const opaque = new Mesh(new BufferGeometry(), createDefaultMaterial());
    const near = new Mesh(new BufferGeometry(), createTransparentMaterial());
    const middle = new Mesh(new BufferGeometry(), createTransparentMaterial());
    const far = new Mesh(new BufferGeometry(), createTransparentMaterial());
    near.position.z = 4;
    middle.position.z = 1;
    far.position.z = -3;
    // added out of depth order, on purpose
    scene.add(opaque, near, far, middle);

    renderer.render(scene, camera);

    const { lastFrame } = renderer;
    expect(lastFrame!.meshes).toEqual([opaque]);
    expect(lastFrame!.transparent).toEqual([far, middle, near]);
  });

  test('updates the world matrices like a real renderer', () => {
    const renderer = new NullRenderer();
    const scene = new Scene();
    const camera = new PerspectiveCamera();
    const mesh = new Mesh(new BufferGeometry(), createDefaultMaterial());
    mesh.position.set(1, 2, 3);
    camera.position.set(0, 0, 5);
    scene.add(mesh);

    renderer.render(scene, camera);
    expect(mesh.worldMatrix.toArray().slice(12)).toEqual([1, 2, 3, 1]);
    expect(camera.viewMatrix.toArray().slice(12)).toEqual([0, 0, -5, 1]);
  });

  test('applies the pixel ratio to setSize', () => {
    const renderer = new NullRenderer();
    renderer.setPixelRatio(2);
    renderer.setSize(100, 50);
    expect(renderer.width).toBe(200);
    expect(renderer.height).toBe(100);
  });

  test('records the clear color', () => {
    const renderer = new NullRenderer();
    renderer.setClearColor('#ff0000');
    expect(renderer.clearColor).toEqual([1, 0, 0, 1]);
    renderer.setClearColor(new Color(0, 255, 0), 0.5);
    expect(renderer.clearColor).toEqual([0, 1, 0, 0.5]);
  });

  test('records disposed objects', () => {
    const renderer = new NullRenderer();
    const geometry = new BufferGeometry();
    const material = createDefaultMaterial();
    renderer.dispose(geometry);
    renderer.dispose(material);
    expect(renderer.disposed).toEqual([geometry, material]);
    expect(renderer.isDisposed).toBe(false);
    renderer.dispose();
    expect(renderer.isDisposed).toBe(true);
  });
});
