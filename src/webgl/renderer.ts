import { ERRORS } from './webgl-errors';
import { Mesh } from '../types/mesh';
import {
  disableAttribs,
  disposeMesh,
  draw,
  enableAttribs,
  initMesh,
  WebGLData,
} from '../utils/webgl-utils';

export class Renderer {
  gl: WebGLRenderingContext;
  data: Record<number, WebGLData> = {};
  pixelRatio = 1;
  idCounter = 0;

  constructor(public canvas: HTMLCanvasElement) {
    const gl = this.canvas.getContext('webgl');
    if (!gl) {
      throw Error(ERRORS.WEBGL_INIT);
    }
    this.gl = gl;
  }

  render(scene: Mesh[]): Renderer {
    const { gl, data } = this;
    if (!gl || !data) {
      throw Error(ERRORS.WEBGL_INIT);
    }
    for (const obj of scene) {
      // initialize the mesh for this rendering context
      // if you need to reuse this mesh in another context, then dispose first
      if (Number.isNaN(obj.id)) {
        obj.id = this.idCounter;
        this.idCounter += 1;
        data[obj.id] = initMesh(gl, obj.material, obj.geometry);
      }
      const { program, buffers } = data[obj.id];
      // render the thing.
      enableAttribs(gl, program, buffers, obj.geometry);
      draw(gl, obj.geometry, obj.material);
      disableAttribs(gl, program, buffers);
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

  dispose(scene: Mesh[] = []): void {
    const { gl, data } = this;
    for (const obj of scene) {
      if (!Number.isNaN(obj) && data[obj.id]) {
        disposeMesh(gl, data[obj.id]);
        delete data[obj.id];
      }
    }
    this.data = {};
    this.idCounter = 0;
    const loseCtx = gl.getExtension('WEBGL_lose_context');
    if (loseCtx && typeof loseCtx.loseContext === 'function') {
      loseCtx.loseContext();
    }
  }
}
