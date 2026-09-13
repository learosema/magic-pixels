import { GL_INTERNAL_FORMAT, glComponentType } from './gl-constants';

describe('glComponentType', () => {
  test('maps each typed array kind to its GL enum', () => {
    expect(glComponentType(new Int8Array())).toBe(0x1400); // BYTE
    expect(glComponentType(new Uint8Array())).toBe(0x1401); // UNSIGNED_BYTE
    expect(glComponentType(new Int16Array())).toBe(0x1402); // SHORT
    expect(glComponentType(new Uint16Array())).toBe(0x1403); // UNSIGNED_SHORT
    expect(glComponentType(new Int32Array())).toBe(0x1404); // INT
    expect(glComponentType(new Uint32Array())).toBe(0x1405); // UNSIGNED_INT
    expect(glComponentType(new Float32Array())).toBe(0x1406); // FLOAT
  });
});

describe('GL_INTERNAL_FORMAT', () => {
  test('maps color spaces to their sized internal format', () => {
    expect(GL_INTERNAL_FORMAT.linear).toBe(0x1908); // RGBA
    expect(GL_INTERNAL_FORMAT.srgb).toBe(0x8c43); // SRGB8_ALPHA8
  });
});
