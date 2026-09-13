import type { BufferGeometry } from '../geometries';
import { Color } from '../utils';
import type { Camera } from '../scene/camera';
import type { Material } from '../scene/material';
import type { Mesh } from '../scene/mesh';
import type { Scene } from '../scene/scene';
import { prepareScene, type Renderer } from '../scene/renderer';
import { Texture } from '../scene/texture';
import { usesMipmaps } from '../scene/constants';
import { ERRORS } from './webgl-errors';
import {
  GL_CULL_FACE,
  GL_DRAW_MODE,
  GL_FILTER,
  GL_INTERNAL_FORMAT,
  GL_WRAPPING,
  glComponentType,
} from './gl-constants';
import {
  getActiveUniforms,
  uniformToArray,
  uploadUniform,
  type UniformInfo,
  type UniformValues,
} from './uniforms';

type GeometryResources = {
  vao: WebGLVertexArrayObject;
  /** one buffer per attribute, plus the byte length that was uploaded */
  buffers: Map<string, { buffer: WebGLBuffer; byteLength: number }>;
  indexBuffer: WebGLBuffer | null;
  /** `geometry.version` at the time the resources were built */
  version: number;
};

type MaterialResources = {
  program: WebGLProgram;
  uniforms: Map<string, UniformInfo>;
  /** last uploaded values per uniform name; unchanged values are skipped */
  state: Map<string, number[]>;
  /** the GLSL sources the program was compiled from */
  vertex: string;
  fragment: string;
};

type TextureResources = {
  texture: WebGLTexture;
};

/**
 * Attribute locations are fixed by name so that one VAO per geometry works
 * with every program: the well-known attributes get 0..2, custom attributes
 * get the next free slot the first time the renderer sees them (in a
 * geometry or in a shader).
 */
const RESERVED_ATTRIBUTE_LOCATIONS: [string, number][] = [
  ['position', 0],
  ['normal', 1],
  ['uv', 2],
];

function arraysEqual(a: UniformValues, b: UniformValues): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

/**
 * WebGL2 renderer. Owns every GPU resource: programs (one per material),
 * vertex array objects and buffers (one set per geometry) and textures.
 * Scene objects stay plain data and can be shared between meshes freely.
 * Materials need a `glsl` shader source pair.
 *
 * Shaders can declare the built-in uniforms `modelMatrix`, `viewMatrix`,
 * `projectionMatrix`, `modelViewMatrix` (mat4) and `normalMatrix` (mat3);
 * they are set per mesh from the scene graph and the camera, unless the
 * material defines a uniform of the same name.
 */
export class WebGL2Renderer implements Renderer {
  gl: WebGL2RenderingContext;
  pixelRatio = 1;
  /** clear color and depth at the start of every `render` (default true) */
  autoClear = true;

  private geometries = new Map<BufferGeometry, GeometryResources>();
  private materials = new Map<Material, MaterialResources>();
  private textures = new Map<Texture, TextureResources>();
  private attributeLocations = new Map<string, number>(
    RESERVED_ATTRIBUTE_LOCATIONS
  );
  private currentProgram: WebGLProgram | null = null;

  // render state, tracked to skip redundant GL calls between draws; the
  // initial values match the GL defaults plus the constructor's DEPTH_TEST
  private blendEnabled = false;
  private cullEnabled = false;
  private cullFace: number | undefined = undefined;
  private depthTestEnabled = true;
  private depthWriteEnabled = true;

  constructor(public canvas: HTMLCanvasElement) {
    const gl = this.canvas.getContext('webgl2');
    if (!gl) {
      throw Error(ERRORS.WEBGL_INIT);
    }
    this.gl = gl;
    gl.enable(gl.DEPTH_TEST);
  }

  /**
   * Render a scene: update the world matrices, then draw every visible mesh
   * in depth-first order. Resources for geometries, materials and textures
   * are created on first use and reused afterwards.
   * @param scene the scene graph
   * @param camera the camera providing view and projection matrices
   * @returns this instance
   */
  render(scene: Scene, camera: Camera): WebGL2Renderer {
    const { gl } = this;
    const frame = prepareScene(scene, camera);
    if (this.autoClear) {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }
    for (const mesh of frame.meshes) {
      this.drawMesh(mesh, camera);
    }
    for (const mesh of frame.transparent) {
      this.drawMesh(mesh, camera);
    }
    gl.bindVertexArray(null);
    return this;
  }

