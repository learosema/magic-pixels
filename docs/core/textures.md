---
title: Textures
---

# Textures

A {@link Texture} is an image plus sampling and upload settings. Like every
scene object it is plain data; the renderer uploads it to the GPU the first
time it is used as a uniform.

## Image sources

`image` can be an `HTMLImageElement`, `HTMLVideoElement`,
`HTMLCanvasElement`, `ImageData` or `ImageBitmap`. `Texture.fromImageUrl(url)`
loads an image with `crossOrigin = 'anonymous'` (so images from other origins
work when the server allows it) and resolves with a texture once decoded.
`Texture.fromBlob(blob)` decodes a `Blob` with `createImageBitmap` instead -
the way to go from raw bytes (an embedded image in a binary file format, a
`fetch` response) to an uploadable image without ever creating a DOM
element.

For a video or a canvas that changes, set `texture.needsUpdate = true` after
the change; the renderer re-uploads the current frame on the next draw and
clears the flag. Nothing is re-uploaded otherwise, so a static image costs one
upload.

## Filtering

`magFilter` says what to do when a texel covers more than one pixel
(zoomed in): `'nearest'` picks the closest texel and looks blocky, which is
what pixel art wants; `'linear'` blends the four nearest and looks smooth.

`minFilter` says what to do when many texels fall into one pixel (zoomed
out). Picking one texel here makes the texture shimmer as it moves, because
which texel wins changes every frame. The fix is _mipmaps_: a chain of
pre-shrunk copies, each half the size of the previous, and a filter that
samples from the copy whose texels match the pixel size. The four
`'...-mipmap-...'` values of {@link Filter} choose how to pick between
levels and within a level; `'linear-mipmap-linear'` (trilinear) is the
smooth default in most engines. The renderer calls `generateMipmap` after
uploading when the minification filter uses mipmaps.

The default in magic-pixels is `'nearest'` for both, the cheapest and
sharpest option; pass `minFilter` and `magFilter` in the options to change
it.

## Wrapping

`wrapS` and `wrapT` say what happens for texture coordinates outside 0..1
along U and V: `'clamp-to-edge'` (the default) stretches the border pixel,
`'repeat'` tiles the image, `'mirrored-repeat'` tiles with every other copy
flipped. Repeat modes let a small tile cover a large floor with UVs from 0
to 10.

## Color space

`colorSpace` tells the GPU what the bytes in the image mean: `'linear'`
(the default) uploads them unchanged, `'srgb'` uploads with an sRGB internal
format so the GPU converts sRGB-encoded values to linear ones when a shader
samples the texture. Anything meant to be looked at as a picture (a photo, a
hand-painted color texture) is sRGB; anything that is really just numbers
stored as an image (a normal map, a roughness map) is linear. See
[linear and sRGB color](../gltf/concepts.md#linear-and-srgb-color) for why
this matters and [texture extensions](../gltf/texture-extensions.md) for how
the renderer applies it.

## Orientation

WebGL uploads the image's first row of pixels at texture coordinate
`v = 0`, and by convention `v = 0` is the _bottom_ of the texture. Image
files store their first row at the _top_. `flipY` (default `false`) tells
the renderer to flip the image vertically during upload so `v = 0` lines up
with the top of the picture; the default keeps the old behaviour, where a
texture appears upside down unless the shader flips the V coordinate itself
(`1.0 - vUv.y`) or the UVs are authored the other way round.

## Upload and lifetime

The first time a texture is bound the renderer creates a GL texture,
uploads the image as 8-bit RGBA (or sRGB-encoded RGBA, see above), sets the
four sampling parameters and the flip flag, and, if needed, generates
mipmaps. The GL texture is cached in a map keyed by the {@link Texture}
object; the same texture in ten materials is uploaded once.
`renderer.dispose(texture)` frees it, and it is re-created if still used.

Textures are bound to units per draw in the order they appear in the
material's uniforms, starting from 0, so a shader with three samplers uses
units 0 to 2. WebGL2 guarantees at least 16 units in the fragment shader.

## Further reading

- [WebGL2 Fundamentals: 3D textures](https://webgl2fundamentals.org/webgl/lessons/webgl-3d-textures.html):
  texture coordinates, filtering, mipmaps and wrapping, with a mipmap
  visualizer.
- [WebGL2 Fundamentals: Cross origin images](https://webgl2fundamentals.org/webgl/lessons/webgl-cors-permission.html):
  why `crossOrigin = 'anonymous'` is needed and what the server has to send.
- [Learn OpenGL: Textures](https://learnopengl.com/Getting-started/Textures):
  the same concepts with figures for each filter and wrap mode.
- [MDN: Using textures in WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL)
  and [texImage2D](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/texImage2D):
  the upload call and its formats.
