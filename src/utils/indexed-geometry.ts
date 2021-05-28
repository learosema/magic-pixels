import { BufferAttribute, BufferGeometry } from '../geometries';

/**
 * Create an indexed buffer geometry from a non-indexed one (might be expensive)
 */
export function createIndexedGeometry(
  geometry: BufferGeometry
): BufferGeometry {
  if (geometry.index !== null) {
    throw Error('the buffer geometry is already indexed');
  }
  const result = new BufferGeometry();
  const newAttribs: Record<string, number[]> = {};
  const indices = [];
  let lastIndex = -1;
  const indexMap: Record<string, number> = {};
  for (let i = 0; i < geometry.count; i++) {
    const data: Record<string, number[]> = {};
    for (const [key, attribute] of Object.entries(geometry.attributes)) {
      const offset = i * attribute.recordSize;
      data[key] = Array.from(
        attribute.data.slice(offset, offset + attribute.recordSize)
      );
    }
    const serialized = JSON.stringify(data);
    if (indexMap[serialized]) {
      const index = indexMap[serialized];
      indices.push(index);
    } else {
      lastIndex++;
      indexMap[serialized] = lastIndex;
      indices.push(lastIndex);
      for (const [key, value] of Object.entries(data)) {
        if (!newAttribs[key]) {
          newAttribs[key] = [];
        }
        Array.prototype.push.apply(newAttribs[key], value);
      }
    }
  }
  result.setIndex(indices, lastIndex > 65534 ? 32 : 16);
  for (const [key, value] of Object.entries(newAttribs)) {
    const recordSize = geometry.attributes[key].recordSize;
    result.setAttribute(
      key,
      new BufferAttribute(new Float32Array(value), recordSize)
    );
  }
  return result;
}
