import type { Texture } from './texture';
import type { Vector, Matrix, Mat2, Mat3, Mat4 } from '../utils';
import { Color } from '../utils';
import { DrawMode } from './constants';

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
  | Mat2
  | Mat3
  | Mat4
  | Color;
export type Uniforms = Record<string, Uniform>;

/** A vertex/fragment shader pair in one shading language */
export type ShaderSource = {
  vertex: string;
  fragment: string;
};

/**
 * A material is plain data: shader sources per shading language, a draw
 * mode and a uniforms object. A renderer picks the language it understands
 * (`glsl` for WebGL2; a WebGPU renderer would read `wgsl`), compiles one
 * program per material (shared by all meshes using it) and uploads the
 * uniforms on every draw, skipping the ones that did not change. Replacing
 * a shader source recompiles the program on the next render.
 */
export type Material = {
  glsl?: ShaderSource;
  drawMode: DrawMode;
  uniforms: Uniforms;
};

export function createDefaultMaterial(): Material {
  return {
    glsl: { vertex: defaultVertexShader, fragment: defaultFragmentShader },
    drawMode: DrawMode.TRIANGLES,
    uniforms: {},
  };
}

export function createNormalMaterial(): Material {
  return {
    glsl: { vertex: defaultVertexShader, fragment: normalFragmentShader },
    drawMode: DrawMode.TRIANGLES,
    uniforms: {},
  };
}

export function createBasicMaterial(color = '#ff0000'): Material {
  return {
    glsl: { vertex: defaultVertexShader, fragment: basicFragmentShader },
    drawMode: DrawMode.TRIANGLES,
    uniforms: {
      color: Color.fromHex(color),
    },
  };
}

/**
 * Create a material from GLSL sources.
 * @param vertexShader GLSL vertex shader (defaults to the built-in one)
 * @param fragmentShader GLSL fragment shader (defaults to the built-in one)
 * @param uniforms initial uniform values
 * @param drawMode primitive type, `DrawMode.TRIANGLES` by default
 */
export function createShaderMaterial(
  vertexShader = defaultVertexShader,
  fragmentShader = defaultFragmentShader,
  uniforms: Uniforms = {},
  drawMode: DrawMode = DrawMode.TRIANGLES
): Material {
  return {
    glsl: { vertex: vertexShader, fragment: fragmentShader },
    drawMode,
    uniforms,
  };
}
