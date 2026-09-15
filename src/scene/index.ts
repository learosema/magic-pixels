import {
  AlphaMode,
  ColorSpace,
  DrawMode,
  Filter,
  Side,
  Wrapping,
  usesMipmaps,
} from './constants';
import { Texture } from './texture';
import type { TextureData, TextureOptions } from './texture';
import { Object3D } from './object3d';
import { Scene } from './scene';
import { Camera, PerspectiveCamera, OrthographicCamera } from './camera';
import { Mesh } from './mesh';
import { Light, AmbientLight, DirectionalLight, PointLight } from './light';
import {
  createDefaultMaterial,
  createBasicMaterial,
  createNormalMaterial,
  createShaderMaterial,
  createPbrMaterial,
} from './material';
import type {
  Material,
  PbrMap,
  PbrMaterialOptions,
  ShaderSource,
  Uniform,
  Uniforms,
} from './material';
import { prepareScene } from './renderer';
import { computeBoundingBox, computeBoundingSphere } from './bounds';
import type { Frame, Renderer } from './renderer';
import { NullRenderer } from './null-renderer';
import type { NullFrame } from './null-renderer';

export type {
  TextureData,
  TextureOptions,
  Material,
  PbrMap,
  PbrMaterialOptions,
  ShaderSource,
  Uniform,
  Uniforms,
  Renderer,
  Frame,
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
  Light,
  AmbientLight,
  DirectionalLight,
  PointLight,
  NullRenderer,
  prepareScene,
  computeBoundingBox,
  computeBoundingSphere,
  Filter,
  Wrapping,
  DrawMode,
  ColorSpace,
  Side,
  AlphaMode,
  usesMipmaps,
  createDefaultMaterial,
  createBasicMaterial,
  createNormalMaterial,
  createShaderMaterial,
  createPbrMaterial,
};
