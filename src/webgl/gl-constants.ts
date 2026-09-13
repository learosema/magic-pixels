import type {
  ColorSpace,
  DrawMode,
  Filter,
  Wrapping,
} from '../scene/constants';
import type { TypedArray } from '../geometries/buffer-geometry';

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

/**
 * The sized internal format a texture is uploaded with. `'srgb'` uses
 * `SRGB8_ALPHA8` so the GPU decodes sRGB-encoded texels to linear values
 * on sample; `'linear'` uploads the bytes as they are.
 */
export const GL_INTERNAL_FORMAT: Record<ColorSpace, number> = {
  linear: 0x1908, // RGBA
  srgb: 0x8c43, // SRGB8_ALPHA8
};

type TypedArrayConstructor = new (...args: never[]) => TypedArray;

// keyed by the typed array constructor, since that is what a BufferAttribute
// carries; there is no renderer-agnostic name for "an Int16Array" to key a
// Record with.
const GL_COMPONENT_TYPE = new Map<TypedArrayConstructor, number>([
  [Int8Array, 0x1400], // BYTE
  [Uint8Array, 0x1401], // UNSIGNED_BYTE
  [Int16Array, 0x1402], // SHORT
  [Uint16Array, 0x1403], // UNSIGNED_SHORT
  [Int32Array, 0x1404], // INT
  [Uint32Array, 0x1405], // UNSIGNED_INT
  [Float32Array, 0x1406], // FLOAT
]);

/** The GL component type enum for a {@link BufferAttribute}'s `data` array */
export function glComponentType(data: TypedArray): number {
  const type = GL_COMPONENT_TYPE.get(data.constructor as TypedArrayConstructor);
  if (type === undefined) {
    throw new Error(`Unsupported typed array: ${data.constructor.name}`);
  }
  return type;
}
