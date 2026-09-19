import { ColorSpace, Filter, Wrapping } from './constants';

const ERRORS = {
  LOADING_ERROR: 'Error loading image',
};

export type TextureData =
  | HTMLImageElement
  | HTMLVideoElement
  | HTMLCanvasElement
  | ImageData
  | ImageBitmap;

export type TextureOptions = {
  minFilter?: Filter;
  magFilter?: Filter;
  wrapS?: Wrapping;
  wrapT?: Wrapping;
  colorSpace?: ColorSpace;
  flipY?: boolean;
};

/**
 * A texture is plain data: an image plus sampling parameters. The renderer
 * uploads it the first time it is used as a uniform and assigns texture units.
 */
export class Texture {
  minFilter: Filter = Filter.NEAREST;
  magFilter: Filter = Filter.NEAREST;
  wrapS: Wrapping = Wrapping.CLAMP_TO_EDGE;
  wrapT: Wrapping = Wrapping.CLAMP_TO_EDGE;

  /**
   * Whether the image is sRGB-encoded, as every photo or hand-painted
   * texture is (`'srgb'`), or holds numbers that only look like an image,
   * like a normal or roughness map (`'linear'`, the default: no conversion).
   * `'srgb'` uploads with an sRGB internal format so the GPU decodes it to
   * linear values before the shader samples it.
   */
  colorSpace: ColorSpace = ColorSpace.LINEAR;

  /**
   * Flip the image vertically on upload (default false). glTF and most
   * image loaders assume row 0 is the top; WebGL's texture coordinate
   * `v = 0` is the bottom, so flipping here makes `v = 0` line up with the
   * top of the picture instead of flipping UVs in the shader.
   */
  flipY = false;

  image: TextureData;

  /**
   * True for a texture made with {@link Texture.empty}: it has a size but no
   * pixels, so the renderer allocates GPU storage for it instead of
   * uploading `image`.
   */
  isEmpty = false;

  /**
   * Set to true after the image (or its contents, e.g. a video frame or a
   * canvas) changed so the renderer re-uploads it. The renderer resets it.
   */
  needsUpdate = false;

  constructor(image: TextureData, options?: TextureOptions) {
    this.image = image;
    if (options) {
      Object.assign(this, options);
    }
  }

  get width(): number {
    if ('naturalWidth' in this.image) {
      return this.image.naturalWidth;
    }
    if ('videoWidth' in this.image) {
      return this.image.videoWidth;
    }
    return this.image.width;
  }

  get height(): number {
    if ('naturalHeight' in this.image) {
      return this.image.naturalHeight;
    }
    if ('videoHeight' in this.image) {
      return this.image.videoHeight;
    }
    return this.image.height;
  }

  static async fromImageUrl(
    url: string,
    options?: TextureOptions
  ): Promise<Texture> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.src = url;
      image.onload = () => {
        resolve(new Texture(image, options));
      };
      image.onerror = () => {
        reject(Error(ERRORS.LOADING_ERROR));
      };
    });
  }

  /**
   * Decode a `Blob` (e.g. an image embedded in a `.glb`) with
   * `createImageBitmap` and wrap the result in a texture.
   */
  static async fromBlob(
    blob: Blob,
    options?: TextureOptions
  ): Promise<Texture> {
    const image = await createImageBitmap(blob);
    return new Texture(image, options);
  }

  /**
   * A texture with no image data yet, sized `width` x `height`. Used for
   * render target attachments: nothing ever samples this placeholder's
   * pixels, so its `data` is empty and only `width`/`height` are real -
   * the renderer allocates GPU storage at that size instead of uploading
   * pixels.
   */
  static empty(
    width: number,
    height: number,
    options?: TextureOptions
  ): Texture {
    const image = {
      width,
      height,
      data: new Uint8ClampedArray(0),
    } as ImageData;
    const texture = new Texture(image, options);
    texture.isEmpty = true;
    return texture;
  }
}
