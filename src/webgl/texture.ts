const ERRORS = {
  LOADING_ERROR: 'Error loading image',
};

// GL enum values are fixed by the spec; using the literals avoids touching the
// WebGL2RenderingContext global at import time (keeps the module loadable in Node).
export const Wrapping: Record<string, number> = {
  CLAMP_TO_EDGE: 0x812f,
  REPEAT: 0x2901,
  MIRRORED_REPEAT: 0x8370,
};

export const Filter: Record<string, number> = {
  LINEAR: 0x2601,
  NEAREST: 0x2600,
  LINEAR_MIPMAP_LINEAR: 0x2703,
  LINEAR_MIPMAP_NEAREST: 0x2701,
  NEAREST_MIPMAP_LINEAR: 0x2702,
  NEAREST_MIPMAP_NEAREST: 0x2700,
};

export type TextureData =
  HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | ImageData;

export type TextureOptions = {
  minFilter?: number;
  magFilter?: number;
  wrapS?: number;
  wrapT?: number;
};

/**
 * A texture is plain data: an image plus sampling parameters. The renderer
 * uploads it the first time it is used as a uniform and assigns texture units.
 */
export class Texture {
  minFilter = Filter.NEAREST;
  magFilter = Filter.NEAREST;
  wrapS = Wrapping.CLAMP_TO_EDGE;
  wrapT = Wrapping.CLAMP_TO_EDGE;
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
