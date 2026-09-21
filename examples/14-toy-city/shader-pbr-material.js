import { createPbrMaterial } from 'magic-pixels';

/**
 * A PBR material with hooks into its shaders.
 *
 * It is `createPbrMaterial` with calls to your GLSL spliced into its vertex
 * and fragment shaders. The lighting stays the ordinary PBR lighting, fed
 * with what your code changed. Each hook is optional: it is spliced in only
 * if your code defines the function.
 *
 * In `vertex`, before the vertices are transformed:
 *
 *   void displace(inout vec3 position, inout vec3 normal)
 *
 * In `fragment`, before the light is worked out, once the base colour, the
 * metallic and roughness factors and the normal are known (`normal` is in
 * view space, like `vPosition` and `vNormal`; not called for `unlit`):
 *
 *   void surface(inout vec4 baseColor, inout float metallic,
 *                inout float roughness, inout vec3 normal)
 *
 * and in `fragment`, after the light, before the colour goes to the screen:
 *
 *   void finish(inout vec4 color)
 *
 * Both blocks can declare what they need before the functions: uniforms
 * (give their values in `uniforms`; a uniform both shaders use is declared in
 * both), helper functions, and varyings: an `out` in the vertex code and a
 * matching `in` in the fragment code carry a value from `displace` to
 * `surface`. The fragment code can read what the PBR shader has:
 * `vPosition`, `vNormal`, `vUv`, `vColor` (with vertex colours).
 *
 * The hooks are added to the source text that `createPbrMaterial` produced,
 * so this has to know how those shaders are written: it fails loudly, not
 * quietly, if the lines it replaces are not found.
 * @param {object} pbrOptions what `createPbrMaterial` takes
 * @param {object} hooks
 * @param {string} [hooks.vertex] GLSL with a `displace` function
 * @param {string} [hooks.fragment] GLSL with a `surface` and/or `finish` function
 * @param {Record<string, unknown>} [hooks.uniforms] values of the uniforms
 */
export function createShaderPbrMaterial(
  pbrOptions,
  { vertex, fragment, uniforms = {} }
) {
  const material = createPbrMaterial(pbrOptions);

  // The library's build strips the whitespace out of its shaders, so the
  // patterns match the code whatever its spacing.
  const patch = (source, pattern, to) => {
    if (!pattern.test(source)) {
      throw Error(`the PBR shader has no ${pattern} to hook into`);
    }
    // a function, so `$` in the replacement means nothing special
    return source.replace(pattern, () => to);
  };
  const MAIN = /void\s+main\s*\(\s*\)\s*\{/;
  const defines = (source, name) =>
    new RegExp(`\\bvoid\\s+${name}\\s*\\(`).test(source);

  if (vertex) {
    let source = material.glsl.vertex;
    // the code goes before main, where it can see the `in` declarations
    source = patch(
      source,
      MAIN,
      `${vertex}

void main() {
  vec3 displacedPosition = position;
  vec3 displacedNormal = normal;
  ${defines(vertex, 'displace') ? 'displace(displacedPosition, displacedNormal);' : ''}`
    );
    source = patch(
      source,
      /vec4\(\s*position\s*,\s*1\.0\s*\)/,
      'vec4(displacedPosition, 1.0)'
    );
    source = patch(
      source,
      /normalMatrix\s*\*\s*normal\b/,
      'normalMatrix * displacedNormal'
    );
    material.glsl.vertex = source;
  }

  if (fragment) {
    let source = material.glsl.fragment;
    source = patch(source, MAIN, `${fragment}\n\nvoid main() {`);
    if (defines(fragment, 'surface')) {
      // Right after the roughness is settled, and before it is squared into
      // alpha and the diffuse and specular colours are made from these
      // values. The normal is worked out here too and used further down.
      source = patch(
        source,
        /roughness\s*=\s*clamp\(\s*roughness\s*,\s*0\.04\s*,\s*1\.0\s*\)\s*;/,
        `vec3 hookedNormal = surfaceNormal();
  surface(baseColor, metallic, roughness, hookedNormal);
  metallic = clamp(metallic, 0.0, 1.0);
  roughness = clamp(roughness, 0.04, 1.0);`
      );
      source = patch(
        source,
        /vec3\s+N\s*=\s*surfaceNormal\(\s*\)\s*;/,
        'vec3 N = normalize(hookedNormal);'
      );
    }
    if (defines(fragment, 'finish')) {
      source = patch(
        source,
        /fragColor\s*=\s*vec4\(\s*outputColor\(\s*color\s*\)\s*,\s*baseColor\.a\s*\)\s*;/,
        `vec4 finished = vec4(color, baseColor.a);
  finish(finished);
  fragColor = vec4(outputColor(finished.rgb), finished.a);`
      );
    }
    material.glsl.fragment = source;
  }

  Object.assign(material.uniforms, uniforms);
  return material;
}
