import { Color, Matrix, Vector } from '../utils';
import { createFakeWebGL2, type FakeWebGL2 } from '../test-utils/fake-webgl2';
import { setUniform, uniformToArray } from './uniforms';

describe('uniformToArray', () => {
  test('flattens all supported value types', () => {
    expect(uniformToArray(1)).toEqual([1]);
    expect(uniformToArray(2n)).toEqual([2]);
    expect(uniformToArray([1, 2, 3])).toEqual([1, 2, 3]);
    expect(uniformToArray([1n, 2n])).toEqual([1, 2]);
    expect(
      uniformToArray([
        [1, 2],
        [3, 4],
      ])
    ).toEqual([1, 2, 3, 4]);
    expect(uniformToArray(new Vector(1, 2))).toEqual([1, 2]);
    expect(uniformToArray(Matrix.identity(2))).toEqual([1, 0, 0, 1]);
    expect(uniformToArray(Color.fromHex('#00ff00'))).toEqual([0, 1, 0, 1]);
  });
});

describe('setUniform', () => {
  let gl: FakeWebGL2;
  let program: WebGLProgram;

  beforeEach(() => {
    gl = createFakeWebGL2();
    program = gl.createProgram();
    const shader = gl.createShader(gl.FRAGMENT_SHADER) as WebGLShader;
    gl.shaderSource(
      shader,
      `uniform vec3 position;
       uniform ivec3 cell;
       uniform mat3 m;
       uniform float weights[3];`
    );
    gl.attachShader(program, shader);
  });

  test('uses float setters for float uniforms', () => {
    expect(setUniform(gl, program, 'position', new Vector(0.5, 1.5, 2.5))).toBe(
      true
    );
    expect(gl.callsTo('uniform3fv')[0].args.slice(1)).toEqual([
      [0.5, 1.5, 2.5],
      0,
      3,
    ]);
  });

  test('uses integer setters for integer uniforms', () => {
    setUniform(gl, program, 'cell', new Vector(1, 2, 3));
    expect(gl.callsTo('uniform3iv')[0].args.slice(1)).toEqual([
      [1, 2, 3],
      0,
      3,
    ]);
  });

  test('uploads array uniforms as a whole', () => {
    setUniform(gl, program, 'weights', [0.1, 0.2, 0.3]);
    expect(gl.callsTo('uniform1fv')[0].args.slice(1)).toEqual([
      [0.1, 0.2, 0.3],
      0,
      3,
    ]);
  });

  test('ignores surplus values but rejects missing ones', () => {
    setUniform(gl, program, 'position', Color.fromHex('#ffffff'));
    expect(gl.callsTo('uniform3fv')[0].args.slice(1)).toEqual([
      [1, 1, 1, 1],
      0,
      3,
    ]);
    expect(() => setUniform(gl, program, 'm', [1, 2, 3])).toThrow(/expects 9/);
  });

  test('returns false for unknown uniforms', () => {
    expect(setUniform(gl, program, 'nope', 1)).toBe(false);
  });
});
