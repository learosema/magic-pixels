import { BufferGeometry } from '../geometries';
import { ERRORS } from './webgl-errors';
import { Material } from './material';
import { setUniform, wrapUniforms } from '../utils';

export class Mesh {
  buffers: Record<string, WebGLBuffer> = {};
  program: WebGLProgram | null = null;
  gl: WebGLRenderingContext | null = null;

  /**
   * Mesh constructor
   * @param geometry a buffer geometry
   * @param material the material
   */
  constructor(
    public geometry: BufferGeometry,
    public material: Material,
    public bufferUsage = WebGLRenderingContext.DYNAMIC_DRAW
  ) {}

  /**
   * Initialize this mesh inside a WebGLRenderingContext, does nothing if already initialized.
   * @param gl the WebGLRenderingContext
   * @returns
   */
  init(gl: WebGLRenderingContext): void {
    if (this.gl) {
      // already initialized
      return;
    }
    this.gl = gl;
    const { material } = this;
    const { fragmentShader, vertexShader } = material;
    this.program = this.createProgram(vertexShader, fragmentShader);
    const uniformsProxy = wrapUniforms(
      this.gl,
      this.program,
      material.uniforms
    );
    material.uniforms = uniformsProxy;
    this.createBuffers();
    gl.useProgram(this.program);
    this.setUniforms();
  }

