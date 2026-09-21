import {
  AlphaMode,
  Mesh,
  Object3D,
  createBoxGeometry,
  createPbrMaterial,
  createSphereGeometry,
} from 'magic-pixels';
import { createGableGeometry, createPyramidGeometry } from './geometries.js';

// What the buildings are made of. The wall textures are multiplied by the
// tint, so one texture gives several colours; roofs share one texture too.
const WALL_TINTS = {
  plaster: [
    [1, 1, 1],
    [1, 0.9, 0.7],
    [0.85, 0.95, 1],
    [1, 0.8, 0.8],
    [0.9, 1, 0.85],
  ],
  stone: [
    [0.6, 0.6, 0.65],
    [0.7, 0.65, 0.6],
  ],
  wood: [
    [0.7, 0.1, 0.07],
    [0.5, 0.3, 0.15],
  ],
};
const ROOF_TINTS = [
  [0.8, 0.04, 0.03], // red
  [0.6, 0.2, 0.06], // terracotta
  [0.12, 0.16, 0.28], // slate
  [0.06, 0.3, 0.1], // green
];

// The kinds of building. Sizes are ranges: every building picks its own
// numbers, so no two are alike. `weight` is how often a kind is picked.
const KINDS = {
  cottage: {
    weight: 4,
    width: [2.4, 3],
    depth: [2.4, 3],
    height: [1.6, 2],
    roof: 'gable',
    roofHeight: 1.1,
    walls: 'plaster',
    chimney: true,
  },
  house: {
    weight: 4,
    width: [3, 3.8],
    depth: [2.6, 3.4],
    height: [2, 2.6],
    roof: 'pyramid',
    roofHeight: 1.5,
    walls: 'plaster',
    chimney: true,
  },
  tower: {
    weight: 1.5,
    width: [1.6, 2],
    depth: [1.6, 2],
    height: [4, 5.5],
    roof: 'pyramid',
    roofHeight: 2.4,
    walls: 'stone',
    chimney: false,
  },
  barn: {
    weight: 1.5,
    width: [3.2, 3.8],
    depth: [4.6, 5.4],
    height: [1.8, 2.2],
    roof: 'gable',
    roofHeight: 1.6,
    walls: 'wood',
    chimney: false,
  },
};

const ROOF_OVERHANG = 0.6;
// the roof sits a hair into the walls, so no crack shows where they meet
const ROOF_SINK = 0.03;

const between = (random, [min, max]) => min + random() * (max - min);
const pick = (random, list) => list[Math.floor(random() * list.length)];

/**
 * Everything to build and animate the buildings of the city.
 * @param {object} textures
 * @param {import('magic-pixels').Texture} textures.plaster
 * @param {import('magic-pixels').Texture} textures.stone
 * @param {import('magic-pixels').Texture} textures.wood
 * @param {import('magic-pixels').Texture} textures.roof
 * @param {object} [textures.normals] normal maps for the same four, by the
 *   same names, made from the same noise as the colour textures (see
 *   `normalPattern`); a building without one is smooth
 * @param {() => number} random a random number generator, 0..1
 */
