---
title: Guides
children:
  - ./core/index.md
  - ./gltf/index.md
---

# The magic pixels book

This is a detaled documentation that explains the core concepts of `magic-pixels`. We'll work our way through step by step.

## Chapter 1: How `magic-pixels` works

- [Intro](./core/index.md)
- [Matrices](./core/matrices.md)
- [The Scene Graph](./core/scene-graph.md)
- [The Cameras](./core/cameras.md)
- [Geometries](./core/geometry.md)
- [Materials](./core/materials.md)
- [Textures](./core/textures.md)
- [Renderer](./core/renderer.md)

## Chapter 2: Model Loading

- [Loading glTF models](./gltf/index.md)
- [Rendering concepts](./gltf/concepts.md)
- [Quaternions](./gltf/quaternions.md)
- [Typed vertex attributes](./gltf/typed-attributes.md)
- [Texture extensions](./gltf/texture-extensions.md)
- [Material render state](./gltf/material-render-state.md)
- [Lights](./gltf/lights.md)

## Reading list

The chapters end with links to the sources they draw on. These are the ones
that come up again and again, and are all free to read online:

- [WebGL2 Fundamentals](https://webgl2fundamentals.org/) by Gregg Tavares.
  The best ground-up introduction to WebGL2; nearly every chapter here has a
  counterpart there.
- [The Book of Shaders](https://thebookofshaders.com/) by Patricio Gonzalez
  Vivo and Jen Lowe. Fragment shaders and GLSL, one small step at a time.
- [3D Math Primer for Graphics and Game Development](https://gamemath.com/)
  by Fletcher Dunn and Ian Parberry. Vectors, matrices, transforms, Euler
  angles and quaternions, with the intuition spelled out.
- [Learn OpenGL](https://learnopengl.com/) by Joey de Vries. Desktop OpenGL,
  but the chapters on transformations, cameras, textures, lighting, gamma and
  physically based rendering carry over one to one.
- [Physically Based Rendering: From Theory to Implementation](https://pbr-book.org/)
  by Pharr, Jakob and Humphreys. The reference for everything under
  "physically based", far deeper than a real-time renderer needs.
- [MDN: WebGL API](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)
  for looking up any single GL call.
