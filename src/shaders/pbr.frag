#version 300 es
// Fragment shader of the PBR material: the glTF metallic-roughness model
// (Lambert diffuse + GGX/Smith/Schlick specular), lit by the light uniforms
// the renderer injects, with the linear -> sRGB conversion at the end
// (unless LINEAR_OUTPUT: then the linear colour is written as it is, for a
// render target that a tone-mapping pass reads).
//
// `createPbrMaterial()` inserts a block of #defines after the #version line.
// Which maps exist has to be known when the shader is compiled (a sampler
// with no texture bound would read texture unit 0), so every optional input
// is a define rather than a runtime branch:
//
//   HAS_BASE_COLOR_MAP, HAS_METALLIC_ROUGHNESS_MAP, HAS_NORMAL_MAP,
//   HAS_OCCLUSION_MAP, HAS_EMISSIVE_MAP     a texture is bound to the sampler
//   BASE_COLOR_UV, METALLIC_ROUGHNESS_UV, NORMAL_UV, OCCLUSION_UV,
//   EMISSIVE_UV                             the varying each map samples
//                                           with: vUv or vUv1
//   HAS_UV1, HAS_VERTEX_COLOR, HAS_TANGENT  optional vertex attributes
//   ALPHA_MASK, ALPHA_BLEND                 glTF alpha modes (neither: OPAQUE)
//   DOUBLE_SIDED                            flip the normal on back faces
//   UNLIT                                   base colour only, no lighting
//   LINEAR_OUTPUT                           skip the linear -> sRGB conversion
//   MAX_DIRECTIONAL_LIGHTS, MAX_POINT_LIGHTS  light array sizes
precision highp float;

#ifndef MAX_DIRECTIONAL_LIGHTS
#define MAX_DIRECTIONAL_LIGHTS 4
#endif
#ifndef MAX_POINT_LIGHTS
#define MAX_POINT_LIGHTS 4
#endif

in vec3 vPosition;
in vec3 vNormal;
in vec2 vUv;
#ifdef HAS_UV1
in vec2 vUv1;
#endif
#ifdef HAS_VERTEX_COLOR
in vec4 vColor;
#endif
#ifdef HAS_TANGENT
in vec4 vTangent;
#endif

// material factors, the glTF defaults unless the material says otherwise
uniform vec4 baseColorFactor;
uniform float metallicFactor;
uniform float roughnessFactor;
uniform vec3 emissiveFactor;
uniform float normalScale;
uniform float occlusionStrength;
uniform float alphaCutoff;

#ifdef HAS_BASE_COLOR_MAP
uniform sampler2D baseColorMap;
#endif
#ifdef HAS_METALLIC_ROUGHNESS_MAP
uniform sampler2D metallicRoughnessMap;
#endif
#ifdef HAS_NORMAL_MAP
uniform sampler2D normalMap;
#endif
#ifdef HAS_OCCLUSION_MAP
uniform sampler2D occlusionMap;
#endif
#ifdef HAS_EMISSIVE_MAP
uniform sampler2D emissiveMap;
#endif

// the lights of the frame, in view space, colours premultiplied by intensity
uniform vec3 ambientLightColor;
uniform vec3 directionalLightDirections[MAX_DIRECTIONAL_LIGHTS];
uniform vec3 directionalLightColors[MAX_DIRECTIONAL_LIGHTS];
uniform int directionalLightCount;
uniform vec3 pointLightPositions[MAX_POINT_LIGHTS];
uniform vec3 pointLightColors[MAX_POINT_LIGHTS];
uniform float pointLightRanges[MAX_POINT_LIGHTS];
uniform int pointLightCount;

out vec4 fragColor;

// ------------------------------------------------------------ colour output

// The exact sRGB transfer curve: a linear toe below 0.0031308, a 1/2.4
// power above it. pow(c, 1/2.2) is the usual approximation of this.
vec3 linearToSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}

// The colour that leaves the shader: sRGB for the canvas, or as it is when
// a later pass does the conversion.
vec3 outputColor(vec3 c) {
#ifdef LINEAR_OUTPUT
  return c;
#else
  return linearToSrgb(c);
#endif
}

// ---------------------------------------------------------- surface normal

