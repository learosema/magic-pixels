import { BufferAttribute, BufferGeometry } from 'magic-pixels';

// Roads between the houses. Three steps:
//
//   1. decide which houses to connect: a minimum spanning tree (every house
//      reachable, no loops), plus a few extra roads for loops,
//   2. turn every house to face its nearest neighbour on the tree, so its
//      door opens onto its road,
//   3. lay a ribbon of ground-hugging triangles along every road.
//
// A "site" is `{ x, z, radius, house }`: where a house stands, the radius of
// the circle it occupies, and the house object itself (an Object3D with
// `doorDistance`, `halfWidth` and `halfDepth`, see houses.js).

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Distance from the point `p` to the line segment from `a` to `b` */
function segmentDistance(p, a, b) {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - a.x) * abx + (p.z - a.z) * abz) / (abx * abx + abz * abz)
    )
  );
  return Math.hypot(p.x - (a.x + abx * t), p.z - (a.z + abz * t));
}

/**
 * Which houses get a road between them: pairs of indices into `sites`.
 * Kruskal's algorithm: go through all pairs, shortest first, and take a pair
 * if it joins two groups of houses that are not connected yet. When all
 * houses are one group, the roads form a tree. The pairs that were not taken
 * are the candidates for a few extra roads that close loops.
 */
function planRoads(sites, heightAt, waterLevel, extra) {
  const pairs = [];
  for (let i = 0; i < sites.length; i++) {
    for (let j = i + 1; j < sites.length; j++) {
      pairs.push({ i, j, length: distance(sites[i], sites[j]) });
    }
  }
  pairs.sort((a, b) => a.length - b.length);

  // a road must not run through the water...
  const dry = ({ i, j, length }) => {
    const steps = Math.ceil(length);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = sites[i].x + (sites[j].x - sites[i].x) * t;
      const z = sites[i].z + (sites[j].z - sites[i].z) * t;
      if (heightAt(x, z) < waterLevel + 0.05) {
        return false;
      }
    }
    return true;
  };
  // ...nor through another house
  const clear = ({ i, j }) =>
    sites.every(
      (site, k) =>
        k === i ||
        k === j ||
        segmentDistance(site, sites[i], sites[j]) > site.radius * 0.85
    );

  // union-find: `group` follows the links to the representative of a group
  const parent = sites.map((_, i) => i);
  const group = (i) => (parent[i] === i ? i : (parent[i] = group(parent[i])));
  const roads = [];
  const spare = [];
  for (const pair of pairs) {
    if (!dry(pair) || !clear(pair)) {
      continue;
    }
    const a = group(pair.i);
    const b = group(pair.j);
    if (a === b) {
      spare.push(pair);
    } else {
      parent[a] = b;
      roads.push(pair);
    }
  }
  // houses no clear road reaches (behind another house, say): join them by
  // the shortest road that at least stays dry
  for (const pair of pairs) {
    if (group(pair.i) !== group(pair.j) && dry(pair)) {
      parent[group(pair.i)] = group(pair.j);
      roads.push(pair);
    }
  }
  // the shortest spare pairs become loops in the network
  return roads.concat(spare.slice(0, extra));
}

/** Turn every house to face the other end of its shortest road */
function orientHouses(sites, roads, random) {
  const nearest = new Map();
  for (const road of roads) {
    for (const [from, to] of [
      [road.i, road.j],
      [road.j, road.i],
    ]) {
      if (!nearest.has(from) || nearest.get(from).length > road.length) {
        nearest.set(from, { to, length: road.length });
      }
    }
  }
  sites.forEach((site, i) => {
    const target = nearest.get(i);
    // local +z is the front of a house; turning by yaw around Y points it at
    // (sin yaw, cos yaw). A little wobble so the street is not too neat.
    site.yaw = target
      ? Math.atan2(sites[target.to].x - site.x, sites[target.to].z - site.z) +
        (random() - 0.5) * 0.5
      : random() * Math.PI * 2;
    site.house.rotation.y = site.yaw;
  });
}

/**
 * The control points of a road from far away (the direction of `other`) to
 * the door of a house, in order, ending at the door. A road always ends at a
 * door. If the straight way to it would cut through the walls, the road goes
 * round the house on the side it comes from: past the back corner if it
 * comes from behind, then along the flank to the front, then to the door.
 */
function approach(site, other) {
  const { doorDistance, halfWidth, halfDepth } = site.house;
  const sin = Math.sin(site.yaw);
  const cos = Math.cos(site.yaw);
  // a house's own coordinates: x to its right, z out of its front
  const toLocal = (p) => {
    const dx = p.x - site.x;
    const dz = p.z - site.z;
    return { x: dx * cos - dz * sin, z: dx * sin + dz * cos };
  };
  const toWorld = ({ x, z }) => ({
    x: site.x + x * cos + z * sin,
    z: site.z - x * sin + z * cos,
  });

  const from = toLocal(other);
  const door = { x: 0, z: doorDistance };
  // walk along the straight way and see whether it enters the walls
  const blocked = Array.from({ length: 12 }, (_, i) => (i + 1) / 13).some(
    (t) => {
      const x = from.x + (door.x - from.x) * t;
      const z = from.z + (door.z - from.z) * t;
      return Math.abs(x) < halfWidth + 0.3 && Math.abs(z) < halfDepth + 0.3;
    }
  );
  if (!blocked) {
    return [toWorld(door)];
  }
  const side = from.x >= 0 ? 1 : -1;
  const flank = side * (halfWidth + 0.7);
  const points = [];
  if (from.z < -halfDepth) {
    points.push({ x: flank, z: -halfDepth - 0.7 }); // round the back corner
  }
  points.push({ x: flank, z: doorDistance + 0.5 }); // along the flank, to the front
  points.push(door);
  return points.map(toWorld);
}

