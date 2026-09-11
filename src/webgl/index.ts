import { Filter, Texture, Wrapping } from './texture';
import type { TextureData, TextureOptions } from './texture';

import { Mesh } from './mesh';
import { Renderer } from './renderer';
import {
  DrawMode,
  createDefaultMaterial,
  createBasicMaterial,
  createNormalMaterial,
  createShaderMaterial,
} from './material';
import type { Material, Uniform, Uniforms } from './material';
import { setUniform } from './uniforms';

export type { TextureData, TextureOptions, Material, Uniform, Uniforms };

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
