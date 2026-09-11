import type { BufferGeometry } from '../geometries';
import type { Material } from './material';
import type { Mesh } from './mesh';
import { Texture } from './texture';
import { ERRORS } from './webgl-errors';
import {
  getActiveUniforms,
  uniformToArray,
  uploadUniform,
  type UniformInfo,
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
  vertexShader: string;
  fragmentShader: string;
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

const MIPMAP_FILTERS = new Set([0x2700, 0x2701, 0x2702, 0x2703]);

function arraysEqual(a: number[], b: number[]): boolean {
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
 */
export class Renderer {
  gl: WebGL2RenderingContext;
  pixelRatio = 1;

  private geometries = new Map<BufferGeometry, GeometryResources>();
  private materials = new Map<Material, MaterialResources>();
  private textures = new Map<Texture, TextureResources>();
  private attributeLocations = new Map<string, number>(
    RESERVED_ATTRIBUTE_LOCATIONS
  );
  private currentProgram: WebGLProgram | null = null;

  constructor(public canvas: HTMLCanvasElement) {
    const gl = this.canvas.getContext('webgl2');
    if (!gl) {
      throw Error(ERRORS.WEBGL_INIT);
    }
    this.gl = gl;
  }

  /**
   * Render a list of meshes. Resources for geometries, materials and textures
   * are created on first use and reused afterwards.
   * @param scene the meshes to draw, in order
   * @returns this instance
   */
  render(scene: Mesh[]): Renderer {
    const { gl } = this;
    for (const { geometry, material } of scene) {
      const materialResources = this.getMaterialResources(material);
      const geometryResources = this.getGeometryResources(geometry);
      if (this.currentProgram !== materialResources.program) {
        gl.useProgram(materialResources.program);
        this.currentProgram = materialResources.program;
      }
      this.setUniforms(materialResources, material);
      gl.bindVertexArray(geometryResources.vao);
      if (geometry.index !== null) {
        const indexType =
          geometry.indexType === 32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
        gl.drawElements(material.drawMode, geometry.count, indexType, 0);
      } else {
        gl.drawArrays(material.drawMode, 0, geometry.count);
      }
    }
    gl.bindVertexArray(null);
    return this;
  }

  setPixelRatio(pixelRatio: number): Renderer {
    this.pixelRatio = pixelRatio;
    return this;
  }

  setSize(width: number, height: number): Renderer {
    const { gl, canvas, pixelRatio } = this;
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
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
    let resources = this.materials.get(material);
    if (
      resources &&
      (resources.vertexShader !== material.vertexShader ||
        resources.fragmentShader !== material.fragmentShader)
    ) {
      // shader source changed: recompile
      this.disposeMaterial(material);
      resources = undefined;
    }
    if (!resources) {
      const { vertexShader, fragmentShader } = material;
      const program = this.createProgram(vertexShader, fragmentShader);
      resources = {
        program,
        uniforms: getActiveUniforms(this.gl, program),
        state: new Map(),
        vertexShader,
        fragmentShader,
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

  private setUniforms(resources: MaterialResources, material: Material): void {
    const { gl } = this;
    let unit = 0;
    for (const [name, value] of Object.entries(material.uniforms)) {
      const info = resources.uniforms.get(name);
      if (!info) {
        // not declared in the shader or optimized away
        continue;
      }
      let values: number[];
      if (value instanceof Texture) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        this.bindTexture(value);
        values = [unit++];
      } else {
        values = uniformToArray(value);
      }
      const previous = resources.state.get(name);
      if (previous && arraysEqual(previous, values)) {
        continue;
      }
      uploadUniform(gl, info, values);
      resources.state.set(name, values.slice());
    }
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
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, texture.minFilter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, texture.magFilter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, texture.wrapS);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, texture.wrapT);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        texture.image
      );
      if (MIPMAP_FILTERS.has(texture.minFilter)) {
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
        gl.FLOAT,
        false,
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
      const data =
        geometry.indexType === 32
          ? new Uint32Array(geometry.index)
          : new Uint16Array(geometry.index);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);
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
