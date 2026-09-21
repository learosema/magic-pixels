import { Texture } from './texture';
import type { Vector, Matrix, Mat2, Mat3, Mat4 } from '../utils';
import { Color } from '../utils';
import { AlphaMode, DrawMode, Side, ToneMapping } from './constants';

import defaultVertexShader from '../shaders/default.vert';
import defaultFragmentShader from '../shaders/default.frag';
import basicFragmentShader from '../shaders/basic.frag';
import normalFragmentShader from '../shaders/normal.frag';
import pbrVertexShader from '../shaders/pbr.vert';
import pbrFragmentShader from '../shaders/pbr.frag';
import fullscreenVertexShader from '../shaders/fullscreen.vert';
import tonemapFragmentShader from '../shaders/tonemap.frag';

export type Uniform =
  | number
  | number[]
  | number[][]
  | bigint
  | bigint[]
  | Texture
  | Vector
  | Matrix
  | Mat2
  | Mat3
  | Mat4
  | Color;
export type Uniforms = Record<string, Uniform>;

/** A vertex/fragment shader pair in one shading language */
export type ShaderSource = {
  vertex: string;
  fragment: string;
};

/**
 * A material is plain data: shader sources per shading language, a draw
 * mode and a uniforms object. A renderer picks the language it understands
 * (`glsl` for WebGL2; a WebGPU renderer would read `wgsl`), compiles one
 * program per distinct shader source pair (shared by all materials and
 * meshes using it) and uploads the uniforms on every draw, skipping the
 * ones that did not change. Replacing a shader source recompiles the
 * program on the next render.
 */
export type Material = {
  glsl?: ShaderSource;
  drawMode: DrawMode;
  uniforms: Uniforms;
  /**
   * Alpha blending (`SRC_ALPHA, ONE_MINUS_SRC_ALPHA`) instead of overwriting
   * the framebuffer, and depth writes off unless `depthWrite` says
   * otherwise. Also determines draw order: transparent meshes are drawn
   * after opaque ones, back to front. Default `false`.
   */
  transparent?: boolean;
  /** Which faces are drawn. Default `'double'`: no culling, as today. */
  side?: Side;
  /** Discard fragments behind what is already drawn. Default `true`. */
  depthTest?: boolean;
  /**
   * Write fragment depth into the depth buffer. Defaults to `true`, except
   * when `transparent` is `true` and `depthWrite` is not set explicitly.
   */
  depthWrite?: boolean;
};

export function createDefaultMaterial(): Material {
  return {
    glsl: { vertex: defaultVertexShader, fragment: defaultFragmentShader },
    drawMode: DrawMode.TRIANGLES,
    uniforms: {},
  };
}

export function createNormalMaterial(): Material {
  return {
    glsl: { vertex: defaultVertexShader, fragment: normalFragmentShader },
    drawMode: DrawMode.TRIANGLES,
    uniforms: {},
  };
}

/**
 * A flat colour: no lighting, no textures. For an unlit textured surface
 * (baked lighting, stylised looks) use
 * `createPbrMaterial({ unlit: true, baseColorMap })`.
 * @param color CSS hex colour, `'#ff0000'` by default
 */
export function createBasicMaterial(color = '#ff0000'): Material {
  return {
    glsl: { vertex: defaultVertexShader, fragment: basicFragmentShader },
    drawMode: DrawMode.TRIANGLES,
    uniforms: {
      color: Color.fromHex(color),
    },
  };
}

/**
 * Create a material from GLSL sources.
 * @param vertexShader GLSL vertex shader (defaults to the built-in one)
 * @param fragmentShader GLSL fragment shader (defaults to the built-in one)
 * @param uniforms initial uniform values
 * @param drawMode primitive type, `DrawMode.TRIANGLES` by default
 */
export function createShaderMaterial(
  vertexShader = defaultVertexShader,
  fragmentShader = defaultFragmentShader,
  uniforms: Uniforms = {},
  drawMode: DrawMode = DrawMode.TRIANGLES
): Material {
  return {
    glsl: { vertex: vertexShader, fragment: fragmentShader },
    drawMode,
    uniforms,
  };
}

/**
 * A texture slot of the PBR material: the texture alone samples the `uv`
 * attribute; the object form picks the texture coordinate set, `0` for
 * `uv` (the default) or `1` for `uv1`, as glTF's `texCoord` does.
 */
export type PbrMap = Texture | { texture: Texture; uv?: 0 | 1 };

/**
 * Options of {@link createPbrMaterial}. Every factor defaults to its glTF
 * default, every map is optional. Colour factors are linear RGB in `0..1`
 * (a {@link Color} is converted); base colour and emissive maps should be
 * created with `colorSpace: 'srgb'`, the other maps hold linear data.
 */
