import { facesToBuffer } from './faces-to-buffer';
import { Vector } from '../types';
import { BufferAttribute, BufferGeometry } from './buffer-geometry';

/**
 * Create sphere geometry
 * @param r radius
 * @param sides number of sides (around the sphere)
 * @param segments number of segments (from top to bottom)
 */
export function createSphereGeometry(
  r = 0.5,
  sides = 36,
  segments = 18
): BufferGeometry {
  const vertices: Vector[] = [];
  const normals: Vector[] = [];
  const texCoords = [];
  const faces = [];

  const dphi = 360 / sides;
  const dtheta = 180 / segments;

  const evalPos = (theta: number, phi: number) => {
    const deg = Math.PI / 180.0;
    const pos = new Vector(
      r * Math.sin(theta * deg) * Math.sin(phi * deg),
      r * Math.cos(theta * deg),
      r * Math.sin(theta * deg) * Math.cos(phi * deg)
    );
    return pos;
  };
  for (let segment = 0; segment <= segments; segment++) {
    const theta = segment * dtheta;
    for (let side = 0; side <= sides; side++) {
      const phi = side * dphi;
      const pos = evalPos(theta, phi);
      const texCoord = new Vector(phi / 360.0, theta / 180.0);
      const normal = pos.normalized;

      vertices.push(pos);
      texCoords.push(texCoord);
      normals.push(normal);
      if (segment === segments) continue;
      if (side === sides) continue;

      if (segment == 0) {
        // first segment uses triangles
        faces.push([
          segment * (sides + 1) + side,
          (segment + 1) * (sides + 1) + side,
          (segment + 1) * (sides + 1) + side + 1,
        ]);
      } else if (segment == segments - 1) {
        // last segment also uses triangles
        faces.push([
          segment * (sides + 1) + side,
          (segment + 1) * (sides + 1) + side + 1,
          segment * (sides + 1) + side + 1,
        ]);
      } else {
        // A --- B
        // D --- C
        const A = segment * (sides + 1) + side;
        const B = (segment + 1) * (sides + 1) + side;
        const C = (segment + 1) * (sides + 1) + side + 1;
        const D = segment * (sides + 1) + side + 1;

        faces.push([A, B, D]);
        faces.push([B, C, D]);
      }
    }
  }
  const geometry = new BufferGeometry();
  const positionData = new Float32Array(facesToBuffer(faces, vertices));
  const normalData = new Float32Array(facesToBuffer(faces, normals));
  const uvData = new Float32Array(facesToBuffer(faces, texCoords));
  geometry.setAttribute('position', new BufferAttribute(positionData, 3));
  geometry.setAttribute('normal', new BufferAttribute(normalData, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvData, 2));
  return geometry;
}
