---
title: Materials and uniforms
---

# Materials and uniforms

A {@link Material} is a plain object with three fields: shader sources,
a draw mode and a uniforms object.

```js
const material = {
  glsl: { vertex: vertexSource, fragment: fragmentSource },
  drawMode: DrawMode.TRIANGLES,
  uniforms: { color: Color.fromHex('#ff00ff'), time: 0 },
};
```

`createShaderMaterial()` builds one from sources and uniforms;
`createDefaultMaterial()`, `createBasicMaterial(color)` and
`createNormalMaterial()` are ready-made unlit ones, and
`createPbrMaterial(options)` is the lit one: the glTF metallic-roughness
model, described in [PBR material](../gltf/pbr-material.md).
`createFullscreenMaterial(fragmentShader, uniforms)` and
`createToneMapMaterial({ map, exposure, toneMapping })` are the materials of
[fullscreen passes](../rendering/tone-mapping.md). There is no
material class: a material _is_ its shader plus its uniforms, and the PBR
material is built the same way as any other. In three.js terms everything
is a `RawShaderMaterial`.

## Shader sources per language

`glsl` is optional and keyed by language on purpose. A WebGL2 renderer reads
`material.glsl` and throws if it is missing; a WebGPU renderer would read
`material.wgsl`. One material can carry both and work with either renderer.

The built-in shaders are GLSL ES 3.00 (`#version 300 es`, `in`/`out`, an
explicit `out vec4 fragColor`). User shaders may still be 1.00
(`attribute`/`varying`, `gl_FragColor`); WebGL2 accepts both.

## One program per shader

The renderer compiles and links one program per distinct pair of shader
sources and caches it by the source strings. Every mesh that uses the same
material shares the program, and so do different materials whose sources
happen to be identical, which is common: `createPbrMaterial()` produces the
same source for every material with the same set of maps, whatever the
factors. The program is deleted when the last material using it is
disposed. If `glsl.vertex` or `glsl.fragment` is replaced by a different
string, the cache notices on the next draw and compiles (or looks up) the
program for the new source. This makes live-editing a fragment shader a
one-line change.

After linking, the renderer asks the program for its _active uniforms_: the
uniforms the shader declares and actually uses (GLSL drops unused ones).
For each it stores the location, the declared type and, for arrays, the
length. This table drives everything below.

## Uploading uniforms

On every draw the renderer walks `material.uniforms` and, for each name the
program knows, converts the value into a flat number array and uploads it.
Two details make this robust:

- **The shader's type picks the setter, not the JavaScript value.** A
  {@link Vector} with three components becomes `uniform3fv` for a `vec3`,
  `uniform3iv` for an `ivec3` and `uniform3iv` again for a `bvec3`. Choosing by
  JavaScript type instead would send a `Vector` of floats through an integer
  setter as soon as the shader declares an `ivec3`, truncating them
  silently; the table in `src/webgl/uniforms.ts` maps every GLSL type to
  the right call.
- **Unchanged values are skipped.** The renderer remembers the last uploaded
  array per uniform of each program and compares element by element. `uniformNfv` calls are
  not free, and a scene with many meshes sharing a material would otherwise
  re-upload the same colour hundreds of times per frame. This is also why
  mutating a `Vector` in place works: the comparison looks at the numbers,
  not the object identity.

Accepted values: `number`, arrays of numbers (nested arrays are flattened,
so `[[1, 2], [3, 4]]` fills a `vec2[2]`), {@link Vector}, {@link Color}
(uploaded as `vec4`), `Matrix`, {@link Mat2}/{@link Mat3}/{@link Mat4},
`bigint`, and {@link Texture}. Array uniforms are addressed by their base
name: a shader's `uniform vec3 lights[4]` is `uniforms.lights = [...]` with
twelve numbers.

## Textures and texture units