export type PbrMaterialOptions = {
  /** linear RGBA multiplied into the base colour, default `[1, 1, 1, 1]` */
  baseColorFactor?: Color | number[];
  /** sRGB texture multiplied into the base colour */
  baseColorMap?: PbrMap;
  /** `0` for a dielectric, `1` for a metal, default `1` */
  metallicFactor?: number;
  /** `0` for a mirror, `1` for chalk, default `1` */
  roughnessFactor?: number;
  /** roughness in the green channel, metalness in the blue channel */
  metallicRoughnessMap?: PbrMap;
  /** tangent-space normals, `0..1` encoded */
  normalMap?: PbrMap;
  /** scales the `x` and `y` of the sampled normal, default `1` */
  normalScale?: number;
  /** ambient occlusion in the red channel */
  occlusionMap?: PbrMap;
  /** how much of the occlusion map applies, `0..1`, default `1` */
  occlusionStrength?: number;
  /** linear RGB added after lighting, default `[0, 0, 0]` */
  emissiveFactor?: Color | number[];
  /** sRGB texture multiplied into the emissive factor */
  emissiveMap?: PbrMap;
  /**
   * `'opaque'` ignores the base colour's alpha (the default), `'mask'`
   * discards fragments with an alpha below `alphaCutoff`, `'blend'` makes
   * the material `transparent`.
   */
  alphaMode?: AlphaMode;
  /** threshold for `'mask'`, default `0.5` */
  alphaCutoff?: number;
  /**
   * Draw both faces (`side: 'double'`) and flip the normal for back faces.
   * Default `false`: back faces are culled (`side: 'front'`), as glTF
   * specifies.
   */
  doubleSided?: boolean;
  /** base colour only, no lighting (glTF's `KHR_materials_unlit`) */
  unlit?: boolean;
  /**
   * Write the linear colour as it is instead of converting it to sRGB.
   * For a material drawn into a render target that a later pass (see
   * {@link createToneMapMaterial}) tone maps and converts. Default `false`.
   */
  linearOutput?: boolean;
  /** multiply the base colour by the `color` vertex attribute (vec3 or vec4) */
  vertexColors?: boolean;
  /**
   * The geometry has a `tangent` attribute (vec4, bitangent handedness in
   * `w`) for the normal map. Without it, the tangent is reconstructed from
   * screen-space derivatives in the fragment shader.
   */
  tangents?: boolean;
  /** size of the directional light arrays in the shader, default `4` */
  maxDirectionalLights?: number;
  /** size of the point light arrays in the shader, default `4` */
  maxPointLights?: number;
};

/** A map slot with the texture unwrapped and the UV set resolved */
type ResolvedMap = { texture: Texture; uv: 0 | 1 };

function resolveMap(map: PbrMap | undefined): ResolvedMap | undefined {
  if (map === undefined) {
    return undefined;
  }
  if (map instanceof Texture) {
    return { texture: map, uv: 0 };
  }
  return { texture: map.texture, uv: map.uv ?? 0 };
}

/** A colour factor as a flat `0..1` array with exactly `size` entries */
function colorFactor(
  value: Color | number[] | undefined,
  fallback: number[],
  size: number
): number[] {
  if (value === undefined) {
    return fallback;
  }
  const values = value instanceof Color ? value.toVec4() : value;
  if (values.length < size) {
    throw Error(`expected ${size} colour components, got ${values.length}`);
  }
  return values.slice(0, size);
}

/** Insert a block of `#define`s after the `#version` line of a shader */
function withDefines(source: string, defines: string[]): string {
  const newline = source.indexOf('\n');
  const version = source.slice(0, newline);
  const body = source.slice(newline);
  return `${version}\n${defines.map((d) => `#define ${d}\n`).join('')}${body}`;
}

/** The map slots: option name, define prefix and the UV define */
const PBR_MAPS: [keyof PbrMaterialOptions, string][] = [
  ['baseColorMap', 'BASE_COLOR'],
  ['metallicRoughnessMap', 'METALLIC_ROUGHNESS'],
  ['normalMap', 'NORMAL'],
  ['occlusionMap', 'OCCLUSION'],
  ['emissiveMap', 'EMISSIVE'],
];

/**
 * Create a physically based material: the glTF 2.0 metallic-roughness
 * model, lit by the lights of the scene through the built-in light
 * uniforms, with the linear to sRGB conversion at the end of the fragment
 * shader. Every option maps to a glTF material property of the same name.
 *
 * Which maps, texture coordinate sets and vertex attributes the material
 * uses is baked into the shader source as a block of `#define`s when the
 * material is created: a sampler without a texture bound would read
 * texture unit 0, so map presence cannot be decided per draw. Materials
 * with the same options (and so the same source) share one program in the
 * renderer. The factors are ordinary uniforms and can be changed at any
 * time (`material.uniforms.roughnessFactor = 0.2`); adding or removing a
 * map means creating a new material.
 */
