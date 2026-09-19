import { ColorSpace } from './constants';
import { Texture } from './texture';

function createImage(width = 1, height = 1): ImageData {
  return {
    width,
    height,
    data: new Uint8ClampedArray(4 * width * height),
  } as ImageData;
}

/**
 * Create a fake HTMLImageElement with dimensions and a factor to calculate
 * natural dimensions
 */
function createImgElement(width = 1, height = 1, factor = 1): HTMLImageElement {
  return {
    width,
    height,
    naturalWidth: width * factor,
    naturalHeight: height * factor,
  } as HTMLImageElement;
}

/**
 * Create a fake HTMLVideoElement with given dimensions and a factor to calculate
 * videoWidth/videoHeight
 */
function createVideoElement(
  width = 1,
  height = 1,
  factor = 1
): HTMLVideoElement {
  return {
    width,
    height,
    videoWidth: width * factor,
    videoHeight: height * factor,
  } as HTMLVideoElement;
}

function createCanvasElement(width = 1, height = 1): HTMLCanvasElement {
  return {
    width,
    height,
  } as HTMLCanvasElement;
}

describe('Texture', () => {
  test('defaults to linear color space and no vertical flip', () => {
    const texture = new Texture(createImage());
    expect(texture.colorSpace).toBe(ColorSpace.LINEAR);
    expect(texture.flipY).toBe(false);
  });

  test('options override the defaults', () => {
    const texture = new Texture(createImage(), {
      colorSpace: ColorSpace.SRGB,
      flipY: true,
    });
    expect(texture.colorSpace).toBe(ColorSpace.SRGB);
    expect(texture.flipY).toBe(true);
  });

  test('fromBlob decodes the blob with createImageBitmap', async () => {
    const bitmap = {} as ImageBitmap;
    const createImageBitmap = vi.fn().mockResolvedValue(bitmap);
    vi.stubGlobal('createImageBitmap', createImageBitmap);
    try {
      const blob = {} as Blob;
      const texture = await Texture.fromBlob(blob, {
        colorSpace: ColorSpace.SRGB,
      });
      expect(createImageBitmap).toHaveBeenCalledWith(blob);
      expect(texture.image).toBe(bitmap);
      expect(texture.colorSpace).toBe(ColorSpace.SRGB);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('width returns the width of the internal texturedata', () => {
    const canvas = createCanvasElement(2, 3);
    const texture = new Texture(canvas);

    expect(texture.width).toBe(canvas.width);
  });

  test('height returns the height of the internal texturedata', () => {
    const canvas = createCanvasElement(2, 3);
    const texture = new Texture(canvas);

    expect(texture.height).toBe(canvas.height);
  });

  test('width returns the naturalWidth if an HTMLImageElement is provided', () => {
    const image = createImgElement(1, 1, 2);
    const texture = new Texture(image);

    expect(texture.width).toBe(image.naturalWidth);
  });

  test('height returns the naturalHeight if an HTMLImageElement is provided', () => {
    const image = createImgElement(1, 1, 2);
    const texture = new Texture(image);

    expect(texture.height).toBe(image.naturalHeight);
  });

  test('width returns the videoWidth if an HTMLVideoElement is provided', () => {
    const image = createVideoElement(1, 1, 2);
    const texture = new Texture(image);

    expect(texture.width).toBe(image.videoWidth);
  });

  test('height returns the videoHeight if an HTMLVideoElement is provided', () => {
    const image = createVideoElement(1, 1, 2);
    const texture = new Texture(image);

    expect(texture.height).toBe(image.videoHeight);
  });

  test('empty creates a texture with the given size and no real pixels', () => {
    const texture = Texture.empty(4, 8, { colorSpace: ColorSpace.SRGB });

    expect(texture.width).toBe(4);
    expect(texture.height).toBe(8);
    expect(texture.colorSpace).toBe(ColorSpace.SRGB);
    expect(texture.isEmpty).toBe(true);
    expect(new Texture(createImage()).isEmpty).toBe(false);
  });
});
