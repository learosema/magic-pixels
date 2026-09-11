import type { BufferGeometry } from '../geometries';
import type { Color } from '../utils';
import type { Camera } from './camera';
import type { Material } from './material';
import { Mesh } from './mesh';
import type { Object3D } from './object3d';
import type { Scene } from './scene';
import type { Texture } from './texture';

/**
 * A renderer draws a scene. The interface sits above the GPU API: it deals
 * in scenes, cameras, meshes, materials and textures, not in buffers or
 * programs, so a WebGPU implementation can live next to the WebGL2 one.
 *
 * Scene objects are plain data. The renderer creates, caches and frees the
 * GPU resources for them, and injects the built-in matrix uniforms
 * `modelMatrix`, `viewMatrix`, `projectionMatrix`, `modelViewMatrix` and
 * `normalMatrix` when a shader declares them.
 */
export interface Renderer {
  /** Update the world matrices and draw the visible meshes of the scene */
  render(scene: Scene, camera: Camera): void;
  /** Resize the drawing surface in CSS pixels; `pixelRatio` is applied */
  setSize(width: number, height: number): void;
  /** Device pixel ratio applied by `setSize` (default 1) */
  setPixelRatio(pixelRatio: number): void;
  /** Color the frame is cleared to before drawing (default black) */
  setClearColor(color: Color | string, alpha?: number): void;
  /**
   * Free GPU resources. Without an argument, everything the renderer created
   * is freed and the renderer is unusable afterwards. With a geometry,
   * material or texture, only that object's resources are freed; they are
   * recreated on the next render if still in use.
   */
  dispose(object?: BufferGeometry | Material | Texture): void;
}

/**
 * Prepare a frame: update the world matrices of the scene (and of the
 * camera, if it is not part of the scene) and collect the meshes to draw,
 * in depth-first order, skipping invisible subtrees. Shared by all renderer
 * implementations.
 */
export function prepareScene(scene: Scene, camera: Camera): Mesh[] {
  scene.updateWorldMatrix();
  if (camera.parent === null) {
    camera.updateWorldMatrix();
  }
  const meshes: Mesh[] = [];
  collectMeshes(scene, meshes);
  return meshes;
}

function collectMeshes(object: Object3D, meshes: Mesh[]): void {
  if (!object.visible) {
    return;
  }
  if (object instanceof Mesh) {
    meshes.push(object);
  }
  for (const child of object.children) {
    collectMeshes(child, meshes);
  }
}
