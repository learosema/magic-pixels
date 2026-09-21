import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  Object3D,
  createPbrMaterial,
} from 'magic-pixels';
import { createTreePieces, treeParts } from './tree.js';
import { createNoise, fbm } from './terrain.js';

const smoothstep = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * A spatial hash: points sorted into square cells, so "is anything near
 * here?" looks at a few cells and not at every point.
 */
function createGrid(cell) {
  const cells = new Map();
  const key = (x, z) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
  return {
    add(x, z, radius = 0) {
      const k = key(x, z);
      if (!cells.has(k)) {
        cells.set(k, []);
      }
      cells.get(k).push({ x, z, radius });
    },
    /** Is there a point closer than `radius` + its own radius to (x, z)? */
    anyNear(x, z, radius) {
      const reach = Math.ceil((radius + 2) / cell);
      const cx = Math.floor(x / cell);
      const cz = Math.floor(z / cell);
      for (let i = -reach; i <= reach; i++) {
        for (let j = -reach; j <= reach; j++) {
          for (const p of cells.get(`${cx + i},${cz + j}`) ?? []) {
            if (Math.hypot(p.x - x, p.z - z) < radius + p.radius) {
              return true;
            }
          }
        }
      }
      return false;
    },
  };
}

/**
 * Decide where the trees stand: random spots, kept if they are on dry land,
 * not on a house or a road, and not on another tree. How many are kept
 * follows a noise map, so there are woods with meadows between them, not an
 * even sprinkle.
 */
function scatterTrees({
  heightAt,
  random,
  size,
  waterLevel,
  houses,
  routes,
  roadWidth,
  count,
}) {
  const noise = createNoise(11);
  const roadPoints = createGrid(2);
  for (const route of routes) {
    for (const p of route) {
      roadPoints.add(p.x, p.z, roadWidth / 2);
    }
  }
  const trees = createGrid(2);
  const placed = [];
  const limit = size / 2 - 3;

  for (let tries = 0; placed.length < count && tries < count * 40; tries++) {
    const x = (random() * 2 - 1) * limit;
    const z = (random() * 2 - 1) * limit;
    // the wood density here: 0 in a meadow, 1 in a wood, with a few
    // stragglers everywhere
    const density =
      0.1 + 0.9 * smoothstep(0.05, 0.45, fbm(noise, x * 0.05, z * 0.05, 3));
    if (random() > density) {
      continue;
    }
    const width = 0.8 + random() * 0.8;
    const height = width * (1.6 + random() * 0.8);
    const radius = width / 2;

    // the ground under the trunk: the lowest of a few points around it, so a
    // tree on a slope is buried a little on its high side and never floats
    const ground = Math.min(
      heightAt(x, z),
      heightAt(x + radius * 0.4, z),
      heightAt(x - radius * 0.4, z),
      heightAt(x, z + radius * 0.4),
      heightAt(x, z - radius * 0.4)
    );
    if (ground < waterLevel + 0.3) {
      continue;
    }
    // not on a house (a little closer than its full circle: crowns may
    // reach over the roofs' edges), not on a road, not on another tree
    if (
      houses.some(
        (h) => Math.hypot(h.x - x, h.z - z) < h.radius + radius * 0.6 + 0.2
      )
    ) {
      continue;
    }
    if (roadPoints.anyNear(x, z, radius * 0.7)) {
      continue;
    }
    // crowns may overlap a little, trunks not
    if (trees.anyNear(x, z, radius * 0.75)) {
      continue;
    }
    trees.add(x, z, radius * 0.75);
    // every tree a slightly different green
    const shade = 0.7 + random() * 0.5;
    placed.push({
      x,
      y: ground - 0.05,
      z,
      yaw: random() * Math.PI * 2,
      width,
      height,
      color: [shade, shade * (0.92 + random() * 0.16), shade * 0.9, 1],
    });
  }
  return placed;
}

