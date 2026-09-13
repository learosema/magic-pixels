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
}
