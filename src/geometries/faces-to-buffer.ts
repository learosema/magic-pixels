import { Vector } from '../types';

/**
 * @param faces array of vertex indices containing 3 or 4 indices each for triangles/quads
 * @param vertices the vertices
 * @returns converts to an array of numbers
 */
export function facesToBuffer(faces: number[][], vertices: Vector[]): number[] {
  return faces
    .map((face) => {
      if (face.length === 3) {
        return face.map((vertexIndex) => vertices[vertexIndex]);
      }
      if (face.length === 4) {
        const q = face.map((vertexIndex) => vertices[vertexIndex]);
        return [q[0], q[1], q[3], q[3], q[1], q[2]];
      }
      throw Error('not supported');
    })
    .flat()
    .map((v) => v.toArray())
    .flat();
}
