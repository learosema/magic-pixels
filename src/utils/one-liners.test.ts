import { clamp, mix } from './one-liners';

describe('One liners tests', () => {
  test('mix', () => {
    expect(mix(1, 7, 0)).toBe(1);
    expect(mix(1, 7, 0.5)).toBe(4);
  });

  test('clamp', () => {
    expect(clamp(0, 1, 3)).toBe(1);
    expect(clamp(1, 1, 3)).toBe(1);
    expect(clamp(2, 1, 3)).toBe(2);
    expect(clamp(3, 1, 3)).toBe(3);
    expect(clamp(4, 1, 3)).toBe(3);
  });
});
