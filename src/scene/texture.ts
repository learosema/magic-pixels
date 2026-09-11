import { Filter, Wrapping } from './constants';

const ERRORS = {
  LOADING_ERROR: 'Error loading image',
};

export type TextureData =
  HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | ImageData;

export type TextureOptions = {
  minFilter?: Filter;
  magFilter?: Filter;
  wrapS?: Wrapping;
  wrapT?: Wrapping;
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
}
