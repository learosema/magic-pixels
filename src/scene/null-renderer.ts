import type { BufferGeometry } from '../geometries';
import type { Material } from './material';
import type { Mesh } from './mesh';
import type { Renderer } from './renderer';
import type { Texture } from './texture';

/**
 * A renderer that draws nothing and needs no canvas. It records what it was
 * asked to do so scene code can be tested without a GPU.
 */
export class NullRenderer implements Renderer {
  width = 0;
  height = 0;
  pixelRatio = 1;

  /** every `render` call, in order */
  frames: Mesh[][] = [];
  /** every object passed to `dispose(object)` */
  disposed: (BufferGeometry | Material | Texture)[] = [];
  /** true after `dispose()` without an argument */
  isDisposed = false;

  /** meshes of the most recent `render` call */
  get lastFrame(): Mesh[] | undefined {
    return this.frames[this.frames.length - 1];
  }

  render(scene: Mesh[]): void {
    this.frames.push([...scene]);
  }

  setSize(width: number, height: number): void {
    this.width = width * this.pixelRatio;
    this.height = height * this.pixelRatio;
  }

  setPixelRatio(pixelRatio: number): void {
    this.pixelRatio = pixelRatio;
  }

  dispose(object?: BufferGeometry | Material | Texture): void {
    if (object === undefined) {
      this.isDisposed = true;
      return;
    }
    this.disposed.push(object);
  }
}
