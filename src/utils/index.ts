import { Color } from './color';
import { facesToBuffer } from './faces-to-buffer';
import { calculateSurfaceNormal } from './surface-normals';
import { Vector } from './vector';
import { Matrix } from './matrix';
import { Mat2 } from './mat2';
import { Mat3 } from './mat3';
import { Mat4 } from './mat4';
import { mix, clamp } from './one-liners';
import { Stopwatch } from './stopwatch';
import { ortho, frustum, perspective } from './perspective';
import { createIndexedGeometry } from './indexed-geometry';
import { mergeGeometries } from './merge-geometries';

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
  mergeGeometries,
  createIndexedGeometry,
};
