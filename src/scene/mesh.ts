import type { BufferGeometry } from '../geometries';
import { Mat3, Mat4 } from '../utils';
import type { Material } from './material';
import { Object3D } from './object3d';

/**
 * A mesh pairs a geometry with a material and places them in the scene
 * graph. It holds no GPU state; the renderer looks up (or creates) the
 * resources for both when rendering.
 */
export class Mesh extends Object3D {
  /** `camera.viewMatrix × worldMatrix`, filled in by the renderer */
  readonly modelViewMatrix = new Mat4();
  /** inverse transpose of `modelViewMatrix`, filled in by the renderer */
  readonly normalMatrix = new Mat3();

  /**
   * Mesh constructor
   * @param geometry a buffer geometry
   * @param material the material
   */
  constructor(
    public geometry: BufferGeometry,
    public material: Material
  ) {
    super();
  }
}
