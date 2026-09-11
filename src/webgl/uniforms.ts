import type { Uniform } from './material';
import { Texture } from './texture';
import { Color } from '../utils/color';
import { Matrix } from '../utils/matrix';
import { Vector } from '../utils/vector';

/** Location and declared type of an active uniform in a linked program */
export type UniformInfo = {
  location: WebGLUniformLocation;
  /** GL type enum (gl.FLOAT_VEC3, gl.SAMPLER_2D, ...) */
  type: number;
  /** array length; 1 for non-array uniforms */
  size: number;
};

type Upload = (
  gl: WebGL2RenderingContext,
  loc: WebGLUniformLocation,
  v: number[],
  n: number
) => void;

// GL type enum -> [components per element, upload function].
// The shader's declared type picks the setter, so a `Vector` works for
// `vec2` and `ivec2` alike and floats are never truncated by accident.
// prettier-ignore
const UNIFORM_TYPES: Record<number, [number, Upload]> = {
  0x1406: [1, (gl, l, v, n) => gl.uniform1fv(l, v, 0, n)], // FLOAT
  0x8b50: [2, (gl, l, v, n) => gl.uniform2fv(l, v, 0, n)], // FLOAT_VEC2
  0x8b51: [3, (gl, l, v, n) => gl.uniform3fv(l, v, 0, n)], // FLOAT_VEC3
  0x8b52: [4, (gl, l, v, n) => gl.uniform4fv(l, v, 0, n)], // FLOAT_VEC4

  0x1404: [1, (gl, l, v, n) => gl.uniform1iv(l, v, 0, n)], // INT
  0x8b53: [2, (gl, l, v, n) => gl.uniform2iv(l, v, 0, n)], // INT_VEC2
  0x8b54: [3, (gl, l, v, n) => gl.uniform3iv(l, v, 0, n)], // INT_VEC3
  0x8b55: [4, (gl, l, v, n) => gl.uniform4iv(l, v, 0, n)], // INT_VEC4

  0x8b56: [1, (gl, l, v, n) => gl.uniform1iv(l, v, 0, n)], // BOOL
  0x8b57: [2, (gl, l, v, n) => gl.uniform2iv(l, v, 0, n)], // BOOL_VEC2
  0x8b58: [3, (gl, l, v, n) => gl.uniform3iv(l, v, 0, n)], // BOOL_VEC3
  0x8b59: [4, (gl, l, v, n) => gl.uniform4iv(l, v, 0, n)], // BOOL_VEC4

  0x1405: [1, (gl, l, v, n) => gl.uniform1uiv(l, v, 0, n)], // UNSIGNED_INT
  0x8dc6: [2, (gl, l, v, n) => gl.uniform2uiv(l, v, 0, n)], // UNSIGNED_INT_VEC2
  0x8dc7: [3, (gl, l, v, n) => gl.uniform3uiv(l, v, 0, n)], // UNSIGNED_INT_VEC3
  0x8dc8: [4, (gl, l, v, n) => gl.uniform4uiv(l, v, 0, n)], // UNSIGNED_INT_VEC4

  0x8b5a: [4,  (gl, l, v, n) => gl.uniformMatrix2fv(l, false, v, 0, n)], // FLOAT_MAT2
  0x8b5b: [9,  (gl, l, v, n) => gl.uniformMatrix3fv(l, false, v, 0, n)], // FLOAT_MAT3
  0x8b5c: [16, (gl, l, v, n) => gl.uniformMatrix4fv(l, false, v, 0, n)], // FLOAT_MAT4
  0x8b65: [6,  (gl, l, v, n) => gl.uniformMatrix2x3fv(l, false, v, 0, n)], // FLOAT_MAT2x3
  0x8b66: [8,  (gl, l, v, n) => gl.uniformMatrix2x4fv(l, false, v, 0, n)], // FLOAT_MAT2x4
  0x8b67: [6,  (gl, l, v, n) => gl.uniformMatrix3x2fv(l, false, v, 0, n)], // FLOAT_MAT3x2
  0x8b68: [12, (gl, l, v, n) => gl.uniformMatrix3x4fv(l, false, v, 0, n)], // FLOAT_MAT3x4
  0x8b69: [8,  (gl, l, v, n) => gl.uniformMatrix4x2fv(l, false, v, 0, n)], // FLOAT_MAT4x2
  0x8b6a: [12, (gl, l, v, n) => gl.uniformMatrix4x3fv(l, false, v, 0, n)], // FLOAT_MAT4x3

  // samplers take a texture unit index
  0x8b5e: [1, (gl, l, v, n) => gl.uniform1iv(l, v, 0, n)], // SAMPLER_2D
  0x8b5f: [1, (gl, l, v, n) => gl.uniform1iv(l, v, 0, n)], // SAMPLER_3D
  0x8b60: [1, (gl, l, v, n) => gl.uniform1iv(l, v, 0, n)], // SAMPLER_CUBE
  0x8b62: [1, (gl, l, v, n) => gl.uniform1iv(l, v, 0, n)], // SAMPLER_2D_SHADOW
  0x8dc1: [1, (gl, l, v, n) => gl.uniform1iv(l, v, 0, n)], // SAMPLER_2D_ARRAY
  0x8dc4: [1, (gl, l, v, n) => gl.uniform1iv(l, v, 0, n)], // SAMPLER_2D_ARRAY_SHADOW
  0x8dc5: [1, (gl, l, v, n) => gl.uniform1iv(l, v, 0, n)], // SAMPLER_CUBE_SHADOW
  0x8dca: [1, (gl, l, v, n) => gl.uniform1iv(l, v, 0, n)], // INT_SAMPLER_2D
  0x8dcb: [1, (gl, l, v, n) => gl.uniform1iv(l, v, 0, n)], // INT_SAMPLER_3D
  0x8dcc: [1, (gl, l, v, n) => gl.uniform1iv(l, v, 0, n)], // INT_SAMPLER_CUBE
  0x8dcf: [1, (gl, l, v, n) => gl.uniform1iv(l, v, 0, n)], // INT_SAMPLER_2D_ARRAY
  0x8dd2: [1, (gl, l, v, n) => gl.uniform1iv(l, v, 0, n)], // UNSIGNED_INT_SAMPLER_2D
  0x8dd3: [1, (gl, l, v, n) => gl.uniform1iv(l, v, 0, n)], // UNSIGNED_INT_SAMPLER_3D
  0x8dd4: [1, (gl, l, v, n) => gl.uniform1iv(l, v, 0, n)], // UNSIGNED_INT_SAMPLER_CUBE
  0x8dd7: [1, (gl, l, v, n) => gl.uniform1iv(l, v, 0, n)], // UNSIGNED_INT_SAMPLER_2D_ARRAY
};

