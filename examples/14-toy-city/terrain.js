import { BufferAttribute } from 'magic-pixels';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const mix = (a, b, t) => a + (b - a) * t;
const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Perlin gradient noise in 2D. Every corner of the integer grid gets a
 * random unit direction (its gradient); a point takes the dot product of
 * each of the four corner gradients with the offset from that corner, and
 * blends the four with a smooth curve. That gives smooth hills, unlike
 * plain random numbers per grid point.
 * @param {number} seed
 * @returns {(x: number, y: number) => number} noise in about -1..1
 */
export function createNoise(seed = 1) {
  let state = seed;
  const random = () => (state = (state * 16807) % 2147483647) / 2147483647;

  // a shuffled 0..255: hashes a grid corner to one of 256 gradients
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const gradients = Array.from({ length: 256 }, () => {
    const angle = random() * Math.PI * 2;
    return [Math.cos(angle), Math.sin(angle)];
  });
  const corner = (xi, yi) => gradients[perm[(perm[xi & 255] + yi) & 255]];
  // 6t^5 - 15t^4 + 10t^3: flat slope at 0 and 1, so no visible grid lines
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const dot = (cx, cy) => {
      const [gx, gy] = corner(xi + cx, yi + cy);
      return gx * (xf - cx) + gy * (yf - cy);
    };
    const u = fade(xf);
    const v = fade(yf);
    // the raw range is about +-0.7: scale it to about +-1
    return (
      mix(mix(dot(0, 0), dot(1, 0), u), mix(dot(0, 1), dot(1, 1), u), v) *
      Math.SQRT2
    );
  };
}

/**
 * Fractal Brownian motion: the same noise at doubled frequency and halved
 * strength, added up. Big shapes with smaller and smaller wrinkles on them.
 */
export function fbm(noise, x, y, octaves = 3) {
  let sum = 0;
  let amplitude = 1;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amplitude * noise(x, y);
    total += amplitude;
    x *= 2;
    y *= 2;
    amplitude /= 2;
  }
  return sum / total;
}

/**
 * The height of an island, as a function of world x and z: gentle hills in
 * the middle, a wobbly coast, and the ground sinking to `-1` before the
 * border of the square it sits on, so it always ends in water.
 * @param {object} [options]
 * @param {number} [options.size] side of the square the island sits on
 * @param {number} [options.seed]
 * @param {number} [options.height] average height of the land
 * @returns {(x: number, z: number) => number}
 */
export function createIsland({ size = 80, seed = 3, height = 0.6 } = {}) {
  const noise = createNoise(seed);
  const half = size / 2;
  return (x, z) => {
    // 0 in the middle, about 1 at the coast; the noise bends the circle
    const radial =
      Math.hypot(x, z) / half + 0.12 * fbm(noise, x * 0.04, z * 0.04);
    // 0 in the middle, exactly 1 at the border of the square
    const edge = Math.max(Math.abs(x), Math.abs(z)) / half;
    // 1 on the land, 0 at the coast, and 0 at the border whatever the noise did
    const land = Math.min(
      1 - smoothstep(0.7, 0.98, radial),
      1 - smoothstep(0.85, 1, edge)
    );
    const hills = 0.35 * fbm(noise, x * 0.07 + 10, z * 0.07 + 10);
    return mix(-1, height + hills, land);
  };
}

/**
 * Give a subdivided plane a height. The plane lies in x/y and gets rotated
 * by -90 degrees around X to lie flat, which turns its local z into the
 * world's up and its local y into world -z. So a vertex at local (x, y)
 * is at world (x, -y), and its height goes into local z.
 *
 * The normals are recomputed: a bump in the surface z = h(x, y) leans a
 * normal by the slope, n = (-dh/dx, -dh/dy, 1), estimated here by looking
 * a little to each side of the vertex.
 * @param {import('magic-pixels').BufferGeometry} geometry
 * @param {(x: number, z: number) => number} heightAt in world coordinates
 */
export function displacePlane(geometry, heightAt) {
  const { position, normal } = geometry.attributes;
  const local = (x, y) => heightAt(x, -y);
  const e = 0.1;
  // the plane is not indexed: each grid point is stored once per triangle
  // that touches it, six times or so, and gets the same answer every time
  const results = new Map();
  for (let i = 0; i < position.count; i++) {
    const x = position.data[i * 3];
    const y = position.data[i * 3 + 1];
    const key = Math.round(x * 100) * 100000 + Math.round(y * 100);
    let result = results.get(key);
    if (!result) {
      const nx = -(local(x + e, y) - local(x - e, y)) / (2 * e);
      const ny = -(local(x, y + e) - local(x, y - e)) / (2 * e);
      const length = Math.hypot(nx, ny, 1);
      result = [local(x, y), nx / length, ny / length, 1 / length];
      results.set(key, result);
    }
    position.data[i * 3 + 2] = result[0];
    normal.data[i * 3] = result[1];
    normal.data[i * 3 + 1] = result[2];
    normal.data[i * 3 + 2] = result[3];
  }
  // measured before the first draw, but be safe if the geometry was drawn
  position.needsUpdate = true;
  normal.needsUpdate = true;
  geometry.boundingBox = null;
  geometry.boundingSphere = null;
}

/**
 * Make a plane fade out towards its edges: every vertex gets a `color`
 * attribute of white with an alpha that is 1 up to `inner` units from the
 * middle and 0 from `outer` units on. With `vertexColors: true` and a
 * blended material, the plane melts into whatever is behind it, so it has no
 * visible border. The plane must be subdivided finely enough for the fade,
 * which is interpolated linearly between vertices.
 * @param {import('magic-pixels').BufferGeometry} geometry
 * @param {number} inner
 * @param {number} outer
 */
export function fadeEdges(geometry, inner, outer) {
  const { position } = geometry.attributes;
  const color = new Float32Array(position.count * 4);
  for (let i = 0; i < position.count; i++) {
    const distance = Math.hypot(position.data[i * 3], position.data[i * 3 + 1]);
    color.set([1, 1, 1, 1 - smoothstep(inner, outer, distance)], i * 4);
  }
  geometry.setAttribute('color', new BufferAttribute(color, 4));
}
