/**
 * A fake WebGL2RenderingContext for unit tests. It records every call, counts
 * created/deleted objects and answers the introspection queries the renderer
 * relies on by parsing the shader sources:
 *
 * - active attributes: `in`/`attribute` declarations in the vertex shader
 * - active uniforms: `uniform` declarations in both shaders
 *
 * A shader whose source contains `COMPILE_ERROR` fails to compile.
 */

export type GLCall = { name: string; args: unknown[] };

type Counts = {
  programs: number;
  shaders: number;
  buffers: number;
  vertexArrays: number;
  textures: number;
};

export type FakeState = {
  calls: GLCall[];
  created: Counts;
  deleted: Counts;
  lost: boolean;
  /** all recorded calls of a method */
  callsTo(name: string): GLCall[];
  /** attribute location bound for a program by name (-1 if unbound) */
  attribLocation(program: WebGLProgram, name: string): number;
};

export type FakeWebGL2 = WebGL2RenderingContext & FakeState;

type Shader = { id: number; type: number; source: string };
type Program = {
  id: number;
  shaders: Shader[];
  attribLocations: Map<string, number>;
  uniformLocations: Map<string, WebGLUniformLocation>;
};

const GLSL_TYPES: Record<string, number> = {
  float: 0x1406,
  vec2: 0x8b50,
  vec3: 0x8b51,
  vec4: 0x8b52,
  int: 0x1404,
  ivec2: 0x8b53,
  ivec3: 0x8b54,
  ivec4: 0x8b55,
  bool: 0x8b56,
  bvec2: 0x8b57,
  bvec3: 0x8b58,
  bvec4: 0x8b59,
  uint: 0x1405,
  uvec2: 0x8dc6,
  uvec3: 0x8dc7,
  uvec4: 0x8dc8,
  mat2: 0x8b5a,
  mat3: 0x8b5b,
  mat4: 0x8b5c,
  sampler2D: 0x8b5e,
  samplerCube: 0x8b60,
};

const CONSTANTS = {
  DEPTH_BUFFER_BIT: 0x0100,
  COLOR_BUFFER_BIT: 0x4000,
  POINTS: 0,
  LINES: 1,
  TRIANGLES: 4,
  NONE: 0,
  BYTE: 0x1400,
  UNSIGNED_BYTE: 0x1401,
  SHORT: 0x1402,
  UNSIGNED_SHORT: 0x1403,
  INT: 0x1404,
  UNSIGNED_INT: 0x1405,
  FLOAT: 0x1406,
  RGBA: 0x1908,
  ARRAY_BUFFER: 0x8892,
  ELEMENT_ARRAY_BUFFER: 0x8893,
  STATIC_DRAW: 0x88e4,
  DYNAMIC_DRAW: 0x88e8,
  FRAGMENT_SHADER: 0x8b30,
  VERTEX_SHADER: 0x8b31,
  MAX_VERTEX_ATTRIBS: 0x8869,
  DEPTH_TEST: 0x0b71,
  BLEND: 0x0be2,
  CULL_FACE: 0x0b44,
  FRONT: 0x0404,
  BACK: 0x0405,
  SRC_ALPHA: 0x0302,
  ONE_MINUS_SRC_ALPHA: 0x0303,
  COMPILE_STATUS: 0x8b81,
  LINK_STATUS: 0x8b82,
  ACTIVE_UNIFORMS: 0x8b86,
  ACTIVE_ATTRIBUTES: 0x8b89,
  TEXTURE_2D: 0x0de1,
  TEXTURE0: 0x84c0,
  TEXTURE_MAG_FILTER: 0x2800,
  TEXTURE_MIN_FILTER: 0x2801,
  TEXTURE_WRAP_S: 0x2802,
  TEXTURE_WRAP_T: 0x2803,
  UNPACK_FLIP_Y_WEBGL: 0x9240,
  SRGB8_ALPHA8: 0x8c43,
};

