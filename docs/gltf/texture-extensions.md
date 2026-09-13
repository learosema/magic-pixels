---
title: Texture extensions
---

# Texture extensions

Two things stand between {@link Texture} and glTF: where the image data can
come from, and what the numbers in it mean once they land on the GPU.

## Images without an `<img>` tag

A `.glb` file packs its images as raw bytes inside the binary chunk, not as
files the browser can point an `<img src>` at. The way to turn arbitrary
bytes into a GPU-uploadable image without an `<img>` element is
[`createImageBitmap(blob)`](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap),
which decodes a `Blob` off the main thread and hands back an `ImageBitmap` -
a source `texImage2D` accepts directly, exactly like an `HTMLImageElement`.

## sRGB, again

[Rendering concepts](./concepts.md#linear-and-srgb-color) covers why a
renderer needs to know whether a texture is sRGB-encoded or already linear.
The GPU can do the sRGB → linear decoding step for free, at sample time, if
the texture is uploaded with an sRGB **internal format**: the storage format
a texture is uploaded with, as opposed to the format and type of the source
data. `RGBA` says "four linear bytes"; `SRGB8_ALPHA8` says "four sRGB-encoded
bytes, decode them when a shader samples this texture". Everything else
about the upload call stays the same - same bytes, same `RGBA` source
format, same `UNSIGNED_BYTE` source type; only the destination format
changes what the sampler returns.

Which glTF textures are sRGB is not a property of the file format, it is a
convention: a base color or emissive map is a picture, so it is sRGB; a
normal, metallic-roughness or occlusion map is numbers stored as an image,
so it is linear. The loader (step 7) will set `colorSpace` per texture slot
accordingly; nothing here decides it automatically, because a texture
provides no way to tell, and re-using the same image in two slots is legal
in glTF.

## Orientation

WebGL and glTF disagree about where row 0 of an image goes. WebGL fills a
texture bottom-to-top: the first row of pixel data lands at texture
coordinate `v = 0`, which is the _bottom_ by the usual image convention.
Image files and glTF UVs both assume row 0 is the _top_. Without correction
a texture appears upside down.
[`UNPACK_FLIP_Y_WEBGL`](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/pixelStorei)
is a pixel store flag that flips the source image vertically during upload,
so `v = 0` ends up at the top of the picture instead - the other way to fix
this is flipping V in the shader, which is what magic-pixels asked for
before this step.

## In magic-pixels

- {@link TextureData} now includes `ImageBitmap` alongside the DOM image
  types it already accepted.
- {@link Texture.colorSpace} is `'linear'` (default, no behaviour change) or
  `'srgb'`. The renderer looks it up in a small table
  (`GL_INTERNAL_FORMAT`, next to the existing filter and wrapping tables) to
  pick the internal format passed to `texImage2D`.
- {@link Texture.flipY} defaults to `false`, matching the shader-side flip
  magic-pixels already used - existing scenes render unchanged. Setting it
  makes the renderer call `pixelStorei(UNPACK_FLIP_Y_WEBGL, true)` before
  the upload instead.
- `Texture.fromBlob(blob, options)` wraps `createImageBitmap` the same way
  `fromImageUrl` wraps `Image`, for loading images out of a `.glb`'s binary
  chunk.

Both new fields are read once, at upload time, alongside the existing filter
and wrap parameters - flip the flag or the color space and set
`needsUpdate = true` to see the change on an already-uploaded texture.

Where it lives:

- `src/scene/texture.ts`: the `ImageBitmap` union member, `colorSpace`,
  `flipY`, `fromBlob()`.
- `src/scene/constants.ts`: the {@link ColorSpace} string union.
- `src/webgl/gl-constants.ts`: `GL_INTERNAL_FORMAT`, mapping `ColorSpace` to
  `RGBA` / `SRGB8_ALPHA8`.
- `src/webgl/webgl2-renderer.ts`: `bindTexture()` sets the flip flag and
  looks up the internal format before `texImage2D`.

## Try it

[Textures](https://learosema.github.io/magic-pixels/examples/06-textures/)
renders the same gradient image on two quads with an identical shader that
samples the texture and encodes the result back to sRGB for display, the
way a lit material eventually will. The left quad is `colorSpace: 'linear'`
(no decoding on sample), so the encode step doubles up on already-encoded
bytes and the result looks washed out; the right quad is `'srgb'`, decoded
on sample and correctly re-encoded, matching the source gradient. Try
setting `flipY` on one of the two textures to see the picture turn upside
down.

## Further reading

- [WebGL2 Fundamentals: Cross origin images](https://webgl2fundamentals.org/webgl/lessons/webgl-cors-permission.html):
  loading images for WebGL, `createImageBitmap` included.
- [MDN: `createImageBitmap`](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap)
  and [`ImageBitmap`](https://developer.mozilla.org/en-US/docs/Web/API/ImageBitmap):
  the type a `.glb`'s embedded images decode into.
- [Learn OpenGL: Textures](https://learnopengl.com/Getting-started/Textures)
  and [Gamma correction](https://learnopengl.com/Advanced-Lighting/Gamma-Correction):
  sRGB textures and framebuffers side by side.
- [Khronos glTF specification: Images](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#images)
  and [Appendix B](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#appendix-b-brdf-implementation):
  which glTF texture slots are sRGB versus linear.
- [MDN: `texImage2D`](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/texImage2D)
  and [`pixelStorei`](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/pixelStorei):
  reference for the internal format argument and `UNPACK_FLIP_Y_WEBGL`.
