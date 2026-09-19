import {
  createFakeCanvas,
  createFakeWebGL2,
  type FakeWebGL2,
} from '../test-utils/fake-webgl2';
import { WebGL2Renderer } from '../webgl/webgl2-renderer';
import { PerspectiveCamera } from './camera';
import { createFullscreenMesh } from './fullscreen';
import { createPbrMaterial, createToneMapMaterial } from './material';
import { Mesh } from './mesh';
import { NullRenderer } from './null-renderer';
import { RenderTarget } from './render-target';
import { Scene } from './scene';
import { createBoxGeometry } from '../geometries';

describe('createFullscreenMesh', () => {
  test('is one triangle that covers the clip-space square', () => {
    const target = new RenderTarget(4, 4);
    const mesh = createFullscreenMesh(
      createToneMapMaterial({ map: target.colorAttachment })
    );
    const { position } = mesh.geometry.attributes;
    expect(position.count).toBe(3);
    expect(mesh.geometry.index).toBeNull();
    expect([...position.data]).toEqual([-1, -1, 3, -1, -1, 3]);
  });
});

describe('render target passes', () => {
  let gl: FakeWebGL2;
  let renderer: WebGL2Renderer;

  beforeEach(() => {
    gl = createFakeWebGL2();
    renderer = new WebGL2Renderer(createFakeCanvas(gl));
  });

  test('a scene rendered into a target is sampled by the pass that follows', () => {
    const target = new RenderTarget(16, 16, { float: true });
    const scene = new Scene();
    scene.add(
      new Mesh(createBoxGeometry(), createPbrMaterial({ linearOutput: true }))
    );
    const pass = new Scene();
    pass.add(
      createFullscreenMesh(
        createToneMapMaterial({ map: target.colorAttachment })
      )
    );
    const camera = new PerspectiveCamera();

    renderer.render(scene, camera, target);
    renderer.render(pass, camera);

    // the target's colour is the only texture: the pass binds the one the
    // framebuffer draws into instead of uploading a placeholder
    expect(gl.created.textures).toBe(1);
    expect(gl.callsTo('texImage2D')).toHaveLength(1);
    expect(gl.callsTo('drawElements')).toHaveLength(1);
    expect(gl.callsTo('drawArrays')[0].args).toEqual([gl.TRIANGLES, 0, 3]);
    // two programs: the PBR shader and the tone-mapping pass
    expect(gl.created.programs).toBe(2);
    // the pass draws to the canvas
    expect(gl.callsTo('bindFramebuffer').at(-1)?.args[1]).toBeNull();
  });

  test('the null renderer records the target of a frame', () => {
    const target = new RenderTarget(4, 4);
    const nullRenderer = new NullRenderer();
    nullRenderer.render(new Scene(), new PerspectiveCamera(), target);
    nullRenderer.render(new Scene(), new PerspectiveCamera());

    expect(nullRenderer.frames[0].target).toBe(target);
    expect(nullRenderer.frames[1].target).toBeUndefined();
  });
});
