#version 300 es
// Vertex shader of the fullscreen passes. The geometry is one triangle with
// the corners (-1, -1), (3, -1) and (-1, 3) in clip space: it is much larger
// than the screen, and the part inside the -1..1 square (the whole screen)
// is all that gets rasterized. `vUv` runs 0..1 across the screen; no
// matrices are involved.
precision highp float;
in vec2 position;
out vec2 vUv;

void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
