import { loadGltf, parseGltf, SUPPORTED_EXTENSIONS } from './loader';
import type { GltfLoaderOptions, GltfResult } from './loader';
import { parseGlb, isGlb } from './glb';
import type { Glb } from './glb';
import { readAccessor, readAccessorData, readIndices } from './accessors';
import { decodeDracoPrimitive } from './draco';
import type { DracoDecoderModule } from './draco';
import type { DracoWorkerOptions } from './draco-worker-pool';
import { decodeMeshoptBufferViews } from './meshopt';
import type { MeshoptDecoder } from './meshopt';
import type { MeshoptWorkerOptions } from './meshopt-worker-pool';
import type {
  GltfAccessor,
  GltfAccessorType,
  GltfAlphaMode,
  GltfAsset,
  GltfBuffer,
  GltfBufferView,
  GltfCamera,
  GltfComponentType,
  GltfDracoMeshCompression,
  GltfImage,
  GltfJson,
  GltfLight,
  GltfMaterial,
  GltfMesh,
  GltfMeshoptCompression,
  GltfNode,
  GltfNormalTextureInfo,
  GltfOcclusionTextureInfo,
  GltfOrthographicCamera,
  GltfPbrMetallicRoughness,
  GltfPerspectiveCamera,
  GltfPrimitive,
  GltfPrimitiveMode,
  GltfSampler,
  GltfScene,
  GltfSparseAccessor,
  GltfTexture,
  GltfTextureInfo,
} from './types';

export type {
  GltfLoaderOptions,
  GltfResult,
  Glb,
  DracoDecoderModule,
  DracoWorkerOptions,
  MeshoptDecoder,
  MeshoptWorkerOptions,
  GltfAccessor,
  GltfAccessorType,
  GltfAlphaMode,
  GltfAsset,
  GltfBuffer,
  GltfBufferView,
  GltfCamera,
  GltfComponentType,
  GltfDracoMeshCompression,
  GltfImage,
  GltfJson,
  GltfLight,
  GltfMaterial,
  GltfMesh,
  GltfMeshoptCompression,
  GltfNode,
  GltfNormalTextureInfo,
  GltfOcclusionTextureInfo,
  GltfOrthographicCamera,
  GltfPbrMetallicRoughness,
  GltfPerspectiveCamera,
  GltfPrimitive,
  GltfPrimitiveMode,
  GltfSampler,
  GltfScene,
  GltfSparseAccessor,
  GltfTexture,
  GltfTextureInfo,
};
export {
  loadGltf,
  parseGltf,
  parseGlb,
  isGlb,
  readAccessor,
  readAccessorData,
  readIndices,
  decodeDracoPrimitive,
  decodeMeshoptBufferViews,
  SUPPORTED_EXTENSIONS,
};
