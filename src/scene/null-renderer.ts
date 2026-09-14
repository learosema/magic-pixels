import type { BufferGeometry } from '../geometries';
import { Color } from '../utils';
import type { Camera } from './camera';
import type { Material } from './material';
import type { Light } from './light';
import type { Mesh } from './mesh';
import { prepareScene } from './renderer';
import type { Renderer } from './renderer';
import type { Scene } from './scene';
import type { Texture } from './texture';

/** What a `NullRenderer` records per `render` call */
export type NullFrame = {
  scene: Scene;
  camera: Camera;
  /** opaque meshes, in the order a renderer would draw them */
  meshes: Mesh[];
  /** transparent meshes, sorted back to front */
  transparent: Mesh[];
  /** visible lights, in scene-tree order */
  lights: Light[];
};

/**
 * A renderer that draws nothing and needs no canvas. It updates the world
 * matrices like a real renderer and records what it was asked to do, so
 * scene code can be tested without a GPU.
 */
export class NullRenderer implements Renderer {
  width = 0;
  height = 0;
  pixelRatio = 1;
  /** clear color as `[r, g, b, a]` in the range 0..1 */
  clearColor = [0, 0, 0, 1];

  /** every `render` call, in order */
  frames: NullFrame[] = [];
  /** every object passed to `dispose(object)` */
  disposed: (BufferGeometry | Material | Texture)[] = [];
  /** true after `dispose()` without an argument */
  isDisposed = false;

  /** the most recent `render` call */
  get lastFrame(): NullFrame | undefined {
    return this.frames[this.frames.length - 1];
  }

  render(scene: Scene, camera: Camera): void {
    const { meshes, transparent, lights } = prepareScene(scene, camera);
    this.frames.push({ scene, camera, meshes, transparent, lights });
  }

  setSize(width: number, height: number): void {
    this.width = width * this.pixelRatio;
    this.height = height * this.pixelRatio;
  }

  setPixelRatio(pixelRatio: number): void {
    this.pixelRatio = pixelRatio;
  }

  setClearColor(color: Color | string, alpha?: number): void {
    const [r, g, b, a] = (
      typeof color === 'string' ? Color.fromHex(color) : color
    ).toVec4();
    this.clearColor = [r, g, b, alpha ?? a];
  }

  dispose(object?: BufferGeometry | Material | Texture): void {
    if (object === undefined) {
      this.isDisposed = true;
      return;
    }
    this.disposed.push(object);
  }
}
