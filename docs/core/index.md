---
title: How magic-pixels works
children:
  - ./matrices.md
  - ./scene-graph.md
  - ./cameras.md
  - ./geometry.md
  - ./materials.md
  - ./textures.md
  - ./renderer.md
---

# How magic-pixels works

What happens between `renderer.render(scene, camera)` and pixels on the canvas?
Let's have a look at one frame, end to end.

## The scene graph is a tree of transforms.

Every {@link Object3D} has a
position, rotation and scale relative to its parent. Before drawing, the
renderer walks the tree once and computes each object's `worldMatrix`,
its transform relative to the scene root. [Scene graph](./scene-graph.md)
explains the walk; [Matrices](./matrices.md) explains what a transform
matrix is and how three of them are composed into one.

## The camera turns world space into clip space

A {@link Camera} is an object in the tree like any other, so its `worldMatrix`
says where it is. The inverse of that, the `viewMatrix`, moves the whole world
so the camera sits at the origin looking down -Z. The `projectionMatrix` then
squashes the visible volume into the cube the GPU clips against.
[Cameras and coordinates](./cameras.md) derives both.

## Meshes are collected

`prepareScene()` returns the visible {@link Mesh}es in tree order.
Each mesh is a {@link BufferGeometry} (the vertex data) plus a
{@link Material} (the shader and its uniforms).

## GPU programs per mesh

For every mesh, the renderer looks up or creates the GPU program for
the material and the vertex array object for the geometry, uploads the
uniforms that changed, including the matrices from steps 1 and 2, binds
the textures, and issues one draw call.

## See also

- [Geometry](./geometry.md),
- [Materials and uniforms](./materials.md),
- [Textures](./textures.md)
- [The renderer](./renderer.md)

## The one design rule

Scene objects are plain data. A geometry is typed arrays, a material is
strings and a uniforms object, a texture is an image and four sampling
settings, an object is three vectors and a list of children. None of them
holds a WebGL handle. The renderer owns every GPU resource and keeps them in
maps keyed by the scene object that they belong to, creating them the first
time an object is drawn and freeing them in `dispose()`.

This is why a material can be shared by a hundred meshes with one compiled
program, why the same scene can be rendered by a {@link WebGL2Renderer} on a
canvas and by a {@link NullRenderer} in a unit test, and why a future WebGPU
renderer only needs to read `material.wgsl` instead of `material.glsl`.
Whenever a new feature is added, the same split applies: describe it on the
scene object, realise it in the renderer.

## Further reading

- [WebGL2 Fundamentals](https://webgl2fundamentals.org/webgl/lessons/webgl-fundamentals.html)
  and [How it works](https://webgl2fundamentals.org/webgl/lessons/webgl-how-it-works.html):
  what WebGL actually is (a rasterization API, not a 3D engine) and how
  vertex and fragment shaders divide the work.
- [three.js manual: Fundamentals](https://threejs.org/manual/#en/fundamentals):
  the same scene, camera, mesh, material vocabulary in the library
  magic-pixels borrows it from.
- [MDN: WebGL API](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API):
  reference for every call the renderer makes.
