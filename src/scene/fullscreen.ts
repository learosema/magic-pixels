import { BufferAttribute, BufferGeometry } from '../geometries';
import type { Material } from './material';
import { Mesh } from './mesh';

/**
 * A mesh that covers the whole screen, for post-processing passes: render
 * the scene into a {@link RenderTarget}, then render a scene holding this
 * mesh with a material that samples the target (see
 * {@link createFullscreenMaterial}, {@link createToneMapMaterial}).
 *
 * The geometry is a single triangle with the clip-space corners (-1, -1),
 * (3, -1) and (-1, 3), not a two-triangle quad. It is three times the screen
 * and the GPU clips it to the visible square: no vertex is shared, so there
 * is no diagonal seam where the two triangles of a quad meet, and it is
 * less work. The vertex shader ignores the camera, so any camera will do
 * when rendering the pass.
 * @param material usually from {@link createFullscreenMaterial}
 */
export function createFullscreenMesh(material: Material): Mesh {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([-1, -1, 3, -1, -1, 3]), 2)
  );
  return new Mesh(geometry, material);
}
