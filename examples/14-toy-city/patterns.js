/**
 * Generate a basic perlin noise pattern via SVG
 * @param {number} width the width
 * @param {number} height the height
 * @param {number|[number, number]} freq noise base frequency (1 or two values)
 * @param {[number, number, number]} color first color
 * @param {[number, number, number]} tint secondary color
 * @param {[number, number, number]} base base color (gets added on top of each)
 * @param {number} seed random seed
 * @param {number} octaves number of octaves
 * @param {number} fade 0 for an opaque pattern; 0..0.5 to fade out towards the
 *   left and right edge, over this fraction of the width on each side, with a
 *   ragged edge (for a strip texture: a road, a river bank)
 * @returns a data-url
 */
export const pattern = (
  width,
  height,
  freq,
  color = [1, 1, 1],
  tint = [0.1, 0.1, 0.1],
  base = [0, 0, 0],
  seed = 8,
  octaves = 2,
  fade = 0
) => {
  const [r, g, b] = color;
  const [tr, tg, tb] = tint;
  const [br, bg, bb] = base;
  // The alpha mask, when there is a fade. The rect is filled with a white
  // gradient that is transparent at the left and right edge and opaque in
  // between; the filter multiplies its alpha with a second noise, so the fade
  // is uneven instead of a clean ramp, and keeps the sand colour only where
  // the mask is opaque (`in`). At the very edge the gradient is 0, so it
  // stays 0 whatever the noise says.
  const gradient = fade
    ? `<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="0">
  <stop offset="0" stop-color="#fff" stop-opacity="0"/>
  <stop offset="${fade}" stop-color="#fff" stop-opacity="1"/>
  <stop offset="${1 - fade}" stop-color="#fff" stop-opacity="1"/>
  <stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </linearGradient></defs>`
    : '';
  const mask = fade
    ? `<feTurbulence type="fractalNoise" baseFrequency="0.06 0.03" seed="${seed + 1}" numOctaves="3" stitchTiles="stitch"/>
  <feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0" result="noise"/>
  <feComposite in="SourceGraphic" in2="noise" operator="arithmetic" k1="0.8" k2="0.7" k3="0" k4="0" result="mask"/>
  <feComposite in="sand" in2="mask" operator="in"/>`
    : '';
  return (
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${gradient}
  <filter id="a" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="${freq instanceof Array ? freq.join(' ') : freq}" seed="${seed}" numOctaves="${octaves}" stitchTiles="stitch"/>
  <feColorMatrix values="${tr} 0 0 ${r} ${br} ${tg} 0 0 ${g} ${bg} ${tb} 0 0 ${b} ${bb} 0 0 0 0 1" result="sand"/>
  ${mask}
  </filter>
  <rect width="${width}" height="${height}" ${fade ? 'fill="url(#g)"' : ''} filter="url(#a)"/></svg>`
        .split(/\n/)
        .map((l) => l.trim())
        .join('')
        .trim()
    )
  );
};

/**
 * Generate the normal map that goes with a noise pattern: the same noise
 * (give it the same `freq`, `seed` and `octaves`) read as a height field, so
 * the bumps of the normal map sit where the light and dark of the colour
 * pattern are. Made with SVG filters:
 *
 *  1. feTurbulence makes the noise; its alpha channel is the height, as grey.
 *  2. Two feConvolveMatrix filters with a Sobel kernel measure the slope, one
 *     along x and one along y. `edgeMode="wrap"` looks at the other side of the
 *     image at the edges, so the map tiles like the noise does.
 *  3. Two feColorMatrix filters pick the slope in x for red and the slope in y
 *     for green, and feComposite adds them into one image.
 *  4. feComponentTransfer stretches red and green around the neutral 0.5 by
 *     `strength` and sets blue to 1: the normal points mostly out of the
 *     surface, and tilts by the slope.
 *
 * A normal map holds directions, not colours: load it with
 * `colorSpace: 'linear'`, and the filter works in sRGB
 * (`color-interpolation-filters`) so that nothing is bent into linear light.
 * The convention is glTF's: red is +x (right), green is +y (up in the image),
 * blue is out of the surface.
 * @param {number} width the width
 * @param {number} height the height
 * @param {number|[number, number]} freq noise base frequency, as for `pattern`
 * @param {number} strength how steep the bumps are. 1 is about right for a
 *   frequency of 0.3 with 3 octaves and does not clip; the slope of noise grows
 *   with its frequency, so use less for a higher one. Values that are too
 *   large clip red and green at 0 and 255, which flattens the steepest bumps.
 * @param {number} seed random seed, as for `pattern`
 * @param {number} octaves number of octaves, as for `pattern`
 * @returns a data-url
 */
export const normalPattern = (
  width,
  height,
  freq,
  strength = 1,
  seed = 8,
  octaves = 2
) => {
  // stretching a channel by `strength` around 0.5
  const slope = strength;
  const intercept = 0.5 * (1 - strength);
  return (
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <filter id="n" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="${freq instanceof Array ? freq.join(' ') : freq}" seed="${seed}" numOctaves="${octaves}" stitchTiles="stitch"/>
  <feColorMatrix values="0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 1" result="height"/>
  <feConvolveMatrix in="height" order="3" kernelMatrix="-1 0 1 -2 0 2 -1 0 1" divisor="4" bias="0.5" edgeMode="wrap" preserveAlpha="true" result="slopeX"/>
  <feConvolveMatrix in="height" order="3" kernelMatrix="1 2 1 0 0 0 -1 -2 -1" divisor="4" bias="0.5" edgeMode="wrap" preserveAlpha="true" result="slopeY"/>
  <feColorMatrix in="slopeX" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1" result="red"/>
  <feColorMatrix in="slopeY" values="0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 1" result="green"/>
  <feComposite in="red" in2="green" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/>
  <feComponentTransfer>
  <feFuncR type="linear" slope="${slope}" intercept="${intercept}"/>
  <feFuncG type="linear" slope="${slope}" intercept="${intercept}"/>
  <feFuncB type="linear" slope="0" intercept="1"/>
  </feComponentTransfer>
  </filter>
  <rect width="${width}" height="${height}" filter="url(#n)"/></svg>`
        .split(/\n/)
        .map((l) => l.trim())
        .join('')
        .trim()
    )
  );
};

/*
function Im(dataurl) {
  const img = new Image();
  img.src = dataurl;
  return img
}

const width = 256
const height = 256
const darkgrey = [.1,.1,.1]
const grey = [.5, .5, .5]
const white = [1., 1., 1.]
const darkgreen = [.1, .2, .1]
const green = [0.04, 0.7, 0.3]
const orange = [.8, .4, .1];
const brown = [.2, .1, .1];
const lightyellow=[1., .8, .7]
const smurf = [.5, .6, 1.]
const blue = [0, 0, .8]
const darkblue = [0, 0, .2]

document.body.appendChild(Im(pattern(width, height, .25, grey)))
document.body.appendChild(Im(pattern(width, height, .25, white)))
document.body.appendChild(Im(pattern(width, height, 0.04, green, darkgreen, darkgrey)))
document.body.appendChild(Im(pattern(width, height, [.1, 0.01], orange, brown)))
document.body.appendChild(Im(pattern(width, height, [0.06, 0.07], lightyellow, grey, brown)))
document.body.appendChild(Im(pattern(256, 256, [.01, .05], smurf, blue, darkblue)))
*/