const ATTRIBUTE_RE =
  /^\s*(?:layout\s*\([^)]*\)\s*)?(?:in|attribute)\s+(?:(?:highp|mediump|lowp)\s+)?(\w+)\s+(\w+)\s*;/gm;
const UNIFORM_RE =
  /^\s*uniform\s+(?:(?:highp|mediump|lowp)\s+)?(\w+)\s+(\w+)(?:\s*\[\s*(\d+)\s*\])?\s*;/gm;

function activeAttributes(program: Program): WebGLActiveInfo[] {
  const vertex = program.shaders.find(
    (s) => s.type === CONSTANTS.VERTEX_SHADER
  );
  if (!vertex) {
    return [];
  }
  return [...vertex.source.matchAll(ATTRIBUTE_RE)].map(([, type, name]) => ({
    name,
    type: GLSL_TYPES[type] ?? 0,
    size: 1,
  }));
}

function activeUniforms(program: Program): WebGLActiveInfo[] {
  const seen = new Set<string>();
  const result: WebGLActiveInfo[] = [];
  for (const shader of program.shaders) {
    for (const [, type, name, size] of shader.source.matchAll(UNIFORM_RE)) {
      if (seen.has(name)) {
        continue;
      }
      seen.add(name);
      result.push({
        name: size ? `${name}[0]` : name,
        type: GLSL_TYPES[type] ?? 0,
        size: size ? parseInt(size, 10) : 1,
      });
    }
  }
  return result;
}

class FakeContext {
  calls: GLCall[] = [];
  created: Counts = {
    programs: 0,
    shaders: 0,
    buffers: 0,
    vertexArrays: 0,
    textures: 0,
  };
  deleted: Counts = {
    programs: 0,
    shaders: 0,
    buffers: 0,
    vertexArrays: 0,
    textures: 0,
  };
  lost = false;
  drawingBufferWidth = 0;
  drawingBufferHeight = 0;

  private nextId = 1;

  constructor() {
    Object.assign(this, CONSTANTS);
  }

  callsTo(name: string): GLCall[] {
    return this.calls.filter((call) => call.name === name);
  }

  attribLocation(program: WebGLProgram, name: string): number {
    return (program as unknown as Program).attribLocations.get(name) ?? -1;
  }

  record(name: string, args: unknown[]): void {
    this.calls.push({ name, args });
  }

  // --- shaders & programs

  createShader(type: number): Shader {
    this.record('createShader', [type]);
    this.created.shaders++;
    return { id: this.nextId++, type, source: '' };
  }

  shaderSource(shader: Shader, source: string): void {
    this.record('shaderSource', [shader, source]);
    shader.source = source;
  }

  compileShader(shader: Shader): void {
    this.record('compileShader', [shader]);
  }

  getShaderParameter(shader: Shader, pname: number): boolean {
    if (pname === CONSTANTS.COMPILE_STATUS) {
      return !shader.source.includes('COMPILE_ERROR');
    }
    return true;
  }

  getShaderInfoLog(): string {
    return 'fake compile error';
  }

  deleteShader(shader: Shader): void {
    this.record('deleteShader', [shader]);
    this.deleted.shaders++;
  }

  createProgram(): Program {
    this.record('createProgram', []);
    this.created.programs++;
    return {
      id: this.nextId++,
      shaders: [],
      attribLocations: new Map(),
      uniformLocations: new Map(),
    };
  }

  attachShader(program: Program, shader: Shader): void {
    this.record('attachShader', [program, shader]);
    program.shaders.push(shader);
  }

  linkProgram(program: Program): void {
    this.record('linkProgram', [program]);
  }

  getProgramParameter(program: Program, pname: number): boolean | number {
    switch (pname) {
      case CONSTANTS.LINK_STATUS:
        return true;
      case CONSTANTS.ACTIVE_ATTRIBUTES:
        return activeAttributes(program).length;
      case CONSTANTS.ACTIVE_UNIFORMS:
        return activeUniforms(program).length;
    }
    return 0;
  }

