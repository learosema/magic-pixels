import type { BufferGeometry } from '../geometries';
import type { Material } from './material';

/**
 * A mesh pairs a geometry with a material. It holds no GPU state; the
 * renderer looks up (or creates) the resources for both when rendering.
 */
export class Mesh {
  /**
   * Mesh constructor
   * @param geometry a buffer geometry
   * @param material the material
   */
  constructor(
    public geometry: BufferGeometry,
    public material: Material
  ) {}
}
