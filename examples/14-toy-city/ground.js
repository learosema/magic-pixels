import { createShaderPbrMaterial } from './shader-pbr-material.js';

// A beach and rocky hilltops. The ground is one mesh with one grass texture;
// where it is low, near the water, the fragment shader shows sand instead, and
// blends to grass as the ground rises; on the highest ground it blends to bare
// rock; so does ground that is steep, where soil would slide off. What decides
// is the height of the ground, which is the z of every vertex of the plane
// before it is turned flat, and how steep it is, which is how far the normal
// leans away from that z: the vertex hook hands both to the fragment hook.

const vertexGlsl = `
out float vHeight; // how high the ground is here
out float vSlope;  // how steep: 0 on the level, 1 on a wall

void displace(inout vec3 p, inout vec3 n) {
  // the plane's own z is the world's up; nothing is moved here
  vHeight = p.z;
  // the normal is a unit vector, so its z is the cosine of the slope's angle
  // and what is left in x and y is the sine
  vSlope = length(n.xy);
}`;

const fragmentGlsl = `
uniform sampler2D sandMap;
uniform sampler2D rockMap;
uniform float sandLevel;  // up to this height the ground is sand...
uniform float sandWidth;  // ...and turns into grass over this much more
uniform float rockLevel;  // from this height the grass starts to show rock...
uniform float rockWidth;  // ...and has shown as much of it as it will over this much more
uniform float rockSlope;  // ground steeper than this (a sine) shows rock too...
uniform float rockSlopeWidth; // ...fully when this much steeper
uniform float rockAmount; // how much of the rock shows at most: 1 is all of it

in float vHeight;
in float vSlope;

void surface(inout vec4 baseColor, inout float metallic, inout float roughness, inout vec3 normal) {
  vec3 sand = texture(sandMap, vUv).rgb;
  // The mottling of the grass texture bends the height a little, so the line
  // between sand and grass wanders about instead of being a contour line.
  float mottle = dot(baseColor.rgb, vec3(0.333)) - 0.15;
  float grassy = smoothstep(sandLevel, sandLevel + sandWidth, vHeight + mottle * 0.25);
  // wet sand is darker: the closer to the water, the darker
  sand *= mix(0.55, 1.0, smoothstep(-0.1, 0.12, vHeight));

  // The rock has its own scale, so it does not tile in step with the grass.
  // Its own light and dark bend the line too: the rock creeps down along its
  // pale spots and the grass creeps up along its dark ones.
  vec3 rock = texture(rockMap, vUv * 1.7).rgb;
  float pale = dot(rock, vec3(0.333)) - 0.4;
  float high = smoothstep(rockLevel, rockLevel + rockWidth, vHeight + pale * 0.3 + mottle * 0.1);
  float steep = smoothstep(rockSlope, rockSlope + rockSlopeWidth, vSlope + pale * 0.1);
  float rocky = rockAmount * max(high, steep);
  vec3 land = mix(baseColor.rgb, rock, rocky);

  baseColor.rgb = mix(sand, land, grassy);
  // sand is rougher than grass and has softer, fewer bumps; rock is roughest
  roughness = mix(0.95, mix(roughness, 0.95, rocky), grassy);
  normal = normalize(mix(normalize(vNormal), normal, mix(0.3, 1.0, grassy)));
}`;

/**
 * The material of the ground: grass with a bump map, a sandy beach and
 * rocky hilltops.
 * @param {object} textures
 * @param {import('magic-pixels').Texture} textures.grass
 * @param {import('magic-pixels').Texture} textures.grassNormal
 * @param {import('magic-pixels').Texture} textures.sand
 * @param {import('magic-pixels').Texture} textures.rock
 * @param {object} [options]
 * @param {number} [options.sandLevel] up to this height the ground is sand
 * @param {number} [options.sandWidth] and turns to grass over this much more
 * @param {number} [options.rockLevel] from this height on, rock shows through
 * @param {number} [options.rockWidth] and shows the most over this much more
 * @param {number} [options.rockSlope] ground steeper than this shows rock too,
 *   as the sine of its angle: 0.1 is about 6 degrees
 * @param {number} [options.rockSlopeWidth] and the most when this much steeper
 * @param {number} [options.rockAmount] the most rock that shows, 0..1
 */
export function createGroundMaterial(
  { grass, grassNormal, sand, rock },
  {
    sandLevel = 0.05,
    sandWidth = 0.3,
    rockLevel = 0.62,
    rockWidth = 0.16,
    rockSlope = 0.08,
    rockSlopeWidth = 0.12,
    rockAmount = 0.9,
  } = {}
) {
  return createShaderPbrMaterial(
    {
      baseColorMap: grass,
      normalMap: grassNormal,
      metallicFactor: 0,
      roughnessFactor: 0.7,
    },
    {
      vertex: vertexGlsl,
      fragment: fragmentGlsl,
      uniforms: {
        sandMap: sand,
        rockMap: rock,
        sandLevel,
        sandWidth,
        rockLevel,
        rockWidth,
        rockSlope,
        rockSlopeWidth,
        rockAmount,
      },
    }
  );
}
