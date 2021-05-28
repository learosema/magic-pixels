export type BufferGroup = {
  startIndex: number;
  count: number;
};

export class BufferAttribute {
  constructor(public data: Float32Array, public recordSize: number) {}

  get count(): number {
    return this.data.length / this.recordSize;
  }
}

/**
 * minimal BufferGeometry class to provide an API similar to THREE
 */
export class BufferGeometry {
  attributes: Record<string, BufferAttribute> = {};
  count = 0;
  index: number[] | null = null;
  indexType: 0 | 16 | 32 = 0;
  groups: BufferGroup[] = [];

  setIndex(indices: ArrayLike<number>, bits: 16 | 32 = 16): BufferGeometry {
    this.index = Array.from(indices);
    this.indexType = bits;
    this.count = this.index.length;
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
    return this;
  }

  removeAttribute(attributeName: string): BufferGeometry {
    if (attributeName in this.attributes) {
      delete this.attributes[attributeName];
    }
    return this;
  }

  dispose(): void {
    for (const attribute of Object.keys(this.attributes)) {
      this.removeAttribute(attribute);
    }
  }
}
