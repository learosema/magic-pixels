import { Color } from '../utils';
import { createBoxGeometry } from '../geometries';
import {
  createFakeCanvas,
  createFakeWebGL2,
  type FakeWebGL2,
} from '../test-utils/fake-webgl2';
import { WebGL2Renderer } from '../webgl/webgl2-renderer';
import { PerspectiveCamera } from './camera';
import { AlphaMode, Side, ToneMapping } from './constants';
import { AmbientLight } from './light';
import {
  createFullscreenMaterial,
  createPbrMaterial,
  createToneMapMaterial,
  type PbrMaterialOptions,
} from './material';
import { Mesh } from './mesh';
import { Scene } from './scene';
import { Texture } from './texture';

const UNIFORM_RE = /^\s*uniform\s+\w+\s+(\w+)/gm;
const ATTRIBUTE_RE = /^\s*in\s+\w+\s+(\w+)\s*;/gm;
const DEFINE_RE = /^#define\s+(\w+)(?:\s+(\S+))?$/gm;

const BUILTIN_UNIFORMS = [
  'modelViewMatrix',
  'projectionMatrix',
  'normalMatrix',
  'ambientLightColor',
  'directionalLightDirections',
  'directionalLightColors',
  'directionalLightCount',
  'pointLightPositions',
  'pointLightColors',
  'pointLightRanges',
  'pointLightCount',
];

function createImage(): ImageData {
  return { width: 1, height: 1, data: new Uint8ClampedArray(4) } as ImageData;
}

/** the defines `createPbrMaterial` inserted, name -> value ('' if none) */
function definesOf(source: string): Map<string, string> {
  const [, ...lines] = source.split('\n');
  const block = lines.slice(
    0,
    lines.findIndex((l) => !l.startsWith('#'))
  );
  return new Map(
    [...block.join('\n').matchAll(DEFINE_RE)].map(([, name, value]) => [
      name,
      value ?? '',
    ])
  );
}

function names(source: string, re: RegExp): Set<string> {
  return new Set([...source.matchAll(re)].map(([, name]) => name));
}

/** every option combination worth compiling, by name */
const VARIANTS: Record<string, PbrMaterialOptions> = {
  plain: {},
  everyMap: {
    baseColorMap: new Texture(createImage()),
    metallicRoughnessMap: new Texture(createImage()),
    normalMap: new Texture(createImage()),
    occlusionMap: { texture: new Texture(createImage()), uv: 1 },
    emissiveMap: new Texture(createImage()),
  },
  tangentsAndColors: {
    normalMap: new Texture(createImage()),
    tangents: true,
    vertexColors: true,
  },
  mask: { alphaMode: AlphaMode.MASK, baseColorMap: new Texture(createImage()) },
  blend: { alphaMode: AlphaMode.BLEND, doubleSided: true },
  unlit: { unlit: true, vertexColors: true },
  linear: { linearOutput: true },
  lights: { maxDirectionalLights: 1, maxPointLights: 8 },
};

