import { Mat4, Vector } from '../utils';
import { Object3D } from './object3d';

const DEFAULT_UP = new Vector(0, 1, 0);

/**
 * A camera is an object in the scene graph that owns a projection matrix.
 * Its `viewMatrix` (the inverse of `worldMatrix`) is kept in sync by
 * `updateWorldMatrix()`. Use `PerspectiveCamera` or `OrthographicCamera`;
 * this base class projects nothing (identity).
 */
export class Camera extends Object3D {
  readonly projectionMatrix = new Mat4();
  /** inverse of `worldMatrix`; transforms world space into view space */
  readonly viewMatrix = new Mat4();

  /** Recompute `projectionMatrix` after changing the camera parameters */
  updateProjectionMatrix(): void {
    this.projectionMatrix.identity();
  }

  /**
   * Point the camera at `target` (the viewing direction is the camera's
   * -Z axis).
   * @param target a point in the parent's coordinate system
   * @param up the up direction, +Y by default
   */
  override lookAt(target: Vector, up: Vector = DEFAULT_UP): this {
    return this.setRotationFromMatrix(Mat4.lookAt(this.position, target, up));
  }

  protected override onWorldMatrixChanged(): void {
    this.viewMatrix.copy(this.worldMatrix).invert();
  }
}

/**
 * Camera with a perspective projection.
 */
export class PerspectiveCamera extends Camera {
  /**
   * @param fov vertical field of view in degrees
   * @param aspect width / height of the viewport
   * @param near distance to the near clipping plane
   * @param far distance to the far clipping plane
   */
  constructor(
    public fov = 50,
    public aspect = 1,
    public near = 0.1,
    public far = 2000
  ) {
    super();
    this.updateProjectionMatrix();
  }

  override updateProjectionMatrix(): void {
    this.projectionMatrix.setPerspective(
      this.fov,
      this.aspect,
      this.near,
      this.far
    );
  }
}

/**
 * Camera with an orthographic (parallel) projection.
 */
export class OrthographicCamera extends Camera {
  constructor(
    public left = -1,
    public right = 1,
    public top = 1,
    public bottom = -1,
    public near = 0.1,
    public far = 2000
  ) {
    super();
    this.updateProjectionMatrix();
  }

  override updateProjectionMatrix(): void {
    this.projectionMatrix.setOrtho(
      this.left,
      this.right,
      this.bottom,
      this.top,
      this.near,
      this.far
    );
  }
}
