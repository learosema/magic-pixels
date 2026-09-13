---
title: Geometry
---

# Geometry

A {@link BufferGeometry} is the vertex data of a mesh: a set of named
attributes, an optional index, and a count. It is plain data. The renderer
turns it into GPU buffers and a vertex array object the first time it is
drawn.

## Attributes

An attribute is one per-vertex value: position, normal, texture coordinate,
colour, anything the vertex shader declares with `in`. A
{@link BufferAttribute} is a typed array plus a `recordSize`, the number of
components per vertex. Positions are `recordSize` 3, UVs 2. The attribute's
`count` is `data.length / recordSize`.

```js
const geometry = new BufferGeometry();
geometry.setAttribute(
  'position',
  new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]), 3)
);
```

The attribute _name_ is the link to the shader: the renderer looks up
`position` in the program's inputs. Names are also how vertex attribute
_locations_ are assigned, see below.

`data` does not have to be a `Float32Array`. Any of the eight WebGL2 vertex
component types works: `Int8Array`, `Uint8Array`, `Int16Array`,
`Uint16Array`, `Int32Array`, `Uint32Array` and `Float32Array`. The renderer
reads the GL type off the array's constructor, so passing an `Int16Array`
for `position` needs nothing else. A third constructor argument,
`normalized`, tells the GPU to map an integer's range onto `-1..1` (signed)
or `0..1` (unsigned) instead of passing it straight through - the way glTF
stores UVs as normalized `Uint8Array`s or `Uint16Array`s, and quantized
positions as normalized `Int16Array`s, to shrink a file with no visible loss
of precision:

```js
// UVs quantized to 8 bit: a quarter of the Float32Array size, unnoticeable
// for texture lookups
geometry.setAttribute(
  'uv',
  new BufferAttribute(new Uint8Array([0, 0, 255, 0, 128, 255]), 2, true)
);
```

## Indexed and non-indexed geometry

Without an index, the GPU reads vertices in order and forms one primitive
per `recordSize` group: for `DrawMode.TRIANGLES`, vertices 0-1-2 make the
first triangle, 3-4-5 the second. A cube drawn that way needs 36 vertices,
and each corner is stored three times with the three different normals of
the faces that meet there.

With an index (`setIndex([...])`), the GPU reads the index array instead and
looks each vertex up. Shared vertices are stored once. `count` then means the
number of indices, and the draw call is `drawElements` instead of
`drawArrays`. `setIndex` stores the indices as a `Uint16Array` by default,
which covers 65 535 vertices; pass `32` as the second argument for a
`Uint32Array` for larger meshes. `createIndexedGeometry()` converts a
non-indexed geometry by merging identical vertices.

Sharing only works when everything at a vertex is shared. A cube's corner
has three normals, so an indexed cube still stores each corner three times,
once per face; an indexed sphere shares nearly everything.

## Built-in geometries

`createPlaneGeometry`, `createBoxGeometry` and `createSphereGeometry` all
produce `position`, `normal` and `uv` attributes. The sphere is indexed; the
plane and the box are built from quads via `facesToBuffer()`, which expands a
list of faces (arrays of vertex indices) into a flat non-indexed array.
`calculateSurfaceNormal()` gives the normal of a triangle from its three
corners via a cross product, for geometry you build yourself.
`mergeGeometries()` concatenates geometries with the same attributes into
one, which turns many draw calls into one.

## Changing a geometry

Two kinds of change, two mechanisms:

- **Contents.** Write into `attribute.data` and set
  `attribute.needsUpdate = true`. The renderer re-uploads that one buffer
  with `bufferSubData` on the next draw (or reallocates if the array's size
  changed). Set `attribute.dynamic = true` up front for data that changes
  every frame; it becomes a `DYNAMIC_DRAW` hint to the driver.
- **Structure.** Adding or removing an attribute or setting an index bumps
  `geometry.version`. The renderer sees the version mismatch and rebuilds
  the whole vertex array object.

## On the GPU: buffers, VAOs and locations

For each geometry the renderer creates one GL buffer per attribute, one
index buffer if there is an index, and one _vertex array object_ (VAO) that
records which buffer feeds which attribute location with what layout. Binding
the VAO before a draw restores all of that in one call, which is why WebGL2
has them.

The catch: a VAO speaks in _locations_ (0, 1, 2, ...), not names, and each
compiled program decides its own name-to-location mapping unless told
otherwise. If `position` were location 0 in one program and 1 in another,
one VAO could not serve both. The renderer therefore fixes locations by name
before linking any program, with `bindAttribLocation`: `position` is 0,
`normal` is 1, `uv` is 2, and every other name gets the next free number the
first time the renderer meets it, whether in a geometry or a shader. Users
never write `layout(location = ...)` and a geometry works with any material.
The limit is `MAX_VERTEX_ATTRIBS`, 16 on most hardware.

`groups` exists on the geometry for drawing sub-ranges with different
materials, as in three.js, but the renderer does not use it yet; a glTF
mesh with several materials becomes several meshes instead.

## Further reading

- [WebGL2 Fundamentals: Attributes](https://webgl2fundamentals.org/webgl/lessons/webgl-attributes.html):
  what `vertexAttribPointer` records and how vertex array objects capture
  it.
- [WebGL2 Fundamentals: Indexed vertices](https://webgl2fundamentals.org/webgl/lessons/webgl-indexed-vertices.html):
  `drawElements` and when sharing vertices pays off.
- [WebGL2 Fundamentals: Drawing multiple things](https://webgl2fundamentals.org/webgl/lessons/webgl-drawing-multiple-things.html):
  the per-object loop of program, attributes, uniforms, draw that the
  renderer runs.
- [MDN: vertexAttribPointer](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/vertexAttribPointer)
  and [WebGLVertexArrayObject](https://developer.mozilla.org/en-US/docs/Web/API/WebGLVertexArrayObject):
  reference for the calls and the layout parameters (size, type,
  normalized, stride, offset).
- [three.js manual: Custom BufferGeometry](https://threejs.org/manual/#en/custom-buffergeometry):
  the three.js `BufferGeometry` that this one imitates, building a cube by
  hand.
