---
title: Material render state
---

# Material render state

Everything so far - shaders, uniforms, textures - decides what color a
fragment gets. Three more questions decide whether that color reaches the
framebuffer at all, and how: is the fragment behind something nearer? Does
it belong to a face pointing away from the camera? And if it is see-through,
how does its color combine with what is already there? None of these are
shader concerns; they are fixed-function GPU state, set once per draw call
rather than computed per fragment.

## The depth buffer

Alongside the color for each pixel, the GPU keeps a **depth buffer**: one
value per pixel, the distance from the camera of the fragment currently
written there. Before writing a new fragment's color, the **depth test**
compares its depth to the stored one and discards the fragment if something
nearer already claimed that pixel. This is what lets a renderer draw meshes
in any order and still get correct occlusion - contrast the
[core renderer chapter](../core/renderer.md#depth-and-clearing), which
introduced the test itself. **Depth write** is the separate question of
whether a fragment that passes the test then updates the stored depth for
fragments drawn after it. Turning it off leaves the buffer as it was: later
fragments are still tested against whatever was there before, just not
against this one.

## Backface culling

A triangle's vertices are wound consistently (counter-clockwise, by
convention, as seen from the front). Projected to screen space, that
winding is either still counter-clockwise or has flipped to clockwise,
depending on whether the triangle faces the camera or away from it. **Face
culling** throws away triangles of the wrong winding before rasterizing
them at all, for free: half the triangles of a closed, opaque mesh (a cube,
a sphere) always face away from the camera and would be overdrawn by the
near half regardless, so skipping them is pure savings. A single flat plane
has no "other half" to save work on - culling it from the back makes it
disappear from that side instead, which is a deliberate choice, not an
optimization.

## Blending

An opaque fragment can simply overwrite the pixel. A translucent one has to
combine with what is behind it, and how depends on what "80% opaque red"
means: the [Porter-Duff "over" operator](https://en.wikipedia.org/wiki/Alpha_compositing#Description)
computes `result = source.rgb * source.a + dest.rgb * (1 - source.a)`, which
`glBlendFunc(SRC_ALPHA, ONE_MINUS_SRC_ALPHA)` sets the GPU up to do
automatically after the fragment shader runs.

This only gives the right picture if `dest` already holds everything that
should show through - which means transparent fragments must be drawn
**back to front**. The depth test does not save this the way it does for
opaque meshes: two overlapping translucent triangles both pass the depth
test regardless of draw order (neither one occludes the other), so order is
the only thing left to get composition right. Depth writes are normally
also turned off for transparent fragments, so that one translucent triangle
does not hide a farther one that should still blend through it.

## In magic-pixels

`Material` gained four optional fields, all matching today's behaviour when
left unset:

- `transparent` (default `false`): enables blending with
  `SRC_ALPHA, ONE_MINUS_SRC_ALPHA` and, unless `depthWrite` is set
  explicitly, turns depth writes off.
- `side`: `Side.FRONT`, `Side.BACK` or `Side.DOUBLE` (default - no culling,
  as before this step).
- `depthTest` / `depthWrite` (default `true`).

`prepareScene()` (shared by every renderer, see
[the renderer chapter](../core/renderer.md#preparescene)) now returns a
{@link Frame} - `{ meshes, transparent, lights }` instead of a flat list -
splitting opaque meshes (tree order) from transparent ones, which it sorts
back to front by the Z coordinate of `viewMatrix * worldMatrix`, i.e.
distance from the camera along its viewing direction. `lights` holds the
visible {@link Light}s (see [Lights](./lights.md)). `WebGL2Renderer`
draws `meshes` then `transparent`,
and before each draw applies the material's blend, cull and depth state -
skipping any GL call whose value did not change since the last mesh, the
same principle as the uniform cache. `NullRenderer` records the same split
as `lastFrame.meshes` / `.transparent` / `.lights`.

Where it lives:

- `src/scene/material.ts`: the four new `Material` fields.
- `src/scene/constants.ts`: the {@link Side} string union.
- `src/scene/renderer.ts`: `prepareScene()` splits and sorts, exports
  `Frame`.
- `src/scene/null-renderer.ts`: `NullFrame` gains `transparent` and
  `lights`.
- `src/webgl/gl-constants.ts`: `GL_CULL_FACE` maps `Side` to the face
  `cullFace` should discard.
- `src/webgl/webgl2-renderer.ts`: `applyRenderState()`, called once per mesh
  from a new `drawMesh()` shared by both draw passes.

## Try it

[Material render state](https://learosema.github.io/magic-pixels/examples/07-material-state/)
renders three overlapping translucent planes sliding through each other
and one single-sided spinning plane. Reorder the translucent planes in the
scene graph or change their positions - they still composite back to front,
whichever one is nearest at the moment. Toggle a plane's `side`
between `Side.FRONT` and `Side.DOUBLE` to see backface culling make it
vanish from behind.

## Further reading

- [Learn OpenGL: Blending](https://learnopengl.com/Advanced-OpenGL/Blending):
  the depth-write and draw-order problem for transparency, worked through
  with the same `glBlendFunc` this step uses.
- [Learn OpenGL: Face culling](https://learnopengl.com/Advanced-OpenGL/Face-culling):
  winding order and why culling is "free" for closed meshes.
- [Wikipedia: Alpha compositing](https://en.wikipedia.org/wiki/Alpha_compositing):
  the Porter-Duff "over" operator this step's blend function implements.
- [WebGL2 Fundamentals: WebGL state diagram](https://webgl2fundamentals.org/webgl/lessons/resources/webgl-state-diagram.html):
  where `BLEND`, `CULL_FACE`, `DEPTH_TEST` and the depth mask sit in the
  overall GL state.
- [MDN: `blendFunc`](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/blendFunc),
  [`cullFace`](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/cullFace)
  and [`depthMask`](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/depthMask):
  reference for the three calls this step adds.
- [Khronos glTF specification: Alpha coverage](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#alpha-coverage)
  and [`doubleSided`](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#reference-material):
  the `OPAQUE`/`MASK`/`BLEND` alpha modes and the culling flag the loader
  (step 7) will map onto `transparent` and `side`.
