---
title: Scene graph
---

# Scene graph

A scene is a tree. {@link Scene} is the root, {@link Mesh}es, cameras and
plain {@link Object3D}s are the nodes, and every node's transform is relative
to its parent. The whole point of the tree is that "relative to the parent"
composes: move the parent and every descendant moves with it.

## What an Object3D holds

- `position`, `rotation`, `scale`: three {@link Vector}s, the object's
  transform relative to its parent. `rotation` is Euler angles in radians,
  XYZ order (see [Matrices](./matrices.md#composing-transforms)).
- `localMatrix`: those three composed into one matrix, `T × R × S`.
- `worldMatrix`: `parent.worldMatrix × localMatrix`, the transform relative
  to the scene root. This is what the renderer uploads as `modelMatrix`.
- `parent` and `children`, maintained by `add()`, `remove()` and
  `removeFromParent()`. An object has one parent; adding it somewhere else
  moves it. `add()` refuses to create a cycle.
- `visible`: an invisible object and its whole subtree are skipped by
  `prepareScene()`.

## The tree walk

`updateWorldMatrix()` is the one function that turns the tree into matrices.
The renderer calls it on the scene at the start of every frame, and it
recurses depth-first:

1. If `matrixAutoUpdate` is true (the default), recompose `localMatrix` from
   position, rotation and scale. There is no change detection on the three
   vectors, so this always happens; composing is cheap.
2. If this object was flagged or an ancestor's world matrix changed,
   recompute `worldMatrix` from the parent's, clear the flag, call the
   `onWorldMatrixChanged()` hook (cameras use it to update their view
   matrix), and force all descendants to recompute too.
3. Recurse into the children with that `force` flag.

A camera that is not part of the scene gets its own `updateWorldMatrix()`
call from `prepareScene()`, so `scene.add(camera)` is optional. Adding it is
useful when the camera should follow an object: parent it to the object.

## Driving the matrix yourself

Set `matrixAutoUpdate = false` to stop the recompose in step 1, write to
`localMatrix` directly and set `worldMatrixNeedsUpdate = true` so step 2
runs. This is for cases where a matrix is the natural input: a transform
loaded from a file, a physics engine, an instance matrix. The three vectors
then no longer describe the object.

## Pivots

Because a child inherits its parent's rotation, `planet.add(moon)` with the
moon at `(2, 0, 0)` makes the moon orbit when `planet.rotation.y` changes.
But that also spins the planet. To rotate the moon around the planet without
rotating the planet, insert an empty {@link Object3D} as a pivot:

```js
const pivot = new Object3D();
planet.add(pivot);
pivot.add(moon);
moon.position.set(2, 0, 0);
pivot.rotation.y += dt;
```

The pivot sits at the planet's origin, so rotating it swings everything
attached to it around that origin. Empty nodes as pivots, hinges and joints
are the standard tool in any scene graph; a glTF file is full of them.

## lookAt

`object.lookAt(target)` sets `rotation` so that the object's +Z axis points at
`target`, a point in the _parent's_ coordinate system (the same system as
`position`). A camera's viewing direction is -Z, so {@link Camera} overrides
`lookAt` to point -Z at the target; both share `Mat4.lookAt`, which builds a
rotation from a forward vector and an `up` hint by two cross products.

The resulting matrix is converted back into Euler angles by
`setRotationFromMatrix()`, which reads the angles off the matrix entries and
handles the degenerate case where the Y rotation is ±90° and X and Z become
indistinguishable. With quaternions this round trip disappears.

## traverse

`object.traverse(callback)` visits the object and every descendant,
depth-first, in the order the renderer draws them. It is the tool for things
like "hide every mesh with this material" or "count the triangles".

## Further reading

- [WebGL2 Fundamentals: Scene graph](https://webgl2fundamentals.org/webgl/lessons/webgl-scene-graph.html):
  builds a solar system with nested nodes and pivots, the same example as
  above, from raw WebGL.
- [three.js manual: Scene graph](https://threejs.org/manual/#en/scenegraph):
  the three.js version, with the same `add()` / parent / children API.
- [3D Math Primer, chapter 8: Rotation in three dimensions](https://gamemath.com/book/orient.html):
  Euler angles, what gimbal lock is, converting between Euler angles and
  matrices (which is what `setRotationFromMatrix` does), and why quaternions
  exist.
