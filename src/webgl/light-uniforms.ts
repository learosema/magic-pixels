import type { Camera } from '../scene/camera';
import {
  AmbientLight,
  DirectionalLight,
  PointLight,
  type Light,
} from '../scene/light';

/**
 * The lights of a frame, flattened into the arrays the built-in light
 * uniforms are uploaded from. Everything is in view space, so a shader can
 * combine it with the `vPosition` and `vNormal` the built-in vertex shader
 * produces, and every colour is premultiplied by the light's intensity.
 *
 * Directional lights are given by the direction they shine in (the node's
 * -Z axis), so the vector towards the light, `L` in the lighting
 * equations, is its negation.
 */
export type LightUniforms = {
  /** sum of all ambient lights, `vec3` */
  ambientLightColor: number[];
  /** direction each directional light shines in, `vec3` per light */
  directionalLightDirections: number[];
  /** colour × intensity, `vec3` per light */
  directionalLightColors: number[];
  directionalLightCount: number;
  /** position of each point light, `vec3` per light */
  pointLightPositions: number[];
  /** colour × intensity, `vec3` per light */
  pointLightColors: number[];
  /** cutoff distance per light, `0` for none, `float` per light */
  pointLightRanges: number[];
  pointLightCount: number;
};

export function createLightUniforms(): LightUniforms {
  return {
    ambientLightColor: [0, 0, 0],
    directionalLightDirections: [],
    directionalLightColors: [],
    directionalLightCount: 0,
    pointLightPositions: [],
    pointLightColors: [],
    pointLightRanges: [],
    pointLightCount: 0,
  };
}

/**
 * Fill `target` from the lights of a frame, transforming directions and
 * positions into the view space of `camera`. The world matrices must be up
 * to date (`prepareScene()` does that).
 */
export function collectLightUniforms(
  lights: Light[],
  camera: Camera,
  target: LightUniforms = createLightUniforms()
): LightUniforms {
  const ambient = target.ambientLightColor;
  ambient[0] = ambient[1] = ambient[2] = 0;
  target.directionalLightDirections.length = 0;
  target.directionalLightColors.length = 0;
  target.directionalLightCount = 0;
  target.pointLightPositions.length = 0;
  target.pointLightColors.length = 0;
  target.pointLightRanges.length = 0;
  target.pointLightCount = 0;

  const v = camera.viewMatrix.values;
  for (const light of lights) {
    const [r, g, b] = light.color.toVec3();
    const { intensity } = light;
    if (light instanceof AmbientLight) {
      ambient[0] += r * intensity;
      ambient[1] += g * intensity;
      ambient[2] += b * intensity;
    } else if (light instanceof DirectionalLight) {
      // the light shines along its local -Z axis, which in world space is
      // the negated third column of the world matrix; the view matrix
      // rotates it into view space (direction: no translation)
      const m = light.worldMatrix.values;
      const dx = -m[8];
      const dy = -m[9];
      const dz = -m[10];
      const x = v[0] * dx + v[4] * dy + v[8] * dz;
      const y = v[1] * dx + v[5] * dy + v[9] * dz;
      const z = v[2] * dx + v[6] * dy + v[10] * dz;
      const length = Math.hypot(x, y, z) || 1;
      target.directionalLightDirections.push(
        x / length,
        y / length,
        z / length
      );
      target.directionalLightColors.push(
        r * intensity,
        g * intensity,
        b * intensity
      );
      target.directionalLightCount++;
    } else if (light instanceof PointLight) {
      // the position is the translation column of the world matrix,
      // transformed as a point (with the view matrix's translation)
      const m = light.worldMatrix.values;
      const px = m[12];
      const py = m[13];
      const pz = m[14];
      target.pointLightPositions.push(
        v[0] * px + v[4] * py + v[8] * pz + v[12],
        v[1] * px + v[5] * py + v[9] * pz + v[13],
        v[2] * px + v[6] * py + v[10] * pz + v[14]
      );
      target.pointLightColors.push(r * intensity, g * intensity, b * intensity);
      target.pointLightRanges.push(light.range);
      target.pointLightCount++;
    }
  }
  return target;
}
