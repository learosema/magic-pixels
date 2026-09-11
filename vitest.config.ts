import { defineConfig, type Plugin } from 'vitest/config';

/** Load .vert/.frag files as plain strings, mirroring esbuild-plugin-glsl in the build */
function glsl(): Plugin {
  return {
    name: 'glsl',
    transform(code, id) {
      if (/\.(vert|frag|glsl)$/.test(id)) {
        return { code: `export default ${JSON.stringify(code)};`, map: null };
      }
    },
  };
}

export default defineConfig({
  plugins: [glsl()],
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
