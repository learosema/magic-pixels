---
title: Matrices
---

# Matrices

A 4x4 matrix is the workhorse of 3D graphics because one matrix can hold a
translation, a rotation and a scale at once, and multiplying two matrices
chains their transforms. magic-pixels has a general `Matrix` class for any
size, and the fixed-size {@link Mat2}, {@link Mat3} and {@link Mat4}, which
are what the scene graph and the renderer use. This page is about
{@link Mat4}.

## Layout: column-major

`Mat4.values` is a `Float32Array` of 16 numbers in _column-major_ order, the
layout GLSL expects. Written out, the array indices sit in the matrix like
this:

```
| 0  4   8  12 |
| 1  5   9  13 |
| 2  6  10  14 |
| 3  7  11  15 |
```

So the first four numbers are the first _column_, not the first row. That is
easy to get wrong when reading the `set([...])` literals in the source: each
line of four in those literals is a column. The convention pays off in two
places: `uniformMatrix4fv` takes the array as is, and the columns have
meaning.

## What the columns mean

A transform matrix applied to a point `p = (x, y, z, 1)` computes
`x * col0 + y * col1 + z * col2 + 1 * col3`. Read that as: the first three
columns are where the X, Y and Z axes of the object end up, and the fourth
column is where its origin ends up. A translation matrix is the identity with
the offset in column 3 (indices 12, 13, 14). A scaling matrix stretches the
three axis columns. A rotation matrix replaces the three axis columns with
three new perpendicular unit vectors.

That reading also explains `getPosition()`: the position of an object is
column 3 of its world matrix, nothing to compute.

The fourth component of `p` is 1 for points so the translation applies. For
a direction vector it is 0, and the translation column drops out, which is
exactly what a direction needs.

## Composing transforms

Multiplying matrices `A × B` produces a matrix that applies `B` first, then
`A`. This is the source of most confusion with matrices, so it is worth
stating the two orders used in the library:

- **Local matrix** = `T × R × S`. Scale first, then rotate, then translate.
  That is what you want: scaling an object around its own origin before
  moving it somewhere. `Mat4.compose(position, rotation, scale)` builds this
  directly, without three separate matrices, by scaling the columns of the
  rotation matrix and writing the position into column 3. The rotation can
  be a {@link Quaternion} (what the scene graph passes) or Euler angles.
- **Rotation** = `Rx × Ry × Rz` for Euler angles in "XYZ order". Applied to
  a vector, the Z rotation happens first in world terms. The more useful
  reading is _intrinsic_: rotate the object around its own X axis, then
  around its new Y axis, then its new Z axis. Order matters because rotations
  do not commute; the same three angles in a different order give a
  different orientation. Euler angles also have two well-known limits:
  three sequential rotations can lose a degree of freedom (gimbal lock),
  and two orientations cannot be interpolated cleanly. Quaternions solve
  both, and `Mat4.rotationFromQuaternion(q)` turns one into a rotation
  matrix without any trigonometry; see [Quaternions](../gltf/quaternions.md).
- **World matrix** = `parent.worldMatrix × localMatrix`: apply the local
  transform, then the parent's, then the grandparent's, and so on up the
  tree.
- **In the vertex shader:** `projectionMatrix × viewMatrix × modelMatrix ×
position`. Read right to left: object space, world space, view space, clip
  space.

## In-place operations

Every method on {@link Mat4} writes into `this` and returns `this`:
`a.multiply(b)` changes `a`. A frame with a thousand objects composes and
multiplies a few thousand matrices, and allocating a new `Float32Array` for
each would make the garbage collector part of the frame budget. When the
original is still needed, `a.clone().multiply(b)` allocates once. The
scene graph relies on this: `object.localMatrix` and `object.worldMatrix`
are allocated once with the object and overwritten every frame.

## Inverse and the normal matrix

`invert()` computes the inverse with the closed-form cofactor expansion for
4x4 matrices; a singular matrix (determinant zero, for example a scale of 0)
becomes the zero matrix rather than throwing. The camera needs it every
frame: the view matrix is the inverse of the camera's world matrix.

Normals need special care. Transforming a normal with the model matrix is
wrong as soon as the scale is non-uniform: stretch a sphere along X and the
normals must tilt _towards_ the stretched axis, but the model matrix would
stretch them along it. The correct matrix is the inverse transpose of the
upper-left 3x3 of the model-view matrix, which is what
`Mat3.setNormalMatrix(mat4)` computes and the renderer uploads as
`normalMatrix`. For a pure rotation the inverse transpose is the matrix
itself, so nothing changes in the common case.

## Further reading

- [3D Math Primer](https://gamemath.com/): the chapters on matrices, matrix
  transformations and multiple coordinate spaces cover everything on this
  page with more figures, and the chapter on rotation in three dimensions
  compares Euler angles, matrices and quaternions.
- [Immersive Linear Algebra](https://immersivemath.com/ila/): an interactive
  textbook; the chapters on vectors, the dot and cross product and matrices
  are the prerequisites.
- [3Blue1Brown: Essence of linear algebra](https://www.3blue1brown.com/topics/linear-algebra):
  video series on what a matrix _does_, which is the right mental model for
  transforms.
- [WebGL2 Fundamentals: 2D matrices](https://webgl2fundamentals.org/webgl/lessons/webgl-2d-matrices.html),
  [3D orthographic](https://webgl2fundamentals.org/webgl/lessons/webgl-3d-orthographic.html)
  and [matrix naming](https://webgl2fundamentals.org/webgl/lessons/webgl-matrix-naming.html):
  builds up translation, rotation and scale matrices from scratch and settles
  the model/view/projection vocabulary.
- [Learn OpenGL: Transformations](https://learnopengl.com/Getting-started/Transformations):
  the same material with GLM and column-major matrices.
- [Lighthouse3D: The normal matrix](https://www.lighthouse3d.com/tutorials/glsl-12-tutorial/the-normal-matrix/):
  why normals need the inverse transpose, with the algebra.
