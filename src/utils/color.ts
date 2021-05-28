export class Color {
  /**
   * Color constructor
   * @param red intensity of red (0..255)
   * @param green intensity of green (0..255)
   * @param blue intensity of blue (0..255)
   * @param alpha alpha value (0..255)
   */
  constructor(
    public red: number,
    public green: number,
    public blue: number,
    public alpha = 255
  ) {}

  static fromHex(color: string): Color {
    return new Color(
      parseInt(color.slice(1, 3), 16),
      parseInt(color.slice(3, 5), 16),
      parseInt(color.slice(5, 7), 16),
      color.length === 9 ? parseInt(color.slice(7, 9), 16) : 255
    );
  }

  toVec3(): number[] {
    const { red, green, blue } = this;
    return [red / 255, green / 255, blue / 255];
  }

  toVec4(): number[] {
    const { red, green, blue, alpha } = this;
    return [red / 255, green / 255, blue / 255, alpha / 255];
  }
}