/**
 * One geometry with a copy of `source` for every placement: each copy scaled,
 * turned around Y and moved into place, with its normals following. Baking
 * hundreds of trees into a single mesh costs one draw call instead of
 * hundreds. A colour per copy goes into a `color` attribute, which a material
 * with `vertexColors` multiplies in.
 * @param {BufferGeometry} source indexed or not
 * @param {{ size: number[], x: number, y: number, z: number, yaw: number, color?: number[] }[]} placements
 */
function bake(source, placements, { colors = false } = {}) {
  const { position, normal, uv } = source.attributes;
  // the corner order of the triangles, whether the source is indexed or not
  const corners =
    source.index ?? Array.from({ length: position.count }, (_, i) => i);
  const vertices = corners.length * placements.length;
  const outPosition = new Float32Array(vertices * 3);
  const outNormal = new Float32Array(vertices * 3);
  const outUv = new Float32Array(vertices * 2);
  const outColor = colors ? new Float32Array(vertices * 4) : null;

  let v = 0;
  for (const { size, x, y, z, yaw, color } of placements) {
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    for (const corner of corners) {
      // scale, then turn around Y, then move
      const px = position.data[corner * 3] * size[0];
      const py = position.data[corner * 3 + 1] * size[1];
      const pz = position.data[corner * 3 + 2] * size[2];
      outPosition.set(
        [x + px * cos + pz * sin, y + py, z - px * sin + pz * cos],
        v * 3
      );
      // a normal is not scaled like a position: dividing by the scale keeps
      // it at a right angle to a surface that was stretched
      const nx = normal.data[corner * 3] / size[0];
      const ny = normal.data[corner * 3 + 1] / size[1];
      const nz = normal.data[corner * 3 + 2] / size[2];
      const length = Math.hypot(nx, ny, nz);
      outNormal.set(
        [
          (nx * cos + nz * sin) / length,
          ny / length,
          (-nx * sin + nz * cos) / length,
        ],
        v * 3
      );
      outUv.set([uv.data[corner * 2], uv.data[corner * 2 + 1]], v * 2);
      if (outColor) {
        outColor.set(color, v * 4);
      }
      v++;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(outPosition, 3));
  geometry.setAttribute('normal', new BufferAttribute(outNormal, 3));
  geometry.setAttribute('uv', new BufferAttribute(outUv, 2));
  if (outColor) {
    geometry.setAttribute('color', new BufferAttribute(outColor, 4));
  }
  return geometry;
}

/**
 * Trees across the island.
 * @param {object} options
 * @param {import('magic-pixels').Texture} options.wood texture of the trunks
 * @param {import('magic-pixels').Texture} options.bush texture of the crowns
 * @param {(x: number, z: number) => number} options.heightAt the ground
 * @param {() => number} options.random
 * @param {number} options.size the island's square
 * @param {number} options.waterLevel
 * @param {{ x: number, z: number, radius: number }[]} options.houses
 * @param {{ x: number, z: number }[][]} options.routes the roads' lines
 * @param {number} options.roadWidth
 * @param {number} [options.count] how many trees to try to place
 * @returns {{ object: Object3D, count: number }}
 */
export function createForest(options) {
  const { wood, bush, count = 240 } = options;
  const trees = scatterTrees({ ...options, count });

  // every tree is the parts of treeParts, so the forest looks like a tree
  // built one at a time
  const pieces = createTreePieces();
  const placementsOf = (piece) =>
    trees.map((tree) => {
      const part = treeParts(tree.width, tree.height).find(
        (p) => p.piece === piece
      );
      return { ...tree, size: part.size, y: tree.y + part.y };
    });

  const object = new Object3D();
  object.add(
    new Mesh(
      bake(pieces.trunk, placementsOf('trunk')),
      createPbrMaterial({
        baseColorMap: wood,
        metallicFactor: 0,
        roughnessFactor: 0.6,
      })
    ),
    new Mesh(
      bake(pieces.crown, placementsOf('crown'), { colors: true }),
      createPbrMaterial({
        baseColorMap: bush,
        vertexColors: true,
        metallicFactor: 0,
        roughnessFactor: 0.6,
      })
    )
  );
  return { object, count: trees.length };
}
