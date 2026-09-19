import { DepthAttachment } from './constants';
import { Texture } from './texture';

export type RenderTargetOptions = {
  /** `'renderbuffer'` (the default), `'texture'` or `'none'`. */
  depth?: DepthAttachment;
  /** Needs `EXT_color_buffer_float`; `false` (the default) is 8-bit. */
  float?: boolean;
};

/**
 * A colour buffer, plus an optional depth buffer, that the renderer can
 * draw into instead of the canvas (`renderer.render(scene, camera,
 * target)`). Plain data like every other scene object: no GPU handles
 * here, the renderer owns and caches the framebuffer, keyed by this
 * object.
 */
export class RenderTarget {
  width: number;
  height: number;
  depth: DepthAttachment;
  float: boolean;

  /** The colour output, sampled like any other {@link Texture} once
   * something has rendered into it. */
  colorAttachment: Texture;

  /**
   * Only set when `depth` is `'texture'`. A renderbuffer has no
   * `Texture` representation: it can be written to but never sampled.
   */
  depthAttachment: Texture | null;

  constructor(
    width: number,
    height: number,
    options: RenderTargetOptions = {}
  ) {
    this.width = width;
    this.height = height;
    this.depth = options.depth ?? DepthAttachment.RENDERBUFFER;
    this.float = options.float ?? false;
    this.colorAttachment = Texture.empty(width, height);
    this.depthAttachment =
      this.depth === DepthAttachment.TEXTURE
        ? Texture.empty(width, height)
        : null;
  }
}
