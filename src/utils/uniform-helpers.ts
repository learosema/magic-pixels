import { Uniform, Uniforms } from '../webgl/material';
import { Texture } from '../webgl/texture';
import { Color } from './color';
import { Matrix } from './matrix';
import { Vector } from './vector';

function setUniformVector(
  gl: WebGLRenderingContext,
  loc: WebGLUniformLocation | null,
  value: number[]
): boolean {
  switch (value.length) {
    case 1:
      gl.uniform1fv(loc, value);
      return true;
    case 2:
      gl.uniform2fv(loc, value);
      return true;
    case 3:
      gl.uniform3fv(loc, value);
      return true;
    case 4:
      gl.uniform4fv(loc, value);
      return true;
  }
  return false;
}

function setUniformIntVector(
  gl: WebGLRenderingContext,
  loc: WebGLUniformLocation | null,
  value: number[]
): boolean {
  switch (value.length) {
    case 1:
      gl.uniform1iv(loc, value);
      return true;
    case 2:
      gl.uniform2iv(loc, value);
      return true;
    case 3:
      gl.uniform3iv(loc, value);
      return true;
    case 4:
      gl.uniform4iv(loc, value);
      return true;
  }
  return false;
}

function setUniformMatrix(
  gl: WebGLRenderingContext,
  loc: WebGLUniformLocation | null,
  value: number[],
  transpose = false
): boolean {
  if (value.length === 4) {
    gl.uniformMatrix2fv(loc, transpose, value);
    return true;
  }
  if (value.length === 9) {
    gl.uniformMatrix3fv(loc, transpose, value);
    return true;
  }
  if (value.length === 16) {
    gl.uniformMatrix4fv(loc, transpose, value);
    return true;
  }
  return false;
}

export function setUniform(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  name: string,
  uniform: Uniform
): boolean {
  gl.useProgram(program);
  const loc = gl.getUniformLocation(program, name);
  if (typeof uniform === 'number') {
    gl.uniform1f(loc, uniform);
    return true;
  }
  if (uniform instanceof Texture) {
    gl.uniform1i(loc, (<Texture>uniform).textureIndex);
    return true;
  }
  if (uniform instanceof Vector) {
    return setUniformIntVector(gl, loc, (<Vector>uniform).values);
  }
  if (uniform instanceof Matrix) {
    return setUniformMatrix(gl, loc, (<Matrix>uniform).values);
  }
  if (uniform instanceof Color) {
    return setUniformVector(gl, loc, (<Color>uniform).toVec4());
  }
  if (uniform instanceof Array) {
    if (typeof uniform[0] === 'number') {
      return setUniformVector(gl, loc, <number[]>uniform);
    }
    if (typeof uniform[0] === 'bigint') {
      const converter = (val: bigint): number => parseInt(val.toString(), 10);
      return setUniformIntVector(gl, loc, (<bigint[]>uniform).map(converter));
    }
    if (uniform[0] instanceof Array) {
      return setUniformMatrix(gl, loc, (<number[][]>uniform).flat(1));
    }
  }
  return false;
}

/**
 * Create a wrapper object from a uniforms object which automatically updates
 * uniforms in the rendering context
 * @param gl a WebGLRenderingContext initialized via canvas.getContext('webgl')
 * @param uniform
 * @returns wrapper object
 */
export function wrapUniforms(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  uniform: Uniforms
): Uniforms {
  const handler: ProxyHandler<Uniforms> = {
    get(target: Uniforms, prop: string) {
      return target[prop];
    },
    set(target: Uniforms, prop: string, value: Uniform): boolean {
      target[prop] = value;
      return setUniform(gl, program, prop, value as Uniform);
    },
  };
  return new Proxy<Uniforms>(uniform, handler);
}