#if defined(HAS_NORMAL_MAP) && !defined(HAS_TANGENT)
// Without a tangent attribute, the tangent is reconstructed from how the
// texture coordinates change across the screen: the direction in which u
// grows along the surface is the tangent (Khronos sample viewer approach).
vec3 derivativeTangent(vec3 N) {
  vec3 dpdx = dFdx(vPosition);
  vec3 dpdy = dFdy(vPosition);
  vec2 duvdx = dFdx(NORMAL_UV);
  vec2 duvdy = dFdy(NORMAL_UV);
  float det = duvdx.x * duvdy.y - duvdy.x * duvdx.y;
  vec3 T = (duvdy.y * dpdx - duvdx.y * dpdy) / (abs(det) < 1e-8 ? 1e-8 : det);
  // Gram-Schmidt: make sure T is perpendicular to the interpolated normal
  return normalize(T - N * dot(N, T));
}
#endif

// The shading normal in view space: the interpolated vertex normal,
// perturbed by the normal map if there is one, flipped for back faces of a
// double-sided material.
vec3 surfaceNormal() {
  vec3 N = normalize(vNormal);
#ifdef HAS_NORMAL_MAP
  // the map stores a tangent-space normal in 0..1; decode to -1..1 and let
  // normalScale exaggerate or flatten the bumps
  vec3 n = texture(normalMap, NORMAL_UV).xyz * 2.0 - 1.0;
  n.xy *= normalScale;
  #ifdef HAS_TANGENT
  vec3 T = normalize(vTangent.xyz);
  T = normalize(T - N * dot(N, T));
  vec3 B = cross(N, T) * vTangent.w;
  #else
  vec3 T = derivativeTangent(N);
  vec3 B = cross(N, T);
  #endif
  // the TBN matrix's columns are the tangent-space axes in view space
  N = normalize(mat3(T, B, N) * n);
#endif
#ifdef DOUBLE_SIDED
  // the back of a surface faces the other way, bumps included
  if (!gl_FrontFacing) {
    N = -N;
  }
#endif
  return N;
}

// -------------------------------------------------------------------- BRDF
//
// The glTF metallic-roughness BRDF (specification, appendix B), with one
// difference: the 1/pi of the Lambert term and of D is left out, so a
// light of intensity 1 lights a white diffuse surface facing it to exactly
// 1. This is the same as the specification with every light intensity
// multiplied by pi.

// Normal distribution: what fraction of the microfacets point along H.
// alphaSq is roughness^4 (alpha = roughness^2, the glTF remapping).
float D_GGX(float NdotH, float alphaSq) {
  float f = NdotH * NdotH * (alphaSq - 1.0) + 1.0;
  return alphaSq / (f * f);
}

// Masking and shadowing of microfacets by their neighbours, height
// correlated Smith form, already divided by 4 NdotL NdotV (the "visibility"
// term V = G / (4 NdotL NdotV)).
float V_SmithGGX(float NdotL, float NdotV, float alphaSq) {
  float ggxV = NdotL * sqrt(NdotV * NdotV * (1.0 - alphaSq) + alphaSq);
  float ggxL = NdotV * sqrt(NdotL * NdotL * (1.0 - alphaSq) + alphaSq);
  return 0.5 / max(ggxV + ggxL, 1e-5);
}

// Fresnel: the reflectance rises from f0 head-on to 1 at grazing angles.
vec3 F_Schlick(vec3 f0, float VdotH) {
  return f0 + (1.0 - f0) * pow(1.0 - VdotH, 5.0);
}

// Light reflected towards V from one light arriving along L with the
// given radiance (colour x intensity x attenuation).
vec3 shade(
  vec3 N, vec3 V, vec3 L, vec3 radiance,
  vec3 cDiff, vec3 f0, float alphaSq
) {
  float NdotL = dot(N, L);
  if (NdotL <= 0.0) {
    return vec3(0.0);
  }
  vec3 H = normalize(L + V);
  float NdotV = max(dot(N, V), 1e-4);
  float NdotH = max(dot(N, H), 0.0);
  float VdotH = max(dot(V, H), 0.0);
  vec3 F = F_Schlick(f0, VdotH);
  // light that is reflected specularly cannot also enter the surface
  vec3 diffuse = (1.0 - F) * cDiff;
  vec3 specular = F * D_GGX(NdotH, alphaSq) * V_SmithGGX(NdotL, NdotV, alphaSq);
  return (diffuse + specular) * radiance * NdotL;
}

