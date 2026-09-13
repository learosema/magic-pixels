---
title: Cameras and coordinates
---

# Cameras and coordinates

## The coordinate system

magic-pixels uses the conventions of OpenGL and three.js: a right-handed
system with +X to the right, +Y up and +Z towards the viewer. A camera at the
origin with no rotation looks down -Z. Angles are in radians, positive is
counter-clockwise when looking down the axis towards the origin.

"Right-handed" is a fact about which way the third axis points once two are
chosen: point your right index finger along +X and middle finger along +Y,
and your thumb gives +Z. It matters because cross products, normals and
rotation directions all flip in a left-handed system, and mixing the two is a
classic source of inside-out models.

## The four spaces a vertex passes through

A vertex position from a geometry goes through four coordinate systems on
its way to the screen, one matrix multiplication per step:

1. **Object space.** The numbers in the `position` attribute. A sphere from
   `createSphereGeometry()` is centred on the origin here.
2. **World space.** After `modelMatrix` (the object's `worldMatrix`). Where
   the vertex is in the scene.
3. **View space** (also eye space, camera space). After `viewMatrix`. The
   camera is at the origin looking down -Z. Lighting is easiest here, so the
   built-in vertex shader passes the view-space position and normal to the
   fragment shader.
4. **Clip space.** After `projectionMatrix`. A 4D position `(x, y, z, w)`.
   The GPU clips triangles against `-w ≤ x, y, z ≤ w`, then divides by `w`
   (the _perspective divide_) to get normalised device coordinates from -1
   to 1 on each axis, which map to the viewport.

The renderer provides `modelViewMatrix` (`viewMatrix × modelMatrix`) as a
built-in uniform because most shaders never need world space on its own.

## The view matrix is an inverse

The camera is an {@link Object3D}. Its `worldMatrix` places the camera in the
world like it would place a mesh. But to draw from the camera's point of view
we need the opposite: a transform that moves the world so the camera ends up
at the origin. That is the inverse of the camera's world matrix, and
{@link Camera} recomputes it in `onWorldMatrixChanged()` whenever the tree
walk updates the camera:

```
viewMatrix = worldMatrix⁻¹
```

Two consequences follow. Moving the camera to `(0, 0, 5)` moves the world to
`z = -5` in view space, in front of the camera. And parenting a camera to
an object works without any special code: its world matrix already includes
the parent's transform.

## Perspective projection

{@link PerspectiveCamera} takes a vertical field of view in degrees, an
aspect ratio, and near and far distances. `Mat4.setPerspective` turns the
field of view into the half-height of the near plane,
`top = near × tan(fov / 2)`, and the aspect ratio into its half-width, then
calls `setFrustum`, which builds the standard OpenGL frustum matrix:

```
| 2n/(r-l)     0      (r+l)/(r-l)      0      |
|    0      2n/(t-b)  (t+b)/(t-b)      0      |
|    0         0     -(f+n)/(f-n)  -2fn/(f-n) |
|    0         0          -1           0      |
```

The `-1` in the bottom row is the trick: it copies `-z` (the distance in
front of the camera) into `w`, so the perspective divide shrinks far things.
The third row maps the depth range `[-near, -far]` to `[-1, 1]` non-linearly;
depth precision is concentrated near the near plane, which is why a tiny
`near` value causes z-fighting far away.

The horizontal field of view is derived from the vertical one and the
aspect ratio, so resizing the canvas needs `camera.aspect = width / height`
followed by `camera.updateProjectionMatrix()`.

## Orthographic projection

{@link OrthographicCamera} maps a box `[left, right] × [bottom, top] ×
[near, far]` straight onto the clip cube with a scale and a translation; `w`
stays 1, so there is no perspective divide and parallel lines stay parallel.
It is the camera for 2D and for UI, and for isometric looks.

## Normals

Normals go from object space to view space with `normalMatrix`, the inverse
transpose of the model-view matrix (see
[Matrices](./matrices.md#inverse-and-the-normal-matrix)). The renderer
computes it per mesh only when the shader declares the uniform.

## Further reading

- [WebGL2 Fundamentals: 3D perspective](https://webgl2fundamentals.org/webgl/lessons/webgl-3d-perspective.html)
  and [3D camera](https://webgl2fundamentals.org/webgl/lessons/webgl-3d-camera.html):
  the perspective divide and the view matrix as the inverse of the camera's
  matrix, with interactive examples.
- [Song Ho Ahn: OpenGL projection matrix](https://www.songho.ca/opengl/gl_projectionmatrix.html)
  and [OpenGL transformation](https://www.songho.ca/opengl/gl_transform.html):
  the full derivation of the frustum and orthographic matrices above, line
  by line, and the chain of coordinate spaces.
- [Learn OpenGL: Coordinate systems](https://learnopengl.com/Getting-started/Coordinate-Systems)
  and [Camera](https://learnopengl.com/Getting-started/Camera): the four
  spaces with diagrams, and building a look-at matrix by hand.
- [Scratchapixel: Perspective and orthographic projection matrix](https://www.scratchapixel.com/lessons/3d-basic-rendering/perspective-and-orthographic-projection-matrix/):
  starts from the pinhole camera and arrives at the same matrix.
- [Nathan Reed: Depth precision visualized](https://developer.nvidia.com/content/depth-precision-visualized):
  why depth is non-linear and what that does to `near` and `far`.
- [3D Math Primer, chapter 3: Multiple coordinate spaces](https://gamemath.com/book/multiplespaces.html):
  object, world and camera space and handedness.
