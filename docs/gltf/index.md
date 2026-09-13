---
title: Loading glTF models
children:
  - ./concepts.md
---

# Loading glTF models

This chapter describes the glTF loader while it is being built, so unlike
the rest of the book it talks about work that is not done yet. Every step
gets its own page once it is implemented; this page is the map. Read
[Rendering concepts](./concepts.md) first if terms like _linear color_,
_BRDF_ or _metallic-roughness_ are new. The step pages assume you know them.

## What a glTF file is

glTF 2.0 is a JSON document that describes a scene, plus binary buffers with
the vertex data and image files for the textures. A `.gltf` file is the JSON
with the buffers and images next to it (or embedded as data URIs); a `.glb`
file packs the JSON and one binary buffer into a single container.

The JSON is a set of flat arrays that reference each other by index:

| glTF array    | What it holds                                                   | magic-pixels counterpart                              |
| ------------- | --------------------------------------------------------------- | ----------------------------------------------------- |
| `scenes`      | which nodes are roots                                           | {@link Scene}                                         |
| `nodes`       | the hierarchy: translation, rotation, scale, children           | {@link Object3D}                                      |
| `meshes`      | a list of _primitives_, each with attributes, indices, material | one {@link Mesh} per primitive                        |
| `accessors`   | a typed view into a buffer: "600 vec3 floats starting at 0"     | {@link BufferAttribute}                               |
| `bufferViews` | a byte range in a buffer, optionally with a stride              | (loader internal)                                     |
| `buffers`     | the raw bytes, by URI or in the `.glb`                          | (loader internal)                                     |
| `materials`   | metallic-roughness parameters and texture references            | a {@link Material} made by `createPbrMaterial()`      |
| `textures`    | image + sampler pairs                                           | {@link Texture}                                       |
| `images`      | URI, data URI or a byte range with a MIME type                  | the `image` of a {@link Texture}                      |
| `samplers`    | min/mag filter and wrapping                                     | {@link Filter}, {@link Wrapping}                      |
| `cameras`     | perspective or orthographic parameters                          | {@link PerspectiveCamera}, {@link OrthographicCamera} |

The mapping is close to one-to-one, which is no accident: the magic-pixels
scene graph follows three.js, and three.js and glTF grew up together. What is
missing on the magic-pixels side falls into three groups, and those groups are
the steps below.

## The steps, and why each exists

**1. Quaternions.** glTF stores node rotations as quaternions, four numbers
that describe a rotation axis and angle without the gimbal lock problems of
Euler angles. {@link Object3D} only has an Euler `rotation` today. We could
convert quaternion to Euler in the loader, but animations (planned for later)
interpolate between quaternions, so it is better to make the quaternion the
real rotation and derive the Euler angles from it.

**2. Typed vertex attributes.** {@link BufferAttribute} only holds
`Float32Array`s. glTF stores UVs, colors and joint indices as bytes and
shorts, and a "quantized" file even stores positions as 16 bit integers to
halve the file size. WebGL can read those directly; it just needs to be told
the component type and whether to normalize integers to the 0..1 range. This
step teaches the renderer that.

**3. Texture extensions.** Two things. Images embedded in a `.glb` come out
as an `ImageBitmap`, which the {@link Texture} type must accept. And color
textures in glTF are stored in the sRGB color space, so the GPU has to convert
them to linear values before lighting math touches them (see
[color spaces](./concepts.md#linear-and-srgb-color)).

**4. Material render state.** A {@link Material} is shaders plus uniforms.
A glTF material can also say "blend me with what is behind" (alpha mode
`BLEND`) and "render both sides". That is GPU state, not a shader concern, so
the material gets `transparent` and `side` fields and the renderer sets the
blend and cull state per draw. Transparent meshes also have to be drawn last
and back to front, which changes what `prepareScene()` returns.

**5. Lights.** A physically based material is meaningless without lights. A
light becomes an {@link Object3D} subclass so it can be positioned and
parented like everything else, and the renderer passes the visible lights to
the shader as uniform arrays, the same way it passes the matrices.

**6. PBR material.** The glTF "metallic-roughness" material is the heart of
the loader and the biggest single step. It is a fragment shader that takes
base color, metalness, roughness, a normal map, occlusion and emission and
computes reflected light for each light in the scene with a
[BRDF](./concepts.md#what-a-brdf-is). The page for this step walks through
the shader term by term.

**7. Loader core.** With everything above in place, the loader is mostly
bookkeeping: parse the container, turn accessors into attributes, build the
node tree, create materials and textures. It is the largest amount of code
but the least new theory.

**8. Compression.** Mesh compression shrinks files several times over.
Quantization comes for free with step 2. Meshopt and Draco need a decoder
that we do not bundle; the user passes it in and the loader calls it for the
buffer views or primitives that are marked as compressed.

**9. Documentation.** The README and these pages.

## How to read the step pages

Each step page has the same shape:

1. **The concept.** What problem the step solves and the theory behind it,
   with the math written out where there is math.
2. **The design.** How it fits the existing scene model and the alternatives
   that were considered.
3. **The implementation.** A walk through the code, file by file, and the
   tests that pin the behaviour down.
4. **Try it.** Something to render or change to see the effect.

## Further reading

- [glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html):
  readable as specifications go, and the source of truth for every table on
  this page. The [reference guide](https://www.khronos.org/files/gltf20-reference-guide.pdf)
  is the same on two pages.
- [glTF tutorial](https://github.com/KhronosGroup/glTF-Tutorials): walks a
  minimal file from a single triangle to animation, skinning and materials.
- [glTF sample assets](https://github.com/KhronosGroup/glTF-Sample-Assets)
  and the [sample viewer](https://github.com/KhronosGroup/glTF-Sample-Viewer):
  test models for every feature, and the reference renderer whose shaders
  the PBR material follows.
- [three.js: GLTFLoader source](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/loaders/GLTFLoader.js):
  a complete loader to compare against, including the extension plugins.
- [WebGL2 Fundamentals: Skinning](https://webgl2fundamentals.org/webgl/lessons/webgl-skinning.html):
  loads a glTF file from scratch in raw WebGL on the way to skinning.
- [meshoptimizer](https://github.com/zeux/meshoptimizer) (with `gltfpack`)
  and [Draco](https://github.com/google/draco): the two compression
  libraries and their glTF extensions.