export function createHouseKit(textures, random) {
  // ------------------------------------------------------------ materials
  // One material per texture and tint, shared by all buildings that use it:
  // the renderer draws them with the same program and just switches uniforms.
  const normals = textures.normals ?? {};
  const material = (name, tint, roughness) =>
    createPbrMaterial({
      baseColorFactor: [...tint, 1],
      baseColorMap: textures[name],
      normalMap: normals[name],
      metallicFactor: 0,
      roughnessFactor: roughness,
    });
  const wallMaterials = Object.fromEntries(
    Object.entries(WALL_TINTS).map(([name, tints]) => [
      name,
      tints.map((tint) => material(name, tint, 0.8)),
    ])
  );
  const roofMaterials = ROOF_TINTS.map((tint) => material('roof', tint, 0.9));
  const chimneyMaterial = material('roof', [0.45, 0.15, 0.1], 0.9);
  const doorMaterial = material('wood', [0.35, 0.18, 0.08], 0.7);
  // a window is either a pane of glass or has a light on behind it (unlit,
  // so it glows whatever the sun does)
  const glassMaterial = createPbrMaterial({
    baseColorFactor: [0.25, 0.45, 0.7, 1],
    metallicFactor: 0,
    roughnessFactor: 0.1,
  });
  const lightMaterial = createPbrMaterial({
    unlit: true,
    baseColorFactor: [1, 0.75, 0.3, 1],
  });

  // ---------------------------------------------------------- geometries
  // details are thin boxes stuck on the walls; a box is centred on its
  // origin, so put it half its thickness out and it sticks out by that
  const frontWindow = createBoxGeometry(0.5, 0.55, 0.06);
  const sideWindow = createBoxGeometry(0.06, 0.55, 0.5);
  const smallDoor = createBoxGeometry(0.6, 1.1, 0.08);
  const bigDoor = createBoxGeometry(1.5, 1.4, 0.08);

  // -------------------------------------------------------------- planning
  /**
   * Decide what a building will be like, without making it yet: where the
   * city has to know the size (to find room for it) before it is built.
   */
  function planHouse() {
    // a weighted pick: walk along the weights until the dice are used up
    const names = Object.keys(KINDS);
    let dice = random() * names.reduce((sum, n) => sum + KINDS[n].weight, 0);
    const name = names.find((n) => (dice -= KINDS[n].weight) < 0) ?? names[0];
    const kind = KINDS[name];

    const plan = {
      name,
      roof: kind.roof,
      roofHeight: kind.roofHeight,
      width: between(random, kind.width),
      depth: between(random, kind.depth),
      height: between(random, kind.height),
      wallMaterial: pick(random, wallMaterials[kind.walls]),
      roofMaterial: pick(random, roofMaterials),
      litWindows: random() < 0.5,
      chimney: null,
    };
    // the circle the building (and its roof) stands in, for the spacing
    plan.radius =
      Math.hypot(plan.width + ROOF_OVERHANG, plan.depth + ROOF_OVERHANG) / 2;

    if (kind.chimney) {
      // on a slope of the roof: at x, z, the roof is at this height above the
      // top of the wall
      const x = (random() < 0.5 ? -1 : 1) * plan.width * 0.2;
      const z = -plan.depth * 0.15;
      const halfWidth = (plan.width + ROOF_OVERHANG) / 2;
      const halfDepth = (plan.depth + ROOF_OVERHANG) / 2;
      const across = Math.abs(x) / halfWidth;
      const along = Math.abs(z) / halfDepth;
      // a gable roof slopes only across, a pyramid roof in both directions
      const slope = plan.roof === 'gable' ? across : Math.max(across, along);
      plan.chimney = { x, z, roofY: plan.roofHeight * (1 - slope) };
    }
    return plan;
  }

  // -------------------------------------------------------------- building
  /** Make the building of a plan: an Object3D standing on y = 0, front to +z */
  function buildHouse(plan) {
    const { width, depth, height } = plan;
    const house = new Object3D();
    house.footprint = plan.radius;
    // for the roads: the spot in front of the door, and the size of the walls
    house.doorDistance = depth / 2 + 0.25;
    house.halfWidth = width / 2;
    house.halfDepth = depth / 2;

    // a box is centred on its origin: lift it so its base is on the ground
    const body = new Mesh(
      createBoxGeometry(width, height, depth),
      plan.wallMaterial
    );
    body.position.y = height / 2;

    const roofWidth = width + ROOF_OVERHANG;
    const roofDepth = depth + ROOF_OVERHANG;
    const roof = new Mesh(
      plan.roof === 'pyramid'
        ? createPyramidGeometry(roofWidth, roofDepth, plan.roofHeight)
        : createGableGeometry(roofWidth, roofDepth, plan.roofHeight),
      plan.roofMaterial
    );
    // the roof's base is at its own y = 0
    roof.position.y = height - ROOF_SINK;
    house.add(body, roof);

    const add = (geometry, mat, x, y, z) => {
      const mesh = new Mesh(geometry, mat);
      mesh.position.set(x, y, z);
      house.add(mesh);
    };
    const windowMaterial = () =>
      plan.litWindows && random() < 0.6 ? lightMaterial : glassMaterial;

    // the door: in the middle of the front, on the ground
    const isBarn = plan.name === 'barn';
    const isTower = plan.name === 'tower';
    if (isBarn) {
      add(bigDoor, doorMaterial, 0, 0.7, depth / 2 + 0.03);
    } else {
      add(smallDoor, doorMaterial, 0, 0.55, depth / 2 + 0.03);
    }

    if (isTower) {
      // windows stacked up all four sides
      for (let y = 1.6; y < height - 0.6; y += 1.2) {
        add(frontWindow, windowMaterial(), 0, y, depth / 2 + 0.01);
        add(frontWindow, windowMaterial(), 0, y, -depth / 2 - 0.01);
        add(sideWindow, windowMaterial(), width / 2 + 0.01, y, 0);
        add(sideWindow, windowMaterial(), -width / 2 - 0.01, y, 0);
      }
    } else if (isBarn) {
      // a hayloft window in the front gable, which is one overhang further out
      add(
        frontWindow,
        windowMaterial(),
        0,
        height + 0.55,
        roofDepth / 2 + 0.01
      );
    } else {
      // two windows beside the door, and one or two on each side
      const y = height * 0.55;
      for (const side of [-1, 1]) {
        add(
          frontWindow,
          windowMaterial(),
          side * (width / 2 - 0.55),
          y,
          depth / 2 + 0.01
        );
        add(
          sideWindow,
          windowMaterial(),
          side * (width / 2 + 0.01),
          y,
          depth * 0.22
        );
        add(
          sideWindow,
          windowMaterial(),
          side * (width / 2 + 0.01),
          y,
          -depth * 0.22
        );
      }
    }

    if (plan.chimney) {
      const { x, z, roofY } = plan.chimney;
      // from the wall top, through the roof, a bit out of it
      const chimneyHeight = roofY + 0.6;
      add(
        createBoxGeometry(0.4, chimneyHeight, 0.4),
        chimneyMaterial,
        x,
        height + chimneyHeight / 2,
        z
      );
      house.chimney = { x, y: height + chimneyHeight, z };
    }
    return house;
  }

  // ----------------------------------------------------------------- smoke
  // Puffs of smoke rise from the chimneys: unlit spheres that grow, drift
  // with the wind and fade out, over and over. They belong to the scene and
  // not to the houses, so the wind blows the same way over every chimney
  // whichever way a house is turned.
  const smokeRoot = new Object3D();
  const puffGeometry = createSphereGeometry(1, 10, 8);
  const puffs = [];
  const PUFFS_PER_CHIMNEY = 5;
  const RISE_TIME = 5; // seconds a puff lives

  /** Start smoke at the chimney of a house, once it is placed in the scene */
  function addSmoke(house) {
    if (!house.chimney) {
      return;
    }
    // the chimney's spot in the world: turn its local x, z by the house's yaw
    const { x, y, z } = house.chimney;
    const yaw = house.rotation.y;
    const origin = [
      house.position.x + x * Math.cos(yaw) + z * Math.sin(yaw),
      house.position.y + y,
      house.position.z - x * Math.sin(yaw) + z * Math.cos(yaw),
    ];
    const shift = random();
    for (let i = 0; i < PUFFS_PER_CHIMNEY; i++) {
      // every puff has its own material, since each fades on its own
      const puffMaterial = createPbrMaterial({
        unlit: true,
        baseColorFactor: [0.92, 0.92, 0.96, 0],
        alphaMode: AlphaMode.BLEND,
      });
      const mesh = new Mesh(puffGeometry, puffMaterial);
      smokeRoot.add(mesh);
      puffs.push({ mesh, origin, offset: i / PUFFS_PER_CHIMNEY + shift });
    }
  }

  function updateSmoke(time) {
    for (const { mesh, origin, offset } of puffs) {
      // 0 when the puff leaves the chimney, 1 when it is gone
      const age = (time / RISE_TIME + offset) % 1;
      mesh.position.set(
        origin[0] + age * 1.8,
        origin[1] + 0.2 + age * 2.6,
        origin[2] + age * 0.5
      );
      const size = 0.12 + age * 0.5;
      mesh.scale.set(size, size, size);
      // fade in quickly so a puff does not pop into being, then out slowly
      const alpha = 0.6 * Math.min(age * 8, 1) * (1 - age);
      mesh.material.uniforms.baseColorFactor = [0.92, 0.92, 0.96, alpha];
    }
  }

  return {
    planHouse,
    buildHouse,
    smoke: { object: smokeRoot, add: addSmoke, update: updateSmoke },
  };
}
