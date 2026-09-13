import { BufferAttribute, BufferGeometry } from '../geometries';
import { Color, Mat4, Matrix, Vector } from '../utils';
import {
  createFakeCanvas,
  createFakeWebGL2,
  type FakeWebGL2,
} from '../test-utils/fake-webgl2';
import { createShaderMaterial } from '../scene/material';
import { Mesh } from '../scene/mesh';
import { Object3D } from '../scene/object3d';
import { Scene } from '../scene/scene';
import { PerspectiveCamera } from '../scene/camera';
import { Texture } from '../scene/texture';
import { DrawMode, Filter, Wrapping } from '../scene/constants';
import { WebGL2Renderer } from './webgl2-renderer';

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

function expectClose(actual: ArrayLike<number>, expected: ArrayLike<number>) {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], 5);
  }
}

function createImage(): ImageData {
  return { width: 1, height: 1, data: new Uint8ClampedArray(4) } as ImageData;
}

describe('WebGL2Renderer', () => {
  let gl: FakeWebGL2;
  let renderer: WebGL2Renderer;

  /** render the meshes as children of a fresh scene with a default camera */
  const draw = (...meshes: Mesh[]) => {
    const scene = new Scene();
    scene.add(...meshes);
    renderer.render(scene, new PerspectiveCamera());
  };

  beforeEach(() => {
    gl = createFakeWebGL2();
    renderer = new WebGL2Renderer(createFakeCanvas(gl));
  });

  test('throws when no WebGL2 context is available', () => {
    expect(() => new WebGL2Renderer(createFakeCanvas(null))).toThrow(
      /WebGL2 context/
    );
  });

  test('throws when a material has no GLSL source', () => {
    const mesh = new Mesh(createTriangle(), {
      drawMode: DrawMode.TRIANGLES,
      uniforms: {},
    });
    expect(() => draw(mesh)).toThrow(/glsl/);
  });

  test('maps the draw mode to the GL constant', () => {
    const material = createShaderMaterial(
      VERTEX_SHADER,
      FRAGMENT_SHADER,
      {},
      DrawMode.LINES
    );
    draw(new Mesh(createTriangle(), material));
    expect(gl.callsTo('drawArrays')[0].args).toEqual([gl.LINES, 0, 3]);
  });

  test('throws with the info log when a shader fails to compile', () => {
    const material = createShaderMaterial(VERTEX_SHADER, 'COMPILE_ERROR');
    const mesh = new Mesh(createTriangle(), material);
    expect(() => draw(mesh)).toThrow(/fake compile error/);
  });

  test('compiles one program per material, shared by all meshes', () => {
    const material = createShaderMaterial(VERTEX_SHADER, FRAGMENT_SHADER);
    const a = new Mesh(createTriangle(), material);
    const b = new Mesh(createTriangle(), material);
    draw(a, b);
    draw(a, b);
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
    draw(a, b);
    draw(a, b);
    expect(gl.created.programs).toBe(2);
    expect(gl.created.vertexArrays).toBe(1);
    expect(gl.created.buffers).toBe(2);
    expect(gl.callsTo('bufferData')).toHaveLength(2);
  });

  test('uploads an index buffer for indexed geometries and draws with drawElements', () => {
    const geometry = createTriangle().setIndex([0, 1, 2]);
    draw(
      new Mesh(geometry, createShaderMaterial(VERTEX_SHADER, FRAGMENT_SHADER))
    );
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
    draw(new Mesh(geometry, material));

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

  test('derives the GL component type and normalized flag per attribute', () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new BufferAttribute(
        new Int16Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]),
        3,
        true
      )
    );
    geometry.setAttribute(
      'uv',
      new BufferAttribute(new Uint8Array([0, 0, 1, 0, 0, 1]), 2, true)
    );
    geometry.setAttribute(
      'custom',
      new BufferAttribute(new Float32Array([1, 2, 3]), 1)
    );
    const material = createShaderMaterial(VERTEX_SHADER, FRAGMENT_SHADER);
    draw(new Mesh(geometry, material));

    const pointers = gl
      .callsTo('vertexAttribPointer')
      .map(({ args }) => [args[0], args[2], args[3]]);
    expect(pointers).toEqual([
      [0, gl.SHORT, true], // position
      [2, gl.UNSIGNED_BYTE, true], // uv
      [3, gl.FLOAT, false], // custom
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
    draw(new Mesh(createTriangle(), material));

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
    draw(mesh);
    draw(mesh);
    expect(gl.callsTo('uniform1fv')).toHaveLength(1);
    expect(gl.callsTo('uniform2fv')).toHaveLength(1);

    material.uniforms.time = 2;
    (material.uniforms.offset as Vector).x = 3;
    draw(mesh);
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
    draw(mesh);
    draw(mesh);

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

  test('maps filter and wrapping modes to GL constants', () => {
    const map = new Texture(createImage(), {
      minFilter: Filter.LINEAR_MIPMAP_LINEAR,
      magFilter: Filter.LINEAR,
      wrapS: Wrapping.REPEAT,
      wrapT: Wrapping.MIRRORED_REPEAT,
    });
    const mesh = new Mesh(
      createTriangle(),
      createShaderMaterial(VERTEX_SHADER, FRAGMENT_SHADER, { map })
    );
    draw(mesh);
    const params = gl.callsTo('texParameteri').map(({ args }) => args[2]);
    expect(params).toEqual([0x2703, 0x2601, 0x2901, 0x8370]);
    expect(gl.callsTo('generateMipmap')).toHaveLength(1);
  });

  test('re-uploads a texture flagged with needsUpdate', () => {
    const map = new Texture(createImage());
    const mesh = new Mesh(
      createTriangle(),
      createShaderMaterial(VERTEX_SHADER, FRAGMENT_SHADER, { map })
    );
    draw(mesh);
    map.needsUpdate = true;
    draw(mesh);
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
    draw(mesh);
    const { position } = geometry.attributes;
    position.data[0] = 5;
    position.needsUpdate = true;
    draw(mesh);
    draw(mesh);

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
    draw(mesh);
    const { position } = geometry.attributes;
    position.data = new Float32Array(18);
    position.needsUpdate = true;
    draw(mesh);

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
    draw(mesh);
    geometry.setAttribute(
      'custom',
      new BufferAttribute(new Float32Array([1, 2, 3]), 1)
    );
    draw(mesh);

    expect(gl.deleted.vertexArrays).toBe(1);
    expect(gl.deleted.buffers).toBe(2);
    expect(gl.created.vertexArrays).toBe(2);
    expect(gl.created.buffers).toBe(5);
  });

  test('recompiles the program when the shader source changes', () => {
    const material = createShaderMaterial(VERTEX_SHADER, FRAGMENT_SHADER);
    const mesh = new Mesh(createTriangle(), material);
    draw(mesh);
    material.glsl!.fragment = FRAGMENT_SHADER + '\n// changed';
    draw(mesh);
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
    draw(mesh);

    renderer.dispose(geometry);
    expect(gl.deleted.vertexArrays).toBe(1);
    expect(gl.deleted.buffers).toBe(2);

    renderer.dispose(material);
    expect(gl.deleted.programs).toBe(1);

    renderer.dispose(map);
    expect(gl.deleted.textures).toBe(1);

    // disposing again is a no-op, rendering recreates everything
    renderer.dispose(geometry);
    draw(mesh);
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
    draw(...meshes);
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
  test('enables depth testing and clears color and depth per frame', () => {
    expect(gl.callsTo('enable').map(({ args }) => args[0])).toEqual([
      gl.DEPTH_TEST,
    ]);
    const mesh = new Mesh(
      createTriangle(),
      createShaderMaterial(VERTEX_SHADER, FRAGMENT_SHADER)
    );
    draw(mesh);
    expect(gl.callsTo('clear')[0].args).toEqual([
      gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT,
    ]);
    renderer.autoClear = false;
    draw(mesh);
    expect(gl.callsTo('clear')).toHaveLength(1);
  });

  test('setClearColor accepts hex strings and Colors', () => {
    renderer.setClearColor('#ff0000');
    renderer.setClearColor(new Color(0, 255, 0, 0), 0.5);
    expect(gl.callsTo('clearColor').map(({ args }) => args)).toEqual([
      [1, 0, 0, 1],
      [0, 1, 0, 0.5],
    ]);
  });

  test('draws visible meshes depth-first and skips invisible subtrees', () => {
    const material = createShaderMaterial(VERTEX_SHADER, FRAGMENT_SHADER);
    const scene = new Scene();
    const group = new Object3D();
    const a = new Mesh(createTriangle(), material);
    const b = new Mesh(createTriangle(), material);
    const hidden = new Mesh(createTriangle(), material);
    const childOfHidden = new Mesh(createTriangle(), material);
    hidden.visible = false;
    hidden.add(childOfHidden);
    group.add(a, hidden);
    scene.add(group, b);
    b.visible = false;

    renderer.render(scene, new PerspectiveCamera());
    expect(gl.callsTo('drawArrays')).toHaveLength(1);
    expect(gl.created.vertexArrays).toBe(1);
  });

  test('injects the built-in matrix uniforms from the scene graph and camera', () => {
    const vertex = `#version 300 es
in vec3 position;
in vec3 normal;
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform mat3 normalMatrix;
void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
    const material = createShaderMaterial(vertex, FRAGMENT_SHADER);
    const scene = new Scene();
    const parent = new Object3D();
    const mesh = new Mesh(createTriangle(), material);
    parent.position.set(1, 0, 0);
    mesh.position.set(0, 2, 0);
    mesh.scale.set(2, 2, 2);
    parent.add(mesh);
    scene.add(parent);
    const camera = new PerspectiveCamera(90, 1, 1, 10);
    camera.position.set(0, 0, 5);

    renderer.render(scene, camera);

    const mat4 = new Map(
      gl.callsTo('uniformMatrix4fv').map(({ args }) => {
        const location = args[0] as { name: string };
        return [location.name, Array.from(args[2] as Float32Array)];
      })
    );
    expect([...mat4.keys()].sort()).toEqual([
      'modelMatrix',
      'modelViewMatrix',
      'projectionMatrix',
      'viewMatrix',
    ]);
    expectClose(
      mat4.get('modelMatrix')!,
      Mat4.translation(1, 2, 0).multiply(Mat4.scaling(2, 2, 2)).values
    );
    expectClose(mat4.get('viewMatrix')!, Mat4.translation(0, 0, -5).values);
    expectClose(
      mat4.get('projectionMatrix')!,
      Mat4.perspective(90, 1, 1, 10).values
    );
    expectClose(
      mat4.get('modelViewMatrix')!,
      Mat4.translation(1, 2, -5).multiply(Mat4.scaling(2, 2, 2)).values
    );

    const [normal] = gl.callsTo('uniformMatrix3fv');
    expect((normal.args[0] as { name: string }).name).toBe('normalMatrix');
    // inverse transpose of a uniform scale by 2 is a uniform scale by 0.5
    expectClose(
      normal.args[2] as Float32Array,
      [0.5, 0, 0, 0, 0.5, 0, 0, 0, 0.5]
    );

    // nothing changed: nothing is re-uploaded
    renderer.render(scene, camera);
    expect(gl.callsTo('uniformMatrix4fv')).toHaveLength(4);
    expect(gl.callsTo('uniformMatrix3fv')).toHaveLength(1);

    // moving the mesh re-uploads the model matrices only
    mesh.position.x = 5;
    renderer.render(scene, camera);
    const names = gl
      .callsTo('uniformMatrix4fv')
      .slice(4)
      .map(({ args }) => (args[0] as { name: string }).name);
    expect(names).toEqual(['modelMatrix', 'modelViewMatrix']);
  });

  test('material uniforms take precedence over built-in uniforms', () => {
    const vertex = `#version 300 es
in vec3 position;
uniform mat4 projectionMatrix;
void main() { gl_Position = projectionMatrix * vec4(position, 1.0); }`;
    const projectionMatrix = Matrix.identity(4);
    const material = createShaderMaterial(vertex, FRAGMENT_SHADER, {
      projectionMatrix,
    });
    draw(new Mesh(createTriangle(), material));
    const uploads = gl.callsTo('uniformMatrix4fv');
    expect(uploads).toHaveLength(1);
    expect(uploads[0].args[2]).toBe(projectionMatrix.values);
  });

  test('uploads Mat4 uniforms without copying', () => {
    const matrix = Mat4.rotX(1);
    const material = createShaderMaterial(VERTEX_SHADER, FRAGMENT_SHADER, {
      modelMatrix: matrix,
    });
    draw(new Mesh(createTriangle(), material));
    expect(gl.callsTo('uniformMatrix4fv')[0].args[2]).toBe(matrix.values);
  });
});