// -------------------------------------------------------------------- main

void main() {
  // base colour: factor x map x vertex colour, all in linear space (an sRGB
  // base colour map is decoded by the sampler, see Texture.colorSpace)
  vec4 baseColor = baseColorFactor;
#ifdef HAS_BASE_COLOR_MAP
  baseColor *= texture(baseColorMap, BASE_COLOR_UV);
#endif
#ifdef HAS_VERTEX_COLOR
  baseColor *= vColor;
#endif

#if defined(ALPHA_MASK)
  if (baseColor.a < alphaCutoff) {
    discard;
  }
  baseColor.a = 1.0;
#elif !defined(ALPHA_BLEND)
  baseColor.a = 1.0;
#endif

#ifdef UNLIT
  fragColor = vec4(outputColor(baseColor.rgb), baseColor.a);
  return;
#endif

  float metallic = metallicFactor;
  float roughness = roughnessFactor;
#ifdef HAS_METALLIC_ROUGHNESS_MAP
  // glTF packs roughness into green and metalness into blue
  vec4 mr = texture(metallicRoughnessMap, METALLIC_ROUGHNESS_UV);
  roughness *= mr.g;
  metallic *= mr.b;
#endif
  metallic = clamp(metallic, 0.0, 1.0);
  // a roughness of exactly 0 makes D a division by zero
  roughness = clamp(roughness, 0.04, 1.0);
  float alpha = roughness * roughness;
  float alphaSq = alpha * alpha;

  // metals have no diffuse colour and reflect in their own colour;
  // dielectrics reflect 4% of the light head-on, without tint
  vec3 cDiff = baseColor.rgb * (1.0 - metallic);
  vec3 f0 = mix(vec3(0.04), baseColor.rgb, metallic);

  vec3 N = surfaceNormal();
  // in view space the camera sits at the origin, so V is just -position
  vec3 V = normalize(-vPosition);

  vec3 color = vec3(0.0);

  for (int i = 0; i < MAX_DIRECTIONAL_LIGHTS; i++) {
    if (i >= directionalLightCount) {
      break;
    }
    // the uniform is the direction the light shines in; L points at it
    vec3 L = -directionalLightDirections[i];
    color += shade(N, V, L, directionalLightColors[i], cDiff, f0, alphaSq);
  }

  for (int i = 0; i < MAX_POINT_LIGHTS; i++) {
    if (i >= pointLightCount) {
      break;
    }
    vec3 toLight = pointLightPositions[i] - vPosition;
    float d = length(toLight);
    vec3 L = toLight / d;
    // inverse-square falloff, windowed to zero at the light's range
    float attenuation = 1.0 / max(d * d, 1e-4);
    float range = pointLightRanges[i];
    if (range > 0.0) {
      attenuation *= clamp(1.0 - pow(d / range, 4.0), 0.0, 1.0);
    }
    vec3 radiance = pointLightColors[i] * attenuation;
    color += shade(N, V, L, radiance, cDiff, f0, alphaSq);
  }

  // Ambient light arrives from every direction, like a uniform environment.
  // The diffuse part reflects cDiff; the specular part reflects roughly
  // f0, the average reflectance (a proper environment map would integrate
  // the BRDF over it, which is left for image-based lighting). Occlusion
  // only darkens this term: crevices are hidden from the environment, not
  // from a light that is shining straight into them.
  float occlusion = 1.0;
#ifdef HAS_OCCLUSION_MAP
  occlusion = 1.0 + occlusionStrength * (texture(occlusionMap, OCCLUSION_UV).r - 1.0);
#endif
  color += ambientLightColor * (cDiff + f0) * occlusion;

  // emission is added after lighting: it is light the surface makes itself
#ifdef HAS_EMISSIVE_MAP
  color += emissiveFactor * texture(emissiveMap, EMISSIVE_UV).rgb;
#else
  color += emissiveFactor;
#endif

  fragColor = vec4(outputColor(color), baseColor.a);
}