  private drawMesh(mesh: Mesh, camera: Camera): void {
    const { gl } = this;
    const { geometry, material } = mesh;
    const materialResources = this.getMaterialResources(material);
    const geometryResources = this.getGeometryResources(geometry);
    if (this.currentProgram !== materialResources.program) {
      gl.useProgram(materialResources.program);
      this.currentProgram = materialResources.program;
    }
    this.applyRenderState(material);
    this.setBuiltinUniforms(materialResources, mesh, camera);
    this.setUniforms(materialResources, material);
    gl.bindVertexArray(geometryResources.vao);
    const mode = GL_DRAW_MODE[material.drawMode];
    if (geometry.index !== null) {
      const indexType =
        geometry.indexType === 32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
      gl.drawElements(mode, geometry.count, indexType, 0);
    } else {
      gl.drawArrays(mode, 0, geometry.count);
    }
  }

  /**
   * Apply a material's blend, cull and depth state, skipping GL calls whose
   * value did not change since the last draw.
   */
  private applyRenderState(material: Material): void {
    const { gl } = this;
    const transparent = material.transparent ?? false;
    if (transparent !== this.blendEnabled) {
      if (transparent) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      } else {
        gl.disable(gl.BLEND);
      }
      this.blendEnabled = transparent;
    }

    const cullFace = GL_CULL_FACE[material.side ?? 'double'];
    const shouldCull = cullFace !== undefined;
    if (shouldCull !== this.cullEnabled) {
      if (shouldCull) {
        gl.enable(gl.CULL_FACE);
      } else {
        gl.disable(gl.CULL_FACE);
      }
      this.cullEnabled = shouldCull;
    }
    if (shouldCull && cullFace !== this.cullFace) {
      gl.cullFace(cullFace);
      this.cullFace = cullFace;
    }

    const depthTest = material.depthTest ?? true;
    if (depthTest !== this.depthTestEnabled) {
      if (depthTest) {
        gl.enable(gl.DEPTH_TEST);
      } else {
        gl.disable(gl.DEPTH_TEST);
      }
      this.depthTestEnabled = depthTest;
    }

