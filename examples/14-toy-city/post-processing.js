import {
  DepthAttachment,
  Filter,
  RenderTarget,
  Scene,
  createFullscreenMaterial,
  createFullscreenMesh,
} from 'magic-pixels';

// A photo of a miniature is recognisable by what is out of focus: the
// foreground melts into a soft blur while the middle stays sharp. This
// fakes it in two extra passes over the finished picture:
//
//   scene ─► [colour + depth] ─► blur by depth ─► smooth the edges ─► canvas
//
// The depth texture says how far away every pixel is, and the blur pass
// blurs each pixel by how far its distance is from the focus distance.

/**
 * Blur radius per pixel, from its depth. A gather blur: every pixel takes the
 * average of a disc of neighbours (a spiral of taps at golden-angle steps
 * covers a disc evenly). Two rules decide which neighbours count, so a sharp
 * thing in front does not smear over a blurry thing behind it, and the
 * blurry thing in front still gets soft edges over what is behind it:
 *
 *  - a neighbour in front of the pixel counts if ITS blur radius reaches
 *    the pixel,
 *  - a neighbour behind it counts if the PIXEL's own blur radius reaches it.
 *
 * And every neighbour's weight is divided by the area of the disc its light
 * is spread over (its blur radius squared): a blurred thing has the same
 * amount of light as a sharp one, only thinner. Without that, a sharp pixel
 * next to a blurred roof would turn nearly roof-coloured the moment a few
 * taps reach the roof, and snap back where they stop: a ghost outline.
 */
const depthOfFieldFragment = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D colorMap;
uniform sampler2D depthMap;
uniform vec2 texel;
uniform float near;
uniform float far;
uniform float focus;        // the distance that is sharp
uniform float band;         // half the depth of the sharp zone, as a fraction of focus
uniform float falloff;      // beyond it, the blur grows to its maximum over this much
uniform float farAmount;    // behind the focus, the blur is at most this much of it
uniform float maxBlur;      // in pixels
out vec4 fragColor;

// few taps keep the pass cheap; the random turn of the spiral and the edge
// smoothing after it hide that
const int TAPS = 24;
const float GOLDEN_ANGLE = 2.39996323;

// depth buffer value -> distance in front of the camera
float eyeDistance(vec2 uv) {
  float z = texture(depthMap, uv).r * 2.0 - 1.0;
  return (2.0 * near * far) / (far + near - z * (far - near));
}

// Blur radius in pixels. Around the focus distance there is a zone that is
// sharp; in front of it and behind it the blur grows the same way, so the
// near part and the far part of the picture are equally soft, like a
// miniature: sharp in the middle, blurred at the top and at the bottom.
// The distances are from the camera, so a point is as sharp as any other
// point at the same distance, however high up it is.
float blurRadius(float distance) {
  float away = abs(distance - focus) / focus - band;
  float t = smoothstep(0.0, 1.0, clamp(away / falloff, 0.0, 1.0));
  return t * maxBlur * (distance < focus ? 1.0 : farAmount);
}

