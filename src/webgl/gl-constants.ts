import type { DrawMode, Filter, Wrapping } from '../scene/constants';

// GL enum values are fixed by the spec; using the literals keeps the module
// loadable without a WebGL2RenderingContext global (e.g. in Node).

export const GL_DRAW_MODE: Record<DrawMode, number> = {
  points: 0x0000,
  lines: 0x0001,
  'line-loop': 0x0002,
  'line-strip': 0x0003,
  triangles: 0x0004,
  'triangle-strip': 0x0005,
  'triangle-fan': 0x0006,
};

export const GL_FILTER: Record<Filter, number> = {
  nearest: 0x2600,
  linear: 0x2601,
  'nearest-mipmap-nearest': 0x2700,
  'linear-mipmap-nearest': 0x2701,
  'nearest-mipmap-linear': 0x2702,
  'linear-mipmap-linear': 0x2703,
};

export const GL_WRAPPING: Record<Wrapping, number> = {
  'clamp-to-edge': 0x812f,
  repeat: 0x2901,
  'mirrored-repeat': 0x8370,
};
