import type { Texture } from './texture';
import type { Vector, Matrix } from '../utils';
import { Color } from '../utils';

import defaultVertexShader from '../shaders/default.vert';
import defaultFragmentShader from '../shaders/default.frag';
import basicFragmentShader from '../shaders/basic.frag';
import normalFragmentShader from '../shaders/normal.frag';

// GL enum values are fixed by the spec; using the literals keeps the module
// loadable without a WebGL2RenderingContext global (e.g. in Node).
export const DrawMode: Record<string, number> = {
  POINTS: 0x0000,
  LINES: 0x0001,
  LINE_LOOP: 0x0002,
  LINE_STRIP: 0x0003,
  TRIANGLES: 0x0004,
  TRIANGLE_STRIP: 0x0005,
  TRIANGLE_FAN: 0x0006,
};

export type Uniform =
  | number
  | number[]
  | number[][]
  | bigint
  | bigint[]
  | Texture
  | Vector
  | Matrix
  | Color;
export type Uniforms = Record<string, Uniform>;

/**
 * A material is plain data: shader sources, a draw mode and a uniforms
 * object. The renderer compiles one program per material (shared by all
 * meshes using it) and uploads the uniforms on every draw, skipping the ones
 * that did not change. Changing `vertexShader`/`fragmentShader` recompiles the
 * program on the next render.
 */
export type Material = {
  vertexShader: string;
  fragmentShader: string;
  drawMode: number;
  uniforms: Uniforms;
};

export function createDefaultMaterial(): Material {
  return {
    vertexShader: defaultVertexShader,
    fragmentShader: defaultFragmentShader,
    drawMode: DrawMode.TRIANGLES,
    uniforms: {},
  };
}

export function createNormalMaterial(): Material {
  return {
    vertexShader: defaultVertexShader,
    fragmentShader: normalFragmentShader,
    drawMode: DrawMode.TRIANGLES,
    uniforms: {},
  };
}

export function createBasicMaterial(color = '#ff0000'): Material {
  return {
    vertexShader: defaultVertexShader,
    fragmentShader: basicFragmentShader,
    drawMode: DrawMode.TRIANGLES,
    uniforms: {
      color: Color.fromHex(color),
    },
  };
}

export function createShaderMaterial(
  vertexShader = defaultVertexShader,
  fragmentShader = defaultFragmentShader,
  uniforms: Record<string, Uniform> = {},
  drawMode = DrawMode.TRIANGLES
): Material {
  return {
    vertexShader,
    fragmentShader,
    drawMode,
    uniforms,
  };
}
