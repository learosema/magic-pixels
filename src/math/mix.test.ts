import { mix } from './mix';

describe('mix tests', () => {
  test('mix', () => {
    expect(mix(1, 7, 0)).toBe(1);
    expect(mix(1, 7, 0.5)).toBe(4);
  });
});
