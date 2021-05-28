# Magic pixels

Magic pixels is a WebGL 3D library, which was originally developed under the name [colorful-pixels](https://github.com/sinnerschrader/colorful-pixels) at [SinnerSchrader](https://sinnerschrader.com).

As I left the company, development work will be continued in this fork.

## Why yet another WebGL library?

To be honest, there really is no need to build our own 3D library. There are many of these already out there.
This is actually a project by [Lea](https://github.com/terabaud), and she decided building something like that anyway, just in order to learn how all this works.

## Features

- An API that is somewhat familiar to THREE
- `Vector`, `Matrix` classes
- a `Renderer` which renders `Mesh`es
- a `Mesh` contains a `BufferGeometry` and a `Material`,
- a `Material` is what's a `RawShaderMaterial` in THREE, it has uniform variables, vertex and fragment shaders and a `drawMode`
- the `drawMode` is one of those WebGL constants `gl.TRIANGLES`, `gl.POINTS`, `gl.LINES`...
- the `BufferGeometry` API is also similar to three.js
- Helpers for creating orthographic, perspective projection matrices
- A `Stopwatch` class for timing (like `performance.now()` but with the possibility to start/stop)
- One-Liners (`mix`, `clamp`)
- Basic geometries (plane geometry, box geometry, sphere geometry and a custom geometry)

## API documentation

- https://terabaud.github.io/magic-pixels/

## Getting started

- First, add it to your project via `npm install magic-pixels`.
- Add a `<canvas>` element to your DOM
- Initialize the WebGL renderer
- Add a resize event handler
- create a scene, consisting of Meshes (a scene is an array of meshes)

### Initialize Renderer

```js
const canvas = document.querySelector('canvas');
const renderer = new Renderer(canvas);
renderer.setSize(innerWidth, innerHeight);
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

A material contains a `vertexShader`, a `fragmentShader`, a `drawMode` and a `uniforms` object.
When a mesh is initialized, the `uniforms` object is wrapped by a ES6 Proxy, so the state in the gl context is automatically updated.

The default drawMode is `gl.TRIANGLES`, see [MDN:drawArrays](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/drawArrays) for more options.

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

// currently, the scene is just an array of meshes:
const scene = [mesh];

// render:
renderer.render(scene);
```

### Camera

```js
const camera = new Camera();
camera.position.set(0, 0, 5);
camera.target.set(0, -0.5, 0);
camera.update();
console.log('camera matrix:', camera.cameraMatrix);
console.log('view matrix:', camera.viewMatrix);
// the view matrix is the inverse of the camera matrix
// you can pass these into the material.uniforms object.
```

### Perspective projection

The camera (currently) does not do projection by itself, but you can create a perspective projection matrix:

```js
const fieldOfView = 70;
const aspectRatio = innerWidth / innerHeight;
const near = 0.01;
const far = 100;
material.uniforms.projectionMatrix = perspective(
  fieldOfView,
  aspectRatio,
  near,
  far
);
```

### Vector/matrix arithmetics

magic-pixels provide basic vector and matrix arithmetics classes.
You can use the `mul` method on the Matrix class for matrix multiplication.

```js
const a = new Vector(1, 0, 0);
const b = new Vector(0, 1, 0);
const c = a.cross(b);
const d = a.add(b);
```

### Create translation Matrices

```js
// identity matrix
const identity = Mat4.identity();
// translate object in space
const translationMatrix = Mat4.translation(tx, ty, tz);
// rotation matrix
const DEG = Math.PI / 180;
const rX = Mat4.rotX(30 * DEG);
const rZ = Mat4.rotY(45 * DEG);
const rZ = Mat4.rotZ(-5 * DEG);
const rotationMatrix = rX.mul(rY).mul(rZ);
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

## Examples on Codepen

Trigger Warning: these examples can cause sickness to people with motion sensitivities.

- [Sinebox](https://codepen.io/terabaud/pen/LYxeYGX)
- [A blob and a background](https://codepen.io/terabaud/pen/YzNEyqm)