/**
 * Query all active uniforms of a linked program.
 * Array uniforms are keyed by their base name (`lights[0]` -> `lights`).
 */
export function getActiveUniforms(
  gl: WebGL2RenderingContext,
  program: WebGLProgram
): Map<string, UniformInfo> {
  const result = new Map<string, UniformInfo>();
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    if (!info) {
      continue;
    }
    const location = gl.getUniformLocation(program, info.name);
    if (!location) {
      continue;
    }
    const name = info.name.replace(/\[0\]$/, '');
    result.set(name, { location, type: info.type, size: info.size });
  }
  return result;
}

/**
 * Flatten a uniform value into a plain array of numbers.
 * Textures are not values; the renderer maps them to a texture unit first.
 */
export function uniformToArray(value: Uniform): number[] {
  if (typeof value === 'number') {
    return [value];
  }
  if (typeof value === 'bigint') {
    return [Number(value)];
  }
  if (value instanceof Vector || value instanceof Matrix) {
    return value.values;
  }
  if (value instanceof Color) {
    return value.toVec4();
  }
  if (Array.isArray(value)) {
    return (value as (number | bigint | number[])[]).flat().map(Number);
  }
  if (value instanceof Texture) {
    throw Error('a Texture has to be bound to a texture unit first');
  }
  throw Error('unsupported uniform value');
}

/**
 * Upload values to a uniform. The setter is chosen from the uniform's
 * declared GLSL type, so the same JS value works for `vec3`, `ivec3` or
 * `bvec3`. Surplus elements are ignored; missing ones throw.
 * @param gl the rendering context, with the program in use
 * @param info location and type of the uniform
 * @param values the flattened value
 */
export function uploadUniform(
  gl: WebGL2RenderingContext,
  info: UniformInfo,
  values: number[]
): void {
  const spec = UNIFORM_TYPES[info.type];
  if (!spec) {
    throw Error(`unsupported uniform type 0x${info.type.toString(16)}`);
  }
  const [components, upload] = spec;
  const n = components * info.size;
  if (values.length < n) {
    throw Error(`uniform expects ${n} values, got ${values.length}`);
  }
  upload(gl, info.location, values, n);
}

/**
 * Set a single uniform on a program by name. Convenience for code working
 * with raw WebGL; the renderer uses a cached variant of the same logic.
 * @param gl the rendering context
 * @param program a linked program
 * @param name uniform name
 * @param value the value (numbers, arrays, Vector, Matrix, Color; a Texture is
 *   not supported here since it needs a texture unit assigned by the renderer)
 * @returns true if the uniform exists in the program and was set
 */
export function setUniform(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
  value: Uniform
): boolean {
  const info = getActiveUniforms(gl, program).get(name);
  if (!info) {
    return false;
  }
  gl.useProgram(program);
  uploadUniform(gl, info, uniformToArray(value));
  return true;
}
