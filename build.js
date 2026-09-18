import esbuild from 'esbuild';
import { glsl } from 'esbuild-plugin-glsl';

Promise.all([
  esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    format: 'esm',
    minify: false,
    outdir: 'dist',
    plugins: [glsl({ minify: true })],
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
