export type BufferGroup = {
  startIndex: number;
  count: number;
};

export class BufferAttribute {
  /**
   * Set to true after writing into `data` (or replacing it) so the renderer
   * re-uploads the buffer on the next render. The renderer resets it to false.
   */
  needsUpdate = false;

  /** Hint for the renderer that `data` is going to change frequently */
  dynamic = false;

  constructor(
    public data: Float32Array,
    public recordSize: number
  ) {}

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
  index: number[] | null = null;
  indexType: 0 | 16 | 32 = 0;
  groups: BufferGroup[] = [];

  /** Incremented on every structural change (attributes added/removed, index set) */
  version = 0;

  setIndex(indices: ArrayLike<number>, bits: 16 | 32 = 16): BufferGeometry {
    this.index = Array.from(indices);
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
