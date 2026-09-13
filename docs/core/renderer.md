---
title: The renderer
---

# The renderer

## The interface

{@link Renderer} is small and deliberately sits _above_ the GPU API:

```ts
render(scene, camera)
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
to front by view-space depth, and `lights` (always empty for now; step 5
starts collecting them). Opaque meshes can draw in any order because the
depth test sorts them out per pixel; blended meshes cannot, so they draw
last, farthest first, in the order that composites correctly.

## One frame in WebGL2Renderer

```
frame = prepareScene(scene, camera)
if autoClear: clear colour and depth
for each mesh in frame.meshes, then frame.transparent:
  materialResources = program + uniform table for mesh.material   (cached)
  geometryResources = VAO + buffers for mesh.geometry               (cached)
  useProgram if it differs from the current one
  apply the material's blend/cull/depth state, skipping calls that would be a no-op
  set built-in matrix uniforms the shader declares
  set material uniforms that changed, binding textures to units
  bindVertexArray
  drawElements or drawArrays with the material's draw mode
bindVertexArray(null)
```

The two `(cached)` lines are where all the GL setup lives. Each is a
"get or create": look the scene object up in a map, validate the cached
resources (material: same shader sources; geometry: same `version`), and
rebuild on mismatch. Because everything is keyed by object identity, sharing
is automatic and the scene layer never learns what a program is.

`gl.useProgram` is skipped when consecutive meshes share a material, and
uniform uploads are skipped when values did not change, so a hundred meshes
with one material cost a hundred draw calls but one program switch and one
set of material uniforms.

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
`setClearColor()` sets the background; `autoClear = false` keeps the
previous frame, for feedback effects.

## Size and pixel ratio

`setSize(width, height)` sets the canvas's backing store to `width ×
pixelRatio` by `height × pixelRatio` and the viewport to match. CSS size is
the caller's business. Passing `devicePixelRatio` to `setPixelRatio` gives
sharp rendering on high-density screens at a proportionally higher fill
cost.

## dispose

`dispose(object)` frees the GL resources of one geometry, material or
texture; the next draw re-creates them if the object is still in use, so it
is safe to call on anything. `dispose()` with no argument frees everything
and loses the context; the renderer is finished afterwards.

## Testing without a GPU

Two tools cover the two layers:

- Scene code is tested through {@link NullRenderer}: render, then inspect
  `renderer.lastFrame.meshes` and `.transparent` for what would have been
  drawn and in which order, `.lights` for the visible lights, or
  `renderer.disposed` for what was freed.
- The WebGL2 renderer is tested against a fake `WebGL2RenderingContext`
  (`src/test-utils/fake-webgl2.ts`). It records every call with its
  arguments, counts objects created and deleted, and answers the queries
  the renderer relies on, active attributes and uniforms, by parsing the
  shader sources with regular expressions. A test can assert that a shared
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