    const depthWrite = material.depthWrite ?? !transparent;
    if (depthWrite !== this.depthWriteEnabled) {
      gl.depthMask(depthWrite);
      this.depthWriteEnabled = depthWrite;
    }
  }

  setPixelRatio(pixelRatio: number): WebGL2Renderer {
    this.pixelRatio = pixelRatio;
    return this;
  }

  setSize(width: number, height: number): WebGL2Renderer {
    const { gl, canvas, pixelRatio } = this;
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    return this;
  }

  /**
   * Set the color the frame is cleared to (black by default).
   * @param color a `Color` or a hex string like `'#202020'`
   * @param alpha overrides the color's alpha if given
   */
  setClearColor(color: Color | string, alpha?: number): WebGL2Renderer {
    const [r, g, b, a] = (
      typeof color === 'string' ? Color.fromHex(color) : color
    ).toVec4();
    this.gl.clearColor(r, g, b, alpha ?? a);
    return this;
  }

  /**
   * Free GPU resources. Without an argument, everything the renderer created
   * is deleted and the context is lost; the renderer is unusable afterwards.
   * With a geometry, material or texture, only that object's resources are
   * freed. It is recreated on the next render if still in use.
   */
  dispose(object?: BufferGeometry | Material | Texture): void {
    if (object === undefined) {
      this.disposeAll();
      return;
    }
    if (this.geometries.has(object as BufferGeometry)) {
      this.disposeGeometry(object as BufferGeometry);
    } else if (this.textures.has(object as Texture)) {
      this.disposeTexture(object as Texture);
    } else if (this.materials.has(object as Material)) {
      this.disposeMaterial(object as Material);
    }
  }

  private disposeAll(): void {
    const { gl } = this;
    for (const geometry of [...this.geometries.keys()]) {
      this.disposeGeometry(geometry);
    }
    for (const material of [...this.materials.keys()]) {
      this.disposeMaterial(material);
    }
    for (const texture of [...this.textures.keys()]) {
      this.disposeTexture(texture);
    }
    const loseCtx = gl.getExtension('WEBGL_lose_context');
    if (loseCtx && typeof loseCtx.loseContext === 'function') {
      loseCtx.loseContext();
    }
  }

  // ---------------------------------------------------------------- materials

  private getMaterialResources(material: Material): MaterialResources {
    const { glsl } = material;
    if (!glsl) {
      throw Error(ERRORS.NO_GLSL);
    }
    let resources = this.materials.get(material);
    if (
      resources &&
      (resources.vertex !== glsl.vertex || resources.fragment !== glsl.fragment)
    ) {
      // shader source changed: recompile
      this.disposeMaterial(material);
      resources = undefined;
    }
    if (!resources) {
      const { vertex, fragment } = glsl;
      const program = this.createProgram(vertex, fragment);
      resources = {
        program,
        uniforms: getActiveUniforms(this.gl, program),
        state: new Map(),
        vertex,
        fragment,
      };
      this.materials.set(material, resources);
    }
    return resources;
  }

  private disposeMaterial(material: Material): void {
    const resources = this.materials.get(material);
    if (!resources) {
      return;
    }
    if (this.currentProgram === resources.program) {
      this.gl.useProgram(null);
      this.currentProgram = null;
    }
    this.gl.deleteProgram(resources.program);
    this.materials.delete(material);
  }

  private compileShader(type: number, source: string): WebGLShader {
    const { gl } = this;
    const shader = gl.createShader(type);
    if (!shader) {
      throw Error(ERRORS.SHADER_FAIL);
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw Error(`${ERRORS.SHADER_FAIL}: ${log}`);
    }
    return shader;
  }

  private createProgram(
    vertexSource: string,
    fragmentSource: string
  ): WebGLProgram {
    const { gl } = this;
    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.compileShader(
      gl.FRAGMENT_SHADER,
      fragmentSource
    );
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);

    // Link once to find out which attributes the vertex shader uses, then
    // pin them to their fixed locations and link again.
    this.linkProgram(program);
    const count = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveAttrib(program, i);
      if (!info || info.name.startsWith('gl_')) {
        continue;
      }
      gl.bindAttribLocation(
        program,
        this.attributeLocation(info.name),
        info.name
      );
    }
    this.linkProgram(program);

    // shaders are only needed for linking; they are freed with the program
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return program;
  }

  private linkProgram(program: WebGLProgram): void {
    const { gl } = this;
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw Error(`${ERRORS.SHADER_FAIL}: ${log}`);
    }
  }

  private attributeLocation(name: string): number {
    let location = this.attributeLocations.get(name);
    if (location === undefined) {
      location = this.attributeLocations.size;
      const max = this.gl.getParameter(this.gl.MAX_VERTEX_ATTRIBS) as number;
      if (location >= max) {
        throw Error(`too many vertex attributes (max ${max})`);
      }
      this.attributeLocations.set(name, location);
    }
    return location;
  }

  // ---------------------------------------------------------------- uniforms

  /**
   * Set the matrix uniforms the shader declares, unless the material
   * provides a uniform of the same name.
   */
  private setBuiltinUniforms(
    resources: MaterialResources,
    mesh: Mesh,
    camera: Camera
  ): void {
    const { uniforms } = mesh.material;
    const wants = (name: string) =>
      resources.uniforms.has(name) && !(name in uniforms);

    mesh.modelViewMatrix.multiplyMatrices(camera.viewMatrix, mesh.worldMatrix);
    if (wants('normalMatrix')) {
      mesh.normalMatrix.setNormalMatrix(mesh.modelViewMatrix);
      this.uploadIfChanged(resources, 'normalMatrix', mesh.normalMatrix.values);
    }
    if (wants('modelMatrix')) {
      this.uploadIfChanged(resources, 'modelMatrix', mesh.worldMatrix.values);
    }
    if (wants('viewMatrix')) {
      this.uploadIfChanged(resources, 'viewMatrix', camera.viewMatrix.values);
    }
    if (wants('projectionMatrix')) {
      this.uploadIfChanged(
        resources,
        'projectionMatrix',
        camera.projectionMatrix.values
      );
    }
    if (wants('modelViewMatrix')) {
      this.uploadIfChanged(
        resources,
        'modelViewMatrix',
        mesh.modelViewMatrix.values
      );
    }
  }

  private setUniforms(resources: MaterialResources, material: Material): void {
    const { gl } = this;
    let unit = 0;
    for (const [name, value] of Object.entries(material.uniforms)) {
      if (!resources.uniforms.has(name)) {
        // not declared in the shader or optimized away
        continue;
      }
      let values: UniformValues;
      if (value instanceof Texture) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        this.bindTexture(value);
        values = [unit++];
      } else {
        values = uniformToArray(value);
      }
      this.uploadIfChanged(resources, name, values);
    }
  }

  /** Upload a uniform unless the same values were uploaded last time */
  private uploadIfChanged(
    resources: MaterialResources,
    name: string,
    values: UniformValues
  ): void {
    const info = resources.uniforms.get(name);
    if (!info) {
      return;
    }
    const previous = resources.state.get(name);
    if (previous && arraysEqual(previous, values)) {
      return;
    }
    uploadUniform(this.gl, info, values);
    resources.state.set(name, Array.from(values));
  }

  // ---------------------------------------------------------------- textures

  /** Bind a texture to the active texture unit, uploading it first if needed */
  private bindTexture(texture: Texture): void {
    const { gl } = this;
    let resources = this.textures.get(texture);
    if (!resources) {
      resources = { texture: gl.createTexture() };
      this.textures.set(texture, resources);
      texture.needsUpdate = true;
    }
    gl.bindTexture(gl.TEXTURE_2D, resources.texture);
    if (texture.needsUpdate) {
      const minFilter = GL_FILTER[texture.minFilter];
      const magFilter = GL_FILTER[texture.magFilter];
      const wrapS = GL_WRAPPING[texture.wrapS];
      const wrapT = GL_WRAPPING[texture.wrapT];
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, texture.flipY);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        GL_INTERNAL_FORMAT[texture.colorSpace],
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        texture.image
      );
      if (usesMipmaps(texture.minFilter)) {
        gl.generateMipmap(gl.TEXTURE_2D);
      }
      texture.needsUpdate = false;
    }
  }

  private disposeTexture(texture: Texture): void {
    const resources = this.textures.get(texture);
    if (!resources) {
      return;
    }
    this.gl.deleteTexture(resources.texture);
    this.textures.delete(texture);
  }

  // -------------------------------------------------------------- geometries

  private getGeometryResources(geometry: BufferGeometry): GeometryResources {
    let resources = this.geometries.get(geometry);
    if (resources && resources.version !== geometry.version) {
      // attributes or index changed: rebuild
      this.disposeGeometry(geometry);
      resources = undefined;
    }
    if (!resources) {
      resources = this.createGeometryResources(geometry);
      this.geometries.set(geometry, resources);
      return resources;
    }
    this.updateAttributes(geometry, resources);
    return resources;
  }

  private createGeometryResources(geometry: BufferGeometry): GeometryResources {
    const { gl } = this;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const buffers: GeometryResources['buffers'] = new Map();
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      const location = this.attributeLocation(name);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        attribute.data,
        attribute.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW
      );
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(
        location,
        attribute.recordSize,
        glComponentType(attribute.data),
        attribute.normalized,
        0,
        0
      );
      attribute.needsUpdate = false;
      buffers.set(name, { buffer, byteLength: attribute.data.byteLength });
    }

    let indexBuffer: WebGLBuffer | null = null;
    if (geometry.index !== null) {
      indexBuffer = gl.createBuffer();
      // the element array buffer binding is part of the VAO state
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.index, gl.STATIC_DRAW);
    }

    gl.bindVertexArray(null);
    return { vao, buffers, indexBuffer, version: geometry.version };
  }

  /** Re-upload attributes flagged with `needsUpdate` */
  private updateAttributes(
    geometry: BufferGeometry,
    resources: GeometryResources
  ): void {
    const { gl } = this;
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      if (!attribute.needsUpdate) {
        continue;
      }
      const entry = resources.buffers.get(name);
      if (!entry) {
        continue;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, entry.buffer);
      if (attribute.data.byteLength === entry.byteLength) {
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, attribute.data);
      } else {
        // size changed: reallocate
        gl.bufferData(
          gl.ARRAY_BUFFER,
          attribute.data,
          attribute.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW
        );
        entry.byteLength = attribute.data.byteLength;
      }
      attribute.needsUpdate = false;
    }
  }

  private disposeGeometry(geometry: BufferGeometry): void {
    const { gl } = this;
    const resources = this.geometries.get(geometry);
    if (!resources) {
      return;
    }
    for (const { buffer } of resources.buffers.values()) {
      gl.deleteBuffer(buffer);
    }
    if (resources.indexBuffer) {
      gl.deleteBuffer(resources.indexBuffer);
    }
    gl.deleteVertexArray(resources.vao);
    this.geometries.delete(geometry);
  }
}
