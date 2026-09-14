#version 300 es
// Vertex shader of the PBR material. `createPbrMaterial()` inserts a block
// of #defines after the #version line that says which optional attributes
// the geometry has: HAS_UV1, HAS_VERTEX_COLOR, HAS_TANGENT.
precision highp float;

in vec3 position;
in vec3 normal;
in vec2 uv;
#ifdef HAS_UV1
in vec2 uv1;
#endif
#ifdef HAS_VERTEX_COLOR
in vec4 color;
#endif
#ifdef HAS_TANGENT
in vec4 tangent;
#endif

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

out vec3 vPosition;
out vec3 vNormal;
out vec2 vUv;
#ifdef HAS_UV1
out vec2 vUv1;
#endif
#ifdef HAS_VERTEX_COLOR
out vec4 vColor;
#endif
#ifdef HAS_TANGENT
out vec4 vTangent;
#endif

void main() {
  // everything the fragment shader needs is handed over in view space,
  // the space the light uniforms arrive in
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vPosition = mvPosition.xyz;
  vNormal = normalize(normalMatrix * normal);
  vUv = uv;
#ifdef HAS_UV1
  vUv1 = uv1;
#endif
#ifdef HAS_VERTEX_COLOR
  vColor = color;
#endif
#ifdef HAS_TANGENT
  // a tangent is a direction along the surface, so unlike the normal it is
  // transformed by the model-view matrix itself, not its inverse transpose;
  // w carries the handedness of the bitangent and is passed through
  vTangent = vec4(normalize(mat3(modelViewMatrix) * tangent.xyz), tangent.w);
#endif
  gl_Position = projectionMatrix * mvPosition;
}
