import { AlphaMode, Filter, Mesh, Texture } from 'magic-pixels';
import { createGridGeometry } from './geometries.js';
import { createShaderPbrMaterial } from './shader-pbr-material.js';
import { fadeEdges } from './terrain.js';

// -------------------------------------------------------------- the waves
// Waves in the vertex shader. Each is a sine of the position along its
// direction, moving with time; the height is the sum of a few of them with
// different directions and lengths, so the pattern never looks like one
// ripple. The slope of the sum (the sum of the derivatives, k * cos) tilts
// the normal, which is what makes the light move on the water.
const vertexGlsl = `
uniform float time;

out vec2 vSea;    // where on the sea this is, to look up the ground below it
out float vWave;  // how high the wave is here, for foam on the crests

// direction (x, y), wavelength, amplitude: in the units of the world
const vec4 WAVES[4] = vec4[4](
  vec4( 0.8,  0.6, 14.0, 0.12),
  vec4(-0.5,  0.9,  9.0, 0.07),
  vec4( 0.2, -1.0,  6.5, 0.04),
  vec4(-0.9, -0.3,  6.0, 0.025)
);
// deep water waves: the speed is sqrt(gravity * k), so short waves are
// slower; a small gravity makes lazy toy waves
const float GRAVITY = 3.0;

// the mesh is a plane in x/y that is turned flat: its z is the world's up
void displace(inout vec3 p, inout vec3 n) {
  vSea = p.xy;
  // far from the island the grid is too coarse for the waves, and the sea
  // fades away there anyway: let them die out
  float fade = 1.0 - smoothstep(60.0, 110.0, length(p.xy));
  float height = 0.0;
  vec2 slope = vec2(0.0);
  for (int i = 0; i < 4; i++) {
    vec2 direction = normalize(WAVES[i].xy);
    float k = 6.2831853 / WAVES[i].z;
    float phase = k * dot(direction, p.xy) - sqrt(GRAVITY * k) * time;
    float amplitude = WAVES[i].w * fade;
    height += amplitude * sin(phase);
    slope += amplitude * k * cos(phase) * direction;
  }
  vWave = height;
  p.z += height;
  n = normalize(vec3(-slope, 1.0));
}`;

