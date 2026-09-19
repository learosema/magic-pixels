---
title: The renderer
---

# The renderer

## The interface

{@link Renderer} is small and deliberately sits _above_ the GPU API:

```ts
render(scene, camera, target?)
setSize(width, height)
setPixelRatio(ratio)
setClearColor(color, alpha?)
dispose(object?)
```

It knows scenes, cameras, geometries, materials and textures, and nothing
about buffers, programs or bind groups. Abstracting one level lower, a
"generic GPU API" over WebGL2 and WebGPU, would mean wrapping two very
different resource models and still needing two shader languages. Sitting
at the scene level means a WebGPU renderer reuses the entire scene layer and
implements five methods.

Two implementations exist. {@link WebGL2Renderer} draws to a canvas.
{@link NullRenderer} draws nothing and records what it was asked to do,
so scene code can be unit tested in Node.

## prepareScene

`prepareScene(scene, camera)` is shared by every implementation. It runs the
tree walk (`scene.updateWorldMatrix()`, plus the camera's if the camera is
not in the scene) and collects the visible {@link Mesh}es depth-first,
skipping invisible subtrees, into a {@link Frame}: `meshes`, the opaque ones
in tree order, `transparent` (`material.transparent === true`), sorted back
to front by view-space depth, and `lights`, the visible {@link Light}s in
tree order. Opaque meshes can draw in any order because the depth test
sorts them out per pixel; blended meshes cannot, so they draw last,
farthest first, in the order that composites correctly.

## One frame in WebGL2Renderer

```
frame = prepareScene(scene, camera)
convert frame.lights into view-space uniform arrays, once per frame
bind the target's framebuffer and viewport, or the canvas's        (cached)
if autoClear: clear colour and depth
for each mesh in frame.meshes, then frame.transparent:
  program + uniform table for mesh.material's shader sources       (cached)
  geometryResources = VAO + buffers for mesh.geometry               (cached)
  useProgram if it differs from the current one
  apply the material's blend/cull/depth state, skipping calls that would be a no-op
  set built-in matrix and light uniforms the shader declares
  set material uniforms that changed, binding textures to units
  bindVertexArray
  drawElements or drawArrays with the material's draw mode
bindVertexArray(null)
bind the canvas's framebuffer and viewport again, if there was a target
```

The `(cached)` lines are where all the GL setup lives. Each is a
"get or create": look the scene object up in a map, validate the cached
resources (material: same shader sources; geometry: same `version`), and
rebuild on mismatch. Geometries are keyed by object identity; programs are
keyed by their source strings, so materials with identical shaders share
one. Either way sharing is automatic and the scene layer never learns what
a program is.

`gl.useProgram` is skipped when consecutive meshes share a material, and
uniform uploads are skipped when values did not change, so a hundred meshes
with one material cost a hundred draw calls but one program switch and one
set of material uniforms. The light uniforms go through the same cache:
they are the same for every mesh in a frame, so each material uploads them
once and only again when a light moves or changes colour.

## Built-in uniforms

Besides the matrices, the renderer fills the light uniforms a shader
declares (`ambientLightColor`, the `directionalLight*` and `pointLight*`
arrays and counts), in view space and premultiplied by intensity. The
shader chooses the array sizes; the renderer pads, cuts and clamps the
counts to fit. [Materials and uniforms](./materials.md#built-in-uniforms)
lists them and [Lights](../gltf/lights.md) explains the values.

## Render state

A {@link Material} can set `transparent`, `side`, `depthTest` and
`depthWrite`; see [Materials and uniforms](./materials.md#render-state) for
what each does. The renderer keeps its own record of what is currently
enabled (blending, culling and which face, depth test, depth writes) and
only issues `enable`/`disable`/`cullFace`/`depthMask` when a mesh's material
actually asks for something different from the previous draw, the same
skip-if-unchanged approach as the uniform cache.

## Depth and clearing

The constructor enables the depth test, and each frame starts by clearing
colour and depth (`autoClear`). Without the depth test, meshes would be
painted in draw order and a far object drawn later would cover a near one.
Clearing honours the depth mask, so the renderer switches depth writes back
on first if a transparent material left them off at the end of the previous
frame.
`setClearColor()` sets the background; `autoClear = false` keeps the
previous frame, for feedback effects.

## Render targets

`render(scene, camera, target)` draws into a {@link RenderTarget}'s
framebuffer instead of the canvas. The framebuffer, its depth renderbuffer
and the GPU textures of its attachments are built the first time a target is
rendered to and kept in a map keyed by the target; if `target.width` or
`height` no longer match what was built, they are rebuilt at the new size.
Every `render()` call starts by binding the framebuffer and viewport it needs,
the target's or the canvas's, so a frame never depends on the last one.
[Render targets](../rendering/render-targets.md) explains framebuffers and
attachments.

## Size and pixel ratio

`setSize(width, height)` sets the canvas's backing store to `width ×
pixelRatio` by `height × pixelRatio` and the viewport to match. CSS size is
the caller's business. Passing `devicePixelRatio` to `setPixelRatio` gives
sharp rendering on high-density screens at a proportionally higher fill
cost.

## dispose

`dispose(object)` frees the GL resources of one geometry, material,
texture or render target; the next draw re-creates them if the object is still in use, so it
is safe to call on anything. `dispose()` with no argument frees everything
and loses the context; the renderer is finished afterwards.

## Testing without a GPU

Two tools cover the two layers:

- Scene code is tested through {@link NullRenderer}: render, then inspect
  `renderer.lastFrame.meshes` and `.transparent` for what would have been
  drawn and in which order, `.lights` for the lights that would have lit
  them, or `renderer.disposed` for what was freed.
- The WebGL2 renderer is tested against a fake `WebGL2RenderingContext`
  (`src/test-utils/fake-webgl2.ts`). It records every call with its
  arguments, counts objects created and deleted, and answers the queries
  the renderer relies on, active attributes and uniforms, by parsing the
  shader sources with regular expressions (array sizes may be `#define`d
  constants, as in real shaders). A test can assert that a shared
  material compiled one program, that an attribute got location 1, or that
  an unchanged uniform was not uploaded twice. Nothing is actually drawn,
  which is the point: the tests check the bookkeeping, and the bookkeeping
  is where the bugs were.

## Further reading

- [WebGL2 Fundamentals: WebGL state diagram](https://webgl2fundamentals.org/webgl/lessons/resources/webgl-state-diagram.html):
  an interactive picture of every piece of GL state (programs, buffers,
  VAOs, textures, units) and what each call changes; the best way to see
  what the renderer's caches stand in for.
- [WebGL2 Fundamentals: Resizing the canvas](https://webgl2fundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html):
  backing store versus CSS size and the device pixel ratio.
- [MDN: WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices):
  state changes, context loss, and what is expensive.
- [three.js: WebGLRenderer source](https://github.com/mrdoob/three.js/blob/dev/src/renderers/WebGLRenderer.js):
  the same structure at full scale, with the render list, state tracking
  and per-object resource caches split into their own modules.
- [WebGPU Fundamentals](https://webgpufundamentals.org/): the other GPU API
  the renderer interface is designed to sit above.
