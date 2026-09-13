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
}

/**
 * minimal BufferGeometry class to provide an API similar to THREE.
 *
 * A geometry is plain data; the renderer creates and caches the GPU buffers
 * for it. Adding/removing attributes or changing the index bumps `version`,
 * which makes the renderer rebuild its buffers. To change the contents of an
 * existing attribute, write into `attribute.data` and set
 * `attribute.needsUpdate = true`.
 */
export class BufferGeometry {
  attributes: Record<string, BufferAttribute> = {};
  count = 0;
  index: Uint16Array | Uint32Array | null = null;
  indexType: 0 | 16 | 32 = 0;
  groups: BufferGroup[] = [];

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

  dispose(): void {
    for (const attribute of Object.keys(this.attributes)) {
      this.removeAttribute(attribute);
    }
  }
}
