import {
  Mesh,
  Object3D,
  createBoxGeometry,
  createPbrMaterial,
} from 'magic-pixels';
import { createPyramidGeometry } from './geometries.js';

/**
 * The shape of a tree, as its parts: which piece, how big (x, y, z), and the
 * height of the piece's origin. The pieces themselves are one unit big (see
 * createTreePieces) and scaled to these sizes, so a tree of any size is the
 * same two pieces, and a forest can bake them (see forest.js).
 *
 * A box is centred on its origin, a pyramid stands on it: so the trunk's
 * origin is half way up the trunk and the crown's is its base, which sits a
 * little down into the trunk.
 */
export function treeParts(width, height, depth = width) {
  return [
    {
      piece: 'trunk',
      size: [width * 0.5, height * 0.25, depth * 0.5],
      y: height * 0.125,
    },
    { piece: 'crown', size: [width, height * 0.8, depth], y: height * 0.2 },
  ];
}

/** The two pieces every tree is made of, one unit big */
export function createTreePieces() {
  return {
    trunk: createBoxGeometry(1, 1, 1),
    crown: createPyramidGeometry(1, 1, 1),
  };
}

export function treeKit({ wood, bush }) {
  const materials = {
    trunk: createPbrMaterial({
      baseColorMap: wood,
      metallicFactor: 0,
      roughnessFactor: 0.6,
    }),
    crown: createPbrMaterial({
      baseColorMap: bush,
      metallicFactor: 0,
      roughnessFactor: 0.6,
    }),
  };
  const pieces = createTreePieces();

  function buildTree(width, height, depth = width) {
    const tree = new Object3D();
    for (const { piece, size, y } of treeParts(width, height, depth)) {
      const mesh = new Mesh(pieces[piece], materials[piece]);
      mesh.scale.set(...size);
      mesh.position.y = y;
      tree.add(mesh);
    }
    return tree;
  }

  return { buildTree };
}