// a different pseudo-random number per pixel, 0..1
float noise(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

void main() {
  vec3 centre = texture(colorMap, vUv).rgb;
  if (maxBlur < 0.5) {
    fragColor = vec4(centre, 1.0);
    return;
  }
  float centreDistance = eyeDistance(vUv);
  float radius = blurRadius(centreDistance);
  // the pixel's own light, spread over its own disc
  float centreWeight = 1.0 / max(1.0, radius * radius);
  vec3 sum = centre * centreWeight;
  // the area of the disc grows with the square of the radius: about one tap
  // per pixel of it
  int taps = int(clamp(maxBlur * maxBlur * 1.5, 12.0, float(TAPS)));
  // every pixel turns its spiral by a random angle, so the gaps between taps
  // become fine grain instead of a visible pattern
  float spin = noise(gl_FragCoord.xy) * 6.2831853;
  float weightSum = centreWeight;
  for (int i = 0; i < TAPS; i++) {
    if (i >= taps) {
      break;
    }
    float r = sqrt((float(i) + 0.5) / float(taps));
    float angle = float(i) * GOLDEN_ANGLE + spin;
    vec2 offset = vec2(cos(angle), sin(angle)) * r * maxBlur; // in pixels
    // snap the tap to the middle of a texel: depth and colour are both read
    // without filtering, so a tap never mixes the colours of two things
    // while its depth says only one of them
    vec2 uv = (floor(vUv / texel + offset) + 0.5) * texel;
    float sampleDistance = eyeDistance(uv);
    float reach = sampleDistance > centreDistance ? radius : blurRadius(sampleDistance);
    // a soft edge, a bit wider for bigger blurs
    float feather = max(1.0, reach * 0.5);
    float coverage = clamp((reach - length(offset)) / feather + 0.5, 0.0, 1.0);
    // a blur smaller than a pixel spreads nothing
    coverage *= smoothstep(0.5, 1.5, reach);
    float weight = coverage / max(1.0, reach * reach);
    sum += texture(colorMap, uv).rgb * weight;
    weightSum += weight;
  }
  fragColor = vec4(sum / weightSum, 1.0);
}`;

/**
 * FXAA: a last pass that finds edges in the finished picture (where the
 * luminance changes sharply between neighbouring pixels), works out which way
 * the edge runs, and blurs along it. It replaces the antialiasing of the
 * canvas, which only applies to what is drawn straight onto the canvas and
 * not to a render target.
 */
const fxaaFragment = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D colorMap;
uniform vec2 texel;
uniform float saturation;
uniform float contrast;
out vec4 fragColor;

const float EDGE_MIN = 0.0312;
const float EDGE_RELATIVE = 0.125;
const float DIRECTION_REDUCE_MIN = 1.0 / 128.0;
const float DIRECTION_REDUCE = 1.0 / 8.0;
const float SPAN_MAX = 8.0;

float luma(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

// Miniatures are painted and lit hard: more saturated, more contrast.
vec3 grade(vec3 c) {
  c = mix(vec3(luma(c)), c, saturation);
  return clamp((c - 0.5) * contrast + 0.5, 0.0, 1.0);
}

void main() {
  vec3 mid = texture(colorMap, vUv).rgb;
  vec3 c00 = texture(colorMap, vUv + vec2(-1.0, -1.0) * texel).rgb;
  vec3 c10 = texture(colorMap, vUv + vec2(1.0, -1.0) * texel).rgb;
  vec3 c01 = texture(colorMap, vUv + vec2(-1.0, 1.0) * texel).rgb;
  vec3 c11 = texture(colorMap, vUv + vec2(1.0, 1.0) * texel).rgb;
  float lMid = luma(mid);
  float l00 = luma(c00);
  float l10 = luma(c10);
  float l01 = luma(c01);
  float l11 = luma(c11);
  float lMin = min(lMid, min(min(l00, l10), min(l01, l11)));
  float lMax = max(lMid, max(max(l00, l10), max(l01, l11)));
  // flat enough: leave it alone, so soft blur stays untouched
  if (lMax - lMin < max(EDGE_MIN, lMax * EDGE_RELATIVE)) {
    fragColor = vec4(grade(mid), 1.0);
    return;
  }
  // the luminance gradient points across the edge; the edge runs at a right
  // angle to it
  float gx = (l10 + l11) - (l00 + l01);
  float gy = (l01 + l11) - (l00 + l10);
  vec2 dir = vec2(gy, -gx);
  // shrink the direction to about one texel, so the two samples on either
  // side of the pixel do not jump over thin lines
  float reduce = max((l00 + l10 + l01 + l11) * 0.25 * DIRECTION_REDUCE, DIRECTION_REDUCE_MIN);
  dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + reduce), -SPAN_MAX, SPAN_MAX) * texel;
  vec3 narrow = 0.5 * (
    texture(colorMap, vUv + dir * (1.0 / 3.0 - 0.5)).rgb +
    texture(colorMap, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);
  vec3 wide = narrow * 0.5 + 0.25 * (
    texture(colorMap, vUv - dir * 0.5).rgb +
    texture(colorMap, vUv + dir * 0.5).rgb);
  // the wide blur may have reached past the edge into something else
  float lWide = luma(wide);
  fragColor = vec4(grade(lWide < lMin || lWide > lMax ? narrow : wide), 1.0);
}`;

/**
 * The passes of the miniature look.
 * @param {import('magic-pixels').WebGL2Renderer} renderer
 * @param {HTMLCanvasElement} canvas
 * @param {import('magic-pixels').PerspectiveCamera} camera
 * @param {object} [options]
 * @param {number} [options.blur] the strongest blur, as a fraction of the canvas height
 * @param {number} [options.band] half the depth of the sharp zone around the
 *   focus, as a fraction of the focus distance
 * @param {number} [options.falloff] beyond the sharp zone the blur grows to its
 *   strongest over this fraction of the focus distance
 * @param {number} [options.farAmount] the blur behind the focus, as a fraction
 *   of the strongest: 1 blurs the far side as much as the near side, like a
 *   miniature, 0 keeps the background sharp
 * @param {number} [options.saturation] colour boost of the last pass, 1 for none
 * @param {number} [options.contrast] contrast boost of the last pass, 1 for none
 */
export function createPostProcessing(renderer, canvas, camera, options = {}) {
  const {
    blur = 0.008,
    band = 0.12,
    falloff = 0.3,
    farAmount = 0.9,
    saturation = 1.25,
    contrast = 1.08,
  } = options;

  const width = canvas.width || 1;
  const height = canvas.height || 1;
  // the scene: colour, and depth as a texture the blur pass can read
  const sceneTarget = new RenderTarget(width, height, {
    depth: DepthAttachment.TEXTURE,
  });
  // the blurred picture, on its way to the edge smoothing
  const blurredTarget = new RenderTarget(width, height, {
    depth: DepthAttachment.NONE,
  });
  // FXAA samples between texels, along the edge
  blurredTarget.colorAttachment.minFilter = Filter.LINEAR;
  blurredTarget.colorAttachment.magFilter = Filter.LINEAR;

  const blurMaterial = createFullscreenMaterial(depthOfFieldFragment, {
    colorMap: sceneTarget.colorAttachment,
    depthMap: sceneTarget.depthAttachment,
    texel: [1, 1],
    near: camera.near,
    far: camera.far,
    focus: 40,
    band,
    falloff,
    farAmount,
    maxBlur: 0,
  });
  const blurScene = new Scene();
  blurScene.add(createFullscreenMesh(blurMaterial));

  const fxaaMaterial = createFullscreenMaterial(fxaaFragment, {
    colorMap: blurredTarget.colorAttachment,
    texel: [1, 1],
    saturation,
    contrast,
  });
  const fxaaScene = new Scene();
  fxaaScene.add(createFullscreenMesh(fxaaMaterial));

  return {
    /** Call after the canvas changed size */
    resize() {
      for (const target of [sceneTarget, blurredTarget]) {
        target.width = canvas.width;
        target.height = canvas.height;
      }
      const texel = [1 / canvas.width, 1 / canvas.height];
      blurMaterial.uniforms.texel = texel;
      fxaaMaterial.uniforms.texel = texel;
      // the blur is in pixels: a fraction of the height keeps it looking the
      // same on a phone and on a 4K screen
      blurMaterial.uniforms.maxBlur = blur * canvas.height;
    },

    /**
     * Draw the scenes through the passes. They are drawn one over the other
     * into the same colour and depth buffers, in order: only the first one
     * clears, so what a later scene draws is tested against the depth of the
     * earlier ones.
     * @param {import('magic-pixels').Scene[]} scenes
     * @param {number} focus the distance from the camera that is sharp
     */
    render(scenes, focus) {
      blurMaterial.uniforms.focus = focus;
      scenes.forEach((scene, i) => {
        renderer.autoClear = i === 0;
        renderer.render(scene, camera, sceneTarget);
      });
      renderer.autoClear = true;
      renderer.render(blurScene, camera, blurredTarget);
      renderer.render(fxaaScene, camera);
    },
  };
}
