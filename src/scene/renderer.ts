import type { BufferGeometry } from '../geometries';
import { Mat4, type Color } from '../utils';
import type { Camera } from './camera';
import { Light } from './light';
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
 * GPU resources for them, and injects the built-in uniforms when a shader
 * declares them: the matrices `modelMatrix`, `viewMatrix`,
 * `projectionMatrix`, `modelViewMatrix` and `normalMatrix`, and the lights
 * of the frame (`ambientLightColor`, `directionalLight*`, `pointLight*`).
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
 * A prepared frame: opaque meshes in scene-tree order, transparent meshes
 * (`material.transparent === true`) sorted back to front by view-space
 * depth so blending composites correctly, and the visible lights in
 * scene-tree order.
 */
export type Frame = {
  meshes: Mesh[];
  transparent: Mesh[];
  lights: Light[];
};

const scratchMatrix = new Mat4();

/**
 * Prepare a frame: update the world matrices of the scene (and of the
 * camera, if it is not part of the scene), collect the visible meshes and
 * lights in depth-first order, skipping invisible subtrees, and split the
 * meshes into opaque and transparent lists. Shared by all renderer
 * implementations.
 */
export function prepareScene(scene: Scene, camera: Camera): Frame {
  scene.updateWorldMatrix();
  if (camera.parent === null) {
    camera.updateWorldMatrix();
  }
  const frame: Frame = { meshes: [], transparent: [], lights: [] };
  collect(scene, frame);
  frame.transparent = frame.transparent
    .map((mesh) => ({ mesh, depth: viewSpaceDepth(mesh, camera) }))
    .sort((a, b) => a.depth - b.depth)
    .map((entry) => entry.mesh);
  return frame;
}

function collect(object: Object3D, frame: Frame): void {
  if (!object.visible) {
    return;
  }
  if (object instanceof Mesh) {
    (object.material.transparent ? frame.transparent : frame.meshes).push(
      object
    );
  } else if (object instanceof Light) {
    frame.lights.push(object);
  }
  for (const child of object.children) {
    collect(child, frame);
  }
}

/** A mesh's Z coordinate in view space; more negative is farther away. */
function viewSpaceDepth(mesh: Mesh, camera: Camera): number {
  scratchMatrix.multiplyMatrices(camera.viewMatrix, mesh.worldMatrix);
  return scratchMatrix.values[14];
}
