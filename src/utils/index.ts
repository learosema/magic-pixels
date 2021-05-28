import { Color } from './color';
import { facesToBuffer } from './faces-to-buffer';
import { calculateSurfaceNormal } from './surface-normals';
import { Vector } from './vector';
import { Matrix } from './matrix';
import { mix, clamp } from './one-liners';
import { Stopwatch } from './stopwatch';
import { ortho, frustum, perspective } from './perspective';
import { Camera } from './camera';
import { Material, Uniform, Uniforms } from '../webgl/material';
import { setUniform, wrapUniforms } from './uniform-helpers';
import { createIndexedGeometry } from './indexed-geometry';
import { mergeGeometries } from './merge-geometries';

import * as Mat2 from './mat2';
import * as Mat3 from './mat3';
import * as Mat4 from './mat4';

export {
  Vector,
  Matrix,
  Mat2,
  Mat3,
  Mat4,
  calculateSurfaceNormal,
  facesToBuffer,
  mix,
  clamp,
  ortho,
  frustum,
  perspective,
  Stopwatch,
  Color,
  Camera,
  Material,
  Uniform,
  Uniforms,
  wrapUniforms,
  setUniform,
  mergeGeometries,
  createIndexedGeometry,
};
