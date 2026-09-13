# Magic pixels

Magic pixels is a WebGL 3D library, which was originally developed under the name [colorful-pixels](https://github.com/sinnerschrader/colorful-pixels) at [SinnerSchrader](https://sinnerschrader.com).

As I left the company, development work will be continued in this fork.

## Why yet another WebGL library?

To be honest, there really is no need to build our own 3D library. There are many of these already out there.
This is actually a project by [Lea](https://github.com/learosema), and she decided building something like that anyway, just in order to learn how all this works.

## Features

- An API that is somewhat familiar to THREE
- `Vector`, `Matrix` classes, plus `Float32Array`-backed `Mat2`, `Mat3`, `Mat4` for transforms
- a scene graph: `Object3D` with `position`, `quaternion`/`rotation`, `scale`, `children`; `Scene`, `Mesh` and the cameras (`PerspectiveCamera`, `OrthographicCamera`) are `Object3D`s
- a `Renderer` interface at the "render a scene" level, implemented by `WebGL2Renderer`, which renders a `Scene` through a `Camera` and owns all GPU resources (programs, vertex array objects, buffers, textures)
- built-in matrix uniforms (`modelMatrix`, `viewMatrix`, `projectionMatrix`, `modelViewMatrix`, `normalMatrix`) set by the renderer
- a `NullRenderer` that draws nothing, for testing scene code without a GPU
- a `Mesh` contains a `BufferGeometry` and a `Material`,
- a `Material` is what's a `RawShaderMaterial` in THREE, it has uniform variables, shader sources per language (`material.glsl`) and a `drawMode`
- the `drawMode` is one of `DrawMode.TRIANGLES`, `DrawMode.POINTS`, `DrawMode.LINES`... (plain strings, no GL constants)
- the `BufferGeometry` API is also similar to three.js
- Helpers for creating orthographic, perspective projection and look-at matrices
- A `Stopwatch` class for timing (like `performance.now()` but with the possibility to start/stop)
- One-Liners (`mix`, `clamp`)
- Basic geometries (plane geometry, box geometry, sphere geometry and a custom geometry)

## API documentation

- https://learosema.github.io/magic-pixels/

## Getting started

- First, add it to your project via `npm install magic-pixels`.
- Add a `<canvas>` element to your DOM
- Initialize the WebGL2 renderer
- Add a resize event handler
- create a `Scene`, add `Mesh`es to it, and a `Camera`
- render the scene through the camera

magic-pixels requires a WebGL2 context. The built-in shaders are written in GLSL ES 3.00;
user-written shaders may use either GLSL ES 1.00 or 3.00.

### Initialize Renderer

```js
const canvas = document.querySelector('canvas');
const renderer = new WebGL2Renderer(canvas);
renderer.setSize(innerWidth, innerHeight);
```

`WebGL2Renderer` implements the `Renderer` interface (`render`, `setSize`, `setPixelRatio`, `dispose`).
Code that only needs to render a scene can depend on the interface. For unit tests of scene code
there is a `NullRenderer`, which needs no canvas and records the frames it was asked to render:

```js
const renderer = new NullRenderer();
renderer.render(scene, camera);
renderer.lastFrame.meshes; // opaque meshes, in tree order
renderer.lastFrame.transparent; // transparent meshes, sorted back to front
renderer.lastFrame.lights; // visible lights (always empty for now)
```

### Create a geometry

```js
// creates a plane geometry of width 2x2 with 3 width segments and 3 height segments
const planeGeometry = createPlaneGeometry(2, 2, 3, 3);

// creates a box geometry of width 1x1x1 with 3 width segments, height segments and depth segments
const boxGeometry = createBoxGeometry(1, 1, 1, 2, 2, 2);

// create a sphere geometry with 16 rings and 16 sides per ring
const sphereGeometry = createSphereGeometry(1, 1, 16, 16);
```

### Create a material

A material contains shader sources per shading language (`material.glsl = { vertex, fragment }`),
a `drawMode` and a `uniforms` object. A material is plain data: the renderer compiles one program per
material (shared by every mesh using it) and uploads the uniforms on each draw, skipping values that
did not change. Just assign to `material.uniforms.time = ...` (or mutate a `Vector` in place) and
render. Replacing `material.glsl.fragment` recompiles the program on the next render.

The setter for a uniform is chosen from the type declared in the shader, so a `Vector` works for
`vec2` and `ivec2` alike. A `Texture` uniform is uploaded on first use and bound to a texture unit
by the renderer.

The default drawMode is `DrawMode.TRIANGLES`. Draw modes, texture filters and wrapping modes are
plain strings (`'triangles'`, `'linear'`, `'repeat'`, ...) rather than GL constants; the `DrawMode`,
`Filter` and `Wrapping` objects list them. See [MDN:drawArrays](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/drawArrays) for what the modes mean.

A material also carries render state, all optional:

- `transparent` (default `false`) blends with `SRC_ALPHA, ONE_MINUS_SRC_ALPHA` instead of
  overwriting the framebuffer, and turns depth writes off unless `depthWrite` is set explicitly.
  Transparent meshes are drawn after opaque ones, sorted back to front.
- `side` (default `Side.DOUBLE`, no culling) restricts drawing to `Side.FRONT` or `Side.BACK`
  faces.
- `depthTest` / `depthWrite` (default `true`) control whether a fragment is discarded by what is
  already drawn, and whether it writes its own depth.

```js
const material = createShaderMaterial(vertexShader, fragmentShader, {
  time: 0,
  resolution: [800, 600],
  color: Color.fromHex('#ff00ff'),
});

// There are some predefined materials:

// just red
const defaultMaterial = createDefaultMaterial();
// just pink
const basicMaterial = createBasicMaterial('#ff00ff');
// the normals
const normalMaterial = createNormalMaterial();
```

### Create a mesh and render

```js
const mesh = new Mesh(geometry, material);
mesh.position.set(0, 0, -5);

const scene = new Scene();
scene.add(mesh);

const camera = new PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);

// render:
renderer.render(scene, camera);
```

The renderer clears color and depth before drawing (`renderer.autoClear = false` to keep the
previous frame, `renderer.setClearColor('#202020')` to change the color) and draws with depth
testing enabled.

### Scene graph

`Scene`, `Mesh` and the cameras extend `Object3D`. Every object has a `position`, a rotation and a
`scale` relative to its parent, and a list of `children`. The rotation is available both as a
`quaternion` and as Euler angles in `rotation` (radians, applied in XYZ order); write to either one
and the other follows on the next update (the quaternion wins if both changed). Before each render,
the renderer walks the tree and computes every object's `worldMatrix` as
`parent.worldMatrix × localMatrix`.

A child inherits its parent's transform, so it orbits when the parent rotates:

```js
const planet = new Mesh(sphereGeometry, material);
const moon = new Mesh(smallSphereGeometry, material);
planet.add(moon);
moon.position.set(2, 0, 0);
scene.add(planet);

function frame(dt) {
  planet.rotation.y += dt; // spins the planet and carries the moon around
}
```

To orbit the moon without spinning the planet, put an empty `Object3D` in between as a pivot:

```js
const pivot = new Object3D();
planet.add(pivot);
pivot.add(moon);
pivot.rotation.y += dt; // only the pivot (and the moon with it) rotates
```

Other useful bits: `object.visible = false` hides an object and its children,
`object.traverse(callback)` visits a subtree, `object.lookAt(target)` points the object's +Z axis
(for cameras: the viewing direction, -Z) at a point given in the parent's coordinate system.
To drive `localMatrix` yourself, set `matrixAutoUpdate = false` and flag changes with
`worldMatrixNeedsUpdate = true`.

Quaternions are what glTF stores and what animations interpolate. `slerp` moves between two
rotations along the shortest arc at constant speed:

```js
const from = Quaternion.fromEuler(new Vector(0, 0, 0));
const to = Quaternion.fromAxisAngle(new Vector(1, 1, 0).normalized, Math.PI);
mesh.quaternion.slerpQuaternions(from, to, t); // t from 0 to 1
```

### Writing shaders

Attribute locations are fixed by name, so no `layout(location = ...)` qualifiers are needed and
one geometry works with any program: `position` is location 0, `normal` is 1, `uv` is 2 and
custom attributes get the next free location in the order the renderer first sees them.

The renderer sets the built-in uniforms `modelMatrix`, `viewMatrix`, `projectionMatrix`,
`modelViewMatrix` (all `mat4`) and `normalMatrix` (`mat3`, the inverse transpose of the model-view
matrix) for every shader that declares them, unless the material defines a uniform of the same
name. The built-in vertex shader uses `modelViewMatrix`, `projectionMatrix` and `normalMatrix`.

```glsl
#version 300 es
precision highp float;
in vec3 position;
in vec3 normal;
in vec2 uv;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
out vec2 vUv;
out vec3 vNormal;

void main() {
  vUv = uv;
  vNormal = normalMatrix * normal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

### Textures

```js
const texture = await Texture.fromImageUrl('image.png', {
  minFilter: Filter.LINEAR,
  magFilter: Filter.LINEAR,
  wrapS: Wrapping.REPEAT,
  wrapT: Wrapping.REPEAT,
  colorSpace: ColorSpace.SRGB, // decode sRGB to linear on sample; default is 'linear'
});
material.uniforms.map = texture;

// for video or canvas textures, flag the texture after the image changed:
texture.needsUpdate = true;

// decode raw bytes (e.g. an image embedded in a binary file) without an <img>:
const fromBytes = await Texture.fromBlob(blob);
```

### Updating geometry

Write into an attribute's `data` and flag it; the renderer re-uploads it with `bufferSubData`
on the next render. Adding or removing attributes or calling `setIndex` bumps
`geometry.version`, which makes the renderer rebuild its buffers.

```js
const { position } = geometry.attributes;
position.data[0] += 0.1;
position.needsUpdate = true;
// hint for frequently changing data (DYNAMIC_DRAW):
position.dynamic = true;
```

### Freeing GPU resources

GPU resources live as long as the renderer, or until you dispose them.
Rendering an object again after disposing it recreates its resources.

```js
renderer.dispose(geometry); // buffers and VAO of one geometry
renderer.dispose(material); // the program of one material
renderer.dispose(texture); // one texture
renderer.dispose(); // everything; loses the context
```

### Camera

A camera is an `Object3D` with a `projectionMatrix`. Place it like any other object; its
`viewMatrix` (the inverse of its world matrix) is computed when the scene is rendered. A camera can
also be a child of another object, e.g. a pivot to orbit it around a point.

```js
const camera = new PerspectiveCamera(70, innerWidth / innerHeight, 0.01, 100);
camera.position.set(0, 2, 5);
camera.lookAt(new Vector(0, 0, 0));

// on resize:
camera.aspect = innerWidth / innerHeight;
camera.updateProjectionMatrix();

// parallel projection:
const ortho = new OrthographicCamera(-2, 2, 1, -1, 0.1, 100);
```

The projection helpers `perspective`, `frustum` and `ortho` (returning a `Matrix`) and their
`Mat4` counterparts (`Mat4.perspective(...)`) are still available if you want to pass matrices
through your own uniforms.

### Vector/matrix arithmetics

magic-pixels provide basic vector and matrix arithmetics classes.
You can use the `mul` method on the Matrix class for matrix multiplication.

```js
const a = new Vector(1, 0, 0);
const b = new Vector(0, 1, 0);
const c = a.cross(b);
const d = a.add(b);
```

### Transformation matrices

`Mat2`, `Mat3` and `Mat4` are fixed-size, `Float32Array`-backed matrices in column-major order
(ready to be uploaded as uniforms). Their operations work in place and allocate nothing, which is
what the scene graph uses per frame. `Matrix` remains the general-purpose class; convert with
`mat4.toMatrix()` and `Mat4.fromMatrix(matrix)`.

```js
// identity matrix
const identity = Mat4.identity();
// translate object in space
const translationMatrix = Mat4.translation(tx, ty, tz);
// rotation matrix, composed in place
const DEG = Math.PI / 180;
const rotationMatrix = Mat4.rotX(30 * DEG)
  .multiply(Mat4.rotY(45 * DEG))
  .multiply(Mat4.rotZ(-5 * DEG));
// translation × rotation × scale, as used by Object3D; the rotation is a
// Quaternion or Euler XYZ angles
const model = new Mat4().compose(position, quaternion, scale);
const fromEuler = new Mat4().compose(position, rotation, scale);
const rotationOnly = Mat4.rotationFromQuaternion(quaternion);
const inverse = model.clone().invert();
// normal matrix for a model(-view) matrix
const normalMatrix = new Mat3().setNormalMatrix(model);
```

### Color helper

The color helper converts a hex color string to a GLSL-friendly vec3 or vec4 value.

```js
const color = Color.fromHex('#ff00ff');
// returns a Color with {red = 255, green = 0, blue = 255, alpha = 255}
color.toVec3();
// returns [1, 0, 1]
color.toVec4();
// returns [1, 0, 1, 1]
```

## Examples

The `examples/` folder holds small self-contained demos, one HTML file each; they are deployed
with the docs at [learosema.github.io/magic-pixels/examples](https://learosema.github.io/magic-pixels/examples/).
To run them locally, `npm run build:examples` copies the current bundle next to them, then serve the
folder with any static file server.

### On Codepen

Trigger Warning: these examples can cause sickness to people with motion sensitivities.

- [Sinebox](https://codepen.io/learosema/pen/LYxeYGX)
- [A blob and a background](https://codepen.io/learosema/pen/YzNEyqm)

## Releasing

Releases are cut in two steps, both driven from GitHub:

1. Every push to `main` runs [release-please](https://github.com/googleapis/release-please), which opens or updates a release pull request with the version bump and `CHANGELOG.md`, based on [Conventional Commits](https://www.conventionalcommits.org/) (`feat:` = minor, `fix:` = patch, `feat!:` or a `BREAKING CHANGE:` footer = major). Merging that PR creates the git tag and the GitHub release.
2. Run the **Release** workflow manually from the Actions tab. It builds the tagged commit and stages it on npm via trusted publishing. The version becomes installable only after a maintainer approves it in the _Staged Packages_ tab on npmjs.com or with `npm stage approve`.