  getProgramInfoLog(): string {
    return '';
  }

  getActiveAttrib(program: Program, index: number): WebGLActiveInfo | null {
    return activeAttributes(program)[index] ?? null;
  }

  getActiveUniform(program: Program, index: number): WebGLActiveInfo | null {
    return activeUniforms(program)[index] ?? null;
  }

  bindAttribLocation(program: Program, location: number, name: string): void {
    this.record('bindAttribLocation', [program, location, name]);
    program.attribLocations.set(name, location);
  }

  getAttribLocation(program: Program, name: string): number {
    return program.attribLocations.get(name) ?? -1;
  }

  getUniformLocation(
    program: Program,
    name: string
  ): WebGLUniformLocation | null {
    const base = name.replace(/\[0\]$/, '');
    if (
      !activeUniforms(program).some(
        (u) => u.name.replace(/\[0\]$/, '') === base
      )
    ) {
      return null;
    }
    let location = program.uniformLocations.get(base);
    if (!location) {
      location = { program: program.id, name: base } as WebGLUniformLocation;
      program.uniformLocations.set(base, location);
    }
    return location;
  }

  useProgram(program: Program | null): void {
    this.record('useProgram', [program]);
  }

  deleteProgram(program: Program): void {
    this.record('deleteProgram', [program]);
    this.deleted.programs++;
  }

  // --- objects

  createBuffer(): WebGLBuffer {
    this.record('createBuffer', []);
    this.created.buffers++;
    return { id: this.nextId++ } as unknown as WebGLBuffer;
  }

  deleteBuffer(buffer: WebGLBuffer): void {
    this.record('deleteBuffer', [buffer]);
    this.deleted.buffers++;
  }

  createVertexArray(): WebGLVertexArrayObject {
    this.record('createVertexArray', []);
    this.created.vertexArrays++;
    return { id: this.nextId++ } as unknown as WebGLVertexArrayObject;
  }

  deleteVertexArray(vao: WebGLVertexArrayObject): void {
    this.record('deleteVertexArray', [vao]);
    this.deleted.vertexArrays++;
  }

  createTexture(): WebGLTexture {
    this.record('createTexture', []);
    this.created.textures++;
    return { id: this.nextId++ } as unknown as WebGLTexture;
  }

  deleteTexture(texture: WebGLTexture): void {
    this.record('deleteTexture', [texture]);
    this.deleted.textures++;
  }

  // --- queries

  getParameter(pname: number): number {
    if (pname === CONSTANTS.MAX_VERTEX_ATTRIBS) {
      return 16;
    }
    return 0;
  }

  getExtension(name: string): unknown {
    if (name === 'WEBGL_lose_context') {
      return {
        loseContext: () => {
          this.lost = true;
        },
      };
    }
    return null;
  }
}

/**
 * Create a fake WebGL2 context. Methods not implemented above (uniform
 * setters, bindBuffer, draw calls, ...) are recorded and return undefined.
 */
export function createFakeWebGL2(): FakeWebGL2 {
  const context = new FakeContext();
  const proxy = new Proxy(context, {
    get(target, prop) {
      if (prop in target) {
        const value = Reflect.get(target, prop);
        return typeof value === 'function' ? value.bind(target) : value;
      }
      if (typeof prop !== 'string') {
        return undefined;
      }
      return (...args: unknown[]) => {
        target.record(prop, args);
      };
    },
  });
  return proxy as unknown as FakeWebGL2;
}

/** A minimal canvas stand-in whose `getContext('webgl2')` returns `gl` */
export function createFakeCanvas(gl: FakeWebGL2 | null): HTMLCanvasElement {
  return {
    width: 0,
    height: 0,
    getContext: () => gl,
  } as unknown as HTMLCanvasElement;
}
