import { Color, Mat4, Vector } from '../utils';
import { Object3D } from './object3d';

const DEFAULT_UP = new Vector(0, 1, 0);

/**
 * Base class of the lights. A light is a node in the scene graph: it is
 * positioned and oriented through its transform like a {@link Mesh} and
 * can be parented to anything. It carries no shading logic of its own.
 * `prepareScene()` collects the visible lights of a frame and the renderer
 * hands them to every shader that declares the light uniforms (see
 * {@link WebGL2Renderer}).
 *
 * The colour is taken as linear RGB and multiplied by `intensity` before
 * it reaches the shader. Use one of the subclasses; the base class itself
 * contributes nothing to a frame.
 */
export class Light extends Object3D {
  /** the light's colour, used as linear RGB; the alpha channel is ignored */
  color: Color;

  /**
   * @param color a `Color` or a hex string like `'#fff4e0'`, white by default
   * @param intensity multiplies the colour, 1 by default
   */
  constructor(
    color: Color | string = '#ffffff',
    public intensity = 1
  ) {
    super();
    this.color = typeof color === 'string' ? Color.fromHex(color) : color;
  }
}

/**
 * Light that reaches every surface from every direction with the same
 * strength: a flat term added to the shading, standing in for light
 * bouncing around the scene. Its transform has no effect. Several ambient
 * lights add up into the single `ambientLightColor` uniform.
 */
export class AmbientLight extends Light {}

/**
 * Light from a source so far away that its rays are parallel, like the sun.
 * It shines along the node's -Z axis in world space, the same axis a
 * camera looks along, so `light.lookAt(target)` aims it (the +Z convention
 * of {@link Object3D.lookAt} is overridden here) and a glTF
 * `KHR_lights_punctual` directional light maps onto it without conversion.
 * The position is irrelevant; only the orientation counts.
 */
export class DirectionalLight extends Light {
  /**
   * Aim the light at `target`, a point in the parent's coordinate system:
   * the -Z axis (the direction the light shines) points at it.
   */
  override lookAt(target: Vector, up: Vector = DEFAULT_UP): this {
    return this.setRotationFromMatrix(Mat4.lookAt(this.position, target, up));
  }
}

/**
 * Light radiating from a point in all directions, like a light bulb. Its
 * position is the translation of the world matrix; its orientation is
 * irrelevant. Intensity falls off with the square of the distance, so
 * values are larger than for a directional light (a bulb a few units away
 * needs an intensity of several).
 */
export class PointLight extends Light {
  /**
   * @param color a `Color` or a hex string, white by default
   * @param intensity multiplies the colour, 1 by default
   * @param range distance beyond which the light contributes nothing; `0`
   *   (the default) means no cutoff, only the inverse-square falloff
   */
  constructor(
    color: Color | string = '#ffffff',
    intensity = 1,
    public range = 0
  ) {
    super(color, intensity);
  }
}
