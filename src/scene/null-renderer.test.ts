import { BufferGeometry } from '../geometries';
import { createDefaultMaterial } from './material';
import { Mesh } from './mesh';
import { NullRenderer } from './null-renderer';
import type { Renderer } from './renderer';

describe('NullRenderer', () => {
  test('records rendered frames', () => {
    const renderer: Renderer = new NullRenderer();
    const mesh = new Mesh(new BufferGeometry(), createDefaultMaterial());
    renderer.render([mesh]);
    renderer.render([mesh, mesh]);
    const { frames, lastFrame } = renderer as NullRenderer;
    expect(frames).toEqual([[mesh], [mesh, mesh]]);
    expect(lastFrame).toEqual([mesh, mesh]);
  });

  test('applies the pixel ratio to setSize', () => {
    const renderer = new NullRenderer();
    renderer.setPixelRatio(2);
    renderer.setSize(100, 50);
    expect(renderer.width).toBe(200);
    expect(renderer.height).toBe(100);
  });

  test('records disposed objects', () => {
    const renderer = new NullRenderer();
    const geometry = new BufferGeometry();
    const material = createDefaultMaterial();
    renderer.dispose(geometry);
    renderer.dispose(material);
    expect(renderer.disposed).toEqual([geometry, material]);
    expect(renderer.isDisposed).toBe(false);
    renderer.dispose();
    expect(renderer.isDisposed).toBe(true);
  });
});