// ------------------------------------------------------------- the colour
// What the water looks like, per pixel. Two hooks into the PBR shader:
//
//   surface: turquoise in the shallows, dark blue where it is deep, see-through
//   at the shore, with foam on the shore and the wave crests, and small moving
//   ripples in the normal, which the sun turns into glitter
//   finish: the sky reflected at glancing angles, so the far sea melts into
//   the sky
const fragmentGlsl = `
uniform float time;
uniform sampler2D groundMap;  // the height of the ground under the sea
uniform float groundSize;     // how far the ground map reaches
uniform float waterLevel;
uniform vec3 skyColor;        // the clear colour, in linear light

in vec2 vSea;
in float vWave;

// colours in linear light, like everything in the shader
const vec3 SHALLOW = vec3(0.03, 0.42, 0.5);
const vec3 DEEP = vec3(0.0, 0.06, 0.3);
const vec3 FOAM = vec3(0.9, 0.95, 1.0);

// a hash without sin(): sin of large numbers loses precision on some GPUs
// and turns into visible blocks or repeating stripes
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// smooth random numbers on a grid: the same idea as Perlin noise, simpler
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

// noise at several scales added up: big shapes with smaller and smaller
// wrinkles on them, about 0.15..0.75
float fbm(vec2 p) {
  float sum = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 3; i++) {
    sum += amplitude * valueNoise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    amplitude *= 0.5;
  }
  return sum;
}

void surface(inout vec4 baseColor, inout float metallic, inout float roughness, inout vec3 normal) {
  // how deep the water is here: the ground map holds the height of the
  // ground, in 0..1 for -1..1; its rows run the other way than the sea's y
  vec2 st = vec2(vSea.x / groundSize + 0.5, 0.5 - vSea.y / groundSize);
  float ground = texture(groundMap, st).r * 2.0 - 1.0;
  float depth = max(waterLevel - ground, 0.0);

  // the colour: from the shallows to the deep; the texture is only left as
  // streaks in it
  float streaks = dot(baseColor.rgb, vec3(0.333));
  baseColor.rgb = mix(SHALLOW, DEEP, smoothstep(0.0, 0.9, depth)) * (0.7 + 1.2 * streaks);
  // see-through in the shallows: the sand and grass show
  baseColor.a *= mix(0.45, 1.0, smoothstep(0.0, 0.6, depth));

  // Foam: lines that run in along the shore, and patches on the tops of the
  // waves. Three things keep it from repeating: the depth is bent by noise
  // before the lines are cut from it, so they are not even contours; two
  // sines of unrelated length and speed, each put out of step by a slow
  // noise, so neighbouring stretches of coast are in different phases; and
  // the foam is broken up by noise at several scales.
  float slow = valueNoise(vSea * 0.3);
  float wobble = (fbm(vSea * 0.8 + vec2(time * 0.05, 0.0)) - 0.45) * 0.25;
  float bent = depth + wobble;
  float lap = 0.6 * sin(bent * 24.0 - time * 1.3 + slow * 9.0)
            + 0.4 * sin(bent * 39.0 - time * 2.1 + slow * 5.0 + 1.7);
  float pulse = smoothstep(0.1, 0.9, lap * 0.5 + 0.5);
  // the foam band is wider in some places than in others
  float shore = 1.0 - smoothstep(0.0, 0.16 + 0.16 * slow, bent);
  float grain = fbm(vSea * 2.2 + vec2(time * 0.25, -time * 0.18));
  float breakup = smoothstep(0.28, 0.48, grain);
  // The tops of the waves line up into a regular grid of peaks. Cut their
  // foam into small moving flecks and it does not read as a pattern: only
  // the highest peaks foam, and only where a fine noise lets them.
  float flecks = smoothstep(0.48, 0.68, fbm(vSea * 3.1 + vec2(time * 0.2, time * 0.12)));
  float crest = smoothstep(0.15 + 0.06 * slow, 0.24, vWave) * flecks * 0.85;
  float foam = clamp(shore * (0.5 + 0.5 * pulse) * breakup + crest, 0.0, 1.0);
  baseColor.rgb = mix(baseColor.rgb, FOAM, foam);
  baseColor.a = mix(baseColor.a, 1.0, foam);
  roughness = mix(roughness, 0.9, foam);

  // ripples: tilt the normal by the slope of two layers of moving noise, in
  // the plane of the surface (found from how the position changes across the
  // screen). The small, quickly changing tilts catch the sun as glitter.
  vec2 p = vSea * 1.3;
  vec2 drift = vec2(time * 0.5, time * 0.35);
  float e = 0.15;
  float n0 = valueNoise(p + drift) + valueNoise(p * 2.3 - drift);
  float nx = valueNoise(p + drift + vec2(e, 0.0)) + valueNoise((p + vec2(e, 0.0)) * 2.3 - drift);
  float ny = valueNoise(p + drift + vec2(0.0, e)) + valueNoise((p + vec2(0.0, e)) * 2.3 - drift);
  vec3 tangent = normalize(dFdx(vPosition));
  vec3 bitangent = normalize(cross(normal, tangent));
  tangent = cross(bitangent, normal);
  vec2 slope = vec2(nx - n0, ny - n0) / e;
  normal = normalize(normal - (tangent * slope.x + bitangent * slope.y) * 0.1 * (1.0 - foam));
}

void finish(inout vec4 color) {
  vec3 toEye = normalize(-vPosition);
  // Fresnel: the more the surface is seen edge-on, the more it is a mirror
  float fresnel = pow(1.0 - clamp(dot(normalize(vNormal), toEye), 0.0, 1.0), 4.0);
  color.rgb = mix(color.rgb, skyColor, fresnel * 0.7);
}`;

