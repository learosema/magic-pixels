import { DrawMode, Filter, Wrapping, usesMipmaps } from './constants';
import { Texture } from './texture';
import type { TextureData, TextureOptions } from './texture';
import { Object3D } from './object3d';
import { Scene } from './scene';
import { Camera, PerspectiveCamera, OrthographicCamera } from './camera';
import { Mesh } from './mesh';
import {
  createDefaultMaterial,
  createBasicMaterial,
  createNormalMaterial,
  createShaderMaterial,
} from './material';
import type { Material, ShaderSource, Uniform, Uniforms } from './material';
import { prepareScene } from './renderer';
import type { Renderer } from './renderer';
import { NullRenderer } from './null-renderer';
import type { NullFrame } from './null-renderer';

export type {
  TextureData,
  TextureOptions,
  Material,
  ShaderSource,
  Uniform,
  Uniforms,
  Renderer,
  NullFrame,
};

export {
  Texture,
  Object3D,
  Scene,
  Camera,
  PerspectiveCamera,
  OrthographicCamera,
  Mesh,
  NullRenderer,
  prepareScene,
  Filter,
  Wrapping,
  DrawMode,
  usesMipmaps,
  createDefaultMaterial,
  createBasicMaterial,
  createNormalMaterial,
  createShaderMaterial,
};