/**
 * A smooth line through the control points: a Catmull-Rom spline, which
 * passes through every point, each piece a cubic curve between two of them
 * whose direction at the ends comes from the neighbouring points. With only
 * the two ends, a point is added to the side of the middle for a gentle bend.
 * @returns {{ x: number, z: number }[]} points about 0.6 units apart
 */
function routeThrough(points, random) {
  let control = points;
  if (points.length === 2) {
    const [a, b] = points;
    const length = distance(a, b);
    const bend = (random() - 0.5) * 0.3 * length;
    control = [
      a,
      {
        x: (a.x + b.x) / 2 - ((b.z - a.z) / length) * bend,
        z: (a.z + b.z) / 2 + ((b.x - a.x) / length) * bend,
      },
      b,
    ];
  }
  const route = [control[0]];
  for (let i = 0; i < control.length - 1; i++) {
    const p0 = control[Math.max(0, i - 1)];
    const p1 = control[i];
    const p2 = control[i + 1];
    const p3 = control[Math.min(control.length - 1, i + 2)];
    const steps = Math.max(2, Math.ceil(distance(p1, p2) / 0.6));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const spline = (a, b, c, d) =>
        0.5 *
        (2 * b +
          (c - a) * t +
          (2 * a - 5 * b + 4 * c - d) * t * t +
          (3 * b - a - 3 * c + d) * t * t * t);
      route.push({
        x: spline(p0.x, p1.x, p2.x, p3.x),
        z: spline(p0.z, p1.z, p2.z, p3.z),
      });
    }
  }
  return route;
}

/**
 * A strip of triangles along each route, following the ground: at every point
 * of a route the strip has a left and a right vertex, half a width to each
 * side, lifted a little above the terrain so it does not flicker against it.
 */
function createRibbons(routes, heightAt, { width, lift, uvScale }) {
  const position = [];
  const normal = [];
  const uv = [];
  const index = [];
  const e = 0.3;
  for (const route of routes) {
    const first = position.length / 3;
    let along = 0;
    route.forEach((p, i) => {
      const before = route[Math.max(0, i - 1)];
      const after = route[Math.min(route.length - 1, i + 1)];
      const length = distance(before, after);
      // the direction of the road here, and the side of it
      const tx = (after.x - before.x) / length;
      const tz = (after.z - before.z) / length;
      if (i > 0) {
        along += distance(route[i - 1], p);
      }
      // the terrain's slope, for the normal
      const nx = -(heightAt(p.x + e, p.z) - heightAt(p.x - e, p.z)) / (2 * e);
      const nz = -(heightAt(p.x, p.z + e) - heightAt(p.x, p.z - e)) / (2 * e);
      const nl = Math.hypot(nx, 1, nz);
      for (const side of [1, -1]) {
        const x = p.x - tz * side * (width / 2);
        const z = p.z + tx * side * (width / 2);
        position.push(x, heightAt(x, z) + lift, z);
        normal.push(nx / nl, 1 / nl, nz / nl);
        uv.push(side === 1 ? 0 : 1, along * uvScale);
      }
    });
    // two triangles per step, counter-clockwise seen from above
    for (let i = 0; i < route.length - 1; i++) {
      const l0 = first + i * 2;
      const r0 = l0 + 1;
      const l1 = l0 + 2;
      const r1 = l0 + 3;
      index.push(l0, l1, r0, r0, l1, r1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array(position), 3)
  );
  geometry.setAttribute(
    'normal',
    new BufferAttribute(new Float32Array(normal), 3)
  );
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  geometry.setIndex(index, position.length / 3 > 65535 ? 32 : 16);
  return geometry;
}

/**
 * Connect the houses with roads. Turns the houses to face their roads, and
 * returns the geometry of all the roads in one piece (world coordinates),
 * and the lines they follow (lists of points), for what has to keep off them.
 * @param {{ x: number, z: number, radius: number, house: object }[]} sites
 * @param {(x: number, z: number) => number} heightAt
 * @param {object} options
 * @param {number} options.waterLevel roads stay above this
 * @param {() => number} options.random
 * @param {number} [options.extra] extra roads that close loops
 * @param {number} [options.width]
 */
export function createRoads(sites, heightAt, options) {
  const { waterLevel, random, extra = 2, width = 1.1 } = options;
  const roads = planRoads(sites, heightAt, waterLevel, extra);
  orientHouses(sites, roads, random);
  // from the door of one house to the door of the other
  const routes = roads.map(({ i, j }) =>
    routeThrough(
      [
        ...approach(sites[i], sites[j]).reverse(),
        ...approach(sites[j], sites[i]),
      ],
      random
    )
  );
  const geometry = createRibbons(routes, heightAt, {
    width,
    lift: 0.04,
    uvScale: 0.6,
  });
  return { geometry, routes };
}
