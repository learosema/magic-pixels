import { BufferAttribute, BufferGeometry } from './buffer-geometry';

// adapted from THREE.js

/**
 * Build a plane
 *
 * @param u first axis
 * @param v second axis
 * @param w third axis
 * @param udir u-direction
 * @param vdir v-direction
 * @param width width
 * @param height height
 * @param depth depth
 * @param gridX number of segments in x-direction
 * @param gridY number of segments in y-direction
 * @param vertexIndexStart starting vertex index
 * @param faceIndex face index
 * @returns
 */
function buildPlane(
  u: string,
  v: string,
  w: string,
  udir: number,
  vdir: number,
  width: number,
  height: number,
  depth: number,
  gridX: number,
  gridY: number,
  vertexIndexStart: number,
  faceIndex: number
) {
  const segmentWidth = width / gridX;
  const segmentHeight = height / gridY;

  const widthHalf = width / 2;
  const heightHalf = height / 2;
  const depthHalf = depth / 2;

  const gridX1 = gridX + 1;
  const gridY1 = gridY + 1;

  let vertexCount = 0;
  let groupCount = 0;

  const vector: Record<string, number> = { x: NaN, y: NaN, z: NaN };
  const vertices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const faceIndices: number[] = [];

  // generate vertices, normals and uvs
  for (let iy = 0; iy < gridY1; iy++) {
    const y = iy * segmentHeight - heightHalf;

    for (let ix = 0; ix < gridX1; ix++) {
      const x = ix * segmentWidth - widthHalf;

      // set values to correct vector component
      vector[u] = x * udir;
      vector[v] = y * vdir;
      vector[w] = depthHalf;

      // now apply vector to vertex buffer
      vertices.push(vector.x, vector.y, vector.z);

      // set values to correct vector component
      vector[u] = 0;
      vector[v] = 0;
      vector[w] = depth > 0 ? 1 : -1;

      // now apply vector to normal buffer
      normals.push(vector.x, vector.y, vector.z);

      // uvs
      uvs.push(ix / gridX);
      uvs.push(1 - iy / gridY);

      // faceIndices
      faceIndices.push(faceIndex);

      // counters
      vertexCount += 1;
    }
  }

  // indices

  // 1. you need three indices to draw a single face
  // 2. a single segment consists of two faces
  // 3. so we need to generate six (2*3) indices per segment

  for (let iy = 0; iy < gridY; iy++) {
    for (let ix = 0; ix < gridX; ix++) {
      const a = vertexIndexStart + ix + gridX1 * iy;
      const b = vertexIndexStart + ix + gridX1 * (iy + 1);
      const c = vertexIndexStart + (ix + 1) + gridX1 * (iy + 1);
      const d = vertexIndexStart + (ix + 1) + gridX1 * iy;

      // faces
      indices.push(a, b, d);
      indices.push(b, c, d);

      // increase counter
      groupCount += 6;
    }
  }

  return {
    vertices,
    normals,
    uvs,
    indices,
    faceIndices,
    groupCount,
    vertexCount,
  };
}

/**
 * Create a box geometry
 * @param width width of the box (default: 1)
 * @param height height of the box (default: 1)
 * @param depth depth of the box (default: 1)
 * @param widthSegments number of width segments (default: 1)
 * @param heightSegments number of height segments (default: 1)
 * @param depthSegments number of depth segments (default: 1)
 * @returns a buffer geometry
 */
export function createBoxGeometry(
  width = 1,
  height = 1,
  depth = 1,
  widthSegments = 1,
  heightSegments = 1,
  depthSegments = 1
): BufferGeometry {
  // build each side of the box geometry
  let count = 0;

  const px = buildPlane(
    'z',
    'y',
    'x',
    -1,
    -1,
    depth,
    height,
    width,
    depthSegments,
    heightSegments,
    count,
    0
  );
  count += px.vertexCount;

  const nx = buildPlane(
    'z',
    'y',
    'x',
    1,
    -1,
    depth,
    height,
    -width,
    depthSegments,
    heightSegments,
    count,
    1
  );
  count += nx.vertexCount;

  const py = buildPlane(
    'x',
    'z',
    'y',
    1,
    1,
    width,
    depth,
    height,
    widthSegments,
    depthSegments,
    count,
    2
  );
  count += py.vertexCount;

  const ny = buildPlane(
    'x',
    'z',
    'y',
    1,
    -1,
    width,
    depth,
    -height,
    widthSegments,
    depthSegments,
    count,
    3
  );
  count += ny.vertexCount;

  const pz = buildPlane(
    'x',
    'y',
    'z',
    1,
    -1,
    width,
    height,
    depth,
    widthSegments,
    heightSegments,
    count,
    4
  );
  count += pz.vertexCount;

  const nz = buildPlane(
    'x',
    'y',
    'z',
    -1,
    -1,
    width,
    height,
    -depth,
    widthSegments,
    heightSegments,
    count,
    5
  );
  count += nz.vertexCount;

  const vertices = new Float32Array(
    Array.prototype.concat.apply(
      [],
      [
        px.vertices,
        nx.vertices,
        py.vertices,
        ny.vertices,
        pz.vertices,
        nz.vertices,
      ]
    )
  );

  const normals = new Float32Array(
    Array.prototype.concat.apply(
      [],
      [px.normals, nx.normals, py.normals, ny.normals, pz.normals, nz.normals]
    )
  );

  const uvs = new Float32Array(
    Array.prototype.concat.apply(
      [],
      [px.uvs, nx.uvs, py.uvs, ny.uvs, pz.uvs, nz.uvs]
    )
  );

  const indices = Array.prototype.concat.apply(
    [],
    [px.indices, nx.indices, py.indices, ny.indices, pz.indices, nz.indices]
  );
  const faceIndices = new Float32Array(
    Array.prototype.concat.apply(
      [],
      [
        px.faceIndices,
        nx.faceIndices,
        py.faceIndices,
        ny.faceIndices,
        pz.faceIndices,
        nz.faceIndices,
      ]
    )
  );
  const geometry = new BufferGeometry();
  let groupIndex = 0;

  geometry.groups.push({ startIndex: groupIndex, count: px.indices.length });
  groupIndex += px.indices.length;

  geometry.groups.push({ startIndex: groupIndex, count: nx.indices.length });
  groupIndex += nx.indices.length;

  geometry.groups.push({ startIndex: groupIndex, count: py.indices.length });
  groupIndex += py.indices.length;

  geometry.groups.push({ startIndex: groupIndex, count: ny.indices.length });
  groupIndex += ny.indices.length;

  geometry.groups.push({ startIndex: groupIndex, count: pz.indices.length });
  groupIndex += pz.indices.length;

  geometry.groups.push({ startIndex: groupIndex, count: nz.indices.length });

  geometry.setAttribute('position', new BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setAttribute('faceIndex', new BufferAttribute(faceIndices, 1));
  geometry.setIndex(indices);
  return geometry;
}
