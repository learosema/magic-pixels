import { Object3D } from './object3d';

/**
 * The root of the scene graph. Add meshes (and cameras, lights, pivots, ...)
 * with `scene.add()` and pass the scene to `renderer.render(scene, camera)`.
 */
export class Scene extends Object3D {}
