import { Texture } from '../webgl';
import { Vector } from '../math/vector';
import { Matrix } from '../math/matrix';
import { Color } from './color';

import defaultVertexShader from '../shaders/default.vert';
import defaultFragmentShader from '../shaders/default.frag';
import basicFragmentShader from '../shaders/basic.frag';
import normalFragmentShader from '../shaders/normal.frag';

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
    drawMode: WebGLRenderingContext.TRIANGLES,
    uniforms: {},
  };
}

export function createNormalMaterial(): Material {
  return {
    vertexShader: defaultVertexShader,
    fragmentShader: normalFragmentShader,
    drawMode: WebGLRenderingContext.TRIANGLES,
    uniforms: {},
  };
}

export function createBasicMaterial(color = '#ff0000'): Material {
  return {
    vertexShader: defaultVertexShader,
    fragmentShader: basicFragmentShader,
    drawMode: WebGLRenderingContext.TRIANGLES,
    uniforms: {
      color: Color.fromHex(color),
    },
  };
}

export function createShaderMaterial(
  vertexShader = defaultVertexShader,
  fragmentShader = defaultFragmentShader,
  uniforms: Record<string, Uniform> = {},
  drawMode = WebGLRenderingContext.TRIANGLES
): Material {
  return {
    vertexShader,
    fragmentShader,
    drawMode,
    uniforms,
  };
}