A {@link Texture} value is not a number; a sampler uniform holds a _texture
unit_ index. The renderer assigns units per draw in the order it meets
textures in the uniforms object: the first texture is bound to unit 0 and
the sampler gets `0`, the next unit 1, and so on. The texture is uploaded
the first time it is seen (see [Textures](./textures.md)).

## Built-in uniforms

If a shader declares any of `modelMatrix`, `viewMatrix`,
`projectionMatrix`, `modelViewMatrix` (all `mat4`) or `normalMatrix`
(`mat3`), the renderer sets them per mesh from the scene graph and the
camera, before the material's own uniforms. A material that defines a uniform
of the same name wins, so a shader can still take a hand-built matrix. The
built-in vertex shader uses `modelViewMatrix`, `projectionMatrix` and
`normalMatrix` and passes `vPosition` (view space), `vNormal` (view space,
normalised) and `vUv` to the fragment shader.

The lights of the frame are built-in uniforms too, filled once per frame
from the visible {@link Light}s, in view space, with colours premultiplied
by intensity: `ambientLightColor` (`vec3`), `directionalLightDirections[]`
and `directionalLightColors[]` (`vec3` arrays) with
`directionalLightCount` (`int`), and `pointLightPositions[]`,
`pointLightColors[]` (`vec3` arrays), `pointLightRanges[]` (`float` array)
with `pointLightCount`. The shader picks the array sizes; the renderer fits
the lights to them and clamps the counts. [Lights](../gltf/lights.md)
explains what the values mean and shows a fragment shader that uses them.

## Render state

Besides shaders and uniforms, a material carries the GPU state a shader
cannot express itself, all optional:

- `transparent` (default `false`): blend with what is already drawn
  (`SRC_ALPHA, ONE_MINUS_SRC_ALPHA`) instead of overwriting it, and turn
  depth writes off unless `depthWrite` says otherwise. It also decides draw
  order - see [prepareScene](./renderer.md#preparescene).
- `side` (default `Side.DOUBLE`, no culling): restrict drawing to
  `Side.FRONT` or `Side.BACK` faces, for closed meshes where the unseen
  side is a wasted fragment, or for a single-sided plane meant to be seen
  from one direction only.
- `depthTest` / `depthWrite` (default `true`): whether a fragment is
  discarded by what is nearer, and whether it records its own depth.

The theory behind blending and culling, and why glTF needs them, is in
[Material render state](../gltf/material-render-state.md).

## Draw mode

`drawMode` is one of the {@link DrawMode} strings and says how the GPU
groups vertices into primitives: `'triangles'`, `'lines'`, `'points'`,
the strip and fan variants. It lives on the material rather than the
geometry because it is a property of _how_ something is drawn, and a
wireframe material with `'lines'` can be swapped onto any geometry.

## Further reading

- [The Book of Shaders](https://thebookofshaders.com/): fragment shaders
  from the first line on; the chapters on shaping functions, colors and
  patterns are the fastest way to get fluent in GLSL.
- [WebGL2 Fundamentals: Shaders and GLSL](https://webgl2fundamentals.org/webgl/lessons/webgl-shaders-and-glsl.html):
  attributes, uniforms, varyings and samplers, and how values get into a
  program.
- [WebGL2 Fundamentals: Less code, more fun](https://webgl2fundamentals.org/webgl/lessons/webgl-less-code-more-fun.html):
  querying active uniforms and picking the setter from the declared type,
  the technique the renderer uses.
- [GLSL ES 3.00 specification](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf):
  the language reference, including the list of uniform types and the
  rules for `in`/`out`.
- [WebGL2 specification](https://registry.khronos.org/webgl/specs/latest/2.0/):
  the API reference, with `getActiveUniform` and the `uniform[1234]{f,i,ui}v`
  family.
- [Shadertoy](https://www.shadertoy.com/): thousands of fragment shaders to
  read; most port to a magic-pixels material with a `resolution` and `time`
  uniform.
