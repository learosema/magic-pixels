import { ERRORS } from './webgl-errors';
import { Mesh } from './mesh';

export class Renderer {
  gl: WebGLRenderingContext;
  pixelRatio = 1;

  constructor(public canvas: HTMLCanvasElement) {
    const gl = this.canvas.getContext('webgl');
    if (!gl) {
      throw Error(ERRORS.WEBGL_INIT);
    }
    this.gl = gl;
  }

  render(scene: Mesh[]): Renderer {
    for (const obj of scene) {
      // initialize the mesh for this rendering context
      // if you need to reuse this mesh in another context, then dispose first
      obj.init(this.gl);
      // render the thing.
      obj.enableAttribs();
      obj.draw();
      obj.disableAttribs();
    }
    return this;
  }

  setPixelRatio(pixelRatio: number): Renderer {
    this.pixelRatio = pixelRatio;
    return this;
  }

  setSize(width: number, height: number): Renderer {
    const { gl, canvas, pixelRatio } = this;
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    return this;
  }

  dispose(): void {
    const { gl } = this;
    const loseCtx = gl.getExtension('WEBGL_lose_context');
    if (loseCtx && typeof loseCtx.loseContext === 'function') {
      loseCtx.loseContext();
    }
  }
}
