import {
  BufferAttribute,
  BufferGeometry,
  Vector,
  calculateSurfaceNormal,
  facesToBuffer,
} from 'magic-pixels';

/**
 * Build a flat-shaded solid: every face gets its own normal, so edges stay
 * sharp. The corners of each face must run counter-clockwise as seen from
 * outside, otherwise the face is culled and the normal points inwards.
 *
 * Texture coordinates come from a planar projection per face: `u` runs along
 * the face's first edge, `v` across the face inside its plane, both measured
 * in world units. So every face gets the same texture density whatever its
 * size, and the texture repeats: use `Wrapping.REPEAT` on it.
 * @param {Vector[]} vertices the corner points
 * @param {number[][]} faces lists of 3 or 4 indices into `vertices`
 * @param {number} uvScale texture repeats per world unit
 * @returns {BufferGeometry}
 */
export function createFlatGeometry(vertices, faces, uvScale = 0.5) {
  // per face corner (not per vertex: a corner has one normal and one uv per
  // face it belongs to), in the order of `faces`
  const cornerNormals = [];
  const cornerUvs = [];
  const cornerFaces = faces.map((face) => {
    const [p0, p1, p2] = face.map((index) => vertices[index]);
    const normal = calculateSurfaceNormal(p0, p1, p2);
    const u = p1.sub(p0).normalized;
    // the normal x u lies in the face, at a right angle to u
    const v = normal.cross(u);
    return face.map((index) => {
      const offset = vertices[index].sub(p0);
      cornerNormals.push(normal);
      cornerUvs.push(
        new Vector(offset.dot(u) * uvScale, offset.dot(v) * uvScale)
      );
      return cornerNormals.length - 1;
    });
  });

  // facesToBuffer expands the same face lists, splitting quads into
  // triangles, so positions, normals and uvs stay in step
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array(facesToBuffer(faces, vertices)), 3)
  );
  geometry.setAttribute(
    'normal',
    new BufferAttribute(
      new Float32Array(facesToBuffer(cornerFaces, cornerNormals)),
      3
    )
  );
  geometry.setAttribute(
    'uv',
    new BufferAttribute(
      new Float32Array(facesToBuffer(cornerFaces, cornerUvs)),
      2
    )
  );
  return geometry;
}

/**
 * A four-sided roof: a pyramid on a rectangular base, base at y = 0, apex
 * above the middle. It has a bottom face too: from a low viewpoint you look
 * up under the eaves, and without one you see straight through the roof.
 */
export function createPyramidGeometry(width, depth, height, uvScale = 0.5) {
  const w = width / 2;
  const d = depth / 2;
  return createFlatGeometry(
    [
      new Vector(-w, 0, d), // 0: base, front left
      new Vector(w, 0, d), // 1: base, front right
      new Vector(w, 0, -d), // 2: base, back right
      new Vector(-w, 0, -d), // 3: base, back left
      new Vector(0, height, 0), // 4: apex
    ],
    [
      [0, 1, 4], // front
      [1, 2, 4], // right
      [2, 3, 4], // back
      [3, 0, 4], // left
      [0, 3, 2, 1], // underneath, looking down
    ],
    uvScale
  );
}

/**
 * A gable roof: a triangular prism lying on its side, the ridge running
 * along z. Base at y = 0, with a bottom face (see createPyramidGeometry).
 */
export function createGableGeometry(width, depth, height, uvScale = 0.5) {
  const w = width / 2;
  const d = depth / 2;
  return createFlatGeometry(
    [
      new Vector(-w, 0, d), // 0..2: the front gable
      new Vector(w, 0, d),
      new Vector(0, height, d),
      new Vector(-w, 0, -d), // 3..5: the back gable
      new Vector(w, 0, -d),
      new Vector(0, height, -d),
    ],
    [
      [0, 1, 2], // front gable, looking at +z
      [4, 3, 5], // back gable, looking at -z
      [1, 4, 5, 2], // right slope
      [3, 0, 2, 5], // left slope
      [0, 3, 4, 1], // underneath, looking down
    ],
    uvScale
  );
}

/**
 * A flat square grid in the x/y plane, facing +z, like `createPlaneGeometry`
 * but indexed: every vertex is stored once and shared by the up to six
 * triangles around it. A plane from `createPlaneGeometry` repeats each vertex
 * for every triangle, which is six times the data and six times the vertex
 * shader runs; for a plane of 75 000 vertices that matters.
 * @param {number} size side of the square
 * @param {number} segments squares per side
 * @returns {BufferGeometry}
 */
export function createGridGeometry(size, segments) {
  const side = segments + 1;
  const position = new Float32Array(side * side * 3);
  const normal = new Float32Array(side * side * 3);
  const uv = new Float32Array(side * side * 2);
  for (let iy = 0; iy < side; iy++) {
    for (let ix = 0; ix < side; ix++) {
      const i = iy * side + ix;
      position.set(
        [(ix / segments - 0.5) * size, (0.5 - iy / segments) * size, 0],
        i * 3
      );
      normal.set([0, 0, 1], i * 3);
      uv.set([ix / segments, iy / segments], i * 2);
    }
  }

  // two counter-clockwise triangles per square
  const indices = new Uint32Array(segments * segments * 6);
  let k = 0;
  for (let iy = 0; iy < segments; iy++) {
    for (let ix = 0; ix < segments; ix++) {
      const a = iy * side + ix; // top left
      const b = a + 1; // top right
      const c = a + side; // bottom left
      const d = c + 1; // bottom right
      indices.set([a, c, b, b, c, d], k);
      k += 6;
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('normal', new BufferAttribute(normal, 3));
  geometry.setAttribute('uv', new BufferAttribute(uv, 2));
  // more than 65 535 vertices do not fit 16 bit indices
  geometry.setIndex(indices, side * side > 65535 ? 32 : 16);
  return geometry;
}
