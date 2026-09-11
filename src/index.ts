import type { BufferGroup } from './geometries/buffer-geometry';
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
  Color,
  mergeGeometries,
  createIndexedGeometry,
} from './utils';
import {
  Texture,
  Mesh,
  Renderer,
  Filter,
  Wrapping,
  DrawMode,
  createBasicMaterial,
  createDefaultMaterial,
  createNormalMaterial,
  createShaderMaterial,
  setUniform,
} from './webgl';
import type {
  TextureData,
  TextureOptions,
  Material,
  Uniform,
  Uniforms,
} from './webgl';

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
  DrawMode,
  createDefaultMaterial,
  createBasicMaterial,
  createNormalMaterial,
  createShaderMaterial,
  setUniform,
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
  mergeGeometries,
  createIndexedGeometry,
};
