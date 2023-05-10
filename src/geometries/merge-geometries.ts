import { BufferGeometry, BufferAttribute } from '../geometries';
import { createIndexedGeometry } from './indexed-geometry';

function mergeNonIndexedGeometries(
  a: BufferGeometry,
  b: BufferGeometry
): BufferGeometry {
  const countA =
    a.index !== null
      ? a.count
      : Math.max.apply(
          null,
          Object.values(a.attributes).map(
            (attr) => (attr.data.length / attr.recordSize) | 0
          )
        );
  const countB =
    b.index !== null
      ? b.count
      : Math.max.apply(
          null,
          Object.values(b.attributes).map(
            (attr) => (attr.data.length / attr.recordSize) | 0
          )
        );
  const result = new BufferGeometry();
  for (const key of Object.keys(a.attributes)) {
    const newAttrib = [];
    const attribA = a.attributes[key];
    const attribB =
      b.attributes[key] || new BufferAttribute(new Float32Array(a.count), 1);
    const recordSize = Math.max(attribA.recordSize, attribB?.recordSize || 0);
    for (let i = 0; i < countA; i++) {
      for (let j = 0; j < recordSize; j++) {
        if (
          attribA.recordSize <= j ||
          attribA.data.length <= i * attribA.recordSize + j
        ) {
          newAttrib.push(0);
          continue;
        }
        newAttrib.push(a.attributes[key].data[i * attribA.recordSize + j]);
      }
    }
    for (let i = 0; i < countB; i++) {
      for (let j = 0; j < recordSize; j++) {
        if (
          !attribB ||
          attribB.recordSize <= j ||
          attribB.data.length <= i * attribB.recordSize + j
        ) {
          newAttrib.push(0);
          continue;
        }
        newAttrib.push(b.attributes[key].data[i * attribB.recordSize + j]);
      }
    }
    result.setAttribute(
      key,
      new BufferAttribute(new Float32Array(newAttrib), recordSize)
    );
  }
  if (a.groups.length === 0) {
    result.groups.push({ startIndex: 0, count: countA });
  }
  result.groups.push(...a.groups, {
    startIndex: countA,
    count: countB,
  });
  return result;
}

function mergeIndexedGeometries(
  a: BufferGeometry,
  b: BufferGeometry
): BufferGeometry {
  if (a.index === null || b.index === null) {
    throw Error();
  }
  const result = mergeNonIndexedGeometries(a, b);
  const maxIndexA = Math.max.apply(null, a.index);
  const maxIndexB = Math.max.apply(null, b.index);
  const indices = a.index.concat(b.index.map((idx) => maxIndexA + 1 + idx));
  result.setIndex(indices, maxIndexA + maxIndexB + 1 < 65534 ? 16 : 32);
  return result;
}

export function mergeGeometries(
  geometry: BufferGeometry,
  otherGeometry: BufferGeometry
): BufferGeometry {
  if (geometry.index === null && otherGeometry.index === null) {
    return mergeNonIndexedGeometries(geometry, otherGeometry);
  }
  return mergeIndexedGeometries(
    geometry.index === null ? createIndexedGeometry(geometry) : geometry,
    otherGeometry.index === null
      ? createIndexedGeometry(otherGeometry)
      : otherGeometry
  );
}
