---
title: Building geometry by hand
---

# Building geometry by hand

`createBoxGeometry` and friends cover the basics. Anything else, a roof, a
fence, a low-poly tree, is a {@link BufferGeometry} you fill yourself. The
[Geometry](./geometry.md) page explains what the buffers are; this one is
about deciding what goes into them.

## A mesh is a list of triangles

The GPU draws triangles and nothing else. Every triangle has three vertices,
and every vertex carries a few numbers: where it is (`position`), which way
the surface faces there (`normal`) and, if a texture is involved, where to
look it up (`uv`). Building geometry means producing those arrays. A
non-indexed geometry is just three vertices per triangle, one triangle after
the other.

## Which side is the front

A triangle has two sides, and by default the PBR material draws only one of
them (`doubleSided: false`): the GPU skips triangles that face away from the
camera, called _back face culling_, since on a closed object you can never
see them anyway. Which side is the front is decided by the order of the three
vertices: **counter-clockwise, seen from outside, is the front**.

The order also decides which way the surface normal points. For a triangle
with corners `a`, `b`, `c`, the cross product `(b - a) × (c - a)` points
towards you when the corners run counter-clockwise (the right-hand rule: curl
your fingers along a → b → c, your thumb is the normal).
{@link calculateSurfaceNormal} does exactly this. So a face that vanishes
from outside and shows from inside has its corners in the wrong order; swap
two of them.

## Normals decide how it is lit

Lighting compares the light direction with the normal, so the normal is what
makes a surface look flat or round:

- **Flat shading.** Every triangle gets its own normal, the same at all three
  corners. Corners are not shared between faces, so the geometry stays
  non-indexed. This is the faceted, low-poly look, and it is the right choice
  for anything with hard edges: houses, roofs, boxes.
- **Smooth shading.** Each shared vertex gets the average of the normals of
  the triangles around it, so light changes gradually across faces. That is
  what {@link createSphereGeometry} does, and it needs indexed vertices to be
  worth it.

The rule of thumb: an edge you want to see needs two different normals at the
same position, which means two vertices there.

## A gabled roof

A triangular prism: two triangles for the gables, two quads for the slopes and
one for the underside. {@link facesToBuffer} turns a list of faces (arrays of
three or four vertex indices, corners counter-clockwise from outside) into a
flat array of positions and splits quads into two triangles. Then the loop
gives every triangle its normal, copied three times.

```js
import {
  BufferGeometry,
  BufferAttribute,
  Vector,
  facesToBuffer,
  calculateSurfaceNormal,
} from 'magic-pixels';

function createRoofGeometry(width, depth, height) {
  const w = width / 2;
  const d = depth / 2;
  const vertices = [
    new Vector(-w, 0, d), // 0..2: the front gable
    new Vector(w, 0, d),
    new Vector(0, height, d),
    new Vector(-w, 0, -d), // 3..5: the back gable
    new Vector(w, 0, -d),
    new Vector(0, height, -d),
  ];
  const faces = [
    [0, 1, 2], // front gable, looking at +z
    [4, 3, 5], // back gable, looking at -z
    [1, 4, 5, 2], // right slope
    [3, 0, 2, 5], // left slope
    [0, 3, 4, 1], // underside
  ];
  const position = facesToBuffer(faces, vertices);

  // three floats per vertex, nine per triangle
  const normal = [];
  for (let i = 0; i < position.length; i += 9) {
    const [a, b, c] = [0, 3, 6].map(
      (o) =>
        new Vector(position[i + o], position[i + o + 1], position[i + o + 2])
    );
    const n = calculateSurfaceNormal(a, b, c).toArray();
    normal.push(...n, ...n, ...n);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array(position), 3)
  );
  geometry.setAttribute(
    'normal',
    new BufferAttribute(new Float32Array(normal), 3)
  );
  return geometry;
}
```

Put it on top of a box: `roof.position.y = boxHeight` (the roof's base sits
at `y = 0`) and make it a child of the same {@link Object3D} as the box, so
the house moves as one.

Two things worth noticing. The gables and the slopes share corner positions
but not vertices, since each face needs its own normal there. And there is
no `uv` attribute: it is only needed once a material samples a texture. Add
a `uv` attribute of `recordSize` 2, one pair per vertex in the same order as
`position`, when you want one.

## Building many pieces

Fifty houses of one shape are fifty meshes sharing one geometry, which is
cheap: the renderer uploads the buffers once. To bake different pieces into a
single mesh instead, for example a house body and its roof, or a whole street,
{@link mergeGeometries} concatenates geometries into one, which means one
draw call. Merge what never moves independently; keep separate meshes for
what does.

## Something to try

Add a chimney: a thin box as a second piece, standing on a slope. Then make
the roof overhang the walls by widening it a little, which is what makes a box
with a roof look like a house. Finally, flip the order of one face in `faces`
and watch it disappear from outside; then set `doubleSided: true` on the
material and watch it come back.

## Further reading

- [three.js manual: Custom BufferGeometry](https://threejs.org/manual/#en/custom-buffergeometry):
  the same idea in three.js, building a cube face by face, including
  normals and UVs.
- [WebGL2 Fundamentals: Attributes](https://webgl2fundamentals.org/webgl/lessons/webgl-attributes.html):
  how the arrays end up as vertex inputs of a shader.
- [Learn OpenGL: Face culling](https://learnopengl.com/Advanced-OpenGL/Face-culling):
  winding order and why the GPU can skip back faces.
- [Learn OpenGL: Basic lighting](https://learnopengl.com/Lighting/Basic-Lighting):
  how the normal enters the lighting equation.
- [3D Math Primer for Graphics and Game Development](https://gamemath.com/book/geomprims.html):
  triangles, normals and the cross product, with the right-hand rule spelled
  out.