describe('createPbrMaterial', () => {
  test('defaults match the glTF material defaults', () => {
    const material = createPbrMaterial();
    expect(material.uniforms).toEqual({
      baseColorFactor: [1, 1, 1, 1],
      metallicFactor: 1,
      roughnessFactor: 1,
      emissiveFactor: [0, 0, 0],
      normalScale: 1,
      occlusionStrength: 1,
      alphaCutoff: 0.5,
    });
    expect(material.transparent).toBe(false);
    expect(material.side).toBe(Side.FRONT);
    expect(material.glsl!.vertex.startsWith('#version 300 es\n')).toBe(true);
    expect(material.glsl!.fragment.startsWith('#version 300 es\n')).toBe(true);
    expect([...definesOf(material.glsl!.fragment)]).toEqual([
      ['MAX_DIRECTIONAL_LIGHTS', '4'],
      ['MAX_POINT_LIGHTS', '4'],
    ]);
  });

  test('takes factors as arrays or Colors', () => {
    const material = createPbrMaterial({
      baseColorFactor: Color.fromHex('#ff0000'),
      emissiveFactor: [0.1, 0.2, 0.3],
      metallicFactor: 0,
      roughnessFactor: 0.5,
    });
    expect(material.uniforms.baseColorFactor).toEqual([1, 0, 0, 1]);
    expect(material.uniforms.emissiveFactor).toEqual([0.1, 0.2, 0.3]);
    expect(material.uniforms.metallicFactor).toBe(0);
    expect(material.uniforms.roughnessFactor).toBe(0.5);
    expect(() => createPbrMaterial({ emissiveFactor: [1] })).toThrow(
      /components/
    );
  });

  test('a map becomes a texture uniform and a define, with its UV set', () => {
    const map = new Texture(createImage());
    const occlusion = new Texture(createImage());
    const material = createPbrMaterial({
      baseColorMap: map,
      occlusionMap: { texture: occlusion, uv: 1 },
    });
    expect(material.uniforms.baseColorMap).toBe(map);
    expect(material.uniforms.occlusionMap).toBe(occlusion);
    expect(material.uniforms.normalMap).toBeUndefined();
    const defines = definesOf(material.glsl!.fragment);
    expect(defines.get('HAS_BASE_COLOR_MAP')).toBe('');
    expect(defines.get('BASE_COLOR_UV')).toBe('vUv');
    expect(defines.get('HAS_OCCLUSION_MAP')).toBe('');
    expect(defines.get('OCCLUSION_UV')).toBe('vUv1');
    expect(defines.has('HAS_UV1')).toBe(true);
    expect(defines.has('HAS_NORMAL_MAP')).toBe(false);
    // the same block goes into the vertex shader
    expect(definesOf(material.glsl!.vertex)).toEqual(defines);
  });

  test('alpha modes map to defines and render state', () => {
    const opaque = createPbrMaterial({ alphaMode: AlphaMode.OPAQUE });
    const mask = createPbrMaterial({
      alphaMode: AlphaMode.MASK,
      alphaCutoff: 0.3,
    });
    const blend = createPbrMaterial({ alphaMode: AlphaMode.BLEND });
    expect(definesOf(opaque.glsl!.fragment).has('ALPHA_MASK')).toBe(false);
    expect(definesOf(mask.glsl!.fragment).has('ALPHA_MASK')).toBe(true);
    expect(mask.uniforms.alphaCutoff).toBe(0.3);
    expect(mask.transparent).toBe(false);
    expect(definesOf(blend.glsl!.fragment).has('ALPHA_BLEND')).toBe(true);
    expect(blend.transparent).toBe(true);
  });

  test('doubleSided disables culling and flips the normal in the shader', () => {
    const material = createPbrMaterial({ doubleSided: true });
    expect(material.side).toBe(Side.DOUBLE);
    expect(definesOf(material.glsl!.fragment).has('DOUBLE_SIDED')).toBe(true);
  });

  test('vertex colours, tangents, unlit and light counts are defines', () => {
    const material = createPbrMaterial({
      vertexColors: true,
      tangents: true,
      unlit: true,
      maxDirectionalLights: 1,
      maxPointLights: 8,
    });
    const defines = definesOf(material.glsl!.vertex);
    expect(defines.has('HAS_VERTEX_COLOR')).toBe(true);
    expect(defines.has('HAS_TANGENT')).toBe(true);
    expect(defines.has('UNLIT')).toBe(true);
    expect(defines.get('MAX_DIRECTIONAL_LIGHTS')).toBe('1');
    expect(defines.get('MAX_POINT_LIGHTS')).toBe('8');
  });

  test('linearOutput is a define, off by default', () => {
    expect(
      definesOf(createPbrMaterial().glsl!.fragment).has('LINEAR_OUTPUT')
    ).toBe(false);
    const linear = createPbrMaterial({ linearOutput: true });
    expect(definesOf(linear.glsl!.fragment).has('LINEAR_OUTPUT')).toBe(true);
  });

  test('materials with the same options produce identical sources', () => {
    const map = new Texture(createImage());
    const a = createPbrMaterial({ baseColorMap: map, metallicFactor: 0 });
    const b = createPbrMaterial({ baseColorMap: map, metallicFactor: 1 });
    expect(a.glsl).toEqual(b.glsl);
    expect(createPbrMaterial({ tangents: true }).glsl).not.toEqual(a.glsl);
  });

  test('every uniform the material sets is declared by the shader, and vice versa', () => {
    const material = createPbrMaterial(VARIANTS.everyMap);
    const declared = names(material.glsl!.fragment, UNIFORM_RE);
    for (const name of Object.keys(material.uniforms)) {
      expect(declared.has(name), name).toBe(true);
    }
    for (const name of declared) {
      if (!BUILTIN_UNIFORMS.includes(name)) {
        expect(name in material.uniforms, name).toBe(true);
      }
    }
    const attributes = names(material.glsl!.vertex, ATTRIBUTE_RE);
    expect([...attributes]).toEqual([
      'position',
      'normal',
      'uv',
      'uv1',
      'color',
      'tangent',
    ]);
  });

  describe('against the fake context', () => {
    let gl: FakeWebGL2;
    let renderer: WebGL2Renderer;

    beforeEach(() => {
      gl = createFakeWebGL2();
      renderer = new WebGL2Renderer(createFakeCanvas(gl));
    });

    /** name of the uniform a recorded upload call went to */
    const uploaded = (): string[] =>
      gl.calls
        .filter(({ name }) => /^uniform(Matrix)?\d[fiu]v$/.test(name))
        .map(({ args }) => (args[0] as { name: string }).name);

    test.each(Object.entries(VARIANTS))(
      'compiles and renders the %s variant',
      (_, options) => {
        const material = createPbrMaterial(options);
        const scene = new Scene();
        scene.add(new AmbientLight(), new Mesh(createBoxGeometry(), material));
        renderer.render(scene, new PerspectiveCamera());
        expect(gl.created.programs).toBe(1);
        expect(gl.callsTo('drawElements')).toHaveLength(1);
        const names = uploaded();
        for (const name of Object.keys(material.uniforms)) {
          expect(names, name).toContain(name);
        }
        expect(names).toContain('ambientLightColor');
        expect(names).toContain('directionalLightCount');
      }
    );

    test('binds every map to its own texture unit', () => {
      const material = createPbrMaterial(VARIANTS.everyMap);
      const scene = new Scene();
      scene.add(new Mesh(createBoxGeometry(), material));
      renderer.render(scene, new PerspectiveCamera());
      const units = gl
        .callsTo('uniform1iv')
        .filter(({ args }) =>
          (args[0] as { name: string }).name.endsWith('Map')
        )
        .map(({ args }) => (args[1] as number[])[0]);
      expect(units).toEqual([0, 1, 2, 3, 4]);
      expect(gl.created.textures).toBe(5);
    });

    test('two materials with the same maps share one program', () => {
      const map = new Texture(createImage());
      const scene = new Scene();
      scene.add(
        new Mesh(createBoxGeometry(), createPbrMaterial({ baseColorMap: map })),
        new Mesh(
          createBoxGeometry(),
          createPbrMaterial({ baseColorMap: map, roughnessFactor: 0.1 })
        ),
        new Mesh(createBoxGeometry(), createPbrMaterial())
      );
      renderer.render(scene, new PerspectiveCamera());
      expect(gl.created.programs).toBe(2);
    });
  });
});