  private compileShader(type: number, code: string): WebGLShader | null {
    const { gl } = this;
    if (!gl) {
      throw Error(ERRORS.WEBGL_INIT);
    }
    const sh = gl.createShader(type);
    if (!sh) {
      throw Error('error creating shader.');
    }
    gl.shaderSource(sh, code);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw gl.getShaderInfoLog(sh);
    }
    return sh;
  }

  private createProgram(
    vertexShader: string,
    fragmentShader: string
  ): WebGLProgram {
    const { gl } = this;
    if (!gl) {
      throw Error('WebGL context not initialized');
    }
    const program = gl.createProgram();
    if (!program) {
      throw Error(ERRORS.SHADER_FAIL);
    }
    const fragShader =
      this.compileShader(gl.FRAGMENT_SHADER, fragmentShader) || null;
    const vertShader =
      this.compileShader(gl.VERTEX_SHADER, vertexShader) || null;
    if (!fragShader || !vertShader) {
      throw Error(ERRORS.SHADER_FAIL);
    }
    gl.attachShader(program, fragShader);
    gl.attachShader(program, vertShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw gl.getProgramInfoLog(program);
    }
    return program;
  }

  private createBuffers(): Mesh {
    const { gl, program, geometry } = this;
    if (!gl || !program) {
      throw Error(ERRORS.WEBGL_INIT);
    }
    const buffers: Record<string, WebGLBuffer> = {};
    for (const [name, attrib] of Object.entries(geometry.attributes)) {
      const buffer = gl.createBuffer();
      if (!buffer) {
        throw Error(ERRORS.WEBGL_INIT);
      }
      const attribLoc = gl.getAttribLocation(program, name);
      if (attribLoc === -1) {
        continue;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, attrib.data, this.bufferUsage);
      gl.enableVertexAttribArray(attribLoc);
      gl.vertexAttribPointer(
        attribLoc,
        attrib.recordSize,
        gl.FLOAT,
        false,
        0,
        0
      );
      buffers[name] = buffer;
    }
    if (geometry.index) {
      const indexBuffer = gl.createBuffer();
      if (indexBuffer === null) {
        throw Error(ERRORS.WEBGL_ERROR);
      }
      // make this buffer the current 'ELEMENT_ARRAY_BUFFER'
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      let data = null;
      if (geometry.indexType === 16) {
        data = new Uint16Array(geometry.index);
      }
      if (geometry.indexType === 32) {
        data = new Uint32Array(geometry.index);
      }
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, this.bufferUsage);
      buffers['_index'] = indexBuffer;
    }
    this.buffers = buffers;
    return this;
  }

  private deleteBuffers(): Mesh {
    const { gl, program } = this;
    if (!gl || !program) {
      return this;
    }
    for (const [key, buffer] of Object.entries(this.buffers)) {
      if (!key.startsWith('_')) {
        const loc = gl.getAttribLocation(program, key);
        gl.disableVertexAttribArray(loc);
      }
      gl.deleteBuffer(buffer);
    }
    this.buffers = {};
    return this;
  }

  /**
   * Update all buffers
   * @returns this instance
   */
  updateBuffers(): Mesh {
    if (!this.gl || !this.program) {
      throw Error(ERRORS.WEBGL_INIT);
    }
    this.deleteBuffers();
    this.createBuffers();
    return this;
  }

  /**
   * Update buffer of a single attribute
   * @param attribName name of the attribute to be updated
   * @param newData the new data
   * @param offset offset (default = 0)
   * @param syncGeometry also keep the underlying geometry data in sync (default = true)
   * @returns current instance
   */
  updateBuffer(
    attribName: string,
    newData: Float32Array,
    offset = 0,
    syncGeometry = true
  ): Mesh {
    const { geometry, gl } = this;
    const buffer = this.buffers[attribName];
    if (syncGeometry) {
      geometry.attributes[attribName].data.set(newData, offset);
    }
    if (gl && buffer !== null) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, offset, newData);
    }
    return this;
  }

  /**
   * Recompile shaders
   * @returns this instance
   */
  recompile(): Mesh {
    const { gl, program } = this;
    const { vertexShader, fragmentShader } = this.material;
    if (gl && program) {
      gl.deleteProgram(program);
    }
    this.program = this.createProgram(vertexShader, fragmentShader);
    return this;
  }

  /**
   * Set uniform variables
   * @returns this instance
   */
  setUniforms(): Mesh {
    const { gl, program, material } = this;
    if (!gl || !program) {
      throw Error(ERRORS.WEBGL_INIT);
    }
    gl.useProgram(program);
    for (const [name, value] of Object.entries(material.uniforms)) {
      setUniform(gl, program, name, value);
    }
    return this;
  }

  /**
   * enable attributes
   * @returns this instance
   */
  disableAttribs(): Mesh {
    const { gl, program, buffers } = this;
    if (!gl || !program) {
      throw Error(ERRORS.WEBGL_INIT);
    }
    gl.useProgram(program);
    for (const key of Object.keys(buffers)) {
      const loc = gl.getAttribLocation(program, key);
      if (loc > -1) {
        gl.disableVertexAttribArray(loc);
      }
    }
    return this;
  }

  /**
   * disable attributes
   * @returns this instance
   */
  enableAttribs(): Mesh {
    const { gl, program, buffers, geometry } = this;
    if (!gl || !program) {
      throw Error(ERRORS.WEBGL_INIT);
    }
    gl.useProgram(program);
    for (const [key, buffer] of Object.entries(buffers)) {
      const attribute = geometry.attributes[key];
      const loc = gl.getAttribLocation(program, key);
      if (loc > -1) {
        gl.enableVertexAttribArray(loc);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.vertexAttribPointer(
          loc,
          attribute.recordSize,
          gl.FLOAT,
          false,
          0,
          0
        );
      }
    }
    return this;
  }

  /**
   * Call drawElements or drawArrays
   * @returns this instance
   */
  draw(): Mesh {
    const { gl, geometry, material } = this;
    if (!gl) {
      throw Error(ERRORS.WEBGL_INIT);
    }
    if (geometry.index !== null) {
      let indexType = WebGLRenderingContext.NONE;
      if (geometry.indexType === 16) {
        indexType = WebGLRenderingContext.UNSIGNED_SHORT;
      }
      if (geometry.indexType === 32) {
        indexType = WebGLRenderingContext.UNSIGNED_INT;
      }
      gl.drawElements(material.drawMode, geometry.count, indexType, 0);
      return this;
    }
    // non-indexed geometries are drawn via drawArrays
    gl.drawArrays(material.drawMode, 0, geometry.count);
    return this;
  }

  /**
   * Free attributes, buffers and delete the program and disconnect the mesh from the WebGL context
   */
  dispose(): void {
    const { gl, program } = this;
    if (!gl || !program) {
      // no dispose necessary
      return;
    }
    this.deleteBuffers();
    gl.deleteProgram(program);
    this.gl = null;
    this.program = null;
    // release the ES6 proxy by cloning the uniforms object
    this.material.uniforms = { ...this.material.uniforms };
  }
}
