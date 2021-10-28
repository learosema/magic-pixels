import { Material, BufferGeometry } from '../types';
import { setUniform, wrapUniforms } from './uniform-helpers';
import { ERRORS } from '../webgl/webgl-errors';

export type BufferCollection = Record<string, WebGLBuffer>;
export type WebGLData = {
  buffers: BufferCollection;
  program: WebGLProgram | null;
  material: Material;
};

export function compileShader(
  gl: WebGLRenderingContext | null,
  type: number,
  code: string
): WebGLShader | null {
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

export function createProgram(
  gl: WebGLRenderingContext | null,
  vertexShader: string,
  fragmentShader: string
): WebGLProgram {
  if (!gl) {
    throw Error('WebGL context not initialized');
  }
  const program = gl.createProgram();
  if (!program) {
    throw Error(ERRORS.SHADER_FAIL);
  }
  const fragShader =
    compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader) || null;
  const vertShader = compileShader(gl, gl.VERTEX_SHADER, vertexShader) || null;
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

export function createBuffers(
  gl: WebGLRenderingContext | null,
  program: WebGLProgram | null,
  geometry: BufferGeometry,
  usage = WebGLRenderingContext.DYNAMIC_DRAW
): Record<string, WebGLBuffer> {
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
    gl.bufferData(gl.ARRAY_BUFFER, attrib.data, usage);
    gl.enableVertexAttribArray(attribLoc);
    gl.vertexAttribPointer(attribLoc, attrib.recordSize, gl.FLOAT, false, 0, 0);
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
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, usage);
    buffers['_index'] = indexBuffer;
  }
  return buffers;
}

/**
 * Initialize this mesh inside a WebGLRenderingContext, does nothing if already initialized.
 * @param gl the WebGLRenderingContext
 * @param material the material, containing a vertex and fragment shader and uniform variables
 * @param geometry the buffer geometry
 * @returns the webgl program and buffers
 */
export function initMesh(
  gl: WebGLRenderingContext | null,
  material: Material,
  geometry: BufferGeometry
): WebGLData {
  if (!gl) {
    throw Error(ERRORS.WEBGL_INIT);
  }
  const { fragmentShader, vertexShader } = material;
  const program = createProgram(gl, vertexShader, fragmentShader);
  const uniformsProxy = wrapUniforms(gl, program, material.uniforms);
  material.uniforms = uniformsProxy;
  const buffers = createBuffers(gl, program, geometry);
  gl.useProgram(program);
  setUniforms(gl, program, material);
  return { program, buffers, material };
}

export function deleteBuffers(
  gl: WebGLRenderingContext | null,
  program: WebGLProgram | null,
  buffers: BufferCollection
): void {
  if (!gl || !program) {
    return;
  }
  for (const [key, buffer] of Object.entries(buffers)) {
    if (!key.startsWith('_')) {
      const loc = gl.getAttribLocation(program, key);
      gl.disableVertexAttribArray(loc);
    }
    gl.deleteBuffer(buffer);
    delete buffers[key];
  }
  return;
}

/**
 * Update a WebGL buffer
 * @param gl the WebGL context
 * @param buffer the WebGL buffer
 * @param newData the new data
 * @param offset offset (default = 0)
 */
export function updateBuffer(
  gl: WebGLRenderingContext | null,
  buffer: WebGLBuffer | null,
  newData: Float32Array,
  offset = 0
): void {
  if (gl && buffer !== null) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, offset, newData);
  }
}

export function setUniforms(
  gl: WebGLRenderingContext | null,
  program: WebGLProgram | null,
  material: Material
): void {
  if (!gl || !program) {
    throw Error(ERRORS.WEBGL_INIT);
  }
  gl.useProgram(program);
  for (const [name, value] of Object.entries(material.uniforms)) {
    setUniform(gl, program, name, value);
  }
}

/**
 * Call disableVertexAttribArray on each attribute
 *
 * @param gl the WebGL context
 * @param program the WebGL program
 * @param buffers the buffers record
 */
export function disableAttribs(
  gl: WebGLRenderingContext | null,
  program: WebGLProgram | null,
  buffers: BufferCollection
): void {
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
}

/**
 * enable attributes
 */
export function enableAttribs(
  gl: WebGLRenderingContext | null,
  program: WebGLProgram | null,
  buffers: BufferCollection,
  geometry: BufferGeometry
): void {
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
      gl.vertexAttribPointer(loc, attribute.recordSize, gl.FLOAT, false, 0, 0);
    }
  }
}

/**
 * Call drawElements or drawArrays
 */
export function draw(
  gl: WebGLRenderingContext | null,
  geometry: BufferGeometry,
  material: Material
): void {
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
    return;
  }
  // non-indexed geometries are drawn via drawArrays
  gl.drawArrays(material.drawMode, 0, geometry.count);
}

/**
 * Free attributes, buffers and delete the program and disconnect the mesh from the WebGL context
 */
export function disposeMesh(
  gl: WebGLRenderingContext | null,
  data: WebGLData
): void {
  const { program, buffers } = data;
  if (!gl || !program) {
    // no dispose necessary
    return;
  }
  deleteBuffers(gl, program, buffers);
  gl.deleteProgram(program);
  data.program = null;
  // release the ES6 proxy by cloning the uniforms object
  data.material.uniforms = { ...data.material.uniforms };
}
