#version 300 es
// Fragment shader of the tone-mapping pass: reads a linear HDR colour from a
// render target, scales it by the exposure, squeezes it into 0..1 with a
// tone-mapping curve and converts the result to sRGB for the display.
//
// `createToneMapMaterial()` inserts one of these after the #version line:
//   TONE_MAPPING_REINHARD, TONE_MAPPING_ACES   the curve (neither: clamp)
precision highp float;

in vec2 vUv;
uniform sampler2D map;
uniform float exposure;

out vec4 fragColor;

// c / (1 + c): 0 stays 0, 1 becomes 0.5, and it approaches 1 for huge values
vec3 reinhard(vec3 c) {
  return c / (1.0 + c);
}

// Krzysztof Narkowicz's fit of the ACES filmic curve: an S-shaped response
// with a toe in the shadows and a shoulder in the highlights.
vec3 aces(vec3 c) {
  const float a = 2.51;
  const float b = 0.03;
  const float d = 2.43;
  const float e = 0.59;
  const float f = 0.14;
  return clamp((c * (a * c + b)) / (c * (d * c + e) + f), 0.0, 1.0);
}

// The exact sRGB transfer curve, as in the PBR shader.
vec3 linearToSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}

void main() {
  vec4 texel = texture(map, vUv);
  vec3 color = texel.rgb * exposure;
#if defined(TONE_MAPPING_ACES)
  color = aces(color);
#elif defined(TONE_MAPPING_REINHARD)
  color = reinhard(color);
#endif
  fragColor = vec4(linearToSrgb(color), texel.a);
}
