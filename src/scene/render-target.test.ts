import { DepthAttachment } from './constants';
import { RenderTarget } from './render-target';
import { Texture } from './texture';

describe('RenderTarget', () => {
  test('defaults to a renderbuffer depth and no float colour', () => {
    const target = new RenderTarget(256, 128);

    expect(target.width).toBe(256);
    expect(target.height).toBe(128);
    expect(target.depth).toBe(DepthAttachment.RENDERBUFFER);
    expect(target.float).toBe(false);
  });

  test('always creates a colour attachment sized to the target', () => {
    const target = new RenderTarget(4, 8);

    expect(target.colorAttachment).toBeInstanceOf(Texture);
    expect(target.colorAttachment.width).toBe(4);
    expect(target.colorAttachment.height).toBe(8);
  });

  test('has no depth attachment texture by default or with depth: none', () => {
    expect(new RenderTarget(4, 4).depthAttachment).toBeNull();
    expect(
      new RenderTarget(4, 4, { depth: DepthAttachment.NONE }).depthAttachment
    ).toBeNull();
  });

  test('has no depth attachment texture with depth: renderbuffer either', () => {
    const target = new RenderTarget(4, 4, {
      depth: DepthAttachment.RENDERBUFFER,
    });

    expect(target.depthAttachment).toBeNull();
  });

  test('creates a sized depth attachment texture with depth: texture', () => {
    const target = new RenderTarget(4, 8, { depth: DepthAttachment.TEXTURE });

    expect(target.depthAttachment).toBeInstanceOf(Texture);
    expect(target.depthAttachment?.width).toBe(4);
    expect(target.depthAttachment?.height).toBe(8);
  });

  test('options override the defaults', () => {
    const target = new RenderTarget(4, 4, { float: true });

    expect(target.float).toBe(true);
  });
});
