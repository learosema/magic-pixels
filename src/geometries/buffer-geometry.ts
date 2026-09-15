import { Box3, Sphere } from '../utils';

export type BufferGroup = {
  startIndex: number;
  count: number;
};

/** Typed arrays a {@link BufferAttribute} can hold */
export type TypedArray =
  | Float32Array
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array;

export class BufferAttribute {
  /**
   * Set to true after writing into `data` (or replacing it) so the renderer
   * re-uploads the buffer on the next render. The renderer resets it to false.
   */
  needsUpdate = false;

  /** Hint for the renderer that `data` is going to change frequently */
  dynamic = false;

  /**
   * For integer arrays, map the value range to 0..1 (unsigned) or -1..1
   * (signed) instead of passing it through as-is. No effect on `Float32Array`.
   */
  normalized: boolean;

  constructor(
    public data: TypedArray,
    public recordSize: number,
    normalized = false
  ) {
    this.normalized = normalized;
  }

  get count(): number {
    return this.data.length / this.recordSize;
  }

  /**
   * One component of one vertex as the shader sees it: for normalized
   * integer data the value mapped to `0..1` (unsigned) or `-1..1` (signed),
   * otherwise the stored number.
   */
  getComponent(index: number, component: number): number {
    return denormalize(
      this.data[index * this.recordSize + component],
      this.data,
      this.normalized
    );
  }
}

/**
 * Map a stored integer to the value WebGL produces for a normalized
 * attribute: unsigned types to `0..1`, signed types to `-1..1` (with the
 * most negative value clamped to `-1`). Floats and non-normalized data are
 * returned as they are.
 */
export function denormalize(
  value: number,
  data: TypedArray,
  normalized: boolean
): number {
  if (!normalized) {
    return value;
  }
  if (data instanceof Int8Array) return Math.max(value / 127, -1);
  if (data instanceof Uint8Array) return value / 255;
  if (data instanceof Int16Array) return Math.max(value / 32767, -1);
  if (data instanceof Uint16Array) return value / 65535;
  if (data instanceof Int32Array) return Math.max(value / 2147483647, -1);
  if (data instanceof Uint32Array) return value / 4294967295;
  return value;
}

/**
 * minimal BufferGeometry class to provide an API similar to THREE.
 *
 * A geometry is plain data; the renderer creates and caches the GPU buffers
 * for it. Adding/removing attributes or changing the index bumps `version`,
 * which makes the renderer rebuild its buffers. To change the contents of an
 * existing attribute, write into `attribute.data` and set
 * `attribute.needsUpdate = true`.
 *
 * `boundingBox` and `boundingSphere` are the extent of the `position`
 * attribute in the geometry's own space, computed on demand by
 * `computeBoundingBox()` / `computeBoundingSphere()` and cached. Set them
 * to `null` after changing positions so they are recomputed.
 */
export class BufferGeometry {
  attributes: Record<string, BufferAttribute> = {};
  count = 0;
  index: Uint16Array | Uint32Array | null = null;
  indexType: 0 | 16 | 32 = 0;
  groups: BufferGroup[] = [];

  /** local-space box around all positions; `null` until computed */
  boundingBox: Box3 | null = null;
  /** local-space sphere around all positions; `null` until computed */
  boundingSphere: Sphere | null = null;

  /** Incremented on every structural change (attributes added/removed, index set) */
  version = 0;

  setIndex(indices: ArrayLike<number>, bits: 16 | 32 = 16): BufferGeometry {
    this.index =
      bits === 32 ? new Uint32Array(indices) : new Uint16Array(indices);
    this.indexType = bits;
    this.count = this.index.length;
    this.version++;
    return this;
  }

  setAttribute(
    attributeName: string,
    bufferAttribute: BufferAttribute
  ): BufferGeometry {
    this.attributes[attributeName] = bufferAttribute;
    if (!this.index) {
      this.count = Math.max(this.count, bufferAttribute.count);
    }
    this.version++;
    return this;
  }

  removeAttribute(attributeName: string): BufferGeometry {
    if (attributeName in this.attributes) {
      delete this.attributes[attributeName];
      this.version++;
    }
    return this;
  }

  /**
   * Compute (and cache in `boundingBox`) the axis-aligned box around every
   * vertex of the `position` attribute, indexed or not. Empty without
   * positions.
   */
  computeBoundingBox(): Box3 {
    const box = (this.boundingBox ?? new Box3()).makeEmpty();
    const position = this.attributes.position;
    if (position) {
      const hasZ = position.recordSize > 2;
      for (let i = 0; i < position.count; i++) {
        box.expandByCoordinates(
          position.getComponent(i, 0),
          position.getComponent(i, 1),
          hasZ ? position.getComponent(i, 2) : 0
        );
      }
    }
    this.boundingBox = box;
    return box;
  }

  /**
   * Compute (and cache in `boundingSphere`) a sphere around every vertex:
   * centred on the bounding box, with the radius of the farthest vertex
   * from that centre. Tighter than the sphere around the box, at the cost
   * of a second pass over the positions.
   */
  computeBoundingSphere(): Sphere {
    const sphere = (this.boundingSphere ?? new Sphere()).makeEmpty();
    const box = this.boundingBox ?? this.computeBoundingBox();
    const position = this.attributes.position;
    if (position && !box.isEmpty) {
      const center = box.getCenter();
      const hasZ = position.recordSize > 2;
      let maxDistanceSquared = 0;
      for (let i = 0; i < position.count; i++) {
        const dx = position.getComponent(i, 0) - center.x;
        const dy = position.getComponent(i, 1) - center.y;
        const dz = (hasZ ? position.getComponent(i, 2) : 0) - center.z;
        maxDistanceSquared = Math.max(
          maxDistanceSquared,
          dx * dx + dy * dy + dz * dz
        );
      }
      sphere.set(center, Math.sqrt(maxDistanceSquared));
    }
    this.boundingSphere = sphere;
    return sphere;
  }

  dispose(): void {
    for (const attribute of Object.keys(this.attributes)) {
      this.removeAttribute(attribute);
    }
  }
}
