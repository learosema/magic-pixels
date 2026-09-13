---
title: Typed vertex attributes
---

# Typed vertex attributes

A vertex attribute does not have to be a 32 bit float. WebGL2 can read a
position, a UV or a colour straight out of a smaller integer type, and
optionally rescale it on the way in. glTF leans on this heavily - it is how
`KHR_mesh_quantization` shrinks a model's vertex data several times over
with no visible loss of quality. This page is about the GPU feature behind
it, not about the loader; the loader (step 7) only has to read the accessor
metadata and hand the right typed array to {@link BufferAttribute}.

## The component types

`gl.vertexAttribPointer(location, size, type, normalized, stride, offset)`
takes a `type` naming the numbers in the buffer and a `normalized` flag
saying what to do with them. WebGL2 accepts eight `type` values; magic-pixels
now supports all of them because each maps one-to-one to a JavaScript typed
array:

| `type`           | bytes | JS array       | signed range  |
| ---------------- | ----- | -------------- | ------------- |
| `BYTE`           | 1     | `Int8Array`    | -128..127     |
| `UNSIGNED_BYTE`  | 1     | `Uint8Array`   | 0..255        |
| `SHORT`          | 2     | `Int16Array`   | -32768..32767 |
| `UNSIGNED_SHORT` | 2     | `Uint16Array`  | 0..65535      |
| `INT`            | 4     | `Int32Array`   | -2³¹..2³¹−1   |
| `UNSIGNED_INT`   | 4     | `Uint32Array`  | 0..2³²−1      |
| `FLOAT`          | 4     | `Float32Array` | any           |

Without `normalized`, the GPU casts the stored integer straight to a float
in the shader: a `Uint8Array` value of `200` arrives as `200.0`, which is
only useful for things that are genuinely small integers (a bone index, a
material ID). With `normalized`, the same byte is rescaled to the unit range
instead, so it can stand in for a float that happens to only need 8 or 16
bits of precision:

```
unsigned: value / (2^bits − 1)              → 0 .. 1
signed:   max(value / (2^(bits−1) − 1), −1) → −1 .. 1
```

A normalized `Uint8` UV coordinate of `255` becomes `1.0`, `128` becomes
`≈0.502`; a normalized `Int16` position of `32767` becomes `≈1.0`. The
`max(..., −1)` in the signed formula exists because the negative range has
one more representable value than the positive one (`-32768` vs `32767`);
without the clamp `-32768 / 32767` would slip fractionally past `-1`.

## Why bother

A `Float32Array` position costs 12 bytes per vertex; a normalized `Int16Array`
costs 6, at a precision of about 1 part in 32000 across whatever range the
mesh occupies - once the mesh is scaled to fit in `-1..1` (which the exporter
does, storing the true scale separately), that is finer than a screen pixel
for anything but extreme close-ups. UVs in `0..1` are an even better fit for
a normalized `Uint8` or `Uint16`: there is no meaningful precision lost,
because the source texture only has so many pixels to sample anyway. Halving
or quartering every vertex halves or quarters the file size and the memory
bandwidth spent reading it - free performance, which is why glTF exporters
default to it and `KHR_mesh_quantization` exists to make it official.

## In magic-pixels

{@link BufferAttribute.data} accepts any of the seven typed arrays above (not
`Float32Array` only, as before), and a third constructor argument sets
{@link BufferAttribute.normalized}. `WebGL2Renderer` reads the GL `type` off
`data`'s constructor - `Int16Array` always means `SHORT`, so there is nothing
to keep in sync - and forwards `normalized` unchanged to
`vertexAttribPointer`. Nothing else about a geometry changes: `count`,
`needsUpdate`, `dynamic` and the buffer-rebuild rules from
[Geometry](../core/geometry.md) all work the same regardless of which typed
array backs an attribute.

The index buffer got the same treatment as a side effect: `BufferGeometry.index`
now stores a `Uint16Array`/`Uint32Array` directly instead of a plain
`number[]` that the renderer had to copy into a typed array on every upload.
`setIndex()` keeps its `ArrayLike<number>` signature, so existing calls are
unaffected.

Where it lives:

- `src/geometries/buffer-geometry.ts`: the `TypedArray` union,
  {@link BufferAttribute}'s `normalized` field, and `BufferGeometry.index`'s
  new type.
- `src/webgl/gl-constants.ts`: `glComponentType()`, a typed array constructor
  → GL `type` lookup.
- `src/webgl/webgl2-renderer.ts`: `createGeometryResources()` passes the
  derived type and `normalized` to `vertexAttribPointer`; the index buffer
  upload no longer re-wraps `geometry.index` in a fresh typed array.

## Try it

[Typed vertex attributes](https://learosema.github.io/magic-pixels/examples/05-typed-attributes/)
renders the same box twice: once with the usual `Float32Array` attributes,
once quantized into normalized `Int16Array`/`Int8Array`/`Uint8Array`s built
by hand from the same source data. The two are visually identical - open the
source and change one of the multipliers (`* 32767`, `* 127`, `* 255`) to
something smaller to see the quantization error appear as the box's surface
starts to facet.

## Further reading

- [WebGL2 Fundamentals: Attributes](https://webgl2fundamentals.org/webgl/lessons/webgl-attributes.html):
  what each `vertexAttribPointer` argument does, `normalized` included.
- [OpenGL ES 3.0 specification, §2.9.1 (Vertex Attribute Access)](https://registry.khronos.org/OpenGL/specs/es/3.0/es_spec_3.0.pdf):
  the exact normalization formulas for each integer type.
- [glTF 2.0 specification: `KHR_mesh_quantization`](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_mesh_quantization/README.md):
  which accessor component types the extension allows per attribute, and why
  positions still need a `scale`/`offset` to recover world units.
- [Khronos glTF: Mesh geometry - accessor component types](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#accessor-data-types):
  the same table this page draws, from the glTF side.
- [MDN: vertexAttribPointer](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/vertexAttribPointer):
  reference for the call the renderer makes per attribute.
