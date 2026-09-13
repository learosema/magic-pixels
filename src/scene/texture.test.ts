import { ColorSpace } from './constants';
import { Texture } from './texture';

function createImage(): ImageData {
  return { width: 1, height: 1, data: new Uint8ClampedArray(4) } as ImageData;
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
});
