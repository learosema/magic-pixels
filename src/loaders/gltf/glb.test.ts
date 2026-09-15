import { GLB_MAGIC, isGlb, parseGlb } from './glb';
import { buildGlb, triangle } from './fixtures';

describe('parseGlb', () => {
  test('splits a container into JSON and binary chunk', () => {
    const builder = triangle();
    const glb = parseGlb(builder.toGlb());
    expect(glb.json.asset.version).toBe('2.0');
    expect(glb.json.meshes?.[0].name).toBe('Triangle');
    expect(glb.bin).not.toBeNull();
    // the chunk is padded to a multiple of 4 bytes
    const { byteLength } = builder.bin;
    expect(glb.bin!.byteLength).toBe(Math.ceil(byteLength / 4) * 4);
    expect(Array.from(glb.bin!.subarray(0, byteLength))).toEqual(
      Array.from(builder.bin)
    );
  });

  test('the binary chunk is a view, not a copy', () => {
    const buffer = triangle().toGlb();
    const glb = parseGlb(buffer);
    expect(glb.bin!.buffer).toBe(buffer);
  });

  test('accepts a Uint8Array with a byte offset', () => {
    const glb = triangle().toGlb();
    const padded = new Uint8Array(glb.byteLength + 8);
    padded.set(new Uint8Array(glb), 8);
    const parsed = parseGlb(padded.subarray(8));
    expect(parsed.json.meshes?.[0].name).toBe('Triangle');
    const bin = triangle().bin;
    expect(Array.from(parsed.bin!.subarray(0, bin.byteLength))).toEqual(
      Array.from(bin)
    );
  });

  test('a container without a binary chunk', () => {
    const glb = parseGlb(buildGlb({ asset: { version: '2.0' } }, null));
    expect(glb.json.asset.version).toBe('2.0');
    expect(glb.bin).toBeNull();
  });

  test('rejects a bad magic and a wrong version', () => {
    expect(() => parseGlb(new ArrayBuffer(4))).toThrow(/magic/);
    const text = new TextEncoder().encode('{"asset":{"version":"2.0"}}');
    expect(() => parseGlb(text)).toThrow(/magic/);
    const glb = triangle().toGlb();
    new DataView(glb).setUint32(4, 1, true);
    expect(() => parseGlb(glb)).toThrow(/version 1/);
  });

  test('rejects a chunk that runs past the end', () => {
    const glb = triangle().toGlb();
    new DataView(glb).setUint32(12, 0xffffff, true);
    expect(() => parseGlb(glb)).toThrow(/exceeds/);
  });
});

describe('isGlb', () => {
  test('tells GLB bytes from JSON text', () => {
    expect(isGlb(triangle().toGlb())).toBe(true);
    expect(isGlb(new TextEncoder().encode('{}'))).toBe(false);
    expect(isGlb(new ArrayBuffer(2))).toBe(false);
    const bytes = new Uint8Array(12);
    new DataView(bytes.buffer).setUint32(0, GLB_MAGIC, true);
    expect(isGlb(bytes)).toBe(true);
  });
});