describe('createFullscreenMaterial', () => {
  test('draws every pixel: no depth test, no depth writes', () => {
    const map = new Texture(createImage());
    const material = createFullscreenMaterial(
      '#version 300 es\nvoid main() {}',
      { map }
    );
    expect(material.depthTest).toBe(false);
    expect(material.depthWrite).toBe(false);
    expect(material.uniforms.map).toBe(map);
    expect(material.glsl!.vertex).toContain('in vec2 position');
    expect(material.glsl!.vertex).toContain('out vec2 vUv');
  });
});

describe('createToneMapMaterial', () => {
  const map = new Texture(createImage());

  test('reads the map with an exposure of 1 and the ACES curve by default', () => {
    const material = createToneMapMaterial({ map });
    expect(material.uniforms).toEqual({ map, exposure: 1 });
    const defines = definesOf(material.glsl!.fragment);
    expect(defines.has('TONE_MAPPING_ACES')).toBe(true);
    expect(defines.has('TONE_MAPPING_REINHARD')).toBe(false);
  });

  test('the curve is a define; none clamps', () => {
    const reinhard = createToneMapMaterial({
      map,
      toneMapping: ToneMapping.REINHARD,
      exposure: 2,
    });
    expect(reinhard.uniforms.exposure).toBe(2);
    expect([...definesOf(reinhard.glsl!.fragment).keys()]).toEqual([
      'TONE_MAPPING_REINHARD',
    ]);
    const none = createToneMapMaterial({ map, toneMapping: ToneMapping.NONE });
    expect(definesOf(none.glsl!.fragment).size).toBe(0);
  });
});
