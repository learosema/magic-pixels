import type { BufferGroup } from './geometries/buffer-geometry';
import type { TextureOptions } from './webgl/texture';
import {
  BufferAttribute,
  BufferGeometry,
  createBoxGeometry,
  createPlaneGeometry,
  createSphereGeometry,
} from './geometries';

import {
  Vector,
  Matrix,
  calculateSurfaceNormal,
  facesToBuffer,
  mix,
  clamp,
  Stopwatch,
  frustum,
  ortho,
  Mat2,
  Mat3,
  Mat4,
  Camera,
  perspective,
  wrapUniforms,
  setUniform,
  Color,
  mergeGeometries,
  createIndexedGeometry,
} from './utils';
import type { Uniform, Uniforms } from './utils';
import {
  Texture,
  Mesh,
  Renderer,
  Filter,
  Wrapping,
  createBasicMaterial,
  createDefaultMaterial,
  createNormalMaterial,
  createShaderMaterial,
} from './webgl';
import type { TextureData, Material } from './webgl';

export type {
  Uniform,
  Uniforms,
  TextureData,
  TextureOptions,
  Material,
  BufferGroup,
};

export {
  BufferAttribute,
  BufferGeometry,
  createBoxGeometry,
  createPlaneGeometry,
  createSphereGeometry,
};
export {
  Texture,
  Mesh,
  Renderer,
  Filter,
  Wrapping,
  createDefaultMaterial,
  createBasicMaterial,
  createNormalMaterial,
  createShaderMaterial,
};
export {
  Vector,
  Matrix,
  Color,
  Mat2,
  Mat3,
  Mat4,
  Camera,
  calculateSurfaceNormal,
  facesToBuffer,
  mix,
  clamp,
  ortho,
  frustum,
  perspective,
  Stopwatch,
  wrapUniforms,
  setUniform,
  mergeGeometries,
  createIndexedGeometry,
};
