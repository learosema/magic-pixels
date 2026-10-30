import esbuild from 'esbuild';
import { glsl } from 'esbuild-plugin-glsl';

// The sub-path entry points import the core through `src/index.ts`; this
// leaves that import to the package's own name, so `magic-pixels/controls`
// uses the same classes as `magic-pixels` instead of a bundled copy.
const coreAsExternal = {
  name: 'core-as-external',
  setup(build) {
    build.onResolve({ filter: /^\.\.\/index$/ }, () => ({
      path: 'magic-pixels',
      external: true,
    }));
  },
};

Promise.all([
  esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    format: 'esm',
    minify: false,
    outdir: 'dist',
    plugins: [glsl({ minify: true })],
  }),
  esbuild.build({
    entryPoints: ['src/controls/index.ts'],
    bundle: true,
    format: 'esm',
    minify: false,
    outfile: 'dist/controls.js',
    plugins: [coreAsExternal],
  }),
  // Classic (non-module) worker scripts, both bundled the same way even
  // though only the Draco one strictly needs it (it importScripts() the
  // Draco decoder, which module workers cannot do; meshopt's is a real ES
  // module, loaded with a plain dynamic import() instead, which works in
  // a classic worker too).
  esbuild.build({
    entryPoints: ['src/loaders/gltf/draco-worker.ts'],
    bundle: true,
    format: 'iife',
    minify: false,
    outfile: 'dist/draco-worker.js',
  }),
  esbuild.build({
    entryPoints: ['src/loaders/gltf/meshopt-worker.ts'],
    bundle: true,
    format: 'iife',
    minify: false,
    outfile: 'dist/meshopt-worker.js',
  }),
]).catch(() => process.exit(1));
