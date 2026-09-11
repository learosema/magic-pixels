import type { BufferGeometry } from '../geometries';
import type { Material } from './material';
import type { Mesh } from './mesh';
import type { Texture } from './texture';

/**
 * A renderer draws a scene. The interface sits above the GPU API: it deals
 * in meshes, materials and textures, not in buffers or programs, so a
 * WebGPU implementation can live next to the WebGL2 one.
 *
 * Scene objects are plain data. The renderer creates, caches and frees the
 * GPU resources for them.
 */
export interface Renderer {
  /** Draw the meshes in order */
  render(scene: Mesh[]): void;
  /** Resize the drawing surface in CSS pixels; `pixelRatio` is applied */
  setSize(width: number, height: number): void;
  /** Device pixel ratio applied by `setSize` (default 1) */
  setPixelRatio(pixelRatio: number): void;
  /**
   * Free GPU resources. Without an argument, everything the renderer created
   * is freed and the renderer is unusable afterwards. With a geometry,
   * material or texture, only that object's resources are freed; they are
   * recreated on the next render if still in use.
   */
  dispose(object?: BufferGeometry | Material | Texture): void;
}
