/**
 * Renderer-agnostic enums. They are plain strings so scene objects never
 * carry GPU API constants; each renderer maps them to its own values
 * (see `src/webgl/gl-constants.ts` for WebGL2).
 *
 * Both the object form (`DrawMode.TRIANGLES`) and the string literal
 * (`'triangles'`) are accepted wherever the type is expected.
 */

export const DrawMode = {
  POINTS: 'points',
  LINES: 'lines',
  LINE_LOOP: 'line-loop',
  LINE_STRIP: 'line-strip',
  TRIANGLES: 'triangles',
  TRIANGLE_STRIP: 'triangle-strip',
  TRIANGLE_FAN: 'triangle-fan',
} as const;
export type DrawMode = (typeof DrawMode)[keyof typeof DrawMode];

export const Filter = {
  NEAREST: 'nearest',
  LINEAR: 'linear',
  NEAREST_MIPMAP_NEAREST: 'nearest-mipmap-nearest',
  LINEAR_MIPMAP_NEAREST: 'linear-mipmap-nearest',
  NEAREST_MIPMAP_LINEAR: 'nearest-mipmap-linear',
  LINEAR_MIPMAP_LINEAR: 'linear-mipmap-linear',
} as const;
export type Filter = (typeof Filter)[keyof typeof Filter];

export const Wrapping = {
  CLAMP_TO_EDGE: 'clamp-to-edge',
  REPEAT: 'repeat',
  MIRRORED_REPEAT: 'mirrored-repeat',
} as const;
export type Wrapping = (typeof Wrapping)[keyof typeof Wrapping];

/** True for the minification filters that sample from mipmaps */
export function usesMipmaps(filter: Filter): boolean {
  return filter.includes('mipmap');
}

export const ColorSpace = {
  LINEAR: 'linear',
  SRGB: 'srgb',
} as const;
export type ColorSpace = (typeof ColorSpace)[keyof typeof ColorSpace];

/** Which faces of a triangle are drawn. `'double'` disables face culling. */
export const Side = {
  FRONT: 'front',
  BACK: 'back',
  DOUBLE: 'double',
} as const;
export type Side = (typeof Side)[keyof typeof Side];

/**
 * How a material treats the alpha of its base colour: ignore it, cut out
 * fragments below a threshold, or blend with what is behind (see
 * `createPbrMaterial`). The names are the glTF `alphaMode` values.
 */
export const AlphaMode = {
  OPAQUE: 'opaque',
  MASK: 'mask',
  BLEND: 'blend',
} as const;
export type AlphaMode = (typeof AlphaMode)[keyof typeof AlphaMode];
