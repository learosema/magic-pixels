import { Color } from './color';
describe('Color test', () => {
  test('fromHex', () => {
    const color = Color.fromHex('#123456');

    expect(color.red).toEqual(0x12);
    expect(color.green).toEqual(0x34);
    expect(color.blue).toEqual(0x56);
  });

  test('fromHex with alpha', () => {
    const color = Color.fromHex('#12345678');
    expect(color.red).toEqual(0x12);
    expect(color.green).toEqual(0x34);
    expect(color.blue).toEqual(0x56);
    expect(color.alpha).toEqual(0x78);
  });

  test('toVec3', () => {
    const color = new Color(255, 0, 255);
    const vec3 = color.toVec3();
    expect(vec3).toEqual([1, 0, 1]);
  });

  test('toVec4', () => {
    const color = new Color(255, 0, 255);
    const vec4 = color.toVec4();
    expect(vec4).toEqual([1, 0, 1, 1]);
  });
});
