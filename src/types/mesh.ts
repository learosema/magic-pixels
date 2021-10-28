import { BufferGeometry } from '../geometries';
import { Material } from './material';

export class Mesh {
  id: number = NaN;

  /**
   * Mesh constructor
   * @param geometry a buffer geometry
   * @param material the material
   */
  constructor(public geometry: BufferGeometry, public material: Material) {}
}
