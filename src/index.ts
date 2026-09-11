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
  NullRenderer,
  Filter,
  Wrapping,
  DrawMode,
  createBasicMaterial,
  createDefaultMaterial,
  createNormalMaterial,
  createShaderMaterial,
} from './scene';
import type {
  Renderer,
  TextureData,
  TextureOptions,
  Material,
  ShaderSource,
  Uniform,
  Uniforms,
} from './scene';
import { WebGL2Renderer, setUniform } from './webgl';

export type {
  Renderer,
  Uniform,
  Uniforms,
  TextureData,
  TextureOptions,
  Material,
  ShaderSource,
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
  NullRenderer,
  WebGL2Renderer,
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