export function createPbrMaterial(options: PbrMaterialOptions = {}): Material {
  const alphaMode = options.alphaMode ?? AlphaMode.OPAQUE;
  const doubleSided = options.doubleSided ?? false;
  const defines: string[] = [];
  const uniforms: Uniforms = {
    baseColorFactor: colorFactor(options.baseColorFactor, [1, 1, 1, 1], 4),
    metallicFactor: options.metallicFactor ?? 1,
    roughnessFactor: options.roughnessFactor ?? 1,
    emissiveFactor: colorFactor(options.emissiveFactor, [0, 0, 0], 3),
    normalScale: options.normalScale ?? 1,
    occlusionStrength: options.occlusionStrength ?? 1,
    alphaCutoff: options.alphaCutoff ?? 0.5,
  };

  let usesUv1 = false;
  for (const [name, prefix] of PBR_MAPS) {
    const map = resolveMap(options[name] as PbrMap | undefined);
    if (!map) {
      continue;
    }
    uniforms[name] = map.texture;
    defines.push(
      `HAS_${prefix}_MAP`,
      `${prefix}_UV ${map.uv === 1 ? 'vUv1' : 'vUv'}`
    );
    usesUv1 ||= map.uv === 1;
  }
  if (usesUv1) {
    defines.push('HAS_UV1');
  }
  if (options.vertexColors) {
    defines.push('HAS_VERTEX_COLOR');
  }
  if (options.tangents) {
    defines.push('HAS_TANGENT');
  }
  if (alphaMode === AlphaMode.MASK) {
    defines.push('ALPHA_MASK');
  } else if (alphaMode === AlphaMode.BLEND) {
    defines.push('ALPHA_BLEND');
  }
  if (doubleSided) {
    defines.push('DOUBLE_SIDED');
  }
  if (options.unlit) {
    defines.push('UNLIT');
  }
  if (options.linearOutput) {
    defines.push('LINEAR_OUTPUT');
  }
  defines.push(
    `MAX_DIRECTIONAL_LIGHTS ${options.maxDirectionalLights ?? 4}`,
    `MAX_POINT_LIGHTS ${options.maxPointLights ?? 4}`
  );

  return {
    glsl: {
      vertex: withDefines(pbrVertexShader, defines),
      fragment: withDefines(pbrFragmentShader, defines),
    },
    drawMode: DrawMode.TRIANGLES,
    uniforms,
    transparent: alphaMode === AlphaMode.BLEND,
    side: doubleSided ? Side.DOUBLE : Side.FRONT,
  };
}

/**
 * A material for a fullscreen pass: the vertex shader draws the triangle of
 * {@link createFullscreenMesh} across the whole screen and passes `vUv`
 * (`0..1` across the screen) to the fragment shader, which is where the
 * pass does its work, typically by sampling a {@link RenderTarget}'s colour
 * texture. Depth testing and depth writes are off: a pass just overwrites
 * every pixel.
 * @param fragmentShader GLSL fragment shader reading `in vec2 vUv`
 * @param uniforms the shader's uniforms, e.g. `{ map: target.colorAttachment }`
 */
export function createFullscreenMaterial(
  fragmentShader: string,
  uniforms: Uniforms = {}
): Material {
  return {
    ...createShaderMaterial(fullscreenVertexShader, fragmentShader, uniforms),
    depthTest: false,
    depthWrite: false,
  };
}

/** Options of {@link createToneMapMaterial} */
export type ToneMapMaterialOptions = {
  /** the linear HDR colour to tone map, usually a render target's colour */
  map: Texture;
  /** multiplied into the colour before the curve, default `1` */
  exposure?: number;
  /** the curve, default `'aces'` */
  toneMapping?: ToneMapping;
};

/**
 * A fullscreen pass material that reads linear HDR colour from `map`,
 * multiplies it by `exposure`, tone maps it and converts it to sRGB: the
 * last step between a scene rendered into a linear render target (PBR
 * materials with `linearOutput`) and the canvas. `exposure` is an ordinary
 * uniform, `material.uniforms.exposure = 2` brightens the picture by a
 * stop. The curve is baked into the shader source; changing it means
 * creating a new material.
 */
export function createToneMapMaterial(
  options: ToneMapMaterialOptions
): Material {
  const toneMapping = options.toneMapping ?? ToneMapping.ACES;
  const defines: string[] = [];
  if (toneMapping === ToneMapping.ACES) {
    defines.push('TONE_MAPPING_ACES');
  } else if (toneMapping === ToneMapping.REINHARD) {
    defines.push('TONE_MAPPING_REINHARD');
  }
  return createFullscreenMaterial(withDefines(tonemapFragmentShader, defines), {
    map: options.map,
    exposure: options.exposure ?? 1,
  });
}