/** '#a8bbde' as the three numbers of a colour in linear light, 0..1 */
function hexToLinear(hex) {
  return [1, 3, 5].map((i) => {
    const srgb = parseInt(hex.slice(i, i + 2), 16) / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
}

/**
 * The height of the ground, as a picture: a square of `size` world units
 * around the origin, 0..255 standing for -1..1. The fragment shader of the
 * water can not call a JavaScript function, but it can look at a texture to
 * see how deep the water is at a spot.
 */
function createGroundMap(heightAt, size, resolution = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = resolution;
  const context = canvas.getContext('2d');
  const image = context.createImageData(resolution, resolution);
  for (let row = 0; row < resolution; row++) {
    for (let column = 0; column < resolution; column++) {
      // world x and z at the middle of the pixel; row 0 is the top of the
      // picture, which is the low z
      const x = ((column + 0.5) / resolution - 0.5) * size;
      const z = ((row + 0.5) / resolution - 0.5) * size;
      const height = Math.min(1, Math.max(-1, heightAt(x, z)));
      const value = Math.round(((height + 1) / 2) * 255);
      image.data.set(
        [value, value, value, 255],
        (row * resolution + column) * 4
      );
    }
  }
  context.putImageData(image, 0, 0);
  // linear: the numbers are heights, not colours; smooth between pixels
  return new Texture(canvas, {
    minFilter: Filter.LINEAR,
    magFilter: Filter.LINEAR,
  });
}

/**
 * The sea: a flat plane at water level, much bigger than the island. Where
 * the ground is above it you see the ground, where the ground sank below it
 * you see the water: an island. Far out the water fades to transparent, and
 * what is behind it is the clear colour, the sky: so the sea has no edge and
 * meets the sky without a horizon line.
 * @param {object} options
 * @param {(x: number, z: number) => number} options.heightAt the ground
 * @param {number} options.groundSize side of the square the ground is defined on
 * @param {number} options.waterLevel
 * @param {import('magic-pixels').Texture} options.texture streaks in the colour
 * @param {string} options.sky the clear colour behind everything, as a hex
 *   string: the far sea reflects it, so it has to be the same one
 * @param {number} [options.size] side of the sea
 * @returns {{ mesh: Mesh, update: (time: number) => void }}
 */
export function createWater({
  heightAt,
  groundSize,
  waterLevel,
  texture,
  sky,
  size = 340,
}) {
  // a square every 1.25 units: the shortest wave (6 units) has 4 to 5 vertices
  // per wavelength, just enough to be drawn as a wave
  const geometry = createGridGeometry(size, Math.round(size / 1.25));
  // solid past the corners of the island's square (radius ~57), gone at 150
  fadeEdges(geometry, 64, 150);

  const material = createShaderPbrMaterial(
    {
      baseColorMap: texture,
      vertexColors: true,
      alphaMode: AlphaMode.BLEND,
      metallicFactor: 0,
      roughnessFactor: 0.15,
    },
    {
      vertex: vertexGlsl,
      fragment: fragmentGlsl,
      uniforms: {
        time: 0,
        groundMap: createGroundMap(heightAt, groundSize),
        groundSize,
        waterLevel,
        skyColor: hexToLinear(sky),
      },
    }
  );
  // blended, but it still says where the sea is: the blur reads the depth
  material.depthWrite = true;

  const mesh = new Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = waterLevel;
  // the same texture density as the ground: 8 repeats per 80 units
  const uv = geometry.attributes.uv.data;
  for (let i = 0; i < uv.length; i++) {
    uv[i] *= (size / groundSize) * 8;
  }

  return {
    mesh,
    update(time) {
      material.uniforms.time = time;
    },
  };
}
