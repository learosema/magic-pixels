---
title: Render targets
---

# Render targets

A draw call writes its pixels somewhere. By default that is the canvas, but
WebGL can be told to write into a texture instead, and then that texture
can be sampled by the next draw like any image. This is called _render to
texture_ and it is the basis of nearly everything beyond a single pass:
shadow maps, reflections, blur, bloom, colour grading.

## Framebuffers and attachments

The place a draw call writes to is a **framebuffer**. The canvas has one,
the default framebuffer, which the browser owns. You can create more. A
framebuffer holds no pixels itself: it is a list of **attachments**, and
each attachment is a piece of memory the GPU writes one kind of value to:

- the **colour attachment** receives the fragment shader's output;
- the **depth attachment** receives the depth of each fragment, so the depth
  test works while drawing into the framebuffer, exactly as it does on the
  canvas.

An attachment is either a **texture** or a **renderbuffer**. A texture can be
sampled by a shader afterwards. A renderbuffer is write-only, and in exchange
the driver may store it in whatever way is fastest. The colour of a render
target is nearly always a texture (that is the point of it); the depth is a
renderbuffer unless you need to read depth back, as a shadow map does.

A framebuffer can only be drawn into when it is _complete_: every attachment
has storage of the same size and a format the GPU can render to. WebGL
reports the answer with `checkFramebufferStatus`, and an incomplete one
silently draws nothing, so the renderer throws instead.

Two more things to know:

- **Storage is allocated once.** A texture created with a width and height
  keeps them; resizing means allocating again.
- **The viewport belongs to the draw, not to the framebuffer.** It has to be
  set to the size of whatever is bound, and set back afterwards.

You cannot read from a texture while you draw into it (WebGL raises an
error for that _feedback loop_). To process an image in several passes, draw
pass one into target A, pass two reads A and draws into B, pass three reads
B and draws into A again. Alternating between two targets like this is
called **ping-pong**.

## In magic-pixels

A {@link RenderTarget} is plain data like every other scene object:

```js
const target = new RenderTarget(1024, 512, {
  depth: 'renderbuffer',
  float: true,
});

renderer.render(scene, camera, target); // draws into the target
renderer.render(pass, camera); // draws to the canvas
```

`width` and `height` are ordinary fields; change them and the renderer
rebuilds the framebuffer at the new size on the next render. `depth` is one
of {@link DepthAttachment}: `'renderbuffer'` (the default), `'texture'` when
the depth has to be sampled later, or `'none'`. `float` asks for a half
float colour format, which can hold values above 1 and is what the
[next page](./tone-mapping.md) needs; it requires the
`EXT_color_buffer_float` extension and the renderer throws a clear error
when the browser does not have it.

`target.colorAttachment` is a normal {@link Texture}: put it in a material's
uniforms and it samples what was rendered. That works because the renderer
does what it does for every scene object: the framebuffer, the renderbuffer
and the GPU texture live in the renderer, in a map keyed by the `RenderTarget`
and the `Texture`, and the texture is registered where a material will find
it, so the colour is never copied. Rendering into a target does not touch
the canvas's framebuffer or viewport: every `render()` call binds what it
needs, and rendering without a target goes back to the canvas.

One detail: a `Texture` normally wraps an image, and an attachment has none.
{@link Texture.empty} makes a texture that has only a size (`isEmpty`); the
renderer allocates storage for it instead of uploading pixels. That also
makes it safe to sample a target's texture before anything has rendered into
it, which is what the first frame of a ping-pong loop does: it reads zeros.

Where it lives:

- `src/scene/render-target.ts`: {@link RenderTarget}, its options and the two
  attachments.
- `src/scene/constants.ts`: the {@link DepthAttachment} string union.
- `src/webgl/webgl2-renderer.ts`: building, caching, resizing and disposing
  the framebuffers; `render()` takes the target as a third argument.
- `src/test-utils/fake-webgl2.ts`: records framebuffer and renderbuffer calls
  and can pretend an extension is missing.

## Try it

[Render targets](https://learosema.github.io/magic-pixels/examples/11-render-targets/)
draws a scene into a float target and shows it through a second pass.
Resize the window: the target follows the canvas and the renderer rebuilds
the framebuffer. Then change `depth` to `'none'` in `script.js` and look at
the spheres.

[Depth texture](https://learosema.github.io/magic-pixels/examples/13-depth-texture/)
uses `depth: 'texture'` and shows the depth attachment as an image next to
the colour. It also shows why depth values are not distances: switch between
the raw depth buffer, which is almost white everywhere, and the linearized
one. Change the `range` uniform to see closer or farther objects in detail.

[Depth of field](https://learosema.github.io/magic-pixels/examples/14-depth-of-field/)
puts the depth texture to work: a fullscreen pass turns each pixel's depth
into a blur radius, growing with the distance from a focus plane, and gathers
a disc of neighbours. The lamps are HDR (much brighter than 1), which is why
they turn into bokeh discs; render the same scene into an 8-bit target and
they shrink to dim spots. Drag the aperture to 0 and the whole picture is
sharp.

[Feedback visualizer](https://learosema.github.io/magic-pixels/examples/12-feedback-visualizer/)
is the ping-pong pattern: two float targets take turns, a fullscreen pass
blurs and fades the previous frame into the other one, and a noise curve is
drawn on top before the result is shown. Change the `decay` and the blur
offset in the feedback shader to make the trails longer or softer.

## Further reading

- [WebGL2 Fundamentals: Render to texture](https://webgl2fundamentals.org/webgl/lessons/webgl-render-to-texture.html):
  the framebuffer recipe step by step, with the viewport pitfall.
- [Learn OpenGL: Framebuffers](https://learnopengl.com/Advanced-OpenGL/Framebuffers):
  attachments, renderbuffers versus textures, and a post-processing example.
- [Khronos: Framebuffer Object](https://www.khronos.org/opengl/wiki/Framebuffer_Object):
  the completeness rules and why an attachment can make one incomplete.
- [MDN: WebGL2RenderingContext.checkFramebufferStatus](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/checkFramebufferStatus)
