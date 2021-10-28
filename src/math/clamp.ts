export const clamp = (x: number, minVal: number, maxVal: number): number =>
  Math.min(Math.max(x, minVal), maxVal);
