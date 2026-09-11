import { BufferAttribute, BufferGeometry } from '../geometries';
import { Color, Matrix, Vector } from '../utils';
import {
  createFakeCanvas,
  createFakeWebGL2,
  type FakeWebGL2,
} from '../test-utils/fake-webgl2';
import { createShaderMaterial } from './material';
import { Mesh } from './mesh';
import { Renderer } from './renderer';
import { Texture } from './texture';

const VERTEX_SHADER = `#version 300 es
in vec3 position;
in vec2 uv;
in float custom;
uniform mat4 modelMatrix;
void main() { gl_Position = modelMatrix * vec4(position, 1.0); }`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform float time;
uniform vec2 offset;
uniform ivec2 grid;
uniform vec4 color;
uniform sampler2D map;
uniform sampler2D map2;
out vec4 fragColor;
void main() { fragColor = color; }`;

function createTriangle(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]), 3)
  );
  geometry.setAttribute(
    'uv',
    new BufferAttribute(new Float32Array([0, 0, 1, 0, 0.5, 1]), 2)
  );
  return geometry;
}

function createImage(): ImageData {
  return { width: 1, height: 1, data: new Uint8ClampedArray(4) } as ImageData;
}

describe('Renderer', () => {
  let gl: FakeWebGL2;
  let renderer: Renderer;

  beforeEach(() => {
    gl = createFakeWebGL2();
    renderer = new Renderer(createFakeCanvas(gl));
  });

  test('throws when no WebGL2 context is available', () => {
    expect(() => new Renderer(createFakeCanvas(null))).toThrow(
      /WebGL2 context/
    );
  });

  test('throws with the info log when a shader fails to compile', () => {
    const material = createShaderMaterial(VERTEX_SHADER, 'COMPILE_ERROR');
    const mesh = new Mesh(createTriangle(), material);
    expect(() => renderer.render([mesh])).toThrow(/fake compile error/);
  });

  test('compiles one program per material, shared by all meshes', () => {
    const material = createShaderMaterial(VERTEX_SHADER, FRAGMENT_SHADER);
    const a = new Mesh(createTriangle(), material);
    const b = new Mesh(createTriangle(), material);
    renderer.render([a, b]);
    renderer.render([a, b]);
    expect(gl.created.programs).toBe(1);
    expect(gl.callsTo('useProgram')).toHaveLength(1);
    expect(gl.callsTo('drawArrays')).toHaveLength(4);
  });

  test('creates one VAO and one buffer per attribute per geometry', () => {
    const geometry = createTriangle();
    const a = new Mesh(
      geometry,
      createShaderMaterial(VERTEX_SHADER, FRAGMENT_SHADER)
    );
    const b = new Mesh(
      geometry,
      createShaderMaterial(VERTEX_SHADER, FRAGMENT_SHADER)
    );
    renderer.render([a, b]);
    renderer.render([a, b]);
    expect(gl.created.programs).toBe(2);
    expect(gl.created.vertexArrays).toBe(1);
    expect(gl.created.buffers).toBe(2);
    expect(gl.callsTo('bufferData')).toHaveLength(2);
  });

  test('uploads an index buffer for indexed geometries and draws with drawElements', () => {
    const geometry = createTriangle().setIndex([0, 1, 2]);
    renderer.render([
      new Mesh(geometry, createShaderMaterial(VERTEX_SHADER, FRAGMENT_SHADER)),
    ]);
    expect(gl.created.buffers).toBe(3);
    const [call] = gl.callsTo('drawElements');
    expect(call.args).toEqual([gl.TRIANGLES, 3, gl.UNSIGNED_SHORT, 0]);
    expect(gl.callsTo('drawArrays')).toHaveLength(0);
  });

  test('binds attribute locations by convention before linking', () => {
    const geometry = createTriangle();
    geometry.setAttribute(
      'custom',
      new BufferAttribute(new Float32Array([1, 2, 3]), 1)
    );
    const material = createShaderMaterial(VERTEX_SHADER, FRAGMENT_SHADER);
    renderer.render([new Mesh(geometry, material)]);

    const program = gl.callsTo('createProgram').length;
    expect(program).toBe(1);
    const bound = gl
      .callsTo('bindAttribLocation')
      .map(({ args }) => [args[1], args[2]]);
    expect(bound).toEqual([
      [0, 'position'],
      [2, 'uv'],
      [3, 'custom'],
    ]);
    // relinked after binding
    expect(gl.callsTo('linkProgram')).toHaveLength(2);

    const pointers = gl
      .callsTo('vertexAttribPointer')
      .map(({ args }) => [args[0], args[1]]);
    expect(pointers).toEqual([
      [0, 3],
      [2, 2],
      [3, 1],
    ]);
  });

  test('chooses the uniform setter from the declared GLSL type', () => {
    const material = createShaderMaterial(VERTEX_SHADER, FRAGMENT_SHADER, {
      time: 1.5,
      offset: new Vector(0.5, 0.25),
      grid: new Vector(4, 2),
      color: Color.fromHex('#ff0000'),
      modelMatrix: Matrix.identity(4),
      unused: 42,
    });
    renderer.render([new Mesh(createTriangle(), material)]);

    const uploads = gl.calls
      .filter(({ name }) => name.startsWith('uniform'))
      .map(({ name, args }) => [name, ...args.slice(1)]);
    expect(uploads).toEqual([
      ['uniform1fv', [1.5], 0, 1],
      ['uniform2fv', [0.5, 0.25], 0, 2],
      ['uniform2iv', [4, 2], 0, 2],
      ['uniform4fv', [1, 0, 0, 1], 0, 4],
      ['uniformMatrix4fv', false, Matrix.identity(4).values, 0, 16],
    ]);
  });

  test('skips uniforms that did not change since the last draw', () => {
    const material = createShaderMaterial(VERTEX_SHADER, FRAGMENT_SHADER, {
      time: 1,
      offset: new Vector(1, 2),
    });
    const mesh = new Mesh(createTriangle(), material);
    renderer.render([mesh]);
    renderer.render([mesh]);
    expect(gl.callsTo('uniform1fv')).toHaveLength(1);
    expect(gl.callsTo('uniform2fv')).toHaveLength(1);

    material.uniforms.time = 2;
    (material.uniforms.offset as Vector).x = 3;
    renderer.render([mesh]);
    expect(gl.callsTo('uniform1fv')).toHaveLength(2);
    expect(gl.callsTo('uniform2fv')).toHaveLength(2);
    expect(gl.callsTo('uniform2fv')[1].args[1]).toEqual([3, 2]);
  });

  test('uploads textures on first use and assigns texture units per draw', () => {
    const map = new Texture(createImage());
    const map2 = new Texture(createImage());
    const material = createShaderMaterial(VERTEX_SHADER, FRAGMENT_SHADER, {
      map,
      map2,
    });
    const mesh = new Mesh(createTriangle(), material);
    renderer.render([mesh]);
    renderer.render([mesh]);

    expect(gl.created.textures).toBe(2);
    expect(gl.callsTo('texImage2D')).toHaveLength(2);
    expect(gl.callsTo('texParameteri')).toHaveLength(8);
    expect(map.needsUpdate).toBe(false);

    const units = gl.callsTo('activeTexture').map(({ args }) => args[0]);
    expect(units).toEqual([
      gl.TEXTURE0,
      gl.TEXTURE0 + 1,
      gl.TEXTURE0,
      gl.TEXTURE0 + 1,
    ]);
    const samplers = gl.callsTo('uniform1iv').map(({ args }) => args[1]);
    expect(samplers).toEqual([[0], [1]]);
  });

  test('re-uploads a texture flagged with needsUpdate', () => {
    const map = new Texture(createImage());
    const mesh = new Mesh(
      createTriangle(),
      createShaderMaterial(VERTEX_SHADER, FRAGMENT_SHADER, { map })
    );
    renderer.render([mesh]);
    map.needsUpdate = true;
    renderer.render([mesh]);
    expect(gl.created.textures).toBe(1);
    expect(gl.callsTo('texImage2D')).toHaveLength(2);
    expect(map.needsUpdate).toBe(false);
  });

  test('re-uploads an attribute flagged with needsUpdate via bufferSubData', () => {
    const geometry = createTriangle();
    const mesh = new Mesh(
      geometry,
      createShaderMaterial(VERTEX_SHADER, FRAGMENT_SHADER)
    );
    renderer.render([mesh]);
    const { position } = geometry.attributes;
    position.data[0] = 5;
    position.needsUpdate = true;
    renderer.render([mesh]);
    renderer.render([mesh]);

    expect(gl.callsTo('bufferSubData')).toHaveLength(1);
    expect(gl.callsTo('bufferSubData')[0].args[2]).toBe(position.data);
    expect(position.needsUpdate).toBe(false);
    expect(gl.created.buffers).toBe(2);
  });

  test('reallocates the buffer when the attribute data changed size', () => {
    const geometry = createTriangle();
    const mesh = new Mesh(
      geometry,
      createShaderMaterial(VERTEX_SHADER, FRAGMENT_SHADER)
    );
    renderer.render([mesh]);
    const { position } = geometry.attributes;
    position.data = new Float32Array(18);
    position.needsUpdate = true;
    renderer.render([mesh]);

    expect(gl.callsTo('bufferSubData')).toHaveLength(0);
    expect(gl.callsTo('bufferData')).toHaveLength(3);
    expect(gl.created.buffers).toBe(2);
  });

  test('rebuilds the VAO when the geometry version changes', () => {
    const geometry = createTriangle();
    const mesh = new Mesh(
      geometry,
      createShaderMaterial(VERTEX_SHADER, FRAGMENT_SHADER)
    );
    renderer.render([mesh]);
    geometry.setAttribute(
      'custom',
      new BufferAttribute(new Float32Array([1, 2, 3]), 1)
    );
    renderer.render([mesh]);

    expect(gl.deleted.vertexArrays).toBe(1);
    expect(gl.deleted.buffers).toBe(2);
    expect(gl.created.vertexArrays).toBe(2);
    expect(gl.created.buffers).toBe(5);
  });

  test('recompiles the program when the shader source changes', () => {
    const material = createShaderMaterial(VERTEX_SHADER, FRAGMENT_SHADER);
    const mesh = new Mesh(createTriangle(), material);
    renderer.render([mesh]);
    material.fragmentShader = FRAGMENT_SHADER + '\n// changed';
    renderer.render([mesh]);
    expect(gl.created.programs).toBe(2);
    expect(gl.deleted.programs).toBe(1);
  });

  test('dispose(object) frees the resources of a single object', () => {
    const geometry = createTriangle();
    const map = new Texture(createImage());
    const material = createShaderMaterial(VERTEX_SHADER, FRAGMENT_SHADER, {
      map,
    });
    const mesh = new Mesh(geometry, material);
    renderer.render([mesh]);

    renderer.dispose(geometry);
    expect(gl.deleted.vertexArrays).toBe(1);
    expect(gl.deleted.buffers).toBe(2);

    renderer.dispose(material);
    expect(gl.deleted.programs).toBe(1);

    renderer.dispose(map);
    expect(gl.deleted.textures).toBe(1);

    // disposing again is a no-op, rendering recreates everything
    renderer.dispose(geometry);
    renderer.render([mesh]);
    expect(gl.created.vertexArrays).toBe(2);
    expect(gl.created.programs).toBe(2);
    expect(gl.created.textures).toBe(2);
    expect(gl.lost).toBe(false);
  });

  test('dispose() frees everything and loses the context', () => {
    const map = new Texture(createImage());
    const meshes = [
      new Mesh(
        createTriangle(),
        createShaderMaterial(VERTEX_SHADER, FRAGMENT_SHADER, { map })
      ),
      new Mesh(
        createTriangle().setIndex([0, 1, 2]),
        createShaderMaterial(VERTEX_SHADER, FRAGMENT_SHADER)
      ),
    ];
    renderer.render(meshes);
    renderer.dispose();

    expect(gl.deleted).toEqual(gl.created);
    expect(gl.lost).toBe(true);
  });

  test('setSize applies the pixel ratio and sets the viewport', () => {
    renderer.setPixelRatio(2).setSize(100, 50);
    expect(renderer.canvas.width).toBe(200);
    expect(renderer.canvas.height).toBe(100);
    expect(gl.callsTo('viewport')).toHaveLength(1);
  });
});
