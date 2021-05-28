const ERRORS = {
  LOADING_ERROR: 'Error loading image',
};

export const Wrapping: Record<string, number> = {
  CLAMP_TO_EDGE: WebGLRenderingContext.CLAMP_TO_EDGE,
  REPEAT: WebGLRenderingContext.REPEAT,
  MIRRORED_REPEAT: WebGLRenderingContext.MIRRORED_REPEAT,
};

export const Filter: Record<string, number> = {
  LINEAR: WebGLRenderingContext.LINEAR,
  NEAREST: WebGLRenderingContext.NEAREST,
  LINEAR_MIPMAP_LINEAR: WebGLRenderingContext.LINEAR_MIPMAP_LINEAR,
  LINEAR_MIPMAP_NEAREST: WebGLRenderingContext.LINEAR_MIPMAP_NEAREST,
  NEAREST_MIPMAP_LINEAR: WebGLRenderingContext.NEAREST_MIPMAP_LINEAR,
  NEAREST_MIPMAP_NEAREST: WebGLRenderingContext.NEAREST_MIPMAP_NEAREST,
};

export type TextureData =
  | HTMLImageElement
  | HTMLVideoElement
  | HTMLCanvasElement
  | ImageData;

export type TextureOptions = {
  minFilter?: number;
  magFilter?: number;
  wrapS?: number;
  wrapT?: number;
  textureIndex?: number;
};

export class Texture {
  minFilter = Filter.NEAREST;
  magFilter = Filter.NEAREST;
  wrapS = Wrapping.CLAMP_TO_EDGE;
  wrapT = Wrapping.CLAMP_TO_EDGE;
  image: TextureData;
  textureIndex = 0;

  gl: WebGLRenderingContext | null = null;
  texture: WebGLTexture | null = null;

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

  upload(gl: WebGLRenderingContext, textureIndex?: number): Texture {
    if (this.gl) {
      this.dispose();
    }
    const texture = gl.createTexture();
    const idx =
      typeof textureIndex !== 'undefined' ? textureIndex : this.textureIndex;
    this.textureIndex = idx;
    gl.activeTexture(gl.TEXTURE0 + idx);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.magFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this.wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, this.wrapT);

    // Upload the image into the texture.
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.image
    );
    this.gl = gl;
    this.texture = texture;
    return this;
  }

  /**
   * re-upload texture via texSubImage2D
   */
  update(): Texture {
    const { gl, texture, textureIndex } = this;
    if (!gl) {
      throw Error();
    }
    gl.activeTexture(gl.TEXTURE0 + textureIndex);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.image
    );
    return this;
  }

  /**
   * dispose Texture
   */
  dispose(): void {
    if (this.texture && this.gl) {
      this.gl.deleteTexture(this.texture);
      this.texture = null;
      this.gl = null;
    }
  }
}
